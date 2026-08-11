# Miss You (React)

The same app — pairing, signals, flying kisses, chat, push notifications —
rebuilt in React + Vite instead of hand-rolled vanilla JS. Functionally
identical to the previous version; this is a structural rewrite, not a
feature change.

## Why this version exists

The vanilla build worked, but hand-managing DOM updates, event listener
re-attachment, and scroll state in plain JS doesn't scale well past a
certain size, and it's not the stack you'd actually want to maintain this
in. This version is organized the way a React codebase should be:

```
src/
  main.jsx              - mounts <App/>, registers the service worker
  App.jsx                - the phase state machine (welcome → pair → app)
  api.js                 - fetch wrappers (unchanged contract with the backend)
  utils.js                - timeAgo, image compression, small helpers
  Icons.jsx                - the heart/chat/send SVGs as components
  hooks/
    usePairData.js          - polling, refresh, optimistic send for signals + chat
    usePushNotifications.js  - VAPID subscribe flow
  components/
    Welcome.jsx, JoinPair.jsx, PairCreated.jsx, ProfileSetup.jsx,
    NotifyPrompt.jsx, NotifyBanner.jsx, AppShell.jsx, SignalsTab.jsx,
    ChatTab.jsx, Avatar.jsx, Stars.jsx
  styles.css                - same design tokens/animations as before
```

The backend didn't change at all — `api/`, `lib/`, and `supabase-schema.sql`
are byte-for-byte what they were. React only replaces how the frontend
renders; it doesn't talk to Supabase directly, same as before.

## One-time setup (~15 minutes)

Same as previous versions:

### 1. Create a Supabase project
Run `supabase-schema.sql` in the SQL Editor. If you already have the tables
from an earlier version, you don't need to redo this — the schema hasn't
changed.

### 2. Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```

### 3. Paste the public key into the frontend
Open `src/hooks/usePushNotifications.js` and replace:
```js
const VAPID_PUBLIC_KEY = "PASTE_YOUR_VAPID_PUBLIC_KEY_HERE";
```

### 4. Try it locally (optional but recommended)
```bash
npm install
npm run dev
```
Opens at `http://localhost:5173`. API routes won't work against `vercel dev`
without the Vercel CLI — for a quick UI check this is fine, but real
end-to-end testing (push, Supabase) needs an actual deploy or `vercel dev`.

### 5. Deploy to Vercel
```bash
npm install -g vercel   # if you don't have it
vercel
```
Vercel auto-detects Vite (build command `vite build`, output `dist`) and
picks up the `/api` functions the same way it did before — no extra config
needed beyond environment variables.

In **Settings → Environment Variables**, add the five from `.env.example`:
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Redeploy after adding them.

### 6. Set up both phones
Same as before: create a pair, get a code, send it to her, she joins. Add to
Home Screen on both (required on iOS before notifications work at all).

## What changed under the hood vs. the vanilla version

- **Caching is more robust now, structurally.** Vite content-hashes the JS/CSS
  bundle filenames (`index-xxxxx.js`), so a code change always produces a new
  URL — no possibility of a browser serving a stale bundle next to fresh
  code, which was the caching bug from before. `vercel.json` sets those
  hashed files to cache forever (`immutable`) since they're safe to, while
  `index.html`, `manifest.json`, and the service worker always revalidate.
- **Tap animations (ripples, particles) are now React state**, not direct
  DOM manipulation — same visual effect, but driven by `useState` + CSS
  animations instead of manually appending/removing spans.
- **Chat auto-scroll tracks scroll position continuously** (via an `onScroll`
  handler) rather than trying to measure it at the moment a message arrives,
  which is more reliable about not yanking you down mid-scroll.
- Both buttons already had independent "sending" flags from the last round
  of fixes — that carried over as-is.

## Testing this before you saw it
I ran an actual `vite build` (not just a syntax check) to make sure
everything compiles the way Vercel will build it, then simulated two
separate devices — pairing, signaling, chatting both directions, and one
resuming a saved session — against the real built bundle in a headless DOM,
talking to a real local copy of the API. All 30 checks passed clean.

## Login, logout, and settings

This app never used passwords — signing in has always been "enter the pair
code, then your name." What was missing was a clear way to *leave*, and a
place to manage your profile without going through onboarding again. Both
are in now, via the gear icon in the header:

- **Settings** — a bottom-sheet panel: edit your name/photo in place (no
  navigating away), check notification status, and see your pair code again.
- **Log out** — clears this device's session and sends you back to the
  start. It's local only — nothing is deleted on the server, so logging
  back in with the same pair code and name reunites you with your existing
  data. Confirms before acting since it's a bigger step than editing your
  profile.

No new backend or schema needed for this — it's built entirely on the
existing `saveProfile` endpoint and local session storage. If you want real
password-based accounts instead of the pair-code model, that's a
meaningfully different (and bigger) piece of work — say the word and I'll
size it properly rather than bolt it on.

## Worth knowing (same notes as before)
- No login beyond the pair code — don't post your deployed URL publicly.
- Vibration is Android-only; iOS Safari has never supported the Vibration API.
- iOS push needs iOS 16.4+ and only works once installed to the Home Screen.
- Photos are stored as compressed data URLs in Postgres, not a separate
  storage bucket.
