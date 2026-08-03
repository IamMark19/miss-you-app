const { supabase } = require("../lib/supabase");

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L, easier to type
function generateCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    // Create a new pair, retrying on the rare code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data, error } = await supabase
        .from("pairs")
        .insert({ code })
        .select("id, code")
        .single();
      if (!error && data) {
        res.status(200).json({ pairId: data.id, code: data.code });
        return;
      }
      if (error && error.code !== "23505") {
        // not a unique-violation — a real problem, stop retrying
        console.error("create pair failed", error);
        res.status(500).json({ error: "Could not create pair" });
        return;
      }
      // 23505 = unique violation on code, loop and try another code
    }
    res.status(500).json({ error: "Could not generate a unique code, try again" });
    return;
  }

  if (req.method === "GET") {
    const code = String(req.query.code || "").trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: "Missing code" });
      return;
    }
    const { data, error } = await supabase.from("pairs").select("id, code").eq("code", code).maybeSingle();
    if (error) {
      console.error("lookup pair failed", error);
      res.status(500).json({ error: "Could not look up code" });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "That code wasn't found" });
      return;
    }
    res.status(200).json({ pairId: data.id, code: data.code });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
