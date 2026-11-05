# System Review — November 2026

Scope: full read of `mobile/`, `admin/`, `supabase/`, `scripts/`, git history (27 commits, Nov 2025), and baseline tooling. Goal: explain last year's three incidents, then list everything that should change before the 2026 event (~3 weeks out), prioritized.

Baseline facts:

| Check | Result |
|-------|--------|
| `admin` `tsc --noEmit` | clean |
| `mobile` `tsc --noEmit` | 1 error: `store/useStore.ts` declares `dataVersion`/`incrementDataVersion` but never implements them (Metro ships it anyway) |
| Tests | none |
| CI | none |
| ESLint (admin) | not configured |
| Supabase project | resumable; `stc_backup.sql` dump (gitignored) matches the 3 migrations exactly, no drift |
| Realtime subscription (`subscribeToAttendanceUpdates`) | defined, never mounted |

---

## Part 1 — Incident root causes

### Incident 1: "Room data cleared halfway through the day after a student change"

Timeline (git + 2025 dump): event day was **Fri 2025-11-14** (all scans 14:55-18:30 UTC = 9:55am-1:30pm ET). Commit `505f181` "fix header parsing" landed 09:42 ET that morning. The dump shows the database was rebuilt in the 15 minutes before doors: 537 students and 22 slot-1 workshops created 09:29 ET, 20 slot-2 workshops created 09:41-09:42 ET (second import after the fix), all 538 students re-upserted 09:44 ET. Pre-fix import code (`eec56d8`, Nov 10) had keyed workshops by name only, which is why slot-2 workshops did not exist until the second import.

**Primary mechanism (confirmed in the pre-15:10 code):** the CSV import keyed workshops by **name only** and assigned each name a single time slot (first row match). A mid-day re-import to change one student rewrote *every* student in the file. Any workshop name appearing in both slots, or any name differing by whitespace/case, resolved to the wrong workshop id or created a brand-new workshop row. Rooms' "registered" lists (computed as `students WHERE workshop_slot1_id = X OR workshop_slot2_id = X`) emptied, and the existing attendance rows became "wrong workshop" orphans. Rooms looked wiped on both the dashboard and the phones.

**Secondary mechanisms still present today** (`admin/app/api/import-csv/route.ts`):

1. Workshop upsert always sends `room_location: ws.roomLocation || null` with `ignoreDuplicates: false`. A CSV without a `room_location` column **nulls every room location** on re-import. This is a literal "room data cleared".
2. A blank or unmatched workshop name (anything other than the magic string `No Workshop`) silently sets the student's slot id to `null`.
3. Workshop matching is exact-string on `(workshop_name, time_slot)`. Trailing spaces, curly quotes, or case drift create duplicate workshops and move students off the one that has attendance.
4. There is no dry-run or diff. The "preview" only counts lines.

**Amplifiers in the schema and admin UI:**

- `attendance.student_id` and `attendance.workshop_id` are `ON DELETE CASCADE`. Deleting a student (admin Students page even deletes attendance explicitly first) or a workshop destroys check-ins with no recovery path.
- No audit log, no soft delete, no backups (Supabase free tier has no PITR).
- Phones never purge stale rows and never re-validate `selectedSession`. After a server-side workshop re-creation, a phone keeps scanning against a workshop id that no longer exists, and every upload then fails with an FK violation (see Incident 3).

### Incident 2: "Multiple people on the same room made the data messy"

- **Attendance never flows down.** `syncFromSupabase` downloads only `students` and `workshops`. Each phone's roster is its own scans. Two staff in one room each see a half-empty roster and both check in the same students.
- **Upload is delete-then-insert, last uploader wins.** `syncToSupabase` runs `DELETE WHERE student_id=? AND workshop_id=?` then `INSERT` for every unsynced row. Device B's later upload erases device A's record (different `scanned_at`, device id, manual flag). Two HTTP calls, not atomic.
- **One tap removes a check-in.** Roster rows toggle: present → "Tap to mark absent" (confirm dialog, then a queued `DELETE` that propagates to the server). Fat fingers on a crowded roster delete other devices' work.
- `scanner_device_id` is `deviceName-modelId`, which collides for same-model phones named "iPhone", so attribution is unreliable in the export.
- Realtime was never wired, so there was no live view to notice the thrash.

### Incident 3: "Cell service dropped and submissions never uploaded"

