const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { data, error } = await supabase
    .from("signals")
    .select("name, ts")
    .order("ts", { ascending: false })
    .limit(150);

  if (error) {
    console.error("fetch signals failed", error);
    res.status(500).json({ error: "Could not load signals" });
    return;
  }

  res.status(200).json({ signals: data || [] });
};
