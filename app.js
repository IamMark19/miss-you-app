import { api } from "./api.js";

const KEY_PAIR_ID = "mya_pair_id";
const KEY_IDENTITY = "mya_identity";
const KEY_AVATAR = "mya_avatar";
const KEY_NOTIFY_DISMISSED = "mya_notify_dismissed";
const POLL_MS = 6000;

// After running `npx web-push generate-vapid-keys`, paste the PUBLIC key here.
const VAPID_PUBLIC_KEY = "PASTE_YOUR_VAPID_PUBLIC_KEY_HERE";

const root = document.getElementById("app");

const state = {
  phase: "loading", // loading | welcome | join-pair | pair-created | profile-setup | notify | app
  pairId: localStorage.getItem(KEY_PAIR_ID) || null,
  pairCode: "",
  identity: localStorage.getItem(KEY_IDENTITY) || "",
  avatar: localStorage.getItem(KEY_AVATAR) || null,
  partner: null, // { name, avatar } | null
  activeTab: "signals", // signals | chat
  signals: [],
  messages: [],
  sendingMiss: false,
  sendingKiss: false,
  justSent: null, // null | 'miss' | 'kiss'
  chatSending: false,
  error: "",
  joinError: "",
  stars: makeStars(24),
  notifyBanner: null, // null | 'ios' | 'enable'
  pendingAvatar: null, // data URL staged during profile setup, before save
};

let pollTimer = null;

// ---------------- helpers ----------------
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
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function vibrateIfSupported(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // ignore — vibration is a nice-to-have, never worth breaking on
    }
  }
}
function avatarHtml(name, url, size) {
  if (url) {
    return `<img class="mya-avatar" style="width:${size}px;height:${size}px" src="${url}" alt="${escapeHtml(name || "")}" />`;
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return `<span class="mya-avatar mya-avatar--placeholder" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${escapeHtml(initial)}</span>`;
}

function fileToCompressedDataUrl(file, maxSize = 240, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------------- push / service worker ----------------
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
      const type = event.data && event.data.type;
      if (type === "NEW_SIGNAL") {
        vibrateIfSupported([100, 50, 100]);
        refreshSignals();
      } else if (type === "NEW_MESSAGE") {
        vibrateIfSupported([60, 40, 60, 40, 60]);
        refreshMessages();
      }
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
    await api.subscribePush(state.pairId, state.identity, sub);
    return { ok: true };
  } catch (e) {
    console.error("enableNotifications failed", e);
    return { ok: false, reason: "Couldn't enable notifications — try again." };
  }
}

// ---------------- data refresh / polling ----------------
async function refreshSignals() {
  try {
    const data = await api.fetchSignals(state.pairId);
    state.signals = data.signals || [];
    if (state.phase === "app" && state.activeTab === "signals") updateSignalsDynamic();
  } catch (e) {
    // transient — keep last known state
  }
}
async function refreshMessages() {
  try {
    const data = await api.fetchMessages(state.pairId);
    state.messages = data.messages || [];
    if (state.phase === "app" && state.activeTab === "chat") updateChatDynamic();
  } catch (e) {
    // transient
  }
}
async function refreshProfiles() {
  try {
    const data = await api.fetchProfiles(state.pairId);
    const mine = (data.profiles || []).find((p) => p.name === state.identity);
    const other = (data.profiles || []).find((p) => p.name !== state.identity);
    state.partner = other || null;
    if (mine && mine.avatar && mine.avatar !== state.avatar) {
      state.avatar = mine.avatar;
      localStorage.setItem(KEY_AVATAR, mine.avatar);
    }
    if (state.phase === "app") {
      updateHeaderDynamic();
      if (state.activeTab === "signals") updateSignalsDynamic();
      if (state.activeTab === "chat") updateChatDynamic();
    }
  } catch (e) {
    // transient
  }
}
async function pollTick() {
  await Promise.all([refreshSignals(), refreshMessages(), refreshProfiles()]);
}
function onVisible() {
  if (!document.hidden) pollTick();
}
function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollTick, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", pollTick);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("focus", pollTick);
}

// ---------------- flow / actions ----------------
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

