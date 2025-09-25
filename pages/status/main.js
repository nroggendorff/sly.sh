const DEFAULT_TIMEOUT = 8000;

function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal, ...opts }).finally(() =>
    clearTimeout(id)
  );
}

async function checkStatus(url) {
  try {
    try {
      const r = await fetchWithTimeout(url, { method: "HEAD", mode: "cors" });
      if (r && (r.ok || r.type === "opaque")) return true;
    } catch (e) {
      try {
        const r2 = await fetchWithTimeout(url, {
          method: "GET",
          mode: "no-cors",
        });
        if (r2 && r2.type === "opaque") return true;
      } catch (_) {
        try {
          const r3 = await fetchWithTimeout(url, {
            method: "GET",
            mode: "cors",
          });
          if (r3 && (r3.ok || r3.type === "opaque")) return true;
        } catch (_) {}
      }
    }
  } catch (err) {}
  return false;
}

async function runChecks() {
  const components = Array.from(document.querySelectorAll(".component"));
  let allUp = true;

  const banner = document.getElementById("globalBanner");
  const bannerText = banner.querySelector(".banner-text");
  const bannerIconContainer = banner.querySelector(".icon");

  const svgWorking = `<svg class="pending-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;

  const svgDone = `<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

  const svgDown = `<svg class="down-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  banner.classList.remove("up", "down");
  banner.classList.add("pending");
  bannerIconContainer.innerHTML = svgWorking;
  bannerText.textContent = "Checking system statuses...";

  await new Promise((resolve) => requestAnimationFrame(resolve));

  const promises = components.map(async (comp) => {
    const url = comp.getAttribute("data-url");
    const badge = comp.querySelector(".status");

    try {
      const up = await checkStatus(url);
      if (up) {
        badge.textContent = "Operational";
        badge.className = "status up";
      } else {
        badge.textContent = "Down";
        badge.className = "status down";
        allUp = false;
      }
    } catch (err) {
      badge.textContent = "Down";
      badge.className = "status down";
      allUp = false;
    }
  });

  await Promise.all(promises);

  banner.classList.remove("pending");
  bannerIconContainer.innerHTML = svgDone;
  banner.classList.remove("pending");
  bannerIconContainer.innerHTML = svgDone;
  banner.classList.remove("pending");

  if (allUp) {
    bannerIconContainer.innerHTML = svgDone;
    banner.classList.add("up");
    bannerText.textContent = "All systems are operational.";
  } else {
    bannerIconContainer.innerHTML = svgDown;
    banner.classList.add("down");
    bannerText.textContent = "Some systems are experiencing issues.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  runChecks();
  setInterval(runChecks, 5 * 60 * 1000);
});
