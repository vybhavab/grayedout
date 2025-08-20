let isBlocked = false;
let styleElement = null;

function normalizeDomain(url) {
  url = url.toLowerCase();
  url = url.replace(/^(https?:\/\/)?(www\.)?/, "");
  url = url.replace(/\/.*$/, "");
  return url;
}

function isInSchedule(schedule) {
  const now = new Date();
  const currentDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
    now.getDay()
  ];

  if (!schedule.days.includes(currentDay)) {
    return false;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMin] = schedule.startTime.split(":").map(Number);
  const [endHour, endMin] = schedule.endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (endMinutes < startMinutes) {
    return currentTime >= startMinutes || currentTime < endMinutes;
  } else {
    return currentTime >= startMinutes && currentTime < endMinutes;
  }
}

function applyGrayscale() {
  if (styleElement) return;

  styleElement = document.createElement("style");
  styleElement.id = "grayed-out-grayscale";
  styleElement.textContent = `
    html {
      filter: grayscale(100%) !important;
      -webkit-filter: grayscale(100%) !important;
    }
  `;

  if (document.head) {
    document.head.appendChild(styleElement);
  } else {
    document.documentElement.appendChild(styleElement);
  }

  isBlocked = true;
}

function removeGrayscale() {
  if (styleElement) {
    styleElement.remove();
    styleElement = null;
  }
  isBlocked = false;
}

async function checkBlockStatus() {
  try {
    const stored = await chrome.storage.sync.get("settings");
    const settings = stored.settings || {
      blockedSites: [],
      blockMode: "always",
      schedule: {
        enabled: false,
        startTime: "09:00",
        endTime: "17:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
      },
    };

    const currentDomain = normalizeDomain(window.location.href);
    const isBlockedSite = settings.blockedSites.some((site) =>
      currentDomain.includes(normalizeDomain(site)),
    );

    if (!isBlockedSite) {
      removeGrayscale();
      return;
    }

    if (settings.blockMode === "always") {
      applyGrayscale();
    } else if (settings.blockMode === "scheduled") {
      if (isInSchedule(settings.schedule)) {
        applyGrayscale();
      } else {
        removeGrayscale();
      }
    }
  } catch (error) {
    console.error("GrayedOut: Error checking block status:", error);
  }
}

checkBlockStatus();

chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === "updateBlockStatus") {
    checkBlockStatus();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkBlockStatus);
} else {
  checkBlockStatus();
}
