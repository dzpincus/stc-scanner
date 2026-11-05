# Stage the Change - Mobile Scanner App

A mobile application for scanning student QR codes and tracking attendance at workshop events.

## Features

- **QR Code Scanning**: Fast camera-based QR code scanning for student check-in
- **Offline-First**: Every scan is saved in SQLite before anything touches the network
- **Multi-Device**: Several phones can scan the same room; the server keeps one row per student and workshop, earliest scan wins
- **Shared Roster**: Each phone downloads the whole event's attendance (every 2 minutes, sooner on a realtime nudge), so a student scanned at another door shows as present here too
- **Session Management**: Select and switch between workshop sessions
- **Roster View**: View all students registered for a workshop
- **Manual Check-In**: Add students manually if QR code fails
- **Wrong Workshop Alert**: Warns when student scans into incorrect workshop

## Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Database**: SQLite (local) + Supabase (cloud)
- **State Management**: Zustand
- **Data Fetching**: React Query (roster screens)
- **Camera**: expo-camera
- **QR Scanning**: Built into expo-camera

## Prerequisites

- Node.js 18+ (20.19.4+ recommended)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Supabase account and project

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project dashboard under **Settings** > **API**.

### 3. Set Up Supabase Database

Follow the instructions in `/supabase/README.md` to:
1. Create a Supabase project
2. Run the database migration
3. Get your API credentials

### 4. Start Development Server

```bash
npm start
```

This will start the Expo development server. You can then:
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan the QR code with Expo Go app on your physical device

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home/Setup screen
│   │   ├── scan.tsx       # Scanning screen
│   │   └── roster.tsx     # Roster view
│   ├── session-select.tsx # Workshop selection
│   └── manual-checkin.tsx # Manual check-in modal
├── components/            # React components
├── lib/                   # Core library code
│   ├── types.ts          # TypeScript types
│   ├── supabase.ts       # Supabase client
│   ├── database.ts       # SQLite operations
│   └── sync.ts           # Sync logic
├── hooks/                # Custom React hooks
├── store/                # Zustand state store
│   └── useStore.ts
├── utils/                # Utility functions
├── app.json              # Expo configuration
└── package.json          # Dependencies
```

## Usage

### First Time Setup (Event Day)

1. **Launch the app** on all scanner devices (build 1.1.0 or later; older builds cannot write attendance under the current database policies)
2. **Initial sync** happens on launch. Home tab → **Full Sync** to confirm; the student count should match the dashboard
3. **Select session**: Choose which workshop you're scanning for (remembered across restarts)
4. **Start scanning**: Navigate to the Scan tab

Full procedure: `../docs/EVENT_DAY_RUNBOOK.md`.

### Scanning Students

1. Point camera at student's QR code
2. App automatically:
   - Validates registration ID
   - Checks if student is registered for this workshop
   - Records attendance with timestamp
   - Shows a green banner (checked in) or orange banner (already checked in, here or on another phone); only wrong-workshop, unknown-student and errors show a dialog
3. Continue scanning next student; the camera resumes on its own

### Handling Issues

**Student registered for different workshop:**
- App shows warning alert
- Scanner can choose to:
  - Mark as "wrong workshop" attendance
  - Cancel and direct student to correct room

**QR code won't scan:**
- Use "Manual Check-In" button
- Search by name or registration ID
- Manually add attendance record

**No internet connection:**
- App continues to work normally
- All scans saved to local database
- Uploads retry every 20 seconds, immediately after each scan, when the app returns to the foreground and when the network comes back

**Removing a check-in:** Roster tab → press and hold the student → Remove. Audited on the server and visible on every device after the next sync.

### Sync Status

The app shows sync status in the header:
- **Green**: Online, all synced
- **Orange with a count**: scans waiting to upload (normal for a few minutes on bad cell)
- **Gray**: Offline mode

The Home tab shows the last sync error text, the number of rows the server rejected, and refuses "Clear All Data" while anything is unsynced.

### How sync works

`lib/sync.ts` (`syncNow`) is the single entry point and holds one in-flight lock: fetch the active event → pull students/workshops → push pending rows through the `upsert_attendance` RPC in batches (each row marked synced individually) → pull the event's attendance and merge it into SQLite (server wins unless the local row is unsynced and earlier) → heartbeat to `devices`. `lib/syncScheduler.ts`, mounted in the root layout, decides when to call it. Requests time out after 15s; failures back off up to 2 minutes.

## Development

### Adding New Features

1. **Create new screens** in `app/` directory
2. **Add components** in `components/`
3. **Database operations** go in `lib/database.ts`
4. **API calls** go in `lib/supabase.ts`
5. **State management** via `store/useStore.ts`

### Running on Physical Device

For best camera performance, test on a real device:

1. Install Expo Go app:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Scan QR code from development server

3. For production, build with EAS:
   ```bash
   npm install -g eas-cli
   eas build --platform android
   eas build --platform ios
   ```

### Debugging

```bash
# View logs
npm run start -- --clear

# Reset database
# (Warning: This clears all local data)
# Add this in app code:
import * as db from './lib/database';
await db.clearAllData();
```

## Building for Production

The Supabase URL and anon key from `.env` are baked into the binary, and every change to the server contract needs a new build on every phone. Bump `version` in `app.json` first; the dashboard's phone panel shows which version each phone runs.

```bash
npx tsc --noEmit                                   # Metro does not typecheck
eas build --profile preview --platform ios|android  # internal distribution
eas build --profile production --platform all
```

## Troubleshooting

### Camera Permission Denied

Make sure `app.json` has camera permissions configured:
```json
{
  "plugins": [
    ["expo-camera", {
      "cameraPermission": "Allow app to access camera"
    }]
  ]
}
```

### Sync Not Working

1. Home tab: read the "Last sync problem" banner
2. Check internet connection; try **Upload Attendance**
3. "not in the active event": the phone holds data from a different event. It will switch on the next Full Sync once nothing is unsynced
4. Build older than 1.1.0: uploads are refused by the database. Install the current build

### SQLite Errors

If database gets corrupted:
1. Clear app data (or reinstall)
2. Re-sync from Supabase

## Support

1. `../docs/EVENT_DAY_RUNBOOK.md` for event-day symptoms
2. `../CLAUDE.md` and `../REVIEW.md` for how the system fits together
3. Contact Dylan Pincus

## License

Copyright 2025 Stage the Change. All rights reserved.
