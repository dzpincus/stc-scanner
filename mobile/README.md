# Stage the Change - Mobile Scanner App

A mobile application for scanning student QR codes and tracking attendance at workshop events.

## Features

- **QR Code Scanning**: Fast camera-based QR code scanning for student check-in
- **Offline-First**: Works without internet connection, syncs when online
- **Multi-Device**: Multiple scanners can operate simultaneously
- **Real-Time Sync**: Attendance data syncs across all devices
- **Session Management**: Select and switch between workshop sessions
- **Roster View**: View all students registered for a workshop
- **Manual Check-In**: Add students manually if QR code fails
- **Wrong Workshop Alert**: Warns when student scans into incorrect workshop

## Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Database**: SQLite (local) + Supabase (cloud)
- **State Management**: Zustand
- **Data Fetching**: React Query (planned)
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

1. **Launch the app** on all scanner devices
2. **Initial sync**: On the home screen, tap "Sync from Supabase" to download:
   - All student registrations
   - Workshop schedules
3. **Select session**: Choose which workshop session you're scanning for
4. **Start scanning**: Navigate to the Scan tab

### Scanning Students

1. Point camera at student's QR code
2. App automatically:
   - Validates registration ID
   - Checks if student is registered for this workshop
   - Records attendance with timestamp
   - Shows confirmation or warning
3. Continue scanning next student

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
- Automatically syncs when connection restored

### Sync Status

The app shows sync status in the header:
- **Green**: Online, all synced
- **Yellow**: Online, pending sync
- **Gray**: Offline mode
- **Red**: Sync error

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

### Android

```bash
eas build --platform android --profile production
```

### iOS

```bash
eas build --platform ios --profile production
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

1. Check internet connection
2. Verify Supabase credentials in `.env`
3. Check Supabase RLS policies are enabled
4. Review console logs for errors

### SQLite Errors

If database gets corrupted:
1. Clear app data (or reinstall)
2. Re-sync from Supabase

## Support

For issues or questions:
1. Check the main project README
2. Review the technical specification
3. Contact the development team

## License

Copyright 2025 Stage the Change. All rights reserved.
