(function () {
  "use strict";

  const KEY_IDENTITY = "mya_identity";
  const KEY_NOTIFY_DISMISSED = "mya_notify_dismissed";
  const POLL_MS = 6000;

  // After running `npx web-push generate-vapid-keys`, paste the PUBLIC key here.
  const VAPID_PUBLIC_KEY = "PASTE_YOUR_VAPID_PUBLIC_KEY_HERE";

  const root = document.getElementById("app");

  const state = {
    phase: "loading", // loading | onboarding | notify | app
    identity: localStorage.getItem(KEY_IDENTITY) || "",
    signals: [],
    sending: false,
    justSent: false,
    error: "",
    stars: makeStars(24),
    notifyBanner: null, // null | 'ios' | 'enable'
  };

  let pollTimer = null;

  function makeStars(count) {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: (Math.random() * 1.6 + 0.7).toFixed(2),
      delay: (Math.random() * 6).toFixed(2),
      dur: (3 + Math.random() * 3).toFixed(2),
    }));
  }

  function timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 45) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return `${Math.floor(day / 7)}w ago`;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // ---------------- API ----------------
  async function apiGetSignals() {
    const res = await fetch("/api/signals");
    if (!res.ok) throw new Error("Failed to load signals");
    const data = await res.json();
    return Array.isArray(data.signals) ? data.signals : [];
  }
  async function apiPostSignal(name) {
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to send signal");
    return res.json();
  }
  async function apiSubscribe(name, subscription) {
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subscription }),
    });
    if (!res.ok) throw new Error("Failed to save subscription");
    return res.json();
  }

  // ---------------- Push ----------------
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register("/service-worker.js");
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "NEW_SIGNAL") refreshSignals();
      });
      return reg;
    } catch (e) {
      console.error("Service worker registration failed", e);
      return null;
    }
  }

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return { ok: false, reason: "Push notifications aren't supported in this browser." };
    }
    if (VAPID_PUBLIC_KEY.indexOf("PASTE_YOUR") === 0) {
      return { ok: false, reason: "Notifications need a VAPID key — see the README." };
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return { ok: false, reason: "" };
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await apiSubscribe(state.identity, sub);
      return { ok: true };
    } catch (e) {
      console.error("enableNotifications failed", e);
      return { ok: false, reason: "Couldn't enable notifications — try again." };
    }
  }

  // ---------------- Signals / polling ----------------
  async function refreshSignals() {
    try {
      state.signals = await apiGetSignals();
      if (state.phase === "app") updateDynamicParts();
    } catch (e) {
      // transient network error — keep last known state
    }
  }
  function onVisible() {
    if (!document.hidden) refreshSignals();
  }
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(refreshSignals, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshSignals);
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", refreshSignals);
  }

  // ---------------- Flow / actions ----------------
  function goToNotifyOrApp() {
    const dismissed = localStorage.getItem(KEY_NOTIFY_DISMISSED) === "true";
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const permission = supported ? Notification.permission : "unsupported";

    if (isIOS() && !isStandalone()) {
      state.phase = dismissed ? "app" : "notify";
      state.notifyBanner = "ios";
    } else if (supported && permission === "default" && !dismissed) {
      state.phase = "notify";
      state.notifyBanner = "enable";
    } else {
      state.phase = "app";
      state.notifyBanner = supported && permission === "default" ? "enable" : null;
    }
    boot();
  }

  async function handleStart(name) {
    name = (name || "").trim();
    if (!name) return;
    state.identity = name;
    localStorage.setItem(KEY_IDENTITY, name);
    goToNotifyOrApp();
  }

  function handleDismissNotify() {
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    state.phase = "app";
    boot();
  }

  async function handleEnableNotifyFromOnboarding() {
    const result = await enableNotifications();
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    state.phase = "app";
    state.notifyBanner = result.ok ? null : "enable";
    state.error = result.ok ? "" : result.reason || "";
    boot();
  }

  async function handleEnableNotifyFromBanner() {
    const result = await enableNotifications();
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    state.notifyBanner = result.ok ? null : state.notifyBanner;
    state.error = result.ok ? "" : result.reason || "";
    renderBanner();
    updateDynamicParts();
  }

  function handleSwitch() {
    localStorage.removeItem(KEY_IDENTITY);
    localStorage.removeItem(KEY_NOTIFY_DISMISSED);
    state.identity = "";
    state.signals = [];
    state.notifyBanner = null;
    state.phase = "onboarding";
    boot();
  }

  async function handleSend() {
    if (state.sending || !state.identity) return;
    state.sending = true;
    state.error = "";
    const mine = { name: state.identity, ts: Date.now() };
    state.signals = [mine, ...state.signals].slice(0, 150);
    state.justSent = true;
    updateDynamicParts();
    spawnRipple();
    spawnParticles();
    setTimeout(() => {
      state.justSent = false;
      updateDynamicParts();
    }, 1800);

    try {
      await apiPostSignal(state.identity);
      await refreshSignals();
    } catch (e) {
      state.error = "That signal didn't send — check your connection and try again.";
    } finally {
      state.sending = false;
      updateDynamicParts();
    }
  }

  function spawnRipple() {
    const wrap = document.getElementById("orbWrap");
    if (!wrap) return;
    const ripple = document.createElement("span");
    ripple.className = "mya-ripple";
    wrap.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1150);
  }
  function spawnParticles() {
    const wrap = document.getElementById("orbWrap");
    if (!wrap) return;
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("span");
      p.className = "mya-particle";
      const x = Math.round((Math.random() - 0.5) * 90);
      p.style.setProperty("--x", `${x}px`);
      p.style.animationDelay = `${(Math.random() * 0.25).toFixed(2)}s`;
      p.style.animationDuration = `${(1.1 + Math.random() * 0.5).toFixed(2)}s`;
      wrap.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }

  // ---------------- Render ----------------
  function starsHtml() {
    return `<div class="mya-stars">${state.stars
      .map(
        (s) =>
          `<span class="mya-star" style="top:${s.top}%;left:${s.left}%;width:${s.size}px;height:${s.size}px;animation-delay:${s.delay}s;animation-duration:${s.dur}s;"></span>`
      )
      .join("")}</div>`;
  }

  function heartSvg(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
  }

  function render() {
    if (state.phase === "loading") {
      root.innerHTML = `<div class="mya-root--loading"><div class="mya-loading-orb"></div></div>`;
    } else if (state.phase === "onboarding") {
      renderOnboarding();
    } else if (state.phase === "notify") {
      renderNotify();
    } else {
      renderAppShell();
    }
  }

  function renderOnboarding() {
    root.innerHTML = `
      ${starsHtml()}
      <div class="mya-onboard">
        <p class="mya-eyebrow">Miss You</p>
        <p class="mya-script">the same sky, different windows</p>
        <h1 class="mya-h1">Who's tapping in?</h1>
        <input class="mya-input" id="nameInput" placeholder="Your name" maxlength="24" autocomplete="off" />
        <button class="mya-btn-start" id="startBtn" disabled>Start</button>
        ${state.error ? `<p class="mya-error">${escapeHtml(state.error)}</p>` : ""}
      </div>
    `;
    const input = document.getElementById("nameInput");
    const btn = document.getElementById("startBtn");
    input.addEventListener("input", () => {
      btn.disabled = !input.value.trim();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) handleStart(input.value);
    });
    btn.addEventListener("click", () => handleStart(input.value));
    input.focus();
  }

  function renderNotify() {
    const isIosCase = state.notifyBanner === "ios";
    root.innerHTML = `
      ${starsHtml()}
      <div class="mya-onboard">
        <div class="mya-bell">${isIosCase ? "🏠" : "🔔"}</div>
        <h1 class="mya-h1">${isIosCase ? "One more step" : "Get a nudge when they miss you"}</h1>
        ${
          isIosCase
            ? `<div class="mya-ios-steps">
                 On iPhone, notifications only work once this is added to your Home Screen.<br/><br/>
                 1. Tap the <b>Share</b> icon in Safari<br/>
                 2. Choose <b>Add to Home Screen</b><br/>
                 3. Open <b>Miss You</b> from your Home Screen icon
               </div>
               <button class="mya-btn-primary" id="notifyDismiss">Got it</button>`
            : `<p class="mya-sub">Turn on notifications so a signal reaches you even when the app is closed.</p>
               <button class="mya-btn-primary" id="notifyEnable">Enable notifications</button>
               <button class="mya-btn-ghost" id="notifyDismiss">Not now</button>`
        }
      </div>
    `;
    const dismissBtn = document.getElementById("notifyDismiss");
    if (dismissBtn) dismissBtn.addEventListener("click", handleDismissNotify);
    const enableBtn = document.getElementById("notifyEnable");
    if (enableBtn) enableBtn.addEventListener("click", handleEnableNotifyFromOnboarding);
  }

  function renderAppShell() {
    root.innerHTML = `
      ${starsHtml()}
      <div class="mya-app">
        <header class="mya-header">
          <span class="mya-hi">Hi, ${escapeHtml(state.identity)}</span>
          <button class="mya-switch" id="switchBtn">Not ${escapeHtml(state.identity)}? Switch</button>
        </header>

        <div id="bannerSlot"></div>

        <div class="mya-center">
          <div class="mya-orb-wrap" id="orbWrap">
            <button class="mya-orb" id="orbBtn" aria-label="Send I miss you">
              ${heartSvg("mya-heart")}
            </button>
          </div>
          <p class="mya-cta" id="ctaText">I miss you</p>
          <p class="mya-status" id="statusText"></p>
        </div>

        <section class="mya-feed">
          <p class="mya-feed-title">Signals</p>
          <div id="feedSlot"></div>
        </section>

        <p class="mya-footer" id="footerText"></p>
        <p class="mya-error" id="errorText"></p>
      </div>
    `;
    document.getElementById("switchBtn").addEventListener("click", handleSwitch);
    document.getElementById("orbBtn").addEventListener("click", handleSend);
    renderBanner();
    updateDynamicParts();
  }

  function renderBanner() {
    const slot = document.getElementById("bannerSlot");
    if (!slot) return;
    if (state.notifyBanner === "ios") {
      slot.innerHTML = `<div class="mya-banner"><span>Add to Home Screen to enable notifications.</span><button id="bannerAction">How</button></div>`;
    } else if (state.notifyBanner === "enable") {
      slot.innerHTML = `<div class="mya-banner"><span>Notifications are off.</span><button id="bannerAction">Enable</button><button class="mya-banner-dismiss" id="bannerDismiss">✕</button></div>`;
    } else {
      slot.innerHTML = "";
      return;
    }
    const actionBtn = document.getElementById("bannerAction");
    if (actionBtn) {
      actionBtn.addEventListener("click", () => {
        if (state.notifyBanner === "ios") {
          state.phase = "notify";
          boot();
        } else {
          handleEnableNotifyFromBanner();
        }
      });
    }
    const dismissBtn = document.getElementById("bannerDismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
        state.notifyBanner = null;
        renderBanner();
      });
    }
  }

  function updateDynamicParts() {
    const partner = state.signals.find((s) => s.name !== state.identity);
    const statusEl = document.getElementById("statusText");
    if (statusEl) {
      statusEl.innerHTML = partner
        ? `${escapeHtml(partner.name)} missed you <span class="mya-status-time">${timeAgo(partner.ts)}</span>`
        : "No signal yet — send the first one";
    }

    const feedSlot = document.getElementById("feedSlot");
    if (feedSlot) {
      const items = state.signals.slice(0, 14);
      feedSlot.innerHTML = items.length
        ? `<ul class="mya-feed-list">${items
            .map(
              (s) => `
        <li class="mya-feed-item ${s.name === state.identity ? "is-me" : "is-them"}">
          <span class="mya-dot"></span>
          <span class="mya-feed-name">${s.name === state.identity ? "You" : escapeHtml(s.name)}</span>
          <span class="mya-feed-time">${timeAgo(s.ts)}</span>
        </li>`
            )
            .join("")}</ul>`
        : `<p class="mya-empty">Nothing here yet. Tap the heart to send your first signal.</p>`;
    }

    const footerEl = document.getElementById("footerText");
    if (footerEl) {
      footerEl.textContent = state.signals.length
        ? `${state.signals.length} signal${state.signals.length === 1 ? "" : "s"} sent between you two`
        : "";
    }

    const ctaEl = document.getElementById("ctaText");
    if (ctaEl) ctaEl.textContent = state.justSent ? "Signal sent" : "I miss you";

    const errorEl = document.getElementById("errorText");
    if (errorEl) errorEl.textContent = state.error || "";

    const orbBtn = document.getElementById("orbBtn");
    if (orbBtn) orbBtn.classList.toggle("mya-orb--sending", state.sending);
  }

  // ---------------- Boot ----------------
  async function boot() {
    render();
    if (state.phase === "app") {
      await refreshSignals();
      startPolling();
    } else {
      stopPolling();
    }
  }

  registerServiceWorker();

  if (state.identity) {
    goToNotifyOrApp();
  } else {
    state.phase = "onboarding";
    boot();
  }
})();
