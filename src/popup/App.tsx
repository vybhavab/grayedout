import React, { useEffect, useRef, useState } from "react";

type BlockMode = "always" | "scheduled";
type BreakScope = "global" | "site";

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
		scope: BreakScope;
		site: string | null;
	};
	enabled?: boolean;
};

const defaultSettings: Settings = {
	blockedSites: [],
	blockMode: "always",
	schedule: {
		enabled: false,
		startTime: "09:00",
		endTime: "17:00",
		days: ["mon", "tue", "wed", "thu", "fri"],
	},
	break: { active: false, until: 0, scope: "global", site: null },
	enabled: true,
};

function normalizeDomain(url: string): string {
	let u = url.trim().toLowerCase();
	u = u.replace(/^(https?:\/\/)?(www\.)?/, "");
	u = u.replace(/\/.*$/, "");
	return u;
}

function isValidDomain(domain: string): boolean {
	if (!domain || typeof domain !== "string") return false;
	const clean = domain
		.trim()
		.toLowerCase()
		.replace(/^(https?:\/\/)?(www\.)?/, "")
		.replace(/\/.*$/, "")
		.replace(/:\\d+$/, "");
	if (!clean) return false;
	const parts = clean.split(".");
	if (parts.length < 2) return false;
	return parts.every(
		(p) =>
			p.length > 0 &&
			p.length <= 63 &&
			/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(p),
	);
}

async function getCurrentTabDomain(): Promise<string | null> {
	try {
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		const tab = tabs[0];
		if (!tab || !tab.url) return null;
		return normalizeDomain(tab.url);
	} catch {
		return null;
	}
}

function formatRemaining(ms: number) {
	if (ms <= 0) return "ending now";
	const totalSec = Math.floor(ms / 1000);
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	if (m >= 1) return `${m}m ${s.toString().padStart(2, "0")}s left`;
	return `${s}s left`;
}

