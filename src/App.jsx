import { useState, useEffect } from "react";
import { api } from "./api.js";
import { isIOS, isStandalone } from "./utils.js";
import { usePushNotifications } from "./hooks/usePushNotifications.js";
import Stars from "./components/Stars.jsx";
import Welcome from "./components/Welcome.jsx";
import JoinPair from "./components/JoinPair.jsx";
import PairCreated from "./components/PairCreated.jsx";
import ProfileSetup from "./components/ProfileSetup.jsx";
import NotifyPrompt from "./components/NotifyPrompt.jsx";
import AppShell from "./components/AppShell.jsx";

const KEY_PAIR_ID = "mya_pair_id";
const KEY_PAIR_CODE = "mya_pair_code";
const KEY_IDENTITY = "mya_identity";
const KEY_AVATAR = "mya_avatar";
const KEY_NOTIFY_DISMISSED = "mya_notify_dismissed";

// Decides which phase/banner to show based on platform + prior choices.
// Pure function (no side effects) so it's easy to reason about and reuse
// from multiple call sites (initial boot, and right after profile setup).
function decideNotifyPhase(dismissed) {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permission = supported ? Notification.permission : "unsupported";

  if (isIOS() && !isStandalone()) {
    return { phase: dismissed ? "app" : "notify", banner: "ios" };
  }
  if (supported && permission === "default" && !dismissed) {
    return { phase: "notify", banner: "enable" };
  }
  return { phase: "app", banner: supported && permission === "default" ? "enable" : null };
}

export default function App() {
  const [phase, setPhase] = useState("loading");
  const [pairId, setPairId] = useState(() => localStorage.getItem(KEY_PAIR_ID) || null);
  const [pairCode, setPairCode] = useState(() => localStorage.getItem(KEY_PAIR_CODE) || "");
  const [identity, setIdentity] = useState(() => localStorage.getItem(KEY_IDENTITY) || "");
  const [avatar, setAvatar] = useState(() => localStorage.getItem(KEY_AVATAR) || null);
  const [notifyBanner, setNotifyBanner] = useState(null);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");

  const { enable: enablePush } = usePushNotifications(pairId, identity);

  // Decide the starting phase once, on mount.
  useEffect(() => {
    if (pairId && identity) {
      const dismissed = localStorage.getItem(KEY_NOTIFY_DISMISSED) === "true";
      const decision = decideNotifyPhase(dismissed);
      setNotifyBanner(decision.banner);
      setPhase(decision.phase);
    } else if (pairId && !identity) {
      setPhase("profile-setup");
    } else {
      setPhase("welcome");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreatePair() {
    setError("");
    try {
      const result = await api.createPair();
      setPairId(result.pairId);
      setPairCode(result.code);
      localStorage.setItem(KEY_PAIR_ID, String(result.pairId));
      localStorage.setItem(KEY_PAIR_CODE, result.code);
      setPhase("pair-created");
    } catch (e) {
      setError("Couldn't start a pair — check your connection and try again.");
    }
  }

  async function handleJoinPair(code) {
    setJoinError("");
    try {
      const result = await api.lookupPair(code);
      setPairId(result.pairId);
      setPairCode(result.code);
      localStorage.setItem(KEY_PAIR_ID, String(result.pairId));
      localStorage.setItem(KEY_PAIR_CODE, result.code);
      setPhase("profile-setup");
    } catch (e) {
      setJoinError(
        e.status === 404 ? "That code wasn't found — check it and try again." : "Something went wrong — try again."
      );
    }
  }

  async function handleProfileSubmit(name, avatarDataUrl) {
    setError("");
    try {
      await api.saveProfile(pairId, name, avatarDataUrl || null);
      setIdentity(name);
      setAvatar(avatarDataUrl || null);
      localStorage.setItem(KEY_IDENTITY, name);
      if (avatarDataUrl) localStorage.setItem(KEY_AVATAR, avatarDataUrl);

      const dismissed = localStorage.getItem(KEY_NOTIFY_DISMISSED) === "true";
      const decision = decideNotifyPhase(dismissed);
      setNotifyBanner(decision.banner);
      setPhase(decision.phase);
    } catch (e) {
      setError("Couldn't save your profile — check your connection and try again.");
    }
  }

  function handleDismissNotify() {
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    setPhase("app");
  }

  async function handleEnableNotifyFromOnboarding() {
    const result = await enablePush();
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    setNotifyBanner(result.ok ? null : "enable");
    setError(result.ok ? "" : result.reason || "");
    setPhase("app");
  }

  async function handleEnableNotifyFromBanner() {
    const result = await enablePush();
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    setNotifyBanner(result.ok ? null : notifyBanner);
  }

  function handleShowIosInstructions() {
    setNotifyBanner("ios");
    setPhase("notify");
  }

  function handleDismissBanner() {
    localStorage.setItem(KEY_NOTIFY_DISMISSED, "true");
    setNotifyBanner(null);
  }

  // Used by Settings: edits the profile in place without leaving the app.
  async function handleSaveProfileFromSettings(name, avatarDataUrl) {
    try {
      await api.saveProfile(pairId, name, avatarDataUrl || null);
      setIdentity(name);
      setAvatar(avatarDataUrl || null);
      localStorage.setItem(KEY_IDENTITY, name);
      if (avatarDataUrl) localStorage.setItem(KEY_AVATAR, avatarDataUrl);
      else localStorage.removeItem(KEY_AVATAR);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  // A real logout: leaves the pair entirely on this device. Signing back in
  // with the same pair code and name reunites you with your existing data —
  // nothing is deleted server-side, this only clears the local session.
  function handleLogout() {
    localStorage.removeItem(KEY_PAIR_ID);
    localStorage.removeItem(KEY_PAIR_CODE);
    localStorage.removeItem(KEY_IDENTITY);
    localStorage.removeItem(KEY_AVATAR);
    localStorage.removeItem(KEY_NOTIFY_DISMISSED);
    setPairId(null);
    setPairCode("");
    setIdentity("");
    setAvatar(null);
    setNotifyBanner(null);
    setPhase("welcome");
  }

  return (
    <div className={`mya-root${phase === "loading" ? " mya-root--loading" : ""}`}>
      {phase === "loading" && <div className="mya-loading-orb" />}
      {phase !== "loading" && <Stars />}

      {phase === "welcome" && (
        <Welcome onCreate={handleCreatePair} onJoin={() => setPhase("join-pair")} error={error} />
      )}

      {phase === "join-pair" && (
        <JoinPair onJoin={handleJoinPair} onBack={() => setPhase("welcome")} error={joinError} />
      )}

      {phase === "pair-created" && (
        <PairCreated code={pairCode} onContinue={() => setPhase("profile-setup")} />
      )}

      {phase === "profile-setup" && (
        <ProfileSetup
          initialName={identity}
          initialAvatar={avatar}
          onSubmit={handleProfileSubmit}
          error={error}
        />
      )}

      {phase === "notify" && (
        <NotifyPrompt
          isIos={notifyBanner === "ios"}
          onEnable={handleEnableNotifyFromOnboarding}
          onDismiss={handleDismissNotify}
        />
      )}

      {phase === "app" && (
        <AppShell
          pairId={pairId}
          pairCode={pairCode}
          identity={identity}
          avatar={avatar}
          onSaveProfile={handleSaveProfileFromSettings}
          onLogout={handleLogout}
          notifyBanner={notifyBanner}
          onEnableNotifyFromBanner={handleEnableNotifyFromBanner}
          onShowIosInstructions={handleShowIosInstructions}
          onDismissBanner={handleDismissBanner}
        />
      )}
    </div>
  );
}
