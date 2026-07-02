# ApexLoad

Mobile-first weightlifting tracker: rolling muscle-group rotation, time-budget
workout generation, hands-free rest timer, TUT-isolated progression, and a
schema that's ready for a future Personal Trainer mode.

## Stack
Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage)

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Apply the database schema** to your Supabase project (`ijrdzalguthelzrlumhd`):
   - Easiest: open the Supabase MCP connector in Claude and run `apply_migration`
     with the contents of `supabase/migrations/0001_init.sql`.
   - Or via CLI: `supabase link --project-ref ijrdzalguthelzrlumhd && supabase db push`
   - Or paste the file directly into the Supabase SQL editor and run it.

3. **Environment variables** — copy `.env.example` to `.env.local` and fill in
   your project's anon key (Project Settings → API in the Supabase dashboard):
   ```
   cp .env.example .env.local
   ```

4. **Run it**
   ```
   npm run dev
   ```

## Architecture notes

- **Muscle groups are a global taxonomy**, not user-owned rows. Each user's
  personal rotation order lives in `user_rotation` (a join table), so the
  global exercise catalog can classify exercises by muscle group without
  depending on any one user's private data. A new signup gets seeded with
  the standard Legs → Chest → Shoulders → Arms → Back cycle automatically
  (see the `handle_new_user` trigger), but every user can reorder or edit
  their own `user_rotation` rows independently.
- **TUT isolation**: `sets.training_variant` (`standard` | `tut`) is indexed
  alongside `exercise_id`, and `lib/suggestions.ts` filters strictly on that
  column — a TUT set never influences a standard-set weight suggestion or
  vice versa.
- **Row Level Security** enforces privacy: custom exercises, machine photos,
  sessions, and sets are owner-only by default. `trainer_clients` +
  `is_active_trainer_of()` are wired into the RLS policies for sessions,
  sets, and machine photos already, so turning on PT mode later is a
  front-end task, not a schema migration.
- **Rest timer accuracy**: `lib/audio.ts` computes a wall-clock end
  timestamp (`Date.now() + duration`) rather than trusting `setInterval`
  ticks, so the countdown stays correct even through render hiccups.

## Known web-platform limits (by design, not a bug)

- **No lock-screen / fully-backgrounded audio.** Browsers suspend JS timers
  and audio when the tab is backgrounded or the phone is locked — this is a
  platform limitation, not something fixable in application code. The app
  is built for foreground use (phone unlocked, app in view during a set),
  per your call. If lock-screen reliability becomes a requirement later,
  the code is already Capacitor-compatible — wrapping it native gives
  access to real OS audio sessions.
- **No cross-app audio ducking.** Lowering Spotify/Apple Music's volume
  from a web page isn't possible; that's an OS-level audio-session API
  (`AVAudioSession` / `AudioFocus`) that only native apps can call. The
  chime plays independently at a fixed volume instead.

## What's stubbed for later

- Personal Trainer front-end (schema is ready: `trainer_clients`,
  `assigned_plans`).
- Linking exercises as "alternatives" has a schema + RLS policy
  (`exercise_alternatives`) but no dedicated UI yet — the active workout
  screen's exercise switcher can be wired to it directly.
