# Stage the Change - Admin Dashboard

Web-based admin dashboard for monitoring workshop attendance and managing the Stage the Change system.

## Features

- 📊 **Dashboard** - Every workshop's registered / present / absent / walk-in counts, refreshed every 30s, plus a "Scanner phones" panel showing each phone's unsynced count, last contact and last error
- 🔒 **Event lock** - One toggle in the header. Locked means doors are open: imports and deletes are refused everywhere until an admin unlocks
- 👥 **Workshop Management** - Roster per workshop, manual check-in (same server path as the phones), CSV export
- ✉️ **Email Reports** - One email per supervisor per slot; re-sending skips supervisors already marked Sent unless you tick Resend
- 📥 **Data Import** - CSV upload with a mandatory preview of every change before anything is written; never deletes students, never blanks rooms
- 📅 **Multi-year** - Previous years stay in the database under their own event; the admin only shows the active one

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API with a Google Workspace service account (primary), Nodemailer SMTP (fallback)
- **Auth**: Supabase Auth, Google sign-in restricted to `@stagethechange.org`
- **Tests**: Vitest (`npm test`) for the import diff, stats and CSV helpers
- **Icons**: Lucide React
- **Date Formatting**: date-fns

## Prerequisites

- Node.js 18.17.0 or higher
- Supabase project with tables created (see `/supabase/migrations`)
- Google Workspace service account with domain-wide delegation for sending email (see `GOOGLE_WORKSPACE_EMAIL_SETUP.md`); an SMTP app password works as a fallback
- Google OAuth client for admin sign-in (see `GOOGLE_OAUTH_SETUP.md`)

## Environment Variables

Create a `.env.local` file in the `admin` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Email (see .env.example for every option)
EMAIL_PROVIDER=gmail-api            # or smtp
EMAIL_FROM_ADDRESS=registration@stagethechange.org
EMAIL_FROM_NAME=Stage the Change
EMAIL_BCC_ADDRESS=registration@stagethechange.org
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# SMTP fallback (EMAIL_PROVIDER=smtp)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### Getting Google Service Account Key

**Required for Gmail API email sending** (see GOOGLE_WORKSPACE_EMAIL_SETUP.md)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create Service Account credentials with domain-wide delegation
5. Download JSON key file
6. Copy entire JSON content to `GOOGLE_SERVICE_ACCOUNT_KEY`

## Installation

```bash
# Navigate to admin directory
cd admin

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Project Structure

```
admin/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx           # Root layout with navigation
│   ├── page.tsx             # Dashboard home
│   ├── workshops/           # Workshop pages
│   │   └── [id]/page.tsx   # Workshop detail
│   ├── emails/              # Email management
│   │   └── page.tsx
│   ├── import/              # Data import
│   │   └── page.tsx
│   ├── api/                 # API routes
│   │   ├── send-emails/
│   │   └── import-csv/
│   └── globals.css          # Global styles
├── lib/                     # Shared utilities
│   ├── supabase.ts         # Supabase client
│   └── types.ts            # TypeScript types
├── public/                  # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Pages Overview

### Dashboard Home (`/`)
- Overview of all workshops grouped by time slot
- Statistics: registered, present (scans by registered students), absent (registered minus present), wrong workshop (walk-ins, counted separately so they never inflate present)
- "Scanner phones" panel: red rows have unsynced scans, an error, or no contact for 3 minutes
- Auto-refreshes every 30 seconds

### Workshop Detail (`/workshops/[id]`)
- Complete student roster for the workshop
- Real-time attendance status (Present/Absent/Wrong Workshop)
- Export attendance to CSV
- Shows scan time for each student

### Email Management (`/emails`)
- Select time slot (1 or 2); the preview and the Send button use the same slot
- Confirmation dialog shows how many will be sent and how many are skipped because they already received that slot's report
- "Resend" checkbox overrides the skip
- History table with per-row error text on failures

### Data Import (`/import`)
- Upload CSV, download the template
- Preview lists every student create/update with before/after values, workshops to create, room changes, skipped rows, and students in the database but missing from the CSV (kept, never deleted)
- Apply only after the preview; refused while the event is locked
- Workshops match by name and slot ignoring case/extra spaces; blank workshop cells keep the current assignment, "No Workshop" clears it

