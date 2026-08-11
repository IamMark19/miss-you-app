import { useState } from "react";
import { HeartOutline, HeartFilled } from "../Icons.jsx";
import { timeAgo, vibrateIfSupported } from "../utils.js";

function spawnRipple(kind, setRipples) {
  const id = `${Date.now()}-${Math.random()}`;
  setRipples((prev) => [...prev, { id, kind }]);
  setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 1150);
}

function spawnParticles(kind, setParticles) {
  const batchId = Date.now();
  const count = kind === "kiss" ? 5 : 6;
  const newOnes = Array.from({ length: count }).map((_, i) => {
    const id = `${batchId}-${i}`;
    const delay = Math.random() * 0.2;
    const dur = 1.1 + Math.random() * 0.5;
    if (kind === "kiss") {
      const angle = -60 + Math.random() * 120; // fan out up and to the sides
      const dist = 70 + Math.random() * 40;
      return {
        id,
        kind,
        dx: Math.sin((angle * Math.PI) / 180) * dist,
        dy: -Math.cos((angle * Math.PI) / 180) * dist - 40,
        rot: (Math.random() - 0.5) * 60,
        delay,
        dur,
      };
    }
    return { id, kind, x: Math.round((Math.random() - 0.5) * 90), delay, dur };
  });
  setParticles((prev) => [...prev, ...newOnes]);
  const ids = new Set(newOnes.map((p) => p.id));
  setTimeout(() => setParticles((prev) => prev.filter((p) => !ids.has(p.id))), 2000);
}

export default function SignalsTab({ identity, signals, sendSignal }) {
  const [sendingMiss, setSendingMiss] = useState(false);
  const [sendingKiss, setSendingKiss] = useState(false);
  const [justSent, setJustSent] = useState(null); // null | 'miss' | 'kiss'
  const [ripples, setRipples] = useState([]);
  const [particles, setParticles] = useState([]);
  const [error, setError] = useState("");

  async function handleTap(kind) {
    const alreadySending = kind === "kiss" ? sendingKiss : sendingMiss;
    if (alreadySending) return;
    const setSending = kind === "kiss" ? setSendingKiss : setSendingMiss;

    setSending(true);
    setError("");
    setJustSent(kind);
    vibrateIfSupported([40]);
    spawnRipple(kind, setRipples);
    spawnParticles(kind, setParticles);
    setTimeout(() => setJustSent(null), 1800);

    const result = await sendSignal(kind);
    if (!result.ok) setError("That signal didn't send — check your connection and try again.");
    setSending(false);
  }

  const partnerSignal = signals.find((s) => s.name !== identity);
  const feedItems = signals.slice(0, 14);

  return (
    <>
      <div className="mya-center">
        <div className="mya-orb-wrap">
          {ripples
            .filter((r) => r.kind === "miss")
            .map((r) => (
              <span key={r.id} className="mya-ripple" />
            ))}
          {particles
            .filter((p) => p.kind === "miss")
            .map((p) => (
              <span
                key={p.id}
                className="mya-particle"
                style={{ "--x": `${p.x}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
              />
            ))}
          <button
            className={`mya-orb${sendingMiss ? " mya-orb--sending" : ""}`}
            onClick={() => handleTap("miss")}
            aria-label="Send I miss you"
          >
            <HeartOutline className="mya-heart" />
          </button>

          <div className="mya-kiss-wrap">
            {ripples
              .filter((r) => r.kind === "kiss")
              .map((r) => (
                <span key={r.id} className="mya-ripple mya-ripple--kiss" />
              ))}
            {particles
              .filter((p) => p.kind === "kiss")
              .map((p) => (
                <span
                  key={p.id}
                  className="mya-kiss-particle"
                  style={{
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    "--rot": `${p.rot}deg`,
                    animationDelay: `${p.delay}s`,
                    animationDuration: `${p.dur}s`,
                  }}
                >
                  💋
                </span>
              ))}
            <button
              className={`mya-kiss-btn${sendingKiss ? " mya-kiss-btn--sending" : ""}`}
              onClick={() => handleTap("kiss")}
              aria-label="Send a flying kiss"
            >
              <HeartFilled className="mya-kiss-heart" />
            </button>
          </div>
        </div>

        <p className="mya-cta">
          {justSent === "kiss" ? "Kiss sent" : justSent === "miss" ? "Signal sent" : "I miss you"}
        </p>
        <p className="mya-status">
          {partnerSignal ? (
            <>
              {partnerSignal.name} {partnerSignal.kind === "kiss" ? "sent you a flying kiss" : "missed you"}{" "}
              <span className="mya-status-time">{timeAgo(partnerSignal.ts)}</span>
            </>
          ) : (
            "No signal yet — send the first one"
          )}
        </p>
      </div>

      <section className="mya-feed">
        <p className="mya-feed-title">Signals</p>
        {feedItems.length === 0 ? (
          <p className="mya-empty">Nothing here yet. Tap the heart to send your first signal.</p>
        ) : (
          <ul className="mya-feed-list">
            {feedItems.map((s, i) => (
              <li
                key={`${s.ts}-${i}`}
                className={`mya-feed-item ${s.name === identity ? "is-me" : "is-them"}`}
              >
                <span className="mya-dot" />
                <span className="mya-feed-name">
                  {s.name === identity ? "You" : s.name}
                  {s.kind === "kiss" ? " 😘" : ""}
                </span>
                <span className="mya-feed-time">{timeAgo(s.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {signals.length > 0 && (
        <p className="mya-footer">
          {signals.length} signal{signals.length === 1 ? "" : "s"} sent between you two
        </p>
      )}
      {error && <p className="mya-error">{error}</p>}
    </>
  );
}