Several independent faults compound here:

1. **One bad record poisons the whole queue.** The upload loop `throw`s on the first failed insert. Rows after it are never attempted; rows before it are inserted but not marked synced (they get deleted and re-inserted next time). An FK violation from a deleted student or a re-created workshop (Incident 1) makes every future sync fail at the same row. UI shows only "Sync Failed".
2. **Delete-then-insert across a flaky link.** If the DELETE lands and the INSERT does not, the server has nothing until the phone retries. If the phone never retries (closed, cleared, battery), the record is gone.
3. **Auto-sync is fragile.** It is a `setInterval` inside the Scan tab only, 30s, no mutex (overlapping syncs on slow links), no `AppState` foreground trigger, no NetInfo reconnect trigger, no backoff. iOS suspends JS timers when the phone is locked. Home and Roster tabs never auto-sync.
4. **No request timeout.** supabase-js uses `fetch` with no `AbortController`. On marginal signal a request can hang for minutes, `isSyncing` stays true, and staff force-quit.
5. `NetInfo.isConnected` is true on captive or degraded networks; the app treats that as online.
6. **"Clear All Data" destroys unsynced rows.** The Home tab Danger Zone deletes `attendance` and `sync_queue` behind a generic confirm that does not mention the unsynced count. Scans that never uploaded are then physically gone.
7. No server-side visibility of which phones still hold unsynced rows, so nobody knew at the end of the day that data was missing.

### What the 2025 dump shows (538 students, 42 workshops, 869 attendance, 52 emails)

| Signal | Value | Reads as |
|--------|-------|----------|
| Attendance with no `scanner_device_id` (admin dashboard manual check-in) | 387 of 869 (45%) | Phones were not trusted or not working for large stretches |
| Mobile vs admin check-ins per hour (UTC) | 14h: 50 mobile / 0 admin. **15h: 10 mobile / 236 admin.** 16h: 194 / 109. 17h: 213 / 28 | Phone uploads stopped for ~1 hour right after doors opened (10-11am ET); staff re-entered slot 1 by hand on the dashboard. Matches Incident 3 (queue poisoned or network) |
| `synced = false` on server rows | 482 (every mobile upload) | Confirms M8: client sends its SQLite `synced` flag |
| Device ids | `iPhone-iPhone14,7` ×141, `iPhone-iPhone17,2` ×49 ... (14 distinct, several same-model collisions likely) | Confirms M7 |
| Students with check-ins in two workshops in the same slot | 31 | Multi-device / wrong-room thrash (Incident 2) |
| Attendance in a workshop the student is not registered for | 47, of which 2 flagged `is_correct_workshop = true` | 2 students had assignments edited after being scanned |
| Workshop name drift | slot-1 `F 2: Short-Form...` vs slot-2 `F 2:  Short-Form...` (double space); a literal `No Workshop` workshop row exists | Confirms A1 normalization gap |
| Workshops with null `room_location` | 2 | |
| Students with zero attendance | 88 | |
| Scans after the event | 3 on 11-15, 3 on 11-16, 8 on 11-26, 1 on 2026-02-26 | Phones still uploading stale queues weeks later; one upload from this year's test |

Deletes leave no trace in this schema, so the mid-day attendance wipe itself cannot be reconstructed from the dump. That is finding D2 (audit history) in one sentence.

---

## Part 2 — Full review findings

Severity: **S1** blocks the event / data loss, **S2** wrong data or security exposure, **S3** quality.

### Mobile (`mobile/`)

