# Testing Guide - Stage the Change Scanner App

## Pre-Testing Setup Checklist

### 1. Supabase Setup ✓
- [ ] Created Supabase project
- [ ] Ran schema migration (`supabase/migrations/20251023000000_initial_schema.sql`)
- [ ] Ran test data seed (`supabase/seed_test_data.sql`)
- [ ] Verified tables created (students, workshops, attendance, etc.)
- [ ] Copied API credentials to mobile/.env

### 2. Environment Configuration ✓
- [ ] Created `mobile/.env` file
- [ ] Added `EXPO_PUBLIC_SUPABASE_URL`
- [ ] Added `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 3. Generated Test QR Codes ✓
- [ ] Ran `python generate_qr_codes.py sample_students.csv test_qr_codes/`
- [ ] Verified QR codes created in `test_qr_codes/` folder
- [ ] Can print or display QR codes for scanning

## Running the App

### Start Development Server

```bash
cd mobile
npm start
```

### Options to Run:
1. **iOS Simulator** (Mac only): Press `i`
2. **Android Emulator**: Press `a`
3. **Physical Device**: Scan QR code with Expo Go app
   - [iOS - App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android - Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Testing Flow

### Test 1: Initial App Launch
**Expected Behavior:**
1. App launches successfully
2. Shows Home tab with "Stage the Change Scanner" title
3. Database initializes (check console for "Database initialized successfully")
4. Stats show 0 for all counts
5. Device ID appears below title
6. Sync status shows "Not synced" (gray)

**What to Check:**
- No crashes or errors
- All UI elements render correctly
- Device ID is displayed

---

### Test 2: Sync Data from Supabase
**Steps:**
1. On Home tab, tap "Full Sync" button
2. Wait for sync to complete

**Expected Behavior:**
1. Sync status changes to "Syncing..." (orange with spinner)
2. Alert shows: "Downloaded: X students, Y workshops"
3. Stats update:
   - Students: 10
   - Workshops: 12
   - Check-Ins: 0
   - Unsynced: 0
4. Sync status shows "Synced X ago" (green)

**What to Check:**
- Alert displays correct counts
- Database stats update
- No errors in console
- Sync status indicator works

**Troubleshooting:**
- If sync fails with "No network connection":
  - Check internet connection
  - Verify Supabase credentials in .env
- If sync fails with database error:
  - Ensure migration ran successfully in Supabase
  - Check RLS policies are enabled

---

### Test 3: Select Workshop Session
**Steps:**
1. Tap "Select Workshop Session" button
2. Modal appears with time slot selector
3. Try both time slots (1 and 2)
4. Select a workshop (e.g., "Art Workshop")

**Expected Behavior:**
1. Modal shows workshops grouped by time slot
2. Workshops display name, room location, capacity
3. Selected workshop highlighted with blue border and checkmark
4. After selection, modal closes
5. Home screen shows selected session info

**What to Check:**
- All 12 workshops appear (6 per slot)
- Workshop details display correctly
- Selection persists when returning to Home tab
- "Change" button appears after selection

---

### Test 4: QR Code Scanning
**Steps:**
1. Navigate to "Scan" tab
2. Grant camera permission when prompted
3. Point camera at a test QR code (e.g., STU001)

**Expected Behavior:**
1. Camera permission request appears
2. After granting, camera view shows
3. Session info displays at top
4. Scanning frame appears with blue corners
5. When QR code scanned:
   - Brief "Processing..." message
   - Success alert: "✓ Check-In Successful - [Student Name]"
   - Haptic vibration (single short vibrate)
   - Student appears in "Recent Check-Ins" list at bottom
   - Scanning resumes after 2 seconds

**What to Check:**
- Camera works and focuses
- QR code detected quickly (< 1 second)
- Student name correct in alert
- Recent list updates
- Can scan multiple codes sequentially

**Special Cases to Test:**

**Case 1: Wrong Workshop**
1. Select "Music Workshop" (Slot 1)
2. Scan STU001 (registered for Art Workshop)

**Expected:**
- Alert shows "⚠️ Wrong Workshop"
- Message indicates correct workshop
- Attendance still recorded
- Warning icon appears in recent list

**Case 2: Already Checked In**
1. Scan same QR code twice

**Expected:**
- Alert: "Already Checked In"
- Double vibration pattern
- No duplicate attendance record

**Case 3: Student Not Found**
1. Scan invalid/unknown QR code

**Expected:**
- Alert: "Student Not Found"
- Message shows registration ID
- Reminder to sync student list

---

### Test 5: Manual Check-In
**Steps:**
1. From Scan tab, tap "Manual Check-In"
2. Start typing student name (e.g., "Alice")
3. Tap on student from results
4. Confirm check-in

**Expected Behavior:**
1. Modal opens with search interface
2. As you type, matching students appear
3. Search works for name, ID, and supervisor
4. Tapping student shows confirmation
5. Success alert appears
6. Option to "Check In Another" or "Done"

**What to Check:**
- Search is fast and responsive
- Shows correct student details
- Duplicate check works (try checking in same student twice)
- Wrong workshop warning still appears

---

### Test 6: Roster View
**Steps:**
1. Navigate to "Roster" tab
2. Check different filter tabs
3. Try searching for students
4. Pull to refresh

**Expected Behavior:**
1. Shows all students registered for selected workshop
2. Stats display at top:
   - Present: count of checked-in students
   - Absent: count not checked in
   - Total: total registered
   - Rate: percentage present
3. Filter tabs work:
   - All: shows everyone
   - Present: only checked-in (green checkmark)
   - Absent: only not checked-in (gray circle)
4. Search filters results instantly
5. Pull-to-refresh updates the list

**What to Check:**
- Stats calculations are correct
- Checkmarks appear for scanned students
- Warning icon for wrong workshop check-ins
- Search works correctly
- Refresh updates data

---

### Test 7: Offline Mode
**Steps:**
1. Check in a few students
2. Enable airplane mode / disconnect WiFi
3. Try scanning more QR codes
4. Check sync status
5. Reconnect to internet
6. Wait or tap "Upload Attendance"

**Expected Behavior:**
1. App continues to work offline
2. QR scanning still functions
3. Sync status shows "Offline" (gray)
4. "Unsynced" count increases
5. After reconnect:
   - Auto-sync occurs (or manual tap)
   - Unsynced count goes to 0
   - Sync status shows "Synced" (green)

**What to Check:**
- No crashes when offline
- Data persists locally
- Sync recovers when back online
- No duplicate records created

---

### Test 8: Multi-Device Scenario (if you have 2 devices)
**Steps:**
1. Install app on two devices
2. Sync both devices
3. Select same workshop on both
4. Check in different students on each device
5. Wait 30 seconds (auto-sync)
6. Refresh roster on both

**Expected Behavior:**
1. Both devices sync successfully
2. Attendance from both appears in Supabase
3. After sync, both devices show all check-ins
4. No conflicts or duplicates

**What to Check:**
- Real-time sync works
- No data loss
- Roster updates across devices

---

### Test 9: Session Switching
**Steps:**
1. Select workshop in Slot 1
2. Check in some students
3. Switch to different workshop in Slot 1
4. Check roster
5. Switch to workshop in Slot 2

**Expected Behavior:**
1. Can switch sessions easily
2. Roster updates to show correct students
3. Previous check-ins preserved
4. Scan tab updates session info

**What to Check:**
- Session selection persists
- Data doesn't mix between sessions
- UI updates correctly

---

### Test 10: Error Handling
**Scenarios to Test:**

**A. Invalid QR Code**
1. Show app a non-student QR code
2. Expected: "Invalid QR Code" alert

**B. Camera Denied**
1. Deny camera permission
2. Expected: Permission request screen with "Grant Permission" button

**C. No Session Selected**
1. Clear session (or start fresh)
2. Go to Scan tab
3. Expected: "No Workshop Selected" screen

**D. No Data Synced**
1. Clear all data
2. Try to select workshop
3. Expected: "No Workshops Found" with sync reminder

---

## Performance Testing

### Load Test
1. Sync 10+ students
2. Check in all students rapidly
3. Switch between tabs quickly

**Expected:**
- No lag or crashes
- UI remains responsive
- Database operations complete quickly

### Stress Test
1. Scan same QR code repeatedly
2. Rapid tab switching
3. Multiple sync operations

**Expected:**
- Duplicate prevention works
- No race conditions
- Graceful handling

---

## Known Limitations

1. **Camera Focus**: May need good lighting for QR codes
2. **Sync Delay**: Auto-sync every 30 seconds, not instant
3. **Node Version**: Warning messages about Node 18.7 (app still works)

---

## Reporting Issues

If you encounter bugs, note:
1. What you were doing
2. Expected vs actual behavior
3. Any error messages in console
4. Device/platform (iOS/Android/simulator)
5. Steps to reproduce

Check console with: `Ctrl+M` (Android) or `Cmd+D` (iOS) → "Show Dev Menu" → "Debug JS Remotely"

---

## Success Criteria

✓ App launches without crashes
✓ Data syncs from Supabase
✓ QR codes scan successfully
✓ Wrong workshop detection works
✓ Duplicate prevention works
✓ Manual check-in works
✓ Roster updates correctly
✓ Offline mode functions
✓ Multi-device sync works
✓ No data loss or corruption

---

## Next Steps After Testing

1. Test with real student data
2. Generate production QR codes
3. Build production app with EAS
4. Deploy to event staff devices
5. Create quick reference guide for event day
