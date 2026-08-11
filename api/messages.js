import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const pairId = req.query.pairId;
  if (!pairId) {
    res.status(400).json({ error: "Missing pairId" });
    return;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("name, text, ts")
    .eq("pair_id", pairId)
    .order("ts", { ascending: false })
    .limit(200);

  if (error) {
    console.error("fetch messages failed", error);
    res.status(500).json({ error: "Could not load messages" });
    return;
  }

  // Return oldest-first, which is the natural reading order for a chat thread.
  res.status(200).json({ messages: (data || []).slice().reverse() });
}