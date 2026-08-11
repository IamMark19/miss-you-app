import webpush from "web-push";
import { supabase } = from "./supabase.js";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:you@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Sends a push to every subscription in the pair that isn't the sender's.
// Never throws — a push failure should never fail the request that triggered it.
export async function notifyPair(pairId, senderName, payload) {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  try {
    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("pair_id", pairId)
      .neq("name", senderName);

    if (error || !subs || !subs.length) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(s.subscription, body);
        } catch (err) {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await supabase.from("subscriptions").delete().eq("id", s.id);
          } else {
            console.error("push send failed", err && err.message);
          }
        }
      })
    );
  } catch (e) {
    console.error("notifyPair failed", e);
  }
}