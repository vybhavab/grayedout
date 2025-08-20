let settings = {
  blockedSites: [],
  blockMode: "always",
  schedule: {
    enabled: false,
    startTime: "09:00",
    endTime: "17:00",
    days: ["mon", "tue", "wed", "thu", "fri"],
  },
};

async function loadSettings() {
  const stored = await chrome.storage.sync.get("settings");
  if (stored.settings) {
    settings = stored.settings;
  }
  updateUI();
}

function updateUI() {
  renderSitesList();
  updateStats();
}

function renderSitesList() {
  const sitesList = document.getElementById("sites-list");
  sitesList.innerHTML = "";

  if (settings.blockedSites.length === 0) {
    sitesList.innerHTML =
      '<div style="color: #999; text-align: center; padding: 40px;">No blocked sites yet</div>';
    return;
  }

  settings.blockedSites.forEach((site, index) => {
    const siteItem = document.createElement("div");
    siteItem.className = "site-item";
    siteItem.innerHTML = `
      <span>${site}</span>
      <button class="remove-btn" data-index="${index}">Remove</button>
    `;
    sitesList.appendChild(siteItem);
  });

  sitesList.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const index = parseInt(e.target.dataset.index);
      settings.blockedSites.splice(index, 1);
      await saveSettings();
      showMessage("Site removed successfully", "success");
    });
  });
}

function updateStats() {
  document.getElementById("total-sites").textContent =
    settings.blockedSites.length;
  document.getElementById("block-mode").textContent =
    settings.blockMode === "always" ? "Always" : "Scheduled";
  document.getElementById("schedule-days").textContent =
    settings.blockMode === "scheduled" ? settings.schedule.days.length : "N/A";
}

function normalizeDomain(url) {
  url = url.trim().toLowerCase();
  url = url.replace(/^(https?:\/\/)?(www\.)?/, "");
  url = url.replace(/\/.*$/, "");
  return url;
}

async function saveSettings() {
  await chrome.storage.sync.set({ settings });
  updateUI();
}

function showMessage(text, type) {
  const messageEl = document.getElementById("message");
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  setTimeout(() => {
    messageEl.className = "message";
  }, 3000);
}

document.getElementById("add-bulk").addEventListener("click", async () => {
  const textarea = document.getElementById("bulk-sites");
  const sites = textarea.value
    .split("\n")
    .map((site) => normalizeDomain(site))
    .filter((site) => site && !settings.blockedSites.includes(site));

  if (sites.length > 0) {
    settings.blockedSites.push(...sites);
    await saveSettings();
    textarea.value = "";
    showMessage(`Added ${sites.length} new site(s)`, "success");
  } else {
    showMessage("No new valid sites to add", "error");
  }
});

document.getElementById("clear-bulk").addEventListener("click", () => {
  document.getElementById("bulk-sites").value = "";
});

document.getElementById("clear-all").addEventListener("click", async () => {
  if (confirm("Are you sure you want to remove all blocked sites?")) {
    settings.blockedSites = [];
    await saveSettings();
    showMessage("All sites removed", "success");
  }
});

document.getElementById("export-sites").addEventListener("click", () => {
  const sitesText = settings.blockedSites.join("\n");
  const blob = new Blob([sitesText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blocked-sites.txt";
  a.click();
  URL.revokeObjectURL(url);
  showMessage("Sites list exported", "success");
});

document.getElementById("export-settings").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grayed-out-settings.json";
  a.click();
  URL.revokeObjectURL(url);
  showMessage("Settings exported", "success");
});

document.getElementById("import-settings").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (imported.blockedSites && Array.isArray(imported.blockedSites)) {
      settings = imported;
      await saveSettings();
      showMessage("Settings imported successfully", "success");
    } else {
      showMessage("Invalid settings file", "error");
    }
  } catch (error) {
    showMessage("Error importing settings", "error");
  }

  e.target.value = "";
});

loadSettings();
