let settings = {
  blockedSites: [],
  blockMode: 'always',
  schedule: {
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri']
  }
};

async function loadSettings() {
  const stored = await chrome.storage.sync.get('settings');
  if (stored.settings) {
    settings = stored.settings;
  }
  updateUI();
}

function updateUI() {
  document.getElementById('mode-always').checked = settings.blockMode === 'always';
  document.getElementById('mode-scheduled').checked = settings.blockMode === 'scheduled';
  
  const scheduleSection = document.getElementById('schedule-section');
  if (settings.blockMode === 'scheduled') {
    scheduleSection.classList.add('visible');
  } else {
    scheduleSection.classList.remove('visible');
  }
  
  document.getElementById('start-time').value = settings.schedule.startTime;
  document.getElementById('end-time').value = settings.schedule.endTime;
  
  document.querySelectorAll('.days input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = settings.schedule.days.includes(checkbox.value);
  });
  
  renderSitesList();
}

function renderSitesList() {
  const sitesList = document.getElementById('sites-list');
  sitesList.innerHTML = '';
  
  if (settings.blockedSites.length === 0) {
    sitesList.innerHTML = '<div style="color: #999; text-align: center; padding: 16px;">No blocked sites yet</div>';
    return;
  }
  
  settings.blockedSites.forEach((site, index) => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    siteItem.innerHTML = `
      <span>${site}</span>
      <button data-index="${index}">Remove</button>
    `;
    sitesList.appendChild(siteItem);
  });
  
  sitesList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      settings.blockedSites.splice(index, 1);
      renderSitesList();
      saveSettings();
    });
  });
}

function normalizeDomain(url) {
  url = url.trim().toLowerCase();
  url = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  url = url.replace(/\/.*$/, '');
  return url;
}

async function saveSettings() {
  await chrome.storage.sync.set({ settings });
  
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    if (shouldBlockSite(tab.url)) {
      chrome.tabs.sendMessage(tab.id, { action: 'updateBlockStatus' }).catch(() => {});
    }
  });
}

function shouldBlockSite(url) {
  if (!url) return false;
  const domain = normalizeDomain(url);
  return settings.blockedSites.some(site => domain.includes(normalizeDomain(site)));
}

document.getElementById('add-site').addEventListener('click', () => {
  const input = document.getElementById('site-input');
  const site = normalizeDomain(input.value);
  
  if (site && !settings.blockedSites.includes(site)) {
    settings.blockedSites.push(site);
    input.value = '';
    renderSitesList();
    saveSettings();
  }
});

document.getElementById('site-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('add-site').click();
  }
});

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    settings.blockMode = e.target.value;
    settings.schedule.enabled = (e.target.value === 'scheduled');
    updateUI();
    saveSettings();
  });
});

document.getElementById('start-time').addEventListener('change', (e) => {
  settings.schedule.startTime = e.target.value;
  saveSettings();
});

document.getElementById('end-time').addEventListener('change', (e) => {
  settings.schedule.endTime = e.target.value;
  saveSettings();
});

document.querySelectorAll('.days input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    settings.schedule.days = Array.from(
      document.querySelectorAll('.days input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    saveSettings();
  });
});

document.getElementById('save-btn').addEventListener('click', () => {
  saveSettings();
  window.close();
});

document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

loadSettings();