| # | Sev | File | Finding |
|---|-----|------|---------|
| M1 | S1 | `lib/sync.ts` | Delete-then-insert upload; throw-on-first-error; no per-row status. (Incidents 2, 3) |
| M2 | S1 | `lib/sync.ts` | No attendance download; realtime never mounted. (Incident 2) |
| M3 | S1 | `app/(tabs)/scan.tsx` | Sync scheduler lives in one screen; no mutex/foreground/reconnect/backoff/timeout. (Incident 3) |
| M4 | S1 | `app/(tabs)/index.tsx` | "Clear All Data" ignores unsynced count. |
| M5 | S2 | `store/useStore.ts` | `selectedSession` and `deviceId` not persisted; app restart loses session; stale workshop id never re-validated against server. Also the TS error. |
| M6 | S2 | `app/(tabs)/roster.tsx` | Single tap on a present student starts a delete. Delete queued by id with no "who/why". |
| M7 | S2 | `lib/sync.ts` | `getDeviceId` collides across identical phones. Should be a per-install UUID stored once. |
| M8 | S2 | `lib/sync.ts` | Upload payload spreads the SQLite row, including `synced: 0`; a server column was added to absorb it. Should map fields explicitly. |
| M9 | S3 | `lib/database.ts` | `getUnsyncedAttendance` has no `ORDER BY`; retries are not deterministic. `bulkInsertStudents` upserts only, never prunes rows deleted on server. |
| M10 | S3 | `app.json` | `newArchEnabled: true` despite "Don't use new arch" / "revert arch" commits during crash fixing. Verify before building. |
| M11 | S3 | `package.json` | `expo-random` is deprecated and unused; `uuid` v13 relies on `react-native-get-random-values` being imported in each screen rather than at the entry point. |
| M12 | S3 | all screens | Success/failure feedback is `Alert.alert` modal per scan; slows throughput at a busy door. Toast/banner + haptic is faster. |

### Database (`supabase/`)

| # | Sev | Finding |
|---|-----|---------|
| D1 | S1 | `attendance` FKs `ON DELETE CASCADE`. Must be `RESTRICT` (or soft delete) during the event. |
| D2 | S1 | No audit trail. A trigger-maintained `attendance_history` table makes every incident recoverable. |
| D3 | S1 | No backup/export job. Free tier has no PITR. |
| D4 | S2 | RLS policies are all `true` for anon, including DELETE on attendance and UPDATE on students. The anon key is in every installed app binary. Anyone with it can read student names and supervisor emails or wipe attendance. |
| D5 | S3 | `sync_queue` and `supervisors` tables are unused server-side. `get_workshop_attendance_summary` is unused. `time_slot IN (1,2)` is hard-coded across schema, UI, emails. |
| D6 | S3 | `attendance.synced` column exists only to absorb a client bug (M8). |

### Admin (`admin/`)

| # | Sev | File | Finding |
|---|-----|------|---------|
| A1 | S1 | `api/import-csv/route.ts` | Re-import nulls `room_location`, nulls unmatched workshop assignments, exact-string workshop matching, no dry-run diff, no BOM stripping on the first header. (Incident 1) |
| A2 | S1 | `students/page.tsx` | Student delete also deletes attendance; no "event mode" guard. Edit of `registration_id` orphans printed QR codes. |
| A3 | S2 | `middleware.ts` | Uses `getSession()` (unverified cookie JWT). Supabase guidance is `getUser()` for authorization decisions. |
| A4 | S2 | `workshops/[id]/page.tsx` | Manual check-in is a plain `insert`; conflicts with a phone upload → 23505 → "Failed to check in". Should upsert on `(student_id, workshop_id)`. CSV export does not quote fields (names with commas break columns). |
| A5 | S2 | `api/send-emails/route.ts` | HTML not escaped (names/notes injected). Re-click resends to everyone; `email_log` never consulted for idempotency. Sends sequentially with no rate handling. |
| A6 | S2 | `page.tsx`, `workshops/page.tsx` | `attendance_rate = attended / registered` can exceed 100% and `absent` can go negative when wrong-workshop check-ins exist. Slot-level rate on the dashboard divides by `attended + absent`, which is `registered`, fine, but overall rate divides by total students, mixing two slots. |
| A7 | S3 | `api/import-csv/route.ts` | Logs every parsed row (student PII) to Vercel logs. |
| A8 | S3 | all client pages | Data fetched with the anon browser client and computed client-side; fine at this scale, but every page re-implements the same stats math. |
| A9 | S3 | repo | No ESLint config; `next lint` is interactive. README/BUILD_COMPLETE.md are stale (dashboard "coming soon"). |

### Process

| # | Sev | Finding |
|---|-----|---------|
| P1 | S1 | No CI: the mobile TS error shipped. A GitHub Action running `tsc` for both apps is 20 lines. |
| P2 | S1 | No event-day runbook: who syncs when, one primary device per room, no imports/deletes during the event, end-of-slot checkpoint. |
| P3 | S2 | No tests around the two pieces of logic that failed: CSV import resolution and sync merge. |

---

## Status log

