import { useState, useRef } from "react";
import Avatar from "./Avatar.jsx";
import { compressImageToDataUrl } from "../utils.js";

export default function ProfileSetup({ initialName, initialAvatar, onSubmit, error }) {
  const [name, setName] = useState(initialName || "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar || null);
  const fileRef = useRef(null);

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

  function handleSubmit() {
    const clean = name.trim();
    if (!clean) return;
    onSubmit(clean, avatarUrl);
  }

  return (
    <div className="mya-onboard">
      <p className="mya-eyebrow">Miss You</p>
      <h1 className="mya-h1">Who's tapping in?</h1>

      <input
        type="file"
        ref={fileRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <button
        type="button"
        className="mya-avatar-btn"
        onClick={() => fileRef.current.click()}
        aria-label="Choose a profile picture"
      >
        <Avatar name={name} url={avatarUrl} size={88} />
        <span className="mya-avatar-edit">✎</span>
      </button>

      <input
        className="mya-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) handleSubmit();
        }}
        placeholder="Your name"
        maxLength={24}
        autoComplete="off"
        autoFocus={!initialName}
      />
      <button className="mya-btn-start" onClick={handleSubmit} disabled={!name.trim()}>
        Continue
      </button>
      {error && <p className="mya-error">{error}</p>}
    </div>
  );
}
