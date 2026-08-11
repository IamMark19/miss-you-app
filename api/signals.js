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
    .from("signals")
    .select("name, kind, ts")
    .eq("pair_id", pairId)
    .order("ts", { ascending: false })
    .limit(150);

  if (error) {
    console.error("fetch signals failed", error);
    res.status(500).json({ error: "Could not load signals" });
    return;
  }

  res.status(200).json({ signals: data || [] });
}