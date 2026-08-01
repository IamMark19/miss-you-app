# Miss You

A tiny installable app for two people. Tap the heart, your person gets a real
push notification — even if the app is closed.

Same visual concept as before (you're both looking at the same night sky),
just rebuilt to run on its own, outside of Claude, so it can live on your
home screen and send real notifications.

## What changed from the Claude artifact version

| | Claude artifact | This version |
|---|---|---|
| Hosting | Claude-hosted link | Your own domain (Vercel) |
| Sync | Claude's built-in storage | Supabase (Postgres) |
| Notifications | None (had to check manually) | Real push, via the Web Push standard |
| Install | Browser tab only | Installable on iPhone + Android home screen |

## One-time setup (~15 minutes)

### 1. Create a Supabase project
Free tier is plenty. At [supabase.com](https://supabase.com), create a new
project, then open the **SQL Editor** and run everything in
`supabase-schema.sql` (creates two tables: `signals` and `subscriptions`).

Then go to **Project Settings → API** and copy:
- **Project URL** → this is `SUPABASE_URL`
- **service_role key** (not the `anon` key — the app calls Supabase only from
  your serverless functions, never from the browser, so it's safe to use the
  full-access key here) → this is `SUPABASE_SERVICE_KEY`

### 2. Generate VAPID keys
These identify your app to the browsers' push services (Apple, Google,
Mozilla) — standard for Web Push, no third-party account needed.

```bash
npx web-push generate-vapid-keys
```

You'll get a public and private key. Keep both.

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
Or connect the folder as a GitHub repo and import it in the Vercel dashboard
— whichever you'd normally do.

Then in the Vercel project's **Settings → Environment Variables**, add all
five from `.env.example`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (any `mailto:` address is fine)

Redeploy after adding them (`vercel --prod`) so the functions pick them up.

### 5. Install it on both phones
Open your deployed URL (e.g. `miss-you-yourname.vercel.app`) on your phone.

- **Android (Chrome):** you'll be offered an "Install app" prompt automatically,
  or use the menu → *Add to Home Screen*.
- **iPhone (Safari):** tap the **Share** icon → **Add to Home Screen**. This
  step is required on iOS — notifications don't work in a regular Safari tab,
  only once it's installed this way. The app itself will walk you through
  this the first time you open it.

Open it from the home screen icon, enter your name, and enable notifications
when asked. Send your girlfriend the same URL so she can do the same on her
phone.

## How it works
- `signals` table logs every tap (`name`, timestamp).
- `subscriptions` table stores each person's push subscription (created by
  the browser when they enable notifications).
- Tapping the heart calls `POST /api/signal`, which saves the tap and pushes
  a notification to any subscription that isn't the sender's.
- The open app also polls `GET /api/signals` every few seconds and refreshes
  instantly on a push, so the on-screen feed stays current whether or not
  notifications are enabled.

## Worth knowing
- **No login/auth.** Anyone with your deployed URL could technically tap the
  button or read the signal history — fine for a private link you only send
  to each other, but don't post the URL publicly. If you want a lock on the
  door later, a simple shared-passphrase check in the API routes would do it.
- **iOS push needs iOS 16.4+** and only works once installed to the home
  screen (Apple's restriction, not this app's).
- Notification permission, once denied in the phone's system settings, has
  to be re-enabled from Settings — the app can't re-prompt after a hard deny.