- **2026-11-02** Decided: resume the 2025 Supabase project and archive 2025 data in place with `event_id` (option a). Applied migrations `20261102210000`-`20261102210005`: events + `event_id` + `current_event_id()`, per-event unique keys, `attendance_history` audit trigger, FK `RESTRICT`, `devices` heartbeat, `upsert_attendance` RPC. Verified with a rolled-back test: RPC statuses correct, earliest-scan merge works, audit rows written, student delete with attendance refused, new rows default to event 2026, same registration id allowed across events. P0 DB items 1-5 done at that point.
- **2026-11-02 (later)** Admin: two-phase, event-scoped CSV import (`admin/lib/csv-import.ts` + vitest, 12 tests) with preview UI; all admin queries scoped to the active event through `admin/lib/event-context.tsx`; event lock toggle in the header (migration `20261102220000_events_update_policy`); delete buttons hidden when locked; student delete no longer pre-deletes attendance (DB RESTRICT refuses, UI explains); manual check-in via `upsert_attendance`; middleware uses `getUser()`. `tsc`, `npm test`, `npm run build` pass. Items 13-16 done.
- **2026-11-02 (later)** Mobile: `lib/sync.ts` rewritten onto the RPC (per-row status, per-row `last_sync_error`, explicit field mapping, 100-row batches), attendance for the active event downloaded and merged into SQLite (server wins unless local row is unsynced and earlier), stale rows pruned after a complete pull, local tables carry `event_id` and purge on event change only when nothing is unsynced, 15s fetch timeout on the Supabase client, single in-flight lock with coalesced reruns, exponential backoff capped at 2 min, device heartbeat to `devices`. New `lib/syncScheduler.ts` mounted in `app/_layout.tsx` (20s tick pushes when pending, attendance pull every 2 min, foreground, reconnect, startup full sync). Store persists `selectedSession` + per-install UUID `deviceId` (hydration started explicitly from the root layout). Scan/manual/roster check-ins trigger an immediate debounced push. Roster: tap on a present student shows who/when, long-press removes (via `delete_attendance` RPC). Home: "Clear All Data" refuses while unsynced > 0, shows event name, last sync error, failed count. `useStore` TS error fixed. `app.json` version 1.1.0. `tsc` passes. Items 7-12 done.
- **2026-11-02 (later)** RLS tightened (migration `20261102230000_rls_tighten`, applied): `is_admin()` = authenticated + `@stagethechange.org` email; anon can only SELECT rows of the active event (students, workshops, attendance, events) and heartbeat `devices`; all anon attendance writes go through `upsert_attendance` (now SECURITY DEFINER, refuses students/workshops outside the active event) and `delete_attendance`; admins get full CRUD incl. new DELETE policies on students/workshops (there were none before, so admin deletes silently affected 0 rows); `attendance_history`, `email_log`, `supervisors`, `sync_queue` admin-only. Verified live with role switching. Anonymous sign-in was dropped from the plan: it gives no protection the anon key does not already leak, and it needs a dashboard toggle. Item 4 done. Item 6 (pg_cron snapshots) dropped: `attendance_history` already holds every row version, so a restore is a SQL query. CI workflow (`.github/workflows/ci.yml`) and `docs/EVENT_DAY_RUNBOOK.md` added; dashboard "Scanner phones" panel added. Items 17-19 done.
- **2026-11-05** P1/P2 pass: scan feedback is a non-blocking banner (modals only for wrong workshop / unknown / error), email route HTML-escapes and skips supervisors already sent unless `resend`, preview matches route logic, selected workshop is reconciled against the server after each reference pull, dashboard math moved to `admin/lib/stats.ts` (walk-ins no longer inflate present or make absent negative), realtime nudge on `attendance` (publication migration `20261105120000`), RFC 4180 CSV export, PII/secret logs removed, ESLint on in admin + CI, docs refreshed and four stale files deleted. 18 admin tests.
- **Remaining before the event**: EAS preview build on every phone (new RLS breaks the 2025 build), two-phone airplane-mode rehearsal, run the Incident 1 CSV through the import preview, tag `v2025-event`, P1 items as time allows. No commits have been made yet.

## Part 3 — Recommended changes

### Options for the sync model

