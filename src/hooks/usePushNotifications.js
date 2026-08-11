import { useCallback } from "react";
import { api } from "../api.js";
import { urlBase64ToUint8Array } from "../utils.js";

// After running `npx web-push generate-vapid-keys`, paste the PUBLIC key here.
const VAPID_PUBLIC_KEY = "BCeuXRcL5EBwH_uM34jQ-EWeV1paDUBypHVWLBAB3qW7yZCZ3pFuGWV9zs8Ib87lvnB6tnQRj5_oJQ0vjEYo2PE";

export function usePushNotifications(pairId, identity) {
  const enable = useCallback(async () => {
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
      await api.subscribePush(pairId, identity, sub);
      return { ok: true };
    } catch (e) {
      console.error("enableNotifications failed", e);
      return { ok: false, reason: "Couldn't enable notifications — try again." };
    }
  }, [pairId, identity]);

  return { enable };
}
