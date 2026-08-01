const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, subscription } = req.body || {};
  if (!name || typeof name !== "string" || !subscription || !subscription.endpoint) {
    res.status(400).json({ error: "Missing name or subscription" });
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      { name: name.trim().slice(0, 40), endpoint: subscription.endpoint, subscription },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("save subscription failed", error);
    res.status(500).json({ error: "Could not save subscription" });
    return;
  }

  res.status(200).json({ ok: true });
};
