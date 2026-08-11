import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api.js";
import { vibrateIfSupported } from "../utils.js";

const POLL_MS = 6000;

// Fetches and keeps signals/messages/partner profile in sync for a pair:
// polls on an interval, refetches on focus/visibility, refetches instantly
// when the service worker forwards a push, and exposes optimistic send
// actions so taps and messages feel instant.
export function usePairData(pairId, identity) {
  const [signals, setSignals] = useState([]);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);

  // Refs mirror state so the service-worker message listener (registered once)
  // always sees the latest activeTab/identity without needing to re-subscribe.
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const refresh = useCallback(async () => {
    if (!pairId) return;
    try {
      const [sigData, msgData, profData] = await Promise.all([
        api.fetchSignals(pairId),
        api.fetchMessages(pairId),
        api.fetchProfiles(pairId),
      ]);
      setSignals(sigData.signals || []);
      setMessages(msgData.messages || []);
      const other = (profData.profiles || []).find((p) => p.name !== identityRef.current);
      setPartner(other || null);
    } catch (e) {
      // transient network error — keep last known state
    }
  }, [pairId]);

  useEffect(() => {
    if (!pairId) return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pairId, refresh]);

  // React to pushes forwarded by the service worker while the app is open.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event) => {
      const type = event.data && event.data.type;
      if (type === "NEW_SIGNAL") {
        vibrateIfSupported([100, 50, 100]);
        refresh();
      } else if (type === "NEW_MESSAGE") {
        vibrateIfSupported([60, 40, 60, 40, 60]);
        refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [refresh]);

  const sendSignal = useCallback(
    async (kind) => {
      const mine = { name: identity, kind, ts: Date.now() };
      setSignals((prev) => [mine, ...prev].slice(0, 150));
      try {
        await api.postSignal(pairId, identity, kind);
        await refresh();
        return { ok: true };
      } catch (e) {
        return { ok: false };
      }
    },
    [pairId, identity, refresh]
  );

  const sendMessage = useCallback(
    async (text) => {
      const mine = { name: identity, text, ts: Date.now() };
      setMessages((prev) => [...prev, mine]);
      try {
        await api.postMessage(pairId, identity, text);
        await refresh();
        return { ok: true };
      } catch (e) {
        return { ok: false };
      }
    },
    [pairId, identity, refresh]
  );

  return { signals, messages, partner, refresh, sendSignal, sendMessage };
}
