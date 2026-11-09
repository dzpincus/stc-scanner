# Event Day Runbook

One page for whoever is running the admin dashboard and handing out phones. Written against the 2026 build (mobile 1.1.0, RLS tightened, `upsert_attendance` sync).

## The week before

- [ ] Final CSV import done through **Import Data → Preview → Apply**. Read the preview: zero "skipped rows", no unexpected "new workshops" (a new workshop usually means a spelling change, not a new session).
- [ ] Known rooms are typed into the Room column on the Workshops page (saves on Enter or click-away; header shows how many are set). Rooms are optional: a workshop without one shows "No room assigned" on phones and scanning works the same. Phones pick up room changes on app start or **Full Sync**.
- [ ] QR codes printed from the Students page ("Download All QR Codes").
- [ ] Every event phone has the current EAS build installed (Home tab shows `v1.1.0` or later next to the device name) and the app opened once on Wi-Fi so it downloads students, workshops and the event.
- [ ] Dashboard "Scanner phones" panel lists every phone, all green.

## Morning of

1. **Lock the event.** Admin dashboard header → click **Unlocked** → confirm. The badge turns red: imports and deletes are now refused everywhere until an admin unlocks. Do not unlock during the day.
2. On each phone: open the app on Wi-Fi, Home tab → **Full Sync**. Confirm the student count matches the dashboard. Select the room's workshop for slot 1.
3. Assign **one primary scanner per room**. A second phone may scan the same room; duplicates are harmless (earliest scan wins, the second phone shows "Already Checked In"), but one primary keeps the staff flow simple.
4. Assign one person to watch the dashboard. Their only job during a slot is the "Scanner phones" panel.

## During a slot

- A scan is saved on the phone the moment the success alert shows. Cell service only affects when it reaches the dashboard, never whether it does.
- Phones upload automatically every 20 seconds while there is anything pending, immediately after each scan, when the app comes back to the foreground, and when the network comes back. Staff do not need to press anything.
- The Scan tab status pill: **green** synced, **orange with a count** pending upload, **grey** offline. Orange for a few minutes on bad cell is normal.
- Wrong-room scans are recorded and flagged; do not turn students away, let the data show it.
- Manual check-in (no QR): Scan tab → **Manual Check-In**, or Roster tab → tap an absent student. Dashboard → workshop → "Check in" does the same from the laptop.
- Removing a check-in: Roster tab → **press and hold** the student → Remove. This is audited and visible on every device after the next sync. Do it only for a genuine mistake.

## Between slots (the checkpoint)

1. Dashboard "Scanner phones": every row green, **Unsynced = 0**, last seen under a minute. If a phone is red: walk to it, open the app (foreground triggers a sync), check it has signal or Wi-Fi, press **Upload Attendance** on the Home tab. The Home tab shows the last error text if an upload is being rejected.
2. Only after all phones are green: phones switch to their slot 2 workshop (Home tab → Change).
3. Do **not** "Clear All Data" on any phone. The button refuses while anything is unsynced; there is no reason to use it on event day.

## End of day

1. Same checkpoint: all phones green, unsynced 0.
2. Dashboard → Emails → preview a slot → Send. Check the log table for failures.
3. Unlock the event only if a correction is needed afterwards; otherwise leave it locked.

## If something goes wrong

| Symptom | What it means | Do this |
|---------|---------------|---------|
| Phone stuck orange, count not dropping, Home tab shows "Last sync problem: … not in the active event" | Phone has stale data from a different event | Finish uploading what it can, then Full Sync; if it refuses to switch events, note the count and call Dylan |
| Phone shows "Student Not Found" for a valid QR | Phone never downloaded students, or the CSV was changed after the morning sync | Home → Full Sync on Wi-Fi |
| Dashboard numbers lower than the room count | Phones still uploading | Wait for the checkpoint; check the phones panel |
| Admin accidentally needs to change a student mid-day | Allowed: edit on Students page. Deletes are blocked by the lock and by the database if the student has scans | Edit, never delete |
| A phone is lost or dies with orange count | Scans on that phone are not on the server | Its row stays red on the dashboard with its last unsynced count; recover the device later and open the app, it will upload. If unrecoverable, the room's paper list is the fallback |

Everything written to `attendance` is also copied to `attendance_history` (insert, update, delete, with who/which device). Nothing on event day is unrecoverable from the SQL editor.

Contact: Dylan Pincus.
