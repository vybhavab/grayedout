type BlockMode = "always" | "scheduled";

type Settings = {
	blockedSites: string[];
	blockMode: BlockMode;
	schedule: {
		enabled: boolean;
		startTime: string;
		endTime: string;
		days: string[];
	};
	break: {
		active: boolean;
		until: number;
		scope: "global" | "site";
		site: string | null;
	};
	enabled?: boolean;
};

console.log("[GrayedOut] background initializing");

const DEFAULT_SETTINGS: Settings = {
	blockedSites: [],
	blockMode: "always",
	schedule: {
		enabled: false,
		startTime: "09:00",
		endTime: "17:00",
		days: ["mon", "tue", "wed", "thu", "fri"],
	},
	break: {
		active: false,
		until: 0,
		scope: "global",
		site: null,
	},
	enabled: true,
};

function getNextAlarmTime(timeStr: string, days: string[]): number | null {
	const [hours, minutes] = timeStr.split(":").map(Number);
	const now = new Date();
	const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

	for (let i = 0; i <= 7; i++) {
		const checkDate = new Date(now);
		checkDate.setDate(checkDate.getDate() + i);
		checkDate.setHours(hours, minutes, 0, 0);
		const dayName = dayNames[checkDate.getDay()];
		if (days.includes(dayName) && checkDate > now) {
			return checkDate.getTime();
		}
	}
	return null;
}

async function scheduleAlarms() {
	await chrome.alarms.clear("blockStart");
	await chrome.alarms.clear("blockEnd");
	await chrome.alarms.clear("breakEnd");

	const stored = await chrome.storage.sync.get("settings");
	const settings: Settings = stored.settings || DEFAULT_SETTINGS;

	if (settings.enabled === false) {
		// When disabled, keep alarms cleared and do nothing.
		return;
	}

	if (settings.blockMode !== "scheduled") {
		if (settings.break?.active && settings.break.until > Date.now()) {
			chrome.alarms.create("breakEnd", { when: settings.break.until });
		}
		return;
	}

	const { startTime, endTime, days } = settings.schedule;
	const nextStart = getNextAlarmTime(startTime, days);
	if (nextStart) chrome.alarms.create("blockStart", { when: nextStart });
	const nextEnd = getNextAlarmTime(endTime, days);
	if (nextEnd) chrome.alarms.create("blockEnd", { when: nextEnd });

	if (settings.break?.active && settings.break.until > Date.now()) {
		chrome.alarms.create("breakEnd", { when: settings.break.until });
	}
}

async function notifyAllTabs() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.id) continue;
        const url = tab.url || "";
        if (!/^https?:/i.test(url)) continue; // skip chrome://, edge://, about:, etc.
        let delivered = false;
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "updateBlockStatus" });
            delivered = true;
        } catch {}
        if (!delivered) {
            try {
                // Ensure content script exists on already-open tabs
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["src/content/grayscale.ts"],
                });
                await chrome.tabs.sendMessage(tab.id, { action: "updateBlockStatus" });
            } catch {}
        }
    }
}

chrome.runtime.onInstalled.addListener(async () => {
	const stored = await chrome.storage.sync.get("settings");
	if (!stored.settings) {
		await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
	}
	await scheduleAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name === "blockStart" || alarm.name === "blockEnd") {
		await notifyAllTabs();
		await scheduleAlarms();
	}
	if (alarm.name === "breakEnd") {
		const stored = await chrome.storage.sync.get("settings");
		const settings: Settings = stored.settings || DEFAULT_SETTINGS;
		if (settings.break?.active && settings.break.until <= Date.now()) {
			settings.break.active = false;
			settings.break.until = 0;
			settings.break.site = null;
			await chrome.storage.sync.set({ settings });
		}
		await notifyAllTabs();
		await scheduleAlarms();
	}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete") {
		const url = tab?.url || "";
		if (!/^https?:/i.test(url)) return;
		chrome.tabs
			.sendMessage(tabId, { action: "updateBlockStatus" })
			.catch(() => {});
	}
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
	if (namespace === "sync" && changes.settings) {
		await notifyAllTabs();
		await scheduleAlarms();
	}
});
