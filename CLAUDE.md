# stc-scanner — Stage the Change Workshop Attendance

One-day charity conference: ~200-300 students, 12+ workshops, 2 time slots. Staff scan student QR codes at room doors; supervisors get attendance emails afterwards.

Three apps, one Supabase Postgres:

| Dir | What | Stack |
|-----|------|-------|
| `mobile/` | Scanner app (iOS/Android), offline-first | Expo SDK 54, RN 0.81, expo-router 6, expo-sqlite, expo-camera, Zustand, React Query, supabase-js |
| `admin/` | Admin dashboard: import CSV, rosters, manual check-in, supervisor emails | Next.js 14 (app router), Tailwind, @supabase/ssr, nodemailer / Gmail API |
| `supabase/` | Schema migrations + seed | Plain SQL, run in Supabase SQL editor (no CLI config in repo) |
| `scripts/` | QR code PNG generator | Python 3 + `qrcode` |

Deep review and remediation plan from Nov 2026: see `REVIEW.md` (status log inside). Event-day procedure: `docs/EVENT_DAY_RUNBOOK.md`.

## Commands

```bash
# Mobile
cd mobile && npm install
npm start                      # Expo dev server (dev client build required; not Expo Go)
npx tsc --noEmit               # typecheck (Metro does NOT typecheck; run this before shipping)
eas build --profile preview --platform ios|android   # internal distribution build
eas build --profile production --platform all

# Admin
cd admin && npm install
npm run dev                    # http://localhost:3000
npx tsc --noEmit
npm run build                  # Vercel runs this

# QR codes (alternative: admin Students page "Download All QR Codes")
cd scripts && pip install -r requirements.txt && python generate_qr_codes.py students.csv qr_codes/
```

`.github/workflows/ci.yml` runs `tsc` for both apps plus admin lint (`next/core-web-vitals`, `react/no-unescaped-entities` off), tests and build. Mobile has no ESLint. Lint is not configured in `admin` (`next lint` prompts interactively).

## Environment

