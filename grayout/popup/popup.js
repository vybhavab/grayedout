let settings = {
  blockedSites: [],
  blockMode: 'always',
  schedule: {
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri']
  },
  break: {
    active: false,
    until: 0,
    scope: 'global',
    site: null
  }
};

let breakTimerId = null;

async function loadSettings() {
  const stored = await chrome.storage.sync.get('settings');
  if (stored.settings) {
    settings = stored.settings;
  }
  // Update site label subtitle if possible
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.url) {
      const d = normalizeDomain(tab.url);
      const labelSpan = document.querySelector('#break-site-label span');
      if (labelSpan) labelSpan.textContent = `This site (${d})`;
    }
  } catch {}
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
  updateBreakUI();
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

function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  
  domain = domain.trim().toLowerCase();
  
  const cleanDomain = domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  
  if (!cleanDomain) return false;
  
  const parts = cleanDomain.split('.');
  if (parts.length < 2) return false;
  
  return parts.every(part => 
    part.length > 0 && 
    part.length <= 63 && 
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(part)
  );
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

async function getCurrentTabDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return null;
    return normalizeDomain(tab.url);
  } catch {
    return null;
  }
}

function formatRemaining(ms) {
  if (ms <= 0) return 'ending now';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 1) return `${m}m ${s.toString().padStart(2, '0')}s left`;
  return `${s}s left`;
}

function updateBreakUI() {
  const statusEl = document.getElementById('break-status');
  const cancelBtn = document.getElementById('cancel-break');
  const startBtn = document.getElementById('start-break');
  const scopeGlobal = document.getElementById('break-global');
  const scopeSite = document.getElementById('break-site');
  const chip = document.getElementById('break-chip');
  const chipText = document.getElementById('break-chip-text');

  if (settings.break?.active && settings.break.until > Date.now()) {
    const remaining = settings.break.until - Date.now();
    const scopeText = settings.break.scope === 'global' ? 'everywhere' : `on ${settings.break.site}`;
    statusEl.textContent = `Break active ${scopeText} — ${formatRemaining(remaining)}`;
    statusEl.style.display = 'block';
    cancelBtn.style.display = 'inline-block';
    startBtn.disabled = true;
    scopeGlobal.disabled = true;
    scopeSite.disabled = true;

    // Show/update chip
    if (chip && chipText) {
      chip.style.display = 'inline-flex';
      chipText.textContent = formatRemaining(remaining).replace(' left','');
    }

    // Start ticking
    if (!breakTimerId) {
      breakTimerId = setInterval(() => {
        const now = Date.now();
        const remain = settings.break.until - now;
        if (remain <= 0) {
          clearInterval(breakTimerId);
          breakTimerId = null;
          // Clear local state and persist; background alarm also handles this
          settings.break = { active: false, until: 0, scope: 'global', site: null };
          saveSettings();
          updateBreakUI();
          return;
        }
        if (chipText) chipText.textContent = formatRemaining(remain).replace(' left','');
        statusEl.textContent = `Break active ${scopeText} — ${formatRemaining(remain)}`;
      }, 1000);
    }
  } else {
    statusEl.style.display = 'none';
    cancelBtn.style.display = 'none';
    startBtn.disabled = false;
    scopeGlobal.disabled = false;
    scopeSite.disabled = false;
    if (chip) chip.style.display = 'none';
    if (breakTimerId) {
      clearInterval(breakTimerId);
      breakTimerId = null;
    }
  }
}

document.getElementById('add-site').addEventListener('click', () => {
  const input = document.getElementById('site-input');
  const rawInput = input.value.trim();
  
  if (!rawInput) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 2000);
    return;
  }
  
  if (!isValidDomain(rawInput)) {
    input.classList.add('error');
    input.placeholder = 'Invalid domain format';
    setTimeout(() => {
      input.classList.remove('error');
      input.placeholder = 'example.com';
    }, 2000);
    return;
  }
  
  const site = normalizeDomain(rawInput);
  
  if (settings.blockedSites.includes(site)) {
    input.classList.add('error');
    input.value = '';
    input.placeholder = 'Site already blocked';
    setTimeout(() => {
      input.classList.remove('error');
      input.placeholder = 'example.com';
    }, 2000);
    return;
  }
  
  settings.blockedSites.push(site);
  input.value = '';
  input.classList.add('success');
  setTimeout(() => input.classList.remove('success'), 500);
  renderSitesList();
  saveSettings();
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

// Break controls
document.getElementById('start-break').addEventListener('click', async () => {
  const mins = parseInt(document.getElementById('break-mins').value, 10) || 15;
  const scope = document.querySelector('input[name="break-scope"]:checked')?.value || 'global';
  const now = Date.now();
  const until = now + mins * 60 * 1000;
  let site = null;
  if (scope === 'site') {
    site = await getCurrentTabDomain();
    if (!site) {
      // Fall back to global if current domain cannot be read
      settings.break.scope = 'global';
    }
  }
  settings.break = { active: true, until, scope, site };
  await saveSettings();
  updateBreakUI();
});

document.getElementById('cancel-break').addEventListener('click', async () => {
  settings.break = { active: false, until: 0, scope: 'global', site: null };
  await saveSettings();
  updateBreakUI();
});
