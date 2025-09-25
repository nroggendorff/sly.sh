const DEFAULT_TIMEOUT = 8000;
const CHECK_INTERVAL = 5 * 60 * 1000;

function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    signal: controller.signal,
    ...options,
  }).finally(() => clearTimeout(timeoutId));
}

async function checkStatus(url) {
  const methods = [
    { method: "HEAD", mode: "cors" },
    { method: "GET", mode: "no-cors" },
    { method: "GET", mode: "cors" },
  ];

  for (const options of methods) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (response && (response.ok || response.type === "opaque")) {
        return true;
      }
    } catch (error) {
      continue;
    }
  }

  return false;
}

function updateBanner(status, message, subtitle) {
  const banner = document.getElementById("globalBanner");
  const icon = banner.querySelector(".status-icon");
  const title = banner.querySelector(".banner-title");
  const subtitleEl = banner.querySelector(".banner-subtitle");

  banner.className = `status-banner ${status}`;
  title.textContent = message;
  subtitleEl.textContent = subtitle;

  const icons = {
    pending: '<div class="spinner"></div>',
    up: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
    down: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
  };

  icon.innerHTML = icons[status];
}

async function runChecks() {
  const components = Array.from(document.querySelectorAll(".component"));
  let allOperational = true;
  let checkedCount = 0;

  updateBanner(
    "pending",
    "Running Diagnostics",
    "Checking all services and assets..."
  );

  const checkPromises = components.map(async (component) => {
    const url = component.getAttribute("data-url");
    const badge = component.querySelector(".status-badge");

    try {
      const isUp = await checkStatus(url);
      checkedCount++;

      if (isUp) {
        badge.textContent = "Operational";
        badge.className = "status-badge up";
      } else {
        badge.textContent = "Down";
        badge.className = "status-badge down";
        allOperational = false;
      }
    } catch (error) {
      badge.textContent = "Error";
      badge.className = "status-badge down";
      allOperational = false;
    }

    updateBanner(
      "pending",
      "Running Diagnostics",
      `Checked ${checkedCount}/${components.length} services...`
    );
  });

  await Promise.all(checkPromises);

  if (allOperational) {
    updateBanner(
      "up",
      "All Systems Operational",
      "Everything is running smoothly"
    );
  } else {
    updateBanner(
      "down",
      "Service Issues Detected",
      "Some services are experiencing problems"
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  runChecks();
  setInterval(runChecks, CHECK_INTERVAL);
});