- Supabase project: ref `mujydfkvozzoltpmjnay`, `https://mujydfkvozzoltpmjnay.supabase.co`, region us-east-2, Postgres 17, org `oilnnsfsoddxgimnfpkx`. Reachable via the Supabase MCP plugin (OAuth). Three migrations are recorded in `supabase_migrations`; use `apply_migration` so new ones are tracked too.
- `mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. **Baked into the binary at build time.** A new Supabase project means a new EAS build on every phone.
- `admin/.env.local`: see `admin/.env.example` (Supabase anon + service role, email provider config, Google service account JSON for Gmail API).
- Admin auth: Google OAuth via Supabase Auth, restricted to `@stagethechange.org` (`admin/middleware.ts`, `admin/lib/supabase-server.ts`).
- Secrets were once committed and purged in commit `a73bb39`; never commit `.env*`, `supabase/.temp`.

## Data model (supabase/migrations)

Applied through 2026-11-02 (`supabase_migrations.schema_migrations` tracks them; apply new ones with the MCP `apply_migration`, one at a time, and avoid `DROP` statements where possible because the client auto-cancels them).

- `events (id, slug '2025'|'2026', name, event_date, is_active, locked)` — exactly one `is_active` row (partial unique index). `current_event_id()` returns it and is the default `event_id` on workshops/students/email_log. `locked = true` means doors are open and the admin must refuse deletes and non-dry-run imports.
- `workshops (id, event_id, workshop_name, time_slot 1|2, room_location, capacity)` — UNIQUE `(event_id, workshop_name, time_slot)`.
- `students (id, event_id, registration_id, student_name, supervisor_name, supervisor_email, workshop_slot1_id, workshop_slot2_id)` — UNIQUE `(event_id, registration_id)`. Registration ids may repeat across years, so every lookup must filter by event.
- `attendance (id, event_id, student_id, workshop_id, scanned_at, scanner_device_id, is_correct_workshop, manually_added, synced)` — UNIQUE `(student_id, workshop_id)`. `event_id` is set by trigger from the student. All FKs are `ON DELETE RESTRICT`.
- `attendance_history` — trigger-written audit of every insert/update/delete on attendance (row JSON, role, uid, device). Read-only from clients.
- `devices (device_id, label, platform, app_version, selected_workshop_id, last_seen_at, last_sync_at, unsynced_count, last_error)` — phone heartbeat, upserted on every sync.
- `upsert_attendance(rows jsonb)` RPC — batch upload, savepoint per row, earliest `scanned_at` wins. Returns `(id, status, server_id, detail)` with status `inserted | merged_earlier | already_synced | duplicate | error`. Clients mark everything except `error` as synced.
- `email_log`, `supervisors` (flags unused), `sync_queue` (server copy unused; mobile has its own SQLite `sync_queue` for deletes).
- QR code payload = `students.registration_id` (plain text).
- RLS (migration `20261102230000`): `is_admin()` = authenticated user with an `@stagethechange.org` email. anon (phones) can SELECT only rows of the active event and upsert `devices`; every anon attendance write goes through `upsert_attendance` / `delete_attendance` (SECURITY DEFINER, active event only). Admin browser pages run as the signed-in admin; API routes use the service role. Mobile builds before 1.1.0 cannot write attendance any more.
- `delete_attendance(ids uuid[])` RPC — phone roster "remove check-in"; audited by the history trigger.
- 2025 data (538 students, 42 workshops, 869 attendance) is archived in place under event slug `2025`. Never truncate it.

## How the pieces talk

1. Admin imports a CSV (`admin/app/api/import-csv/route.ts`): upserts workshops by `(name, slot)`, then upserts students by `registration_id`. Two-phase: `dryRun=1` returns an `ImportPlan` diff (pure logic in `admin/lib/csv-import.ts`, unit-tested with `npm test`), `dryRun=0` applies it. Scoped to the active event, refused (423) when `events.locked`. Workshops match by normalized `(name, slot)`; rooms are never blanked; blank workshop cells keep the current assignment ("No Workshop" clears); students missing from the CSV are listed, never deleted.
2. Mobile sync (`mobile/lib/sync.ts`, `syncNow`): fetch active event → optionally pull students/workshops (purges local tables when the event changed and nothing is unsynced) → push pending deletions and `attendance WHERE synced = 0` through `upsert_attendance` in 100-row batches, marking rows individually → optionally pull all attendance for the event and merge into SQLite (server wins unless the local row is unsynced and earlier) → heartbeat `devices`. One in-flight lock; concurrent calls coalesce into one rerun. `mobile/lib/syncScheduler.ts` (mounted in `app/_layout.tsx`) triggers it: 20s tick when pending, attendance pull every 2 min, foreground, reconnect, startup. Backoff on failure, capped at 2 min. Supabase fetch has a 15s timeout (`mobile/lib/supabase.ts`).
3. Scan (`mobile/app/(tabs)/scan.tsx`): lookup by registration_id in SQLite, insert attendance locally (`synced = 0`), then `requestPush()` (debounced 750ms). Because attendance is downloaded, a student scanned on another phone shows "Already Checked In" here too.
4. Admin dashboard polls all three tables every 30s (filtered by the active event from `admin/lib/event-context.tsx`) and computes stats client-side via `admin/lib/stats.ts` (present = scans by registered students; walk-ins counted separately). CSV downloads go through `admin/lib/csv.ts`. Realtime: `attendance` is in the `supabase_realtime` publication; phones use change events only as a debounced nudge to pull. The header shows the active event and its lock toggle; delete buttons hide when locked. Manual check-in goes through `upsert_attendance`. Emails (`admin/app/api/send-emails/route.ts`) group students by `supervisor_email` per slot, HTML-escape everything, and skip supervisors already logged `sent` for that slot unless `resend: true`.

## Conventions

- Dylan's global standards apply (`~/.claude/CLAUDE.md`): single-line commits, KISS, edit over create, backward compatibility explicit.
- Schema changes go in a new file under `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`; never edit applied migrations.
- Mobile booleans are stored as INTEGER 0/1 in SQLite and converted to real booleans before upload. Keep that boundary in `mobile/lib/sync.ts`.
- `mobile/lib/supabase.ts` exports a lazy `supabase` Proxy; do not access it at module top level (production crash history: commits around 2025-11-06). Same rule for the zustand store: it uses `persist` with `skipHydration: true`; the root layout calls `useStore.persist.rehydrate()` after `initDatabase()`.
- Local SQLite schema changes go through `ensureColumn` in `mobile/lib/database.ts` (additive `ALTER TABLE`), never by editing the `CREATE TABLE` block alone, because installed phones already have the old tables.
- `mobile/app.json` version must be bumped whenever the server contract changes; the dashboard devices panel shows each phone's version.
- `newArchEnabled` in `mobile/app.json` was flipped off and back on during 2025 crash fixes; verify before an EAS build.

## Event-day invariants (do not break)

- A scan must never be lost once the phone shows a success alert. Local SQLite row is the source of truth until the server confirms.
- Never delete rows from `students` or `workshops` during the event; never run a CSV import during the event without a dry-run diff.
- One `(student, workshop)` attendance row; earliest scan wins across devices.
