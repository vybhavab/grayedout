import { useEffect, useRef, useState } from "react"

import "./style.css"

type BlockMode = "always" | "scheduled"
type BreakScope = "global" | "site"

type Settings = {
  blockedSites: string[]
  blockMode: BlockMode
  schedule: {
    enabled: boolean
    startTime: string
    endTime: string
    days: string[]
  }
  break: {
    active: boolean
    until: number
    scope: BreakScope
    site: string | null
  }
  enabled?: boolean
}

const defaultSettings: Settings = {
  blockedSites: [],
  blockMode: "always",
  schedule: {
    enabled: false,
    startTime: "09:00",
    endTime: "17:00",
    days: ["mon", "tue", "wed", "thu", "fri"]
  },
  break: { active: false, until: 0, scope: "global", site: null },
  enabled: true
}

function normalizeDomain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "")
}

export default function OptionsIndex() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [bulk, setBulk] = useState("")
  const [msg, setMsg] = useState<{
    text: string
    kind: "success" | "error" | ""
  }>({ text: "", kind: "" })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      const stored = await chrome.storage.sync.get("settings")
      if (stored.settings) {
        const s: Settings = {
          ...defaultSettings,
          ...stored.settings,
          schedule: {
            ...defaultSettings.schedule,
            ...(stored.settings.schedule ?? {})
          },
          break: {
            ...defaultSettings.break,
            ...(stored.settings.break ?? {})
          }
        }
        setSettings(s)
      }
    })()
  }, [])

  async function save(next: Settings) {
    setSettings(next)
    await chrome.storage.sync.set({ settings: next })
  }

  function show(text: string, kind: "success" | "error") {
    setMsg({ text, kind })
    setTimeout(() => setMsg({ text: "", kind: "" }), 2500)
  }

  function addBulk() {
    const sites = bulk
      .split("\n")
      .map(normalizeDomain)
      .filter((s) => s && !settings.blockedSites.includes(s))
    if (sites.length === 0) {
      show("No new valid sites to add", "error")
      return
    }
    save({ ...settings, blockedSites: [...settings.blockedSites, ...sites] })
    setBulk("")
    show(`Added ${sites.length} new site(s)`, "success")
  }

  function remove(idx: number) {
    const next = settings.blockedSites.slice()
    next.splice(idx, 1)
    save({ ...settings, blockedSites: next })
    show("Site removed successfully", "success")
  }

  function clearAll() {
    if (!confirm("Remove all blocked sites?")) return
    save({ ...settings, blockedSites: [] })
    show("All sites removed", "success")
  }

  function exportSites() {
    const blob = new Blob([settings.blockedSites.join("\n")], {
      type: "text/plain"
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "blocked-sites.txt"
    a.click()
    URL.revokeObjectURL(url)
    show("Sites list exported", "success")
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "grayed-out-settings.json"
    a.click()
    URL.revokeObjectURL(url)
    show("Settings exported", "success")
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      if (Array.isArray(imported.blockedSites)) {
        await save(imported)
        show("Settings imported successfully", "success")
      } else show("Invalid settings file", "error")
    } catch {
      show("Error importing settings", "error")
    }
    e.target.value = ""
  }

  return (
    <div className="flex flex-col items-center justify-center w-screen p-8 mx-auto">
      <div className="space-y-6 w-full max-w-4xl">
        <header>
          <h1 className="text-3xl font-bold">Grayed Out Options</h1>
          <p className="text-zinc-400">Advanced settings and site management</p>
        </header>

        {msg.text && (
          <div
            className={`border rounded-md px-3 py-2 text-sm ${msg.kind === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
            {msg.text}
          </div>
        )}
        {/* Global enable/disable */}
        <section className="space-y-3 border border-zinc-700/40 rounded-lg p-4 bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Global</h2>
            <label className="text-xs text-zinc-400 flex items-center gap-2">
              <span>Enabled</span>
              <button
                role="switch"
                aria-checked={settings.enabled !== false ? "true" : "false"}
                onClick={() =>
                  save({
                    ...settings,
                    enabled: settings.enabled === false ? true : false
                  })
                }
                className={
                  (settings.enabled !== false ? "bg-blue-600" : "bg-zinc-700") +
                  " relative inline-flex h-5 w-9 items-center rounded-full transition"
                }>
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
        </section>

        {/* Focus mode + Schedule */}
        <section className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Bulk Add Sites</h3>
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={`Enter sites to block (one per line)\n\nExamples:\nx.com\ninstagram.com\nyoutube.com\nreddit.com`}
                className="w-full h-40 rounded-md border border-zinc-700/40 bg-zinc-900/60 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"></textarea>
              <p className="text-xs text-zinc-400 mt-2">
                Enter domain names only, without https:// or www. Each site on a
                new line.
              </p>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-primary" onClick={addBulk}>
                  Add Sites
                </button>
                <button className="btn" onClick={() => setBulk("")}>
                  Clear
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">
                Currently Blocked Sites{" "}
                {settings.blockedSites.length > 0 &&
                  `(${settings.blockedSites.length})`}
              </h3>
              <div className="max-h-64 overflow-auto rounded-md border border-zinc-700/40 p-1 bg-zinc-900/40">
                {settings.blockedSites.length === 0 && (
                  <div className="text-center text-zinc-500 py-8">
                    No blocked sites yet
                  </div>
                )}
                {settings.blockedSites.map((site, i) => (
                  <div
                    key={site + String(i)}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border border-zinc-700/40 m-1">
                    <span className="font-medium text-sm">{site}</span>
                    <button
                      className="btn btn-danger px-2 py-1"
                      onClick={() => remove(i)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn" onClick={exportSites}>
                  Export List
                </button>
                <button className="btn" onClick={clearAll}>
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3 border border-zinc-700/40 rounded-lg p-4 bg-zinc-900/40">
          <h2 className="font-semibold ">Focus Mode</h2>
          <div className="seg">
            <label className="seg-item">
              <input
                type="radio"
                name="mode"
                checked={settings.blockMode === "always"}
                onChange={() =>
                  save({
                    ...settings,
                    blockMode: "always",
                    schedule: { ...settings.schedule, enabled: false }
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
                  save({
                    ...settings,
                    blockMode: "scheduled",
                    schedule: { ...settings.schedule, enabled: true }
                  })
                }
              />
              <span>Scheduled</span>
            </label>
          </div>

          {settings.blockMode === "scheduled" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Start</label>
                  <input
                    className="w-full rounded-md border border-zinc-700/50 bg-zinc-900/60 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"
                    type="time"
                    value={settings.schedule.startTime}
                    onChange={(e) =>
                      save({
                        ...settings,
                        schedule: {
                          ...settings.schedule,
                          startTime: e.target.value
                        }
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
                      save({
                        ...settings,
                        schedule: {
                          ...settings.schedule,
                          endTime: e.target.value
                        }
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Days</label>
                <div className="grid grid-cols-7 gap-1 mt-1">
                  {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(
                    (d) => (
                      <button
                        key={d}
                        onClick={() => {
                          const has = settings.schedule.days.includes(d)
                          const days = has
                            ? settings.schedule.days.filter((x) => x !== d)
                            : [...settings.schedule.days, d]
                          save({
                            ...settings,
                            schedule: { ...settings.schedule, days }
                          })
                        }}
                        className={
                          (settings.schedule.days.includes(d)
                            ? "bg-blue-500/20 border-blue-500/40 text-zinc-100"
                            : "bg-zinc-900/60 text-zinc-400 border-zinc-700/40") +
                          " text-xs py-1 rounded-md border"
                        }>
                        {d.slice(0, 3)}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6 border border-zinc-700/40 rounded-lg p-4 bg-zinc-900/40">
          <h2 className="font-semibold ">Import/Export Settings</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={exportSettings}>
              Export All Settings
            </button>
            <button
              className="btn btn-primary"
              onClick={() => fileRef.current?.click()}>
              Import Settings
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={onImportFile}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Export to backup or share. Import from a previously exported file.
          </p>
        </section>
      </div>
    </div>
  )
}
