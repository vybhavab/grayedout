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
      content: "Grayout active";
      position: fixed;
      right: 18px;
      bottom: 18px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.72);
      color: #e5e7eb;
      border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 10px 30px rgba(2, 6, 23, 0.35);
      backdrop-filter: saturate(140%) blur(6px);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      letter-spacing: 0.2px;
      z-index: 2147483647;
      animation: grayout-chip-in 380ms ease-out, grayout-chip-out 420ms ease-in 3s forwards;
      pointer-events: none;
    }

    @keyframes grayout-chip-in {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes grayout-chip-out {
      to { transform: translateY(8px); opacity: 0; }
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
      break: { active: false, until: 0, scope: "global", site: null },
    };

    const currentDomain = normalizeDomain(window.location.href);
    const isBlockedSite = settings.blockedSites.some((site) =>
      currentDomain.includes(normalizeDomain(site)),
    );

    if (!isBlockedSite) {
      removeGrayscale();
      return;
    }

    // Honor active break
    if (settings.break?.active && settings.break.until > Date.now()) {
      if (
        settings.break.scope === "global" ||
        (settings.break.scope === "site" && settings.break.site && currentDomain.includes(normalizeDomain(settings.break.site)))
      ) {
        removeGrayscale();
        return;
      }
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
