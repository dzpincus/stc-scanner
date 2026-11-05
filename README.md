# Stage the Change - Workshop Attendance System

QR check-in for a one-day conference: 200-300 students, 12+ workshops, two time slots. Staff scan at room doors with an offline-first phone app; organizers watch a web dashboard; supervisors get attendance emails afterwards.

| Directory | What | Stack |
|-----------|------|-------|
| `mobile/` | Scanner app (iOS/Android). Scans are saved on the phone first, uploaded in the background, and every phone downloads every room's check-ins. | Expo SDK 54, expo-sqlite, Zustand, supabase-js |
| `admin/` | Dashboard: CSV import with preview, rosters, manual check-in, event lock, phone health panel, supervisor emails. Google sign-in restricted to `@stagethechange.org`. | Next.js 14, Tailwind, Supabase Auth, Gmail API |
| `supabase/` | Postgres schema as plain SQL migrations (multi-year: an `events` row per conference). | Supabase Postgres 17 |
| `scripts/` | QR code PNG generator (the admin Students page can also do this). | Python 3 |

## Start here

- **Working on the code:** `CLAUDE.md` has commands, environment, data model and conventions. `REVIEW.md` has the Nov 2026 review, the 2025 incident analysis and a status log of what was changed.
- **Running the event:** `docs/EVENT_DAY_RUNBOOK.md`.
- **Admin setup:** `admin/README.md`, then `admin/GOOGLE_OAUTH_SETUP.md` (sign-in) and `admin/GOOGLE_WORKSPACE_EMAIL_SETUP.md` (sending email through a service account).
- **Database:** `supabase/README.md` and `supabase/migrations/`.

## How a scan travels

1. Phone looks the registration id up in SQLite and writes an attendance row with `synced = 0`. The success banner means the row is safe on the phone.
2. Within a second the phone calls the `upsert_attendance` RPC. The server keeps one row per `(student, workshop)`, earliest scan wins, and reports a status per row. Rows that fail stay on the phone and retry with backoff.
3. Every phone pulls the event's attendance every two minutes, and sooner when the server signals a change, so a student scanned at one door shows as present on every phone and on the dashboard.
4. Every upload also writes a heartbeat to `devices`. The dashboard shows each phone's unsynced count and last error.

## Per-year reuse

Data for past years stays in the same tables under its own `events` row. Each year: insert a new `events` row, make it the active one, import the CSV, rebuild the phones (the Supabase URL and anon key are baked into the binary).