| Option | Description | Effort | Risk | Verdict |
|--------|-------------|--------|------|---------|
| **A. Harden current pull/push** | Upsert with `onConflict (student_id, workshop_id)` first-scan-wins, per-row outcomes, download attendance, root-level scheduler with mutex/timeout/foreground/reconnect triggers | 3-4 days | Low; same architecture staff already know | **Recommended** |
| B. Online-first with outbox | Push each scan immediately, fall back to outbox, realtime roster | 4-5 days | Medium; on bad cell it degrades to A anyway | Take two ideas from it: immediate push after scan, realtime roster as P1 |
| C. Sync engine (PowerSync / WatermelonDB / ElectricSQL) | Replace hand-rolled sync | 1-2 weeks | High in a 3-week window; new native deps | No |

### P0 — must ship before the event

**Database (new migrations, never edit old ones)**

1. `ALTER` attendance FKs to `ON DELETE RESTRICT`.
2. `attendance_history` table + trigger on INSERT/UPDATE/DELETE (row snapshot, operation, `now()`, `auth.uid()`/device id).
3. `devices` table: `device_id, label, last_seen_at, app_version, unsynced_count` updated by a heartbeat on every sync. Dashboard panel "phones with unsynced data".
4. RLS: turn on Supabase anonymous sign-in for the scanner; policies become `auth.role() = 'authenticated'`; students/workshops read-only from the client; attendance insert/update allowed, delete only via an RPC that records the reason. Admin writes stay on the service role. (If this is too much in the window, the minimum is: revoke anon DELETE/UPDATE on `students`/`workshops` and anon DELETE on `attendance`.)
5. Server RPC `upsert_attendance(rows jsonb)` that inserts with `ON CONFLICT (student_id, workshop_id) DO NOTHING` and returns per-row status. One round trip, atomic per row, earliest scan wins.
6. Hourly `pg_cron` snapshot of `attendance` into a dated table, plus an admin "Export everything" CSV button. Confirm `pg_cron` availability on the new project tier; fall back to a GitHub Action calling a service-role export.

**Mobile**

7. `lib/sync.ts`: call the RPC; mark each row synced individually; store `last_error` per row; never delete-then-insert. Download attendance for all workshops on every sync and merge into SQLite (server wins unless local row is unsynced).
8. New `lib/syncScheduler.ts` mounted in `app/_layout.tsx`: mutex, 20s interval, `AppState` → active, NetInfo reconnect, 15s `AbortController` timeout on the Supabase client's `fetch`, exponential backoff on failure, immediate attempt after each scan.
9. Persist `selectedSession` and a generated install `deviceId` with `zustand/middleware` `persist` + AsyncStorage. After each download, verify the selected workshop still exists; if not, clear it and alert.
10. Roster: long-press + typed confirmation to remove a check-in; removal becomes `UPDATE ... voided_at, voided_reason` rather than delete (or the RPC in item 4).
11. Home: "Clear All Data" disabled while unsynced > 0; move it behind a settings screen; show unsynced count and last successful sync prominently on every tab.
12. Fix the `useStore` TS error. Map upload fields explicitly (drop `synced` from payload).

**Admin**

13. Import: two-phase. `POST /api/import-csv?dryRun=1` returns a diff (new students, changed assignments, students in DB but not in CSV, workshops to create, fields that would be cleared). Commit only after the admin confirms. Never write `null` over an existing `room_location`/`capacity`/`description` when the CSV lacks the column. Normalize workshop names (trim, collapse spaces, case-insensitive match against existing). Strip UTF-8 BOM. Treat blank workshop as "leave unchanged", not null.
14. "Event mode" flag (a `settings` row): when on, admin UI hides delete buttons and the import route refuses non-dry-run requests.
15. Middleware `getUser()`.
16. Manual check-in via the same upsert RPC.

**Process**

17. GitHub Action: `tsc --noEmit` for `admin` and `mobile`, `next build` for admin, on every push.
18. Vitest tests for: CSV header mapping + workshop resolution (with BOM, quotes, both-slot workshops, blank cells) and the sync merge function (local unsynced vs server row, first-scan-wins).
19. `docs/EVENT_DAY_RUNBOOK.md`: morning full sync on every phone, one primary scanner per room, end-of-slot "all phones green" checkpoint on the dashboard devices panel, no imports or deletes after doors open, who to call.

### P1 — should ship

