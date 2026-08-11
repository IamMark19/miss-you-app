import { useState } from "react";

export default function JoinPair({ onJoin, onBack, error }) {
  const [code, setCode] = useState("");

  function submit() {
    if (code.trim().length >= 4) onJoin(code.trim());
  }

  return (
    <div className="mya-onboard">
      <p className="mya-eyebrow">Miss You</p>
      <h1 className="mya-h1">Enter their code</h1>
      <p className="mya-sub">Whatever six characters they sent you.</p>
      <input
        className="mya-input mya-input--code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="ABC123"
        maxLength={6}
        autoComplete="off"
        autoCapitalize="characters"
        autoFocus
      />
      <button className="mya-btn-start" onClick={submit} disabled={code.trim().length < 4}>
        Join
      </button>
      <button className="mya-btn-ghost" onClick={onBack}>
        Back
      </button>
      {error && <p className="mya-error">{error}</p>}
    </div>
  );
}