## API Routes

### POST `/api/send-emails`
Send attendance reports via email to all supervisors.

**Request:**
```json
{
  "timeSlot": 1,
  "resend": false
}
```

**Response:**
```json
{
  "success": true,
  "sent": 25,
  "failed": 0,
  "skipped": 3,
  "total": 28
}
```

### POST `/api/import-csv`
Two-phase import scoped to the active event.

**Request:** `multipart/form-data` with `file` and `dryRun` (`1` = preview only, `0` = apply). Apply returns 423 while the event is locked.

**Response:** `{ dryRun, event, plan, applied? }` where `plan` is the full diff (see `lib/csv-import.ts` `ImportPlan`) and `applied` carries counts and per-row failures after a real import.

## CSV Import Format

**Flexible Column Mapping** - The system automatically recognizes various column name formats:

Required columns (any of these names will work):
- **Student ID:** `registration_id`, `Registrant ID`
- **Student Name:** `student_name`, or combination of `Name (First Name)` + `Name (Last Name)`
- **Supervisor Email:** `supervisor_email`, `Contact Email`

Optional columns:
- **Supervisor Name:** `supervisor_name`, or combination of `Contact First Name` + `Contact Last Name`
- **Workshop Slot 1:** `workshop_slot1_name`, `Breakout Session I`
- **Workshop Slot 2:** `workshop_slot2_name`, `Breakout Session II`
- **School:** `School/Organization Name`
- **Time Slot:** `time_slot` (1 or 2)
- **Room:** `room_location`
- **Notes:** `notes`

Example CSV (Simple Format):
```csv
registration_id,student_name,supervisor_email,workshop_slot1_name,workshop_slot2_name
ST001,John Doe,jane@example.com,Intro to Theater,Advanced Acting
ST002,Mary Johnson,bob@example.com,Stage Design,Costume Design
```

Example CSV (Your Registration System Format):
```csv
School/Organization Name,Name (Last Name),Name (First Name),Registrant ID,Breakout Session I,Breakout Session II,Contact Last Name,Contact First Name,Contact Email
Commack High School,Doe,John,01K632PW9WEX87R,Building Resilience Through Dance,Dance For Every Body,Smith,Jane,jsmith@example.com
```

**Note:** Column names are case-insensitive and flexible. The system will automatically map common variations.

## Email Template

The system sends HTML emails with:
- Stage the Change branding
- Workshop attendance summary
- Student-by-student attendance table
- Attendance statistics
- Responsive design

Emails are grouped by supervisor, so each supervisor receives one email with all their students. All student and supervisor text is HTML-escaped.

## Troubleshooting

### Email sending fails
- Check Gmail credentials in `.env.local`
- Ensure 2FA is enabled and App Password is generated
- Verify SMTP settings (smtp.gmail.com:587)

### Google Sheets import fails
- Ensure sheet is publicly accessible or shared with Service Account email
- Verify Service Account JSON is correctly formatted
- Check that Google Sheets API is enabled

### Supabase connection issues
- Verify environment variables are correct
- Check Supabase project is active
- Ensure RLS policies allow read/write access
- Confirm database migrations have been run

### TypeScript errors
```bash
npm run build  # Check for type errors
```

### Styling issues
```bash
npm run dev    # Ensure Tailwind is processing correctly
```

## Production Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables in Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `GOOGLE_SERVICE_ACCOUNT_KEY` (optional)

### Build Command
```bash
npm run build
```

### Start Command
```bash
npm start
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run type-check

# Lint
npm run lint
```

## Security Considerations

- **Service Role Key**: Only used in API routes (import, email); browser pages run as the signed-in admin and rely on RLS (`is_admin()` = `@stagethechange.org` email)
- **Email Credentials**: Keep the service account JSON / SMTP password out of git (`.env*` is ignored)
- **Lint**: `npm run lint` runs on every build; `react/no-unescaped-entities` is off because the privacy/terms pages are prose with literal quotes

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs
3. Check browser console for errors
4. Review server logs in production

## License

Proprietary - Stage the Change
