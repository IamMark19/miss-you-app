const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:you@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Missing name" });
    return;
  }
  const cleanName = name.trim().slice(0, 40);
  const ts = Date.now();

  const { error: insertError } = await supabase.from("signals").insert({ name: cleanName, ts });
  if (insertError) {
    console.error("insert signal failed", insertError);
    res.status(500).json({ error: "Could not save signal" });
    return;
  }

  // Notify everyone whose saved identity isn't the sender.
  try {
    const { data: subs, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .neq("name", cleanName);

    if (!subError && subs && subs.length && process.env.VAPID_PRIVATE_KEY) {
      const payload = JSON.stringify({
        title: "Miss You",
        body: `${cleanName} misses you 💛`,
      });
      await Promise.allSettled(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(s.subscription, payload);
          } catch (err) {
            if (err && (err.statusCode === 404 || err.statusCode === 410)) {
              await supabase.from("subscriptions").delete().eq("id", s.id);
            } else {
              console.error("push send failed", err && err.message);
            }
          }
        })
      );
    }
  } catch (e) {
    // Signal was already saved — a push failure shouldn't fail the request.
    console.error("push notification step failed", e);
  }

  res.status(200).json({ ok: true, ts });
};
