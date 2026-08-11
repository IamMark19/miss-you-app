import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { pairId, name, avatar } = req.body || {};
    if (!pairId || !name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Missing pairId or name" });
    }
    // Keep the stored avatar to a sane size (roughly 350KB as a data URL).
    const safeAvatar = typeof avatar === "string" && avatar.length <= 350000 ? avatar : null;

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { 
          pair_id: pairId, 
          name: name.trim().slice(0, 40), 
          avatar: safeAvatar, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: "pair_id,name" }
      );

    if (error) {
      console.error("save profile failed", error);
      return res.status(500).json({ error: "Could not save profile" });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const pairId = req.query.pairId;
    if (!pairId) {
      return res.status(400).json({ error: "Missing pairId" });
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("name, avatar")
      .eq("pair_id", pairId);

    if (error) {
      console.error("fetch profiles failed", error);
      return res.status(500).json({ error: "Could not load profiles" });
    }
    return res.status(200).json({ profiles: data || [] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}