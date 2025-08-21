import React, { useEffect, useRef, useState } from "react";

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
};

function normalizeDomain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "");
}

export function App() {
  const [settings, setSettings] = useState<Settings>({
    blockedSites: [],
    blockMode: "always",
    schedule: {
      enabled: false,
      startTime: "09:00",
      endTime: "17:00",
      days: ["mon", "tue", "wed", "thu", "fri"],
    },
  });
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState<{
    text: string;
    kind: "success" | "error" | "";
  }>({ text: "", kind: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const stored = await chrome.storage.sync.get("settings");
      if (stored.settings) setSettings(stored.settings);
    })();
  }, []);

  async function save(next: Settings) {
    setSettings(next);
    await chrome.storage.sync.set({ settings: next });
  }

  function show(text: string, kind: "success" | "error") {
    setMsg({ text, kind });
    setTimeout(() => setMsg({ text: "", kind: "" }), 2500);
  }

  function addBulk() {
    const sites = bulk
      .split("\n")
      .map(normalizeDomain)
      .filter((s) => s && !settings.blockedSites.includes(s));
    if (sites.length === 0) {
      show("No new valid sites to add", "error");
      return;
    }
    save({ ...settings, blockedSites: [...settings.blockedSites, ...sites] });
    setBulk("");
    show(`Added ${sites.length} new site(s)`, "success");
  }

  function remove(idx: number) {
    const next = settings.blockedSites.slice();
    next.splice(idx, 1);
    save({ ...settings, blockedSites: next });
    show("Site removed successfully", "success");
  }

  function clearAll() {
    if (!confirm("Remove all blocked sites?")) return;
    save({ ...settings, blockedSites: [] });
    show("All sites removed", "success");
  }

  function exportSites() {
    const blob = new Blob([settings.blockedSites.join("\n")], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blocked-sites.txt";
    a.click();
    URL.revokeObjectURL(url);
    show("Sites list exported", "success");
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grayed-out-settings.json";
    a.click();
    URL.revokeObjectURL(url);
    show("Settings exported", "success");
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (Array.isArray(imported.blockedSites)) {
        await save(imported);
        show("Settings imported successfully", "success");
      } else show("Invalid settings file", "error");
    } catch {
      show("Error importing settings", "error");
    }
    e.target.value = "";
  }

  return (
    <div className="wrap max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">GrayedOut Options</h1>
        <p className="text-zinc-400">Advanced settings and site management</p>
      </header>

      {msg.text && (
        <div
          className={`mb-4 border rounded-md px-3 py-2 text-sm ${msg.kind === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}
        >
          {msg.text}
        </div>
      )}

      <section className="mb-6 border border-zinc-700/40 rounded-lg p-4 bg-zinc-900/40">
        <h2 className="font-semibold mb-3">Blocked Sites Management</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2 text-sm">Bulk Add Sites</h3>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={`Enter sites to block (one per line)\n\nExamples:\nx.com\ninstagram.com\nyoutube.com\nreddit.com`}
              className="w-full h-40 rounded-md border border-zinc-700/40 bg-zinc-900/60 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"
            ></textarea>
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
            <h3 className="font-semibold mb-2 text-sm">
              Currently Blocked Sites
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
                  className="flex items-center justify-between gap-2 p-2 rounded-md border border-zinc-700/40 m-1"
                >
                  <span className="font-medium text-sm">{site}</span>
                  <button
                    className="btn btn-danger px-2 py-1"
                    onClick={() => remove(i)}
                  >
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

      <section className="mb-6 border border-zinc-700/40 rounded-lg p-4 bg-zinc-900/40">
        <h2 className="font-semibold mb-3">Statistics & Overview</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-md border border-zinc-700/40 p-3 bg-zinc-900/60">
            <div className="text-blue-400 text-xl font-bold">
              {settings.blockedSites.length}
            </div>
            <div className="text-zinc-400 text-xs">Blocked Sites</div>
          </div>
          <div className="rounded-md border border-zinc-700/40 p-3 bg-zinc-900/60">
            <div className="text-blue-400 text-xl font-bold">
              {settings.blockMode === "always" ? "Always" : "Scheduled"}
            </div>
            <div className="text-zinc-400 text-xs">Block Mode</div>
          </div>
          <div className="rounded-md border border-zinc-700/40 p-3 bg-zinc-900/60">
            <div className="text-blue-400 text-xl font-bold">
              {settings.blockMode === "scheduled"
                ? settings.schedule.days.length
                : "N/A"}
            </div>
            <div className="text-zinc-400 text-xs">Scheduled Days</div>
          </div>
        </div>
      </section>

      <section className="mb-6 border border-zinc-700/40 rounded-lg p-4 bg-zinc-900/40">
        <h2 className="font-semibold mb-3">Import/Export Settings</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={exportSettings}>
            Export All Settings
          </button>
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
          >
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
  );
}
