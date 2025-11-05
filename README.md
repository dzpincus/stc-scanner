# Stage the Change - Workshop Attendance System

A mobile-first attendance tracking system for workshop events with offline capabilities, multi-device support, and automated reporting.

## Overview

This system enables efficient attendance tracking for events with 200-300 students across multiple workshop sessions. Key features include:

- ✅ **Offline-First Mobile App**: React Native app works without internet
- ✅ **QR Code Scanning**: Fast, contactless student check-in
- ✅ **Multi-Device Support**: Multiple scanners operate simultaneously
- ✅ **Real-Time Sync**: Attendance data syncs across all devices
- 📧 **Email Reports**: Automated attendance reports to supervisors (coming soon)
- 📊 **Admin Dashboard**: Web interface for monitoring and management (coming soon)

## Project Structure

```
stc-scanner/
├── mobile/                 # React Native mobile scanner app
│   ├── app/               # Expo Router screens
│   ├── components/        # React components
│   ├── lib/               # Core libraries (database, sync, types)
│   ├── store/             # State management
│   └── README.md          # Mobile app documentation
├── supabase/              # Database schema and migrations
│   ├── migrations/        # SQL migration files
│   └── README.md          # Database setup guide
├── scripts/               # Utility scripts
│   ├── generate_qr_codes.py  # QR code generator
│   ├── sample_students.csv   # Example data
│   └── README.md          # Scripts documentation
├── admin/                 # Admin dashboard (coming soon)
└── STAGE_THE_CHANGE_TECHNICAL_SPEC.md  # Full technical specification
```

## Quick Start

### 1. Database Setup (5 minutes)

1. Create a [Supabase](https://supabase.com) account and project
2. Run the database migration:
   ```bash
   # Copy SQL from supabase/migrations/20251023000000_initial_schema.sql
   # Paste into Supabase SQL Editor and run
   ```
3. Get your API credentials from Supabase dashboard

See [supabase/README.md](supabase/README.md) for detailed instructions.

### 2. Generate QR Codes (10 minutes)

1. Prepare student data in CSV format
2. Install Python dependencies:
   ```bash
   cd scripts
   pip install -r requirements.txt
   ```
3. Generate QR codes:
   ```bash
   python generate_qr_codes.py students.csv qr_codes/
   ```

See [scripts/README.md](scripts/README.md) for more details.

### 3. Mobile App Setup (15 minutes)

1. Install dependencies:
   ```bash
   cd mobile
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. Start development server:
   ```bash
   npm start
   ```

4. Scan QR code with Expo Go app or use a simulator

See [mobile/README.md](mobile/README.md) for complete setup guide.

## Event Day Workflow

### Preparation (Morning of Event)

1. **Import Data**: Load student registrations and workshop schedules into Supabase
2. **Configure Devices**: Install mobile app on all scanner devices (iOS/Android)
3. **Initial Sync**: Open app on each device and sync from Supabase
4. **Assign Sessions**: Each scanner selects their workshop session
5. **Test Scan**: Verify QR code scanning works

### During Event

1. **Check-In**: Students scan QR codes at workshop entrance
2. **Monitor**: View real-time attendance on admin dashboard
3. **Handle Issues**: Use manual check-in for missing/damaged QR codes
4. **Sync**: App automatically syncs attendance every 30 seconds

### After Event

1. **Final Sync**: Ensure all devices have synced
2. **Send Reports**: Trigger email reports to supervisors
3. **Export Data**: Download attendance reports from admin dashboard

## Technology Stack

### Mobile App
- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Local Database**: expo-sqlite
- **Cloud Database**: Supabase (PostgreSQL)
- **State**: Zustand
- **Camera**: expo-camera

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Functions**: Supabase Edge Functions

### Admin Dashboard (Coming Soon)
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui

### Scripts
- **Language**: Python 3.8+
- **QR Codes**: qrcode library
- **Data Import**: Google Sheets API

## System Requirements

### For Development
- Node.js 18.17+ (20.19.4+ recommended)
- Python 3.8+
- Supabase account (free tier)

### For Event Day Scanners
- iOS 13+ or Android 8+
- Camera permission enabled
- Expo Go app (for development) or built app (for production)
- Internet connection (for initial sync and periodic updates)

### For Admin Dashboard
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

## Key Features Explained

### Offline-First Architecture

The mobile app stores all data locally in SQLite and works completely offline. When internet is available, it syncs with Supabase:

1. **Download**: Student lists and workshop schedules
2. **Upload**: Attendance records and check-ins
3. **Real-time**: See updates from other devices instantly

### Multi-Device Coordination

Multiple scanners can operate simultaneously without conflicts:
- Each attendance record has a unique ID
- Duplicate check-ins prevented by database constraint
- Real-time sync keeps all devices updated
- Conflict resolution via "last-write-wins"

### QR Code System

Each student receives a unique QR code containing their registration ID:
- Fast scanning (< 1 second)
- Works offline
- Validates against expected workshop
- Alerts if student scans at wrong session

## Development Status

### ✅ Completed (Phase 1)
- [x] Database schema and migrations
- [x] Mobile app project initialization
- [x] TypeScript type definitions
- [x] SQLite database operations
- [x] Supabase sync logic
- [x] State management setup
- [x] QR code generation script
- [x] Environment configuration
- [x] Documentation

### 🚧 In Progress (Phase 2)
- [ ] Mobile app UI screens
- [ ] QR scanning implementation
- [ ] Attendance recording logic
- [ ] Real-time sync integration

### 📋 Planned (Phase 3+)
- [ ] Admin dashboard
- [ ] Email reporting system
- [ ] Google Sheets integration
- [ ] Testing and bug fixes
- [ ] Production deployment

## Documentation

- [Technical Specification](STAGE_THE_CHANGE_TECHNICAL_SPEC.md) - Complete system design
- [Mobile App Guide](mobile/README.md) - Mobile app setup and usage
- [Database Setup](supabase/README.md) - Supabase configuration
- [Scripts Guide](scripts/README.md) - Utility scripts documentation

## Support

### Common Issues

**Mobile app won't sync:**
- Check internet connection
- Verify Supabase credentials in `.env`
- Ensure RLS policies are enabled in Supabase

**QR codes won't scan:**
- Check camera permissions
- Ensure good lighting
- Try manual check-in as fallback

**Database errors:**
- Verify migration ran successfully
- Check Supabase project is active
- Review RLS policies

### Getting Help

1. Review the technical specification
2. Check component-specific README files
3. Review Supabase dashboard for errors
4. Check browser/app console for error messages

## Contributing

This is a custom project for Stage the Change. For modifications:

1. Review the technical specification first
2. Test changes thoroughly on multiple devices
3. Update documentation as needed
4. Ensure offline functionality still works

## License

Copyright 2025 Stage the Change. All rights reserved.

## Acknowledgments

Built with:
- [Expo](https://expo.dev)
- [Supabase](https://supabase.com)
- [React Native](https://reactnative.dev)
- [Next.js](https://nextjs.org)
