const DEFAULT_SETTINGS = {
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
    until: 0, // ms epoch
    scope: "global", // 'global' | 'site'
    site: null, // domain when scope is 'site'
  },
};

function getNextAlarmTime(timeStr, days) {
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
  const settings = stored.settings || DEFAULT_SETTINGS;

  if (settings.blockMode !== "scheduled") {
    // Still schedule break alarm if needed
    if (settings.break?.active && settings.break.until > Date.now()) {
      chrome.alarms.create("breakEnd", { when: settings.break.until });
    }
    return;
  }

  const { startTime, endTime, days } = settings.schedule;

  const nextStart = getNextAlarmTime(startTime, days);
  if (nextStart) {
    chrome.alarms.create("blockStart", { when: nextStart });
  }

  const nextEnd = getNextAlarmTime(endTime, days);
  if (nextEnd) {
    chrome.alarms.create("blockEnd", { when: nextEnd });
  }

  // Break alarm
  if (settings.break?.active && settings.break.until > Date.now()) {
    chrome.alarms.create("breakEnd", { when: settings.break.until });
  }
}

async function notifyAllTabs() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    chrome.tabs
      .sendMessage(tab.id, { action: "updateBlockStatus" })
      .catch(() => {});
  });
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
    const settings = stored.settings || DEFAULT_SETTINGS;
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
