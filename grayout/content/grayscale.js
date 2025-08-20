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
      transition: filter 0.5s ease-in-out;
    }

    body::before {
      content: "You've been grayed out";
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      animation: slideInOut 3.5s ease-out forwards;
      pointer-events: none;
    }

    @keyframes slideInOut {
      0% {
        transform: translateX(100%);
        opacity: 0;
      }
      10% {
        transform: translateX(0);
        opacity: 1;
      }
      85% {
        transform: translateX(0);
        opacity: 1;
      }
      100% {
        transform: translateX(100%);
        opacity: 0;
      }
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

let messageListener = null;
let domListener = null;

function setupListeners() {
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }

  messageListener = (request, _sender, _sendResponse) => {
    if (request.action === "updateBlockStatus") {
      checkBlockStatus();
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  if (document.readyState === "loading") {
    if (domListener) {
      document.removeEventListener("DOMContentLoaded", domListener);
    }
    domListener = checkBlockStatus;
    document.addEventListener("DOMContentLoaded", domListener, { once: true });
  } else {
    checkBlockStatus();
  }
}

setupListeners();
