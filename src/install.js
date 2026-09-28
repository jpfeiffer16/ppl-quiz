/**
 * PWA install affordance — beforeinstallprompt (Chromium) + light iOS Safari hint.
 * Dismissible; dismissal remembered briefly in localStorage. Hidden when already installed.
 */

const DISMISS_KEY = "ppl-quiz:install-dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let deferredPrompt = null;
let bannerEl = null;
let installBtn = null;
let dismissBtn = null;
let textEl = null;
let actionsEl = null;

function isStandalone() {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  // iOS Safari legacy
  if (typeof navigator.standalone === "boolean" && navigator.standalone) return true;
  return false;
}

function isIos() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore quota / private mode */
  }
}

async function hasInstalledRelatedApp() {
  if (!("getInstalledRelatedApps" in navigator)) return false;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

function hideBanner() {
  if (!bannerEl) return;
  bannerEl.hidden = true;
  bannerEl.dataset.mode = "";
}

function showBanner(mode) {
  if (!bannerEl || wasDismissedRecently()) return;
  bannerEl.dataset.mode = mode;
  bannerEl.hidden = false;

  if (mode === "prompt") {
    textEl.textContent =
      "Add to your home screen for one-tap access and offline practice.";
    installBtn.hidden = false;
    installBtn.disabled = false;
    installBtn.textContent = "Install app";
    actionsEl.hidden = false;
  } else if (mode === "ios") {
    textEl.innerHTML =
      "On iPhone/iPad: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.";
    installBtn.hidden = true;
    actionsEl.hidden = false;
  }
}

async function onInstallClick() {
  if (!deferredPrompt) return;
  installBtn.disabled = true;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice && choice.outcome === "accepted") {
      hideBanner();
    } else {
      // User dismissed the browser sheet — treat like a soft dismiss
      rememberDismiss();
      hideBanner();
    }
  } catch (err) {
    console.warn("Install prompt failed:", err);
    installBtn.disabled = false;
  }
}

function onDismissClick() {
  rememberDismiss();
  hideBanner();
}

/**
 * Wire install UI. Safe to call once at boot.
 */
export async function initInstallPrompt() {
  bannerEl = document.getElementById("install-banner");
  installBtn = document.getElementById("install-btn");
  dismissBtn = document.getElementById("install-dismiss");
  textEl = document.getElementById("install-banner-text");
  actionsEl = document.getElementById("install-banner-actions");

  if (!bannerEl || !installBtn || !dismissBtn || !textEl || !actionsEl) return;

  installBtn.addEventListener("click", onInstallClick);
  dismissBtn.addEventListener("click", onDismissClick);

  // Already running as an installed app
  if (isStandalone()) {
    hideBanner();
    return;
  }

  if (await hasInstalledRelatedApp()) {
    hideBanner();
    return;
  }

  if (wasDismissedRecently()) {
    hideBanner();
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showBanner("prompt");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    hideBanner();
  });

  // Re-check display-mode if the user installs mid-session (rare)
  const mm = window.matchMedia("(display-mode: standalone)");
  const onDisplayMode = () => {
    if (mm.matches) hideBanner();
  };
  if (typeof mm.addEventListener === "function") {
    mm.addEventListener("change", onDisplayMode);
  } else if (typeof mm.addListener === "function") {
    mm.addListener(onDisplayMode);
  }

  // iOS has no beforeinstallprompt — light Safari hint only
  if (isIos() && !isStandalone()) {
    showBanner("ios");
  }
}