async function handleCreatePair() {
  state.error = "";
  try {
    const result = await api.createPair();
    state.pairId = result.pairId;
    state.pairCode = result.code;
    localStorage.setItem(KEY_PAIR_ID, String(result.pairId));
    state.phase = "pair-created";
    render();
  } catch (e) {
    state.error = "Couldn't start a pair — check your connection and try again.";
    render();
  }
}

async function handleJoinPair(code) {
  const clean = (code || "").trim();
  if (!clean) return;
  state.joinError = "";
  try {
    const result = await api.lookupPair(clean);
    state.pairId = result.pairId;
    localStorage.setItem(KEY_PAIR_ID, String(result.pairId));
    state.phase = "profile-setup";
    render();
  } catch (e) {
    state.joinError = e.status === 404 ? "That code wasn't found — check it and try again." : "Something went wrong — try again.";
    render();
  }
}

async function handleAvatarFile(file) {
  if (!file) return;
  try {
    state.pendingAvatar = await fileToCompressedDataUrl(file);
    updateAvatarPreview();
  } catch (e) {
    console.error("avatar processing failed", e);
  }
}

async function handleProfileSubmit(name) {
  const clean = (name || "").trim();
  if (!clean) return;
  state.error = "";
  try {
    await api.saveProfile(state.pairId, clean, state.pendingAvatar || null);
    state.identity = clean;
    state.avatar = state.pendingAvatar || null;
    localStorage.setItem(KEY_IDENTITY, clean);
    if (state.avatar) localStorage.setItem(KEY_AVATAR, state.avatar);
    goToNotifyOrApp();
  } catch (e) {
    state.error = "Couldn't save your profile — check your connection and try again.";
    render();
  }
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
  updateSignalsDynamic();
}

function handleSwitch() {
  localStorage.removeItem(KEY_IDENTITY);
  localStorage.removeItem(KEY_AVATAR);
  state.identity = "";
  state.avatar = null;
  state.pendingAvatar = null;
  state.phase = "profile-setup";
  stopPolling();
  render();
}

async function handleSend(kind) {
  const sendingKey = kind === "kiss" ? "sendingKiss" : "sendingMiss";
  if (state[sendingKey]) return;
  state[sendingKey] = true;
  state.error = "";
  const mine = { name: state.identity, kind, ts: Date.now() };
  state.signals = [mine, ...state.signals].slice(0, 150);
  state.justSent = kind;
  updateSignalsDynamic();
  vibrateIfSupported([40]);
  spawnTapEffect(kind);
  setTimeout(() => {
    state.justSent = null;
    updateSignalsDynamic();
  }, 1800);

  try {
    await api.postSignal(state.pairId, state.identity, kind);
    await refreshSignals();
  } catch (e) {
    state.error = "That signal didn't send — check your connection and try again.";
  } finally {
    state[sendingKey] = false;
    updateSignalsDynamic();
  }
}

async function handleSendMessage(text) {
  const clean = (text || "").trim();
  if (!clean || state.chatSending) return;
  state.chatSending = true;
  const input = document.getElementById("chatInput");
  if (input) input.value = "";
  const mine = { name: state.identity, text: clean, ts: Date.now() };
  state.messages = [...state.messages, mine];
  updateChatDynamic();
  try {
    await api.postMessage(state.pairId, state.identity, clean);
    await refreshMessages();
  } catch (e) {
    state.error = "That message didn't send — check your connection and try again.";
    updateChatDynamic();
  } finally {
    state.chatSending = false;
  }
}

