const { supabase } = require("../lib/supabase");
const { notifyPair } = require("../lib/push");

const COPY = {
  miss: (name) => `${name} misses you 💛`,
  kiss: (name) => `${name} sent you a flying kiss 😘`,
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { pairId, name, kind } = req.body || {};
  const cleanKind = kind === "kiss" ? "kiss" : "miss";
  if (!pairId || !name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Missing pairId or name" });
    return;
  }
  const cleanName = name.trim().slice(0, 40);
  const ts = Date.now();

  const { error: insertError } = await supabase
    .from("signals")
    .insert({ pair_id: pairId, name: cleanName, kind: cleanKind, ts });
  if (insertError) {
    console.error("insert signal failed", insertError);
    res.status(500).json({ error: "Could not save signal" });
    return;
  }

  await notifyPair(pairId, cleanName, {
    type: "signal",
    kind: cleanKind,
    title: "Miss You",
    body: COPY[cleanKind](cleanName),
  });

  res.status(200).json({ ok: true, ts });
};
