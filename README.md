# Miss You

A tiny installable app for two people. Tap the heart to send a signal, blow a
flying kiss, or just say something in chat — your person gets a real push
notification, even if the app is closed.

## What's new in this version

- **Pairing** — no more trusting names alone. The first person creates a pair
  and gets a 6-character code; the second person enters it to join. Everything
  (signals, chat, notifications) is scoped to that pair.
- **Profile pictures** — tap the avatar circle during setup to add a photo.
  It's resized and compressed in the browser before it's ever sent anywhere.
  Skip it and you get a soft initial-letter avatar instead.
- **Chat** — a second tab with a real back-and-forth thread, synced the same
  way as signals, with its own push notifications.
- **Flying kiss** — a second, smaller button next to the heart for "I love
  you" moments, with its own animation and its own line in the feed.
- **Vibration on receive** — when a signal, kiss, or message arrives, the
  phone vibrates (Android). See the platform note below for iPhone.

## One-time setup (~15 minutes)

### 1. Create a Supabase project
Free tier is plenty. At [supabase.com](https://supabase.com), create a new
project, then open the **SQL Editor** and run everything in
`supabase-schema.sql` (creates `pairs`, `profiles`, `signals`, `messages`,
and `subscriptions`).

> Upgrading from the first version of this app? That schema had `signals`
> and `subscriptions` tables without pairing. Drop those two tables before
> running the new `supabase-schema.sql` — the shape changed (added `pair_id`
> and a `kind` column).

Then go to **Project Settings → API** and copy:
- **Project URL** → this is `SUPABASE_URL`
- **service_role key** (not `anon` — the app only calls Supabase from your
  serverless functions, never from the browser, so the full-access key is
  safe here) → this is `SUPABASE_SERVICE_KEY`

### 2. Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
Keep both the public and private key.

### 3. Paste the public key into the frontend
Open `app.js`, find this line near the top, and replace the placeholder:
```js
const VAPID_PUBLIC_KEY = "PASTE_YOUR_VAPID_PUBLIC_KEY_HERE";
```

### 4. Deploy to Vercel
```bash
npm install -g vercel   # if you don't have it already
cd miss-you-app
vercel
```
Or connect the folder as a GitHub repo and import it in the Vercel dashboard.

In the Vercel project's **Settings → Environment Variables**, add all five
from `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (any `mailto:`
address is fine). Redeploy after adding them (`vercel --prod`).

### 5. Set up both phones
Open your deployed URL on your phone, tap **Create a pair**, and you'll get a
6-character code — text it to her however you normally would. She opens the
same URL, taps **I have a code**, and enters it.

- **Android (Chrome):** you'll be offered an "Install app" prompt
  automatically, or use the menu → *Add to Home Screen*.
- **iPhone (Safari):** tap **Share** → **Add to Home Screen**. This step is
  required on iOS before notifications work at all — the app walks through
  it the first time it's opened there.

Each of you sets a name (and optionally a photo) once, then you're in.

## How it works
- `pairs` holds just a join code. `profiles`, `signals`, `messages`, and
  `subscriptions` all key off `pair_id`, so the two of you are cleanly
  isolated from anyone else who might spin up their own pair.
- Tapping the heart or the kiss button calls `POST /api/signal` with a
  `kind` of `miss` or `kiss`; sending a chat message calls `POST
  /api/message`. Both save to Supabase and push a notification to every
  subscription in the pair that isn't the sender's.
- The open app polls every few seconds and refreshes instantly on a push
  (via a message from the service worker to the page), so both the Signals
  feed and the chat thread stay current whether or not notifications are on.

## Worth knowing
- **No account/login beyond the pair code.** Anyone who has your code could
  join your pair — treat the code like you'd treat a shared link, don't post
  it publicly.
- **Vibration is Android-only.** iOS Safari has never supported the
  Vibration API, on the web or in an installed PWA — that's an Apple
  platform limitation, not something fixable from here. iPhones still get
  the notification itself (sound + system haptic), just not a
  custom-controlled buzz pattern.
- **iOS push needs iOS 16.4+**, and only works once the app is installed to
  the Home Screen.
- **Photos are stored as compressed images in the database**, not in a
  separate file storage bucket — simplest to set up, plenty for two small
  profile pictures. If you ever want to store much larger images, that's a
  bigger change (Supabase Storage).
- Notification permission, once denied in the phone's system settings, has
  to be re-enabled from Settings — the app can't re-prompt after a hard deny.