// ---------------- tap effects ----------------
function spawnTapEffect(kind) {
  const wrap = document.getElementById(kind === "kiss" ? "kissWrap" : "orbWrap");
  if (!wrap) return;
  const ripple = document.createElement("span");
  ripple.className = kind === "kiss" ? "mya-ripple mya-ripple--kiss" : "mya-ripple";
  wrap.appendChild(ripple);
  setTimeout(() => ripple.remove(), 1150);

  const count = kind === "kiss" ? 5 : 6;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    if (kind === "kiss") {
      p.className = "mya-kiss-particle";
      p.textContent = "💋";
      const angle = -60 + Math.random() * 120; // fly up and outward
      const dist = 70 + Math.random() * 40;
      p.style.setProperty("--dx", `${Math.sin((angle * Math.PI) / 180) * dist}px`);
      p.style.setProperty("--dy", `${-Math.cos((angle * Math.PI) / 180) * dist - 40}px`);
      p.style.setProperty("--rot", `${(Math.random() - 0.5) * 60}deg`);
    } else {
      p.className = "mya-particle";
      const x = Math.round((Math.random() - 0.5) * 90);
      p.style.setProperty("--x", `${x}px`);
    }
    p.style.animationDelay = `${(Math.random() * 0.2).toFixed(2)}s`;
    p.style.animationDuration = `${(1.1 + Math.random() * 0.5).toFixed(2)}s`;
    wrap.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

// ---------------- render: shells ----------------
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
  stopPolling();
  if (state.phase === "loading") {
    root.innerHTML = `<div class="mya-root--loading"><div class="mya-loading-orb"></div></div>`;
  } else if (state.phase === "welcome") {
    renderWelcome();
  } else if (state.phase === "join-pair") {
    renderJoinPair();
  } else if (state.phase === "pair-created") {
    renderPairCreated();
  } else if (state.phase === "profile-setup") {
    renderProfileSetup();
  } else if (state.phase === "notify") {
    renderNotify();
  } else {
    renderAppShell();
  }
}

function renderWelcome() {
  root.innerHTML = `
    ${starsHtml()}
    <div class="mya-onboard">
      <p class="mya-eyebrow">Miss You</p>
      <p class="mya-script">the same sky, different windows</p>
      <h1 class="mya-h1">Start with your person</h1>
      <button class="mya-btn-start" id="createBtn">Create a pair</button>
      <button class="mya-btn-ghost" id="joinBtn">I have a code</button>
      ${state.error ? `<p class="mya-error">${escapeHtml(state.error)}</p>` : ""}
    </div>
  `;
  document.getElementById("createBtn").addEventListener("click", handleCreatePair);
  document.getElementById("joinBtn").addEventListener("click", () => {
    state.phase = "join-pair";
    render();
  });
}

function renderJoinPair() {
  root.innerHTML = `
    ${starsHtml()}
    <div class="mya-onboard">
      <p class="mya-eyebrow">Miss You</p>
      <h1 class="mya-h1">Enter their code</h1>
      <p class="mya-sub">Whatever six characters they sent you.</p>
      <input class="mya-input mya-input--code" id="codeInput" placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters" />
      <button class="mya-btn-start" id="joinSubmit" disabled>Join</button>
      <button class="mya-btn-ghost" id="backBtn">Back</button>
      ${state.joinError ? `<p class="mya-error">${escapeHtml(state.joinError)}</p>` : ""}
    </div>
  `;
  const input = document.getElementById("codeInput");
  const submit = document.getElementById("joinSubmit");
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
    submit.disabled = input.value.trim().length < 4;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) handleJoinPair(input.value);
  });
  submit.addEventListener("click", () => handleJoinPair(input.value));
  document.getElementById("backBtn").addEventListener("click", () => {
    state.phase = "welcome";
    render();
  });
  input.focus();
}

function renderPairCreated() {
  root.innerHTML = `
    ${starsHtml()}
    <div class="mya-onboard">
      <p class="mya-eyebrow">Miss You</p>
      <h1 class="mya-h1">Your pair code</h1>
      <p class="mya-sub">Send this to them however you'd normally text — they'll enter it on their end.</p>
      <div class="mya-code-display">${escapeHtml(state.pairCode)}</div>
      <button class="mya-btn-start" id="continueBtn">Continue</button>
    </div>
  `;
  document.getElementById("continueBtn").addEventListener("click", () => {
    state.phase = "profile-setup";
    render();
  });
}