- Realtime (`postgres_changes` on `attendance`) feeding the roster so a second device in a room sees the first device's scans within seconds.
- Dashboard math fixes (A6); per-workshop export with proper CSV quoting; device attribution column.
- Emails: HTML-escape, skip supervisors already logged as `sent` for that slot unless "resend" is checked, preview before send.
- Replace per-scan `Alert.alert` with a non-blocking banner + haptic; keep the modal only for wrong-workshop and errors.
- Stop logging PII in the import route.

### P2 — nice to have / future years

- `events` table and `event_id` on workshops/students/attendance so next year does not start from a wiped database.
- ESLint config for admin; delete `BUILD_COMPLETE.md`; refresh README.
- Capacity warnings on the scan screen; check-out flow.

### Out of scope now

- Changing stacks (Expo/Next/Supabase stay).
- Multi-tenant or multi-event UI.
- Native push notifications.

---

## Part 4 — Plan, rollback, success criteria

**Sequence (3 weeks)**

| Week | Work |
|------|------|
| 1 | Stand up new Supabase project; apply existing 3 migrations + P0 schema (items 1-6); mobile sync rewrite (7-12); CI (17) |
| 2 | Admin import dry-run + event mode (13-16); tests (18); load last year's dump (if extractable) into a staging project and replay the Incident 1 CSV against the dry-run |
| 3 | EAS preview builds on every event phone; two-device same-room rehearsal with airplane-mode toggling; runbook (19); P1 items as time allows; production build + freeze |

**Files to modify**

| Path | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/2026…_restrict_fks.sql` | create | D1 |
| `supabase/migrations/2026…_attendance_history.sql` | create | D2 |
| `supabase/migrations/2026…_devices_and_settings.sql` | create | heartbeat + event mode |
| `supabase/migrations/2026…_rls_authenticated.sql` | create | D4 |
| `supabase/migrations/2026…_upsert_attendance_rpc.sql` | create | item 5 |
| `mobile/lib/sync.ts` | rewrite upload/download | M1, M2, M8 |
| `mobile/lib/syncScheduler.ts` | create | M3 |
| `mobile/app/_layout.tsx` | edit | mount scheduler, anonymous sign-in |
| `mobile/store/useStore.ts` | edit | persist, fix TS, install device id |
| `mobile/lib/database.ts` | edit | merge-from-server, per-row error columns, ordering |
| `mobile/app/(tabs)/index.tsx` | edit | clear-data guard, status |
| `mobile/app/(tabs)/roster.tsx` | edit | long-press void instead of tap delete |
| `admin/app/api/import-csv/route.ts` | edit | dry-run diff, normalization, no null overwrite |
| `admin/app/import/page.tsx` | edit | diff review UI |
| `admin/middleware.ts` | edit | getUser |
| `admin/app/workshops/[id]/page.tsx` | edit | upsert check-in, CSV quoting |
| `admin/app/page.tsx` | edit | devices panel, math |
| `.github/workflows/ci.yml` | create | P1 |
| `docs/EVENT_DAY_RUNBOOK.md` | create | P2 |

**Rollback**

- Tag current `main` as `v2025-event` before any change. Each migration ships with a `-- down` block in a comment; FK and RLS changes are reversible with one `ALTER`/`CREATE POLICY`.
- Mobile: keep the 2025 EAS build artifact available; the new build is a distinct version. If the RPC path misbehaves, the client falls back to direct `upsert` with `onConflict` (keep that code path behind a constant).
- Admin deploys on Vercel; rollback is "promote previous deployment".

**Success criteria (checklist)**

- [ ] Two phones in one room, airplane mode toggled on each during scanning, end state on the server has exactly one row per student with the earliest `scanned_at`, and both phones show the full room roster.
- [ ] Killing a phone mid-upload and relaunching results in zero unsynced rows within 60s of reconnect, with no duplicates or deletions on the server.
- [ ] A row that cannot upload (forced FK error in staging) does not block other rows; it is visible on the device and on the dashboard devices panel.
- [ ] Re-importing last year's CSV (or a copy with a missing `room_location` column and a trailing-space workshop name) in dry-run shows the would-be changes and writes nothing; commit mode preserves room locations and does not create duplicate workshops.
- [ ] Deleting a student with attendance is refused by the database.
- [ ] Every attendance mutation appears in `attendance_history`.
- [ ] Anon key can no longer delete or update attendance/students/workshops (verified with curl).
- [ ] `tsc` passes for both apps in CI; import and merge tests pass.
- [ ] "Clear All Data" is disabled while unsynced > 0.
