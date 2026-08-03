const { supabase } = require("../lib/supabase");
const { notifyPair } = require("../lib/push");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { pairId, name, text } = req.body || {};
  if (!pairId || !name || typeof name !== "string" || !text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing pairId, name, or text" });
    return;
  }
  const cleanName = name.trim().slice(0, 40);
  const cleanText = text.trim().slice(0, 500);
  const ts = Date.now();

  const { error: insertError } = await supabase
    .from("messages")
    .insert({ pair_id: pairId, name: cleanName, text: cleanText, ts });
  if (insertError) {
    console.error("insert message failed", insertError);
    res.status(500).json({ error: "Could not send message" });
    return;
  }

  await notifyPair(pairId, cleanName, {
    type: "message",
    title: cleanName,
    body: cleanText.length > 120 ? `${cleanText.slice(0, 117)}...` : cleanText,
  });

  res.status(200).json({ ok: true, ts });
};