function renderProfileSetup() {
  state.pendingAvatar = state.avatar || null;
  root.innerHTML = `
    ${starsHtml()}
    <div class="mya-onboard">
      <p class="mya-eyebrow">Miss You</p>
      <h1 class="mya-h1">Who's tapping in?</h1>
      <input type="file" id="avatarFile" accept="image/*" style="display:none" />
      <button type="button" class="mya-avatar-btn" id="avatarBtn" aria-label="Choose a profile picture">
        <span id="avatarPreview">${avatarHtml(state.identity, state.pendingAvatar, 88)}</span>
        <span class="mya-avatar-edit">✎</span>
      </button>
      <input class="mya-input" id="nameInput" placeholder="Your name" maxlength="24" autocomplete="off" value="${escapeHtml(state.identity)}" />
      <button class="mya-btn-start" id="profileSubmit" ${state.identity ? "" : "disabled"}>Continue</button>
      ${state.error ? `<p class="mya-error">${escapeHtml(state.error)}</p>` : ""}
    </div>
  `;
  const nameInput = document.getElementById("nameInput");
  const submit = document.getElementById("profileSubmit");
  const fileInput = document.getElementById("avatarFile");

  nameInput.addEventListener("input", () => {
    submit.disabled = !nameInput.value.trim();
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && nameInput.value.trim()) handleProfileSubmit(nameInput.value);
  });
  submit.addEventListener("click", () => handleProfileSubmit(nameInput.value));
  document.getElementById("avatarBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => handleAvatarFile(e.target.files && e.target.files[0]));
  if (!state.identity) nameInput.focus();
}
function updateAvatarPreview() {
  const el = document.getElementById("avatarPreview");
  if (el) el.innerHTML = avatarHtml(state.identity, state.pendingAvatar, 88);
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
          : `<p class="mya-sub">Turn on notifications so a signal or message reaches you even when the app is closed.</p>
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

// ---------------- render: main app shell ----------------
function renderAppShell() {
  root.innerHTML = `
    ${starsHtml()}
    <div class="mya-app-v2">
      <header class="mya-header">
        <div class="mya-header-id">
          <span id="headerAvatar">${avatarHtml(state.identity, state.avatar, 32)}</span>
          <span class="mya-hi">Hi, ${escapeHtml(state.identity)}</span>
        </div>
        <button class="mya-switch" id="switchBtn">Switch</button>
      </header>

      <div id="bannerSlot"></div>
      <div id="tabContent" class="mya-tab-content"></div>

      <nav class="mya-tabbar">
        <button class="mya-tab-btn active" id="tabSignals" data-tab="signals">
          ${heartSvg("mya-tab-icon")}
          <span>Signals</span>
        </button>
        <button class="mya-tab-btn" id="tabChat" data-tab="chat">
          <svg class="mya-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span>Chat</span>
          <span class="mya-tab-dot" id="chatDot" hidden></span>
        </button>
      </nav>
    </div>
  `;
  document.getElementById("switchBtn").addEventListener("click", handleSwitch);
  document.querySelectorAll(".mya-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  renderBanner();
  mountActiveTab();
}

function switchTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  document.querySelectorAll(".mya-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  if (tab === "chat") {
    const dot = document.getElementById("chatDot");
    if (dot) dot.hidden = true;
  }
  mountActiveTab();
}

function mountActiveTab() {
  if (state.activeTab === "chat") mountChatTab();
  else mountSignalsTab();
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

function updateHeaderDynamic() {
  const el = document.getElementById("headerAvatar");
  if (el) el.innerHTML = avatarHtml(state.identity, state.avatar, 32);
}

// ---------------- Signals tab ----------------
function mountSignalsTab() {
  const content = document.getElementById("tabContent");
  if (!content) return;
  content.innerHTML = `
    <div class="mya-center">
      <div class="mya-orb-wrap" id="orbWrap">
        <button class="mya-orb" id="orbBtn" aria-label="Send I miss you">
          ${heartSvg("mya-heart")}
        </button>
        <div class="mya-kiss-wrap" id="kissWrap">
          <button class="mya-kiss-btn" id="kissBtn" aria-label="Send a flying kiss">😘</button>
        </div>
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
  `;
  document.getElementById("orbBtn").addEventListener("click", () => handleSend("miss"));
  document.getElementById("kissBtn").addEventListener("click", () => handleSend("kiss"));
  updateSignalsDynamic();
}

function updateSignalsDynamic() {
  if (state.activeTab !== "signals") return;
  const partnerSignal = state.signals.find((s) => s.name !== state.identity);
  const statusEl = document.getElementById("statusText");
  if (statusEl) {
    if (partnerSignal) {
      const verb = partnerSignal.kind === "kiss" ? "sent you a flying kiss" : "missed you";
      statusEl.innerHTML = `${escapeHtml(partnerSignal.name)} ${verb} <span class="mya-status-time">${timeAgo(partnerSignal.ts)}</span>`;
    } else {
      statusEl.textContent = "No signal yet — send the first one";
    }
  }

  const feedSlot = document.getElementById("feedSlot");
  if (feedSlot) {
    const items = state.signals.slice(0, 14);
    feedSlot.innerHTML = items.length
      ? `<ul class="mya-feed-list">${items
          .map((s) => {
            const icon = s.kind === "kiss" ? "😘" : "";
            return `
        <li class="mya-feed-item ${s.name === state.identity ? "is-me" : "is-them"}">
          <span class="mya-dot"></span>
          <span class="mya-feed-name">${s.name === state.identity ? "You" : escapeHtml(s.name)}${icon ? ` ${icon}` : ""}</span>
          <span class="mya-feed-time">${timeAgo(s.ts)}</span>
        </li>`;
          })
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
  if (ctaEl) {
    ctaEl.textContent = state.justSent === "kiss" ? "Kiss sent" : state.justSent === "miss" ? "Signal sent" : "I miss you";
  }

  const errorEl = document.getElementById("errorText");
  if (errorEl) errorEl.textContent = state.error || "";

  const orbBtn = document.getElementById("orbBtn");
  if (orbBtn) orbBtn.classList.toggle("mya-orb--sending", state.sendingMiss);

  const kissBtn = document.getElementById("kissBtn");
  if (kissBtn) kissBtn.classList.toggle("mya-kiss-btn--sending", state.sendingKiss);
}

// ---------------- Chat tab ----------------
function mountChatTab() {
  const content = document.getElementById("tabContent");
  if (!content) return;
  content.innerHTML = `
    <div class="mya-chat">
      <div class="mya-chat-messages" id="chatMessages"></div>
      <form class="mya-chat-inputbar" id="chatForm">
        <input class="mya-chat-input" id="chatInput" placeholder="Say something..." maxlength="500" autocomplete="off" />
        <button type="submit" class="mya-chat-send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  `;
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSendMessage(input.value);
  });
  updateChatDynamic(true);
  input.focus();
}