export function App() {
	const [settings, setSettings] = useState<Settings>(defaultSettings);
	const [siteLabel, setSiteLabel] = useState("This site");
	const [breakInput, setBreakInput] = useState<number>(15);
	const [newSite, setNewSite] = useState("");
	const [inputError, setInputError] = useState<string>("");
	const tickRef = useRef<number | null>(null);
	const saveDebounceRef = useRef<number | null>(null);

	useEffect(() => {
		(async () => {
			const stored = await chrome.storage.sync.get("settings");
			let s: Settings = stored.settings
				? {
						...defaultSettings,
						...stored.settings,
						schedule: {
							...defaultSettings.schedule,
							...(stored.settings.schedule ?? {}),
						},
						break: {
							...defaultSettings.break,
							...(stored.settings.break ?? {}),
						},
					}
				: defaultSettings;
			setSettings(s);
			try {
				const tabs = await chrome.tabs.query({
					active: true,
					currentWindow: true,
				});
				const tab = tabs[0];
				if (tab?.url) setSiteLabel(`This site (${normalizeDomain(tab.url)})`);
			} catch {}
		})();
	}, []);

	useEffect(() => {
		if (settings.break.active && settings.break.until > Date.now()) {
			if (tickRef.current == null) {
				tickRef.current = window.setInterval(() => {
					// trigger re-render by setting state noop
					setSettings((s) => ({ ...s }));
				}, 1000);
			}
		} else if (tickRef.current) {
			clearInterval(tickRef.current);
			tickRef.current = null;
		}
		return () => {
			if (tickRef.current) {
				clearInterval(tickRef.current);
				tickRef.current = null;
			}
		};
	}, [settings.break.active, settings.break.until]);

	async function saveSettings(next: Settings) {
		setSettings(next);
		await chrome.storage.sync.set({ settings: next });
		// Notify tabs if needed
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			if (tab.id) {
				try {
					await chrome.tabs.sendMessage(tab.id, {
						action: "updateBlockStatus",
					});
				} catch {}
			}
		}

		function saveSettingsDebounced(next: Settings, delay = 300) {
			setSettings(next);
			if (saveDebounceRef.current) {
				clearTimeout(saveDebounceRef.current);
			}
			saveDebounceRef.current = window.setTimeout(async () => {
				await chrome.storage.sync.set({ settings: next });
				const tabs = await chrome.tabs.query({});
				for (const tab of tabs) {
					if (tab.id) {
						try {
							await chrome.tabs.sendMessage(tab.id, {
								action: "updateBlockStatus",
							});
						} catch {}
					}
				}
				saveDebounceRef.current = null;
			}, delay);
		}
	}

	const scheduleVisible = settings.blockMode === "scheduled";
	const breakRemaining = Math.max(0, settings.break.until - Date.now());

	function onToggleDay(day: string) {
		const has = settings.schedule.days.includes(day);
		const days = has
			? settings.schedule.days.filter((d) => d !== day)
			: [...settings.schedule.days, day];
		saveSettingsDebounced({
			...settings,
			schedule: { ...settings.schedule, days },
		});
	}

	async function onStartBreak() {
		const mins = breakInput || 15;
		let scope: BreakScope = settings.break.scope;
		let site: string | null = null;
		if (scope === "site") {
			site = await getCurrentTabDomain();
			if (!site) scope = "global";
		}
		const until = Date.now() + mins * 60 * 1000;
		await saveSettings({
			...settings,
			break: { active: true, until, scope, site },
		});
	}

	async function onCancelBreak() {
		await saveSettings({
			...settings,
			break: { active: false, until: 0, scope: "global", site: null },
		});
	}

	function addSite() {
		const raw = newSite.trim();
		if (!raw || !isValidDomain(raw)) {
			setInputError("Invalid domain format");
			setTimeout(() => setInputError(""), 1800);
			return;
		}
		const site = normalizeDomain(raw);
		if (settings.blockedSites.includes(site)) {
			setInputError("Site already blocked");
			setTimeout(() => setInputError(""), 1500);
			return;
		}
		saveSettings({
			...settings,
			blockedSites: [...settings.blockedSites, site],
		});
		setNewSite("");
	}

	function removeSite(idx: number) {
		const copy = settings.blockedSites.slice();
		copy.splice(idx, 1);
		saveSettings({ ...settings, blockedSites: copy });
	}

	return (
		<div className="wrap">
			<header className="flex items-center justify-between gap-3 mb-3">
				<div className="flex items-center gap-2">
					<img
						src="/icons/icon-128.png"
						alt="GrayedOut"
						className="w-7 h-7 rounded-lg"
					/>
					<div>
						<h1 className="m-0 text-sm font-bold tracking-tight">GrayedOut</h1>
						<p className="m-0 text-[11px] text-zinc-400">
							Stay in flow. Color on break.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<label className="text-xs text-zinc-400 flex items-center gap-2">
						<span>Enabled</span>
						<button
							role="switch"
							aria-checked={settings.enabled !== false ? "true" : "false"}
							onClick={() =>
								saveSettings({
									...settings,
									enabled: settings.enabled === false ? true : false,
								})
							}
							className={
								(settings.enabled !== false ? "bg-blue-600" : "bg-zinc-700") +
								" relative inline-flex h-5 w-9 items-center rounded-full transition"
							}
						>
							<span
								className={
									(settings.enabled !== false
										? "translate-x-5"
										: "translate-x-1") +
									" inline-block h-4 w-4 transform rounded-full bg-white transition"
								}
							/>
						</button>
					</label>
				</div>
			</header>

			<section className="mb-3">
				<h2 className="section-title">Focus Mode</h2>
				<div className="seg">
					<label className="seg-item">
						<input
							type="radio"
							name="mode"
							checked={settings.blockMode === "always"}
							onChange={() =>
								saveSettings({
									...settings,
									blockMode: "always",
									schedule: { ...settings.schedule, enabled: false },
								})
							}
						/>
						<span>Always</span>
					</label>
					<label className="seg-item">
						<input
							type="radio"
							name="mode"
							checked={settings.blockMode === "scheduled"}
							onChange={() =>
								saveSettings({
									...settings,
									blockMode: "scheduled",
									schedule: { ...settings.schedule, enabled: true },
								})
							}
						/>
						<span>Scheduled</span>
					</label>
				</div>

				{scheduleVisible && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<div className="flex-1">
								<label className="text-xs text-zinc-400">Start</label>
								<input
									className="w-full rounded-md border border-zinc-700/50 bg-zinc-900/60 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"
									type="time"
									value={settings.schedule.startTime}
									onChange={(e) =>
										saveSettingsDebounced({
											...settings,
											schedule: {
												...settings.schedule,
												startTime: e.target.value,
											},
										})
									}
								/>
							</div>
							<div className="flex-1">
								<label className="text-xs text-zinc-400">End</label>
								<input
									className="w-full rounded-md border border-zinc-700/50 bg-zinc-900/60 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"
									type="time"
									value={settings.schedule.endTime}
									onChange={(e) =>
										saveSettingsDebounced({
											...settings,
											schedule: {
												...settings.schedule,
												endTime: e.target.value,
											},
										})
									}
								/>
							</div>
						</div>
						<div>
							<label className="text-xs text-zinc-400">Days</label>
							<div className="grid grid-cols-7 gap-1 mt-1">
								{["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => (
									<button
										key={d}
										onClick={() => onToggleDay(d)}
										className={
											(settings.schedule.days.includes(d)
												? "bg-blue-500/20 border-blue-500/40 text-zinc-100"
												: "bg-zinc-900/60 text-zinc-400 border-zinc-700/40") +
											" text-xs py-1 rounded-md border"
										}
									>
										{d.slice(0, 3)}
									</button>
								))}
							</div>
						</div>
					</div>
				)}
			</section>

			<section className="mb-3">
				<div className="flex items-center justify-between">
					<h2 className="section-title">Break</h2>
					{settings.break.active && settings.break.until > Date.now() && (
						<div className="chip">
							<span>
								{formatRemaining(breakRemaining).replace(" left", "")}
							</span>
						</div>
					)}
				</div>
				<p
					className="muted"
					style={{
						display:
							settings.break.active && settings.break.until > Date.now()
								? "block"
								: "none",
					}}
				>
					Break active{" "}
					{settings.break.scope === "global"
						? "everywhere"
						: settings.break.site
							? `on ${settings.break.site}`
							: ""}{" "}
					— {formatRemaining(breakRemaining)}
				</p>

				<div className="grid grid-cols-[auto_auto_1fr] items-center gap-2 mb-2">
					<label htmlFor="break-mins" className="text-xs text-zinc-400">
						Duration (min)
					</label>
					<span className="text-zinc-500">→</span>
					<input
						id="break-mins"
						type="number"
						min={1}
						max={120}
						step={1}
						value={breakInput}
						onChange={(e) => setBreakInput(parseInt(e.target.value || "0", 10))}
						className="w-full rounded-md border border-zinc-700/50 bg-zinc-900/60 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"
					/>
				</div>

				<div className="seg" role="group" aria-label="Break scope">
					<label className="seg-item">
						<input
							type="radio"
							name="break-scope"
							checked={settings.break.scope === "global"}
							onChange={() =>
								setSettings((s) => ({
									...s,
									break: { ...s.break, scope: "global" },
								}))
							}
						/>
						<span>Every Site</span>
					</label>
					<label className="seg-item">
						<input
							type="radio"
							name="break-scope"
							checked={settings.break.scope === "site"}
							onChange={() =>
								setSettings((s) => ({
									...s,
									break: { ...s.break, scope: "site" },
								}))
							}
						/>
						<span>{siteLabel}</span>
					</label>
				</div>

				<div className="flex justify-end gap-2 mt-2">
					{!settings.break.active && (
						<button className="btn" onClick={onStartBreak}>
							Start Break
						</button>
					)}
					{settings.break.active && (
						<button className="btn btn-danger" onClick={onCancelBreak}>
							Cancel Break
						</button>
					)}
				</div>
			</section>

			<section className="mb-3">
				<h2 className="section-title">Blocked Sites</h2>
				<div className="flex gap-2 mb-1">
					<input
						value={newSite}
						onChange={(e) => setNewSite(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addSite();
							}
						}}
						placeholder="example.com"
						className={
							"flex-1 rounded-md border px-3 py-2 outline-none bg-zinc-900/60 " +
							(inputError
								? "border-red-500/60 focus:ring-2 focus:ring-red-500/30"
								: "border-zinc-700/50 focus:ring-2 focus:ring-blue-500/30")
						}
					/>
					<button className="btn" onClick={addSite}>
						Add
					</button>
				</div>
				{inputError && (
					<div className="text-xs text-red-400 mb-2">{inputError}</div>
				)}
				<div className="max-h-40 overflow-auto rounded-md border border-zinc-700/40 p-1 bg-zinc-900/40">
					{settings.blockedSites.length === 0 && (
						<div className="text-center text-zinc-500 py-4 text-sm">
							No blocked sites yet
						</div>
					)}
					{settings.blockedSites.map((site, i) => (
						<div
							key={site + String(i)}
							className="flex items-center justify-between gap-2 p-2 rounded-md border border-zinc-700/40 m-1"
						>
							<span className="font-medium text-sm">{site}</span>
							<button
								className="btn btn-danger px-2 py-1"
								onClick={() => removeSite(i)}
							>
								Remove
							</button>
						</div>
					))}
				</div>
			</section>

			<footer className="flex justify-center mt-2">
				<a
					className="text-blue-400 font-semibold hover:underline"
					href="#"
					onClick={(e) => {
						e.preventDefault();
						chrome.runtime.openOptionsPage();
					}}
				>
					Open advanced options
				</a>
			</footer>
		</div>
	);
}
