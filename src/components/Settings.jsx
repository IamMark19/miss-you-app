import { useState, useRef, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { compressImageToDataUrl } from "../utils.js";

function notifyStatusText(status) {
  if (status === "granted") return "On";
  if (status === "denied") return "Blocked — re-enable from your phone's notification settings";
  if (status === "unsupported") return "Not supported in this browser";
  return "Off";
}

function getNotifyStatus() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export default function Settings({
  identity,
  avatar,
  pairId,
  pairCode,
  onSaveProfile,
  onEnableNotify,
  onLogout,
  onClose,
}) {
  const [name, setName] = useState(identity);
  const [avatarUrl, setAvatarUrl] = useState(avatar);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [notifyStatus, setNotifyStatus] = useState(getNotifyStatus());
  const fileRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      console.error("avatar processing failed", err);
    }
  }

  async function handleSaveProfile() {
    const clean = name.trim();
    if (!clean) return;
    setSaving(true);
    setError("");
    const result = await onSaveProfile(clean, avatarUrl);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setError("Couldn't save — check your connection and try again.");
    }
  }

  async function handleEnableNotify() {
    await onEnableNotify();
    setNotifyStatus(getNotifyStatus());
  }

  function handleLogoutClick() {
    if (window.confirm("Log out? You'll need the pair code to sign back in.")) {
      onLogout();
    }
  }

  return (
    <div className="mya-settings-overlay" onClick={onClose}>
      <div className="mya-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mya-settings-header">
          <h2>Settings</h2>
          <button className="mya-settings-close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <section className="mya-settings-section">
          <p className="mya-settings-label">Your profile</p>
          <input
            type="file"
            ref={fileRef}
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFile}
          />
          <button
            type="button"
            className="mya-avatar-btn mya-avatar-btn--sm"
            onClick={() => fileRef.current.click()}
            aria-label="Change your profile picture"
          >
            <Avatar name={name} url={avatarUrl} size={64} />
            <span className="mya-avatar-edit">✎</span>
          </button>
          <input
            className="mya-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoComplete="off"
          />
          <button
            className="mya-btn-primary"
            onClick={handleSaveProfile}
            disabled={saving || !name.trim()}
          >
            {saved ? "Saved" : saving ? "Saving..." : "Save profile"}
          </button>
          {error && <p className="mya-error">{error}</p>}
        </section>

        <section className="mya-settings-section">
          <p className="mya-settings-label">Notifications</p>
          <p className="mya-settings-value">{notifyStatusText(notifyStatus)}</p>
          {notifyStatus === "default" && (
            <button className="mya-btn-ghost" onClick={handleEnableNotify}>
              Enable notifications
            </button>
          )}
        </section>

        <section className="mya-settings-section">
          <p className="mya-settings-label">Your pair</p>
          <p className="mya-settings-value">
            {pairCode ? (
              <>
                Code: <span className="mya-settings-code">{pairCode}</span>
              </>
            ) : (
              "Pair code not saved on this device"
            )}
          </p>
        </section>

        <button className="mya-btn-logout" onClick={handleLogoutClick}>
          Log out
        </button>
      </div>
    </div>
  );
}