function messageHtml(m) {
  const mine = m.name === state.identity;
  const avatarSrc = mine ? state.avatar : state.partner && state.partner.avatar;
  const avatarName = mine ? state.identity : m.name;
  return `
    <div class="mya-msg ${mine ? "is-me" : "is-them"}">
      ${!mine ? avatarHtml(avatarName, avatarSrc, 26) : ""}
      <div class="mya-msg-bubble">
        <span class="mya-msg-text">${escapeHtml(m.text)}</span>
        <span class="mya-msg-time">${timeAgo(m.ts)}</span>
      </div>
    </div>`;
}

function updateChatDynamic(forceFullRender) {
  if (state.activeTab !== "chat") return;
  const container = document.getElementById("chatMessages");
  if (!container) return;

  if (!state.messages.length) {
    container.innerHTML = `<p class="mya-empty mya-empty--chat">No messages yet — say hi 👋</p>`;
    return;
  }

  const renderedCount = container.querySelectorAll(".mya-msg").length;
  const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

  if (forceFullRender || renderedCount === 0 || renderedCount > state.messages.length) {
    container.innerHTML = state.messages.map((m) => messageHtml(m)).join("");
    container.scrollTop = container.scrollHeight;
  } else if (state.messages.length > renderedCount) {
    const newOnes = state.messages.slice(renderedCount);
    container.insertAdjacentHTML("beforeend", newOnes.map((m) => messageHtml(m)).join(""));
    if (wasNearBottom) container.scrollTop = container.scrollHeight;
  }
}

// ---------------- boot ----------------
async function boot() {
  render();
  if (state.phase === "app") {
    await Promise.all([refreshProfiles(), refreshSignals(), refreshMessages()]);
    startPolling();
  }
}

registerServiceWorker();

if (state.pairId && state.identity) {
  goToNotifyOrApp();
} else if (state.pairId && !state.identity) {
  state.phase = "profile-setup";
  render();
} else {
  state.phase = "welcome";
  render();
}
