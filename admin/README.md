# Stage the Change - Admin Dashboard

Web-based admin dashboard for monitoring workshop attendance and managing the Stage the Change system.

## Features

- 📊 **Real-time Dashboard** - Overview of all workshops with live attendance statistics
- 👥 **Workshop Management** - Detailed view of each workshop with student roster
- ✉️ **Email Reports** - Send attendance reports to supervisors automatically
- 📥 **Data Import** - Import student and workshop data from Google Sheets or CSV
- 📈 **Analytics** - Track attendance rates, wrong workshop alerts, and more
- 🎨 **Stage the Change Branding** - Official colors and styling

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Email**: Nodemailer with Gmail SMTP
- **Icons**: Lucide React
- **Date Formatting**: date-fns

## Prerequisites

- Node.js 18.17.0 or higher
- Supabase project with tables created (see `/supabase/migrations`)
- Gmail account with App Password for email sending
- (Optional) Google Cloud project with Service Account for Google Sheets import

## Environment Variables

Create a `.env.local` file in the `admin` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Gmail SMTP Configuration (for sending emails)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

# Google Sheets API (optional, for importing data)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

### Getting Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Go to "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in `GMAIL_APP_PASSWORD`

### Getting Google Service Account Key (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create Service Account credentials
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
│   │   ├── import-csv/
│   │   └── import-google-sheet/
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
- Total statistics: registered, present, absent, wrong workshop
- Auto-refreshes every 30 seconds
- Click workshop cards to view details

### Workshop Detail (`/workshops/[id]`)
- Complete student roster for the workshop
- Real-time attendance status (Present/Absent/Wrong Workshop)
- Export attendance to CSV
- Shows scan time for each student

### Email Management (`/emails`)
- Send attendance reports to supervisors
- Select time slot (1 or 2)
- Preview emails before sending
- View email history log
- Groups students by supervisor automatically

### Data Import (`/import`)
- Import from Google Sheets (requires Service Account)
- Upload CSV files
- Download CSV template
- Preview data before import
- Automatically creates workshops and links students

## API Routes

### POST `/api/send-emails`
Send attendance reports via email to all supervisors.

**Request:**
```json
{
  "timeSlot": 1
}
```

**Response:**
```json
{
  "success": true,
  "sent": 25,
  "failed": 0,
  "total": 25
}
```

### POST `/api/import-csv`
Import student and workshop data from CSV file.

**Request:** `multipart/form-data` with file

**Response:**
```json
{
  "success": true,
  "students": 200,
  "workshops": 12,
  "errors": 0
}
```

### POST `/api/import-google-sheet`
Import data from Google Sheets.

**Request:**
```json
{
  "url": "https://docs.google.com/spreadsheets/d/..."
}
```

**Response:**
```json
{
  "success": true,
  "students": 200,
  "workshops": 12,
  "errors": 0
}
```

## CSV Import Format

Required columns:
- `registration_id` - Unique student ID
- `student_name` - Full name
- `supervisor_email` - Email address

Optional columns:
- `supervisor_name` - Supervisor name
- `workshop_slot1_name` - First workshop name
- `workshop_slot2_name` - Second workshop name
- `time_slot` - Workshop time slot (1 or 2)
- `room_location` - Room location
- `notes` - Additional notes

Example CSV:
```csv
registration_id,student_name,supervisor_email,workshop_slot1_name,workshop_slot2_name
ST001,John Doe,jane@example.com,Intro to Theater,Advanced Acting
ST002,Mary Johnson,bob@example.com,Stage Design,Costume Design
```

## Email Template

The system sends HTML emails with:
- Stage the Change branding
- Workshop attendance summary
- Student-by-student attendance table
- Attendance statistics
- Responsive design

Emails are grouped by supervisor, so each supervisor receives one email with all their students.

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

- **Service Role Key**: Only use in API routes (server-side), never expose to client
- **Email Credentials**: Keep Gmail App Password secure
- **RLS Policies**: Ensure Supabase RLS is properly configured
- **CORS**: Configure allowed origins in production
- **Rate Limiting**: Consider adding rate limiting for email sending

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs
3. Check browser console for errors
4. Review server logs in production

## License

Proprietary - Stage the Change
