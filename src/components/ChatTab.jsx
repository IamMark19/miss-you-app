import { useState, useRef, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { SendIcon } from "../Icons.jsx";
import { timeAgo } from "../utils.js";

export default function ChatTab({ identity, partner, messages, sendMessage }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  // Tracks scroll position continuously (not just at message-update time) so
  // we know whether the user was already at the bottom *before* new content
  // arrives, rather than measuring after the DOM has already grown taller.
  const isAtBottomRef = useRef(true);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    setDraft("");
    isAtBottomRef.current = true; // sending a message should always snap you to the bottom
    const result = await sendMessage(text);
    if (!result.ok) setError("That message didn't send — check your connection and try again.");
    setSending(false);
  }

  return (
    <div className="mya-chat">
      <div className="mya-chat-messages" ref={listRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <p className="mya-empty mya-empty--chat">No messages yet — say hi 👋</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.name === identity;
            return (
              <div key={`${m.ts}-${i}`} className={`mya-msg ${mine ? "is-me" : "is-them"}`}>
                {!mine && <Avatar name={m.name} url={partner && partner.avatar} size={26} />}
                <div className="mya-msg-bubble">
                  <span className="mya-msg-text">{m.text}</span>
                  <span className="mya-msg-time">{timeAgo(m.ts)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="mya-chat-inputbar" onSubmit={handleSubmit}>
        <input
          className="mya-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something..."
          maxLength={500}
          autoComplete="off"
        />
        <button type="submit" className="mya-chat-send" aria-label="Send message">
          <SendIcon />
        </button>
      </form>
      {error && <p className="mya-error">{error}</p>}
    </div>
  );
}
