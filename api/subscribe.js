import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { pairId, name, subscription } = req.body || {};
  if (!pairId || !name || typeof name !== "string" || !subscription || !subscription.endpoint) {
    res.status(400).json({ error: "Missing pairId, name, or subscription" });
    return;
  }

  const { error } = await supabase.from("subscriptions").upsert(
    {
      pair_id: pairId,
      name: name.trim().slice(0, 40),
      endpoint: subscription.endpoint,
      subscription,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("save subscription failed", error);
    res.status(500).json({ error: "Could not save subscription" });
    return;
  }

  res.status(200).json({ ok: true });
}