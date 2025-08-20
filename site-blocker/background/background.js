const DEFAULT_SETTINGS = {
  blockedSites: [],
  blockMode: 'always',
  schedule: {
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri']
  }
};

function getNextAlarmTime(timeStr, days) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  
  // Find next occurrence
  for (let i = 0; i <= 7; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + i);
    checkDate.setHours(hours, minutes, 0, 0);
    
    const dayName = dayNames[checkDate.getDay()];
    
    // Check if this day is in our schedule and time hasn't passed
    if (days.includes(dayName) && checkDate > now) {
      return checkDate.getTime();
    }
  }
  
  return null;
}

async function scheduleAlarms() {
  // Clear existing schedule alarms
  await chrome.alarms.clear('blockStart');
  await chrome.alarms.clear('blockEnd');
  
  const stored = await chrome.storage.sync.get('settings');
  const settings = stored.settings || DEFAULT_SETTINGS;
  
  if (settings.blockMode !== 'scheduled') {
    return;
  }
  
  const { startTime, endTime, days } = settings.schedule;
  
  // Schedule next start time
  const nextStart = getNextAlarmTime(startTime, days);
  if (nextStart) {
    chrome.alarms.create('blockStart', { when: nextStart });
  }
  
  // Schedule next end time
  const nextEnd = getNextAlarmTime(endTime, days);
  if (nextEnd) {
    chrome.alarms.create('blockEnd', { when: nextEnd });
  }
}

async function notifyAllTabs() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'updateBlockStatus' }).catch(() => {});
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('settings');
  if (!stored.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
  
  await scheduleAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'blockStart' || alarm.name === 'blockEnd') {
    await notifyAllTabs();
    // Reschedule for next occurrence
    await scheduleAlarms();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { action: 'updateBlockStatus' }).catch(() => {});
  }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    await notifyAllTabs();
    // Reschedule alarms when settings change
    await scheduleAlarms();
  }
});