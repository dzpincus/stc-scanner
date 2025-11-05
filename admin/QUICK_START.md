# Quick Start Guide - Admin Dashboard

Get the Stage the Change admin dashboard running in 15 minutes.

## Prerequisites Checklist

- [ ] Node.js 18.17+ installed (check with `node --version`)
- [ ] Supabase project created
- [ ] Database migrations run (from `/supabase/migrations`)
- [ ] Gmail account with 2FA enabled

---

## Step 1: Set Up Supabase (5 minutes)

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Name: `stage-the-change`
4. Set database password (save this!)
5. Choose region closest to you
6. Click "Create new project"
7. Wait for project creation (~2 minutes)

### 1.2 Run Database Migrations

1. In your terminal:
```bash
cd /home/dylanpincus/code/stc-scanner
```

2. Copy the SQL from `supabase/migrations/20251023000000_initial_schema.sql`

3. In Supabase Dashboard:
   - Click "SQL Editor" in sidebar
   - Click "New Query"
   - Paste the entire migration SQL
   - Click "Run"
   - Should see "Success" message

### 1.3 Get Supabase Credentials

1. In Supabase Dashboard:
   - Click "Settings" (gear icon)
   - Click "API"

2. Copy these values:
   - **Project URL** (under "Project URL")
   - **anon public key** (under "Project API keys")
   - **service_role key** (under "Project API keys" - click "Reveal")

---

## Step 2: Set Up Gmail for Email Sending (3 minutes)

### 2.1 Enable 2-Factor Authentication

1. Go to https://myaccount.google.com/security
2. If 2FA not enabled:
   - Click "2-Step Verification"
   - Follow the setup process

### 2.2 Create App Password

1. Still in https://myaccount.google.com/security
2. Search for "App passwords" or scroll to find it
3. Click "App passwords"
4. Select "Mail" and "Other"
5. Name it: `Stage the Change`
6. Click "Generate"
7. **Copy the 16-character password** (you won't see it again!)

---

## Step 3: Configure Environment Variables (2 minutes)

1. Navigate to admin directory:
```bash
cd /home/dylanpincus/code/stc-scanner/admin
```

2. Create `.env.local`:
```bash
cp .env.example .env.local
```

3. Edit `.env.local` with your values:
```env
# Supabase (from Step 1.3)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Gmail (from Step 2.2)
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# Google Sheets (skip for now, optional)
# GOOGLE_SERVICE_ACCOUNT_KEY=
```

---

## Step 4: Install and Run (2 minutes)

Dependencies should already be installed, but verify:

```bash
# Check if node_modules exists
ls node_modules

# If not, install:
npm install

# Start development server
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

Open http://localhost:3000 in your browser!

---

## Step 5: Import Sample Data (3 minutes)

### Option A: Use Sample CSV (Easiest)

1. In the dashboard, click "Import Data" in navigation
2. Click "Download CSV Template"
3. Or use the included `sample-data.csv` file
4. Click "Choose File" and select `sample-data.csv`
5. Click "Import CSV"
6. Should see success message: "Imported 30 students"

### Option B: Create Google Sheet (If you want Google Sheets integration)

See `GOOGLE_SHEETS_SETUP.md` for detailed instructions.

Quick version:
1. Create new Google Sheet
2. Paste this URL in browser: https://sheets.google.com
3. Create blank sheet
4. Copy data from `sample-data.csv`
5. File > Share > Get link > Change to "Anyone with the link can view"
6. Copy the sheet URL
7. In dashboard: Import Data > Paste URL > Import

---

## Step 6: Verify Everything Works

### 6.1 Check Dashboard
- Go to http://localhost:3000
- Should see workshop cards with statistics
- Click a workshop card to view details

### 6.2 Test Email System
1. Click "Emails" in navigation
2. Select "Time Slot 1"
3. Click "Send Emails"
4. Check your email inbox (if you used your own email in sample data)

### 6.3 Check Workshop Details
1. Click "Workshops" or any workshop card
2. Should see student roster
3. Click "Export CSV" to download attendance

---

## Common Issues

### "Failed to load dashboard data"
- **Check**: Are you connected to internet?
- **Check**: Is Supabase URL correct in `.env.local`?
- **Check**: Did migrations run successfully?
- **Fix**: Restart dev server with `npm run dev`

### "Failed to send emails"
- **Check**: Is Gmail App Password correct (16 characters, no spaces)?
- **Check**: Is GMAIL_USER your actual Gmail address?
- **Check**: Is 2FA enabled on your Gmail account?
- **Fix**: Double-check credentials in `.env.local`

### No workshops showing on dashboard
- **Check**: Did you import data in Step 5?
- **Check**: Look in Supabase Dashboard > Table Editor > workshops
- **Fix**: Re-import sample data

### Port 3000 already in use
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

---

## Next Steps

### Add Your Real Data

1. **Export from your registration system**
   - Required columns: `registration_id`, `student_name`, `supervisor_email`
   - Optional: `workshop_slot1_name`, `workshop_slot2_name`

2. **Format as CSV**
   - Use `sample-data.csv` as template
   - Replace with your actual students

3. **Import**
   - Use Import Data page
   - Upload your CSV

### Set Up Mobile Scanner App

1. Navigate to mobile directory:
```bash
cd /home/dylanpincus/code/stc-scanner/mobile
```

2. Follow mobile app README for setup

3. Same Supabase credentials work for both!

### Set Up Google Sheets (Optional)

1. Follow `GOOGLE_SHEETS_SETUP.md`
2. Create service account
3. Share Google Sheet with service account
4. Import directly from Google Sheets

### Customize Email Template

Edit `admin/app/api/send-emails/route.ts`:
- Function `generateEmailHTML()` at line 123
- Modify HTML template
- Change email subject line

### Deploy to Production

When ready to deploy:

1. Push to GitHub
2. Deploy to Vercel:
   - Import GitHub repo
   - Add environment variables
   - Deploy!

See main `README.md` for deployment details.

---

## Test Checklist

Before your event, verify:

- [ ] Dashboard loads and shows workshops
- [ ] Student data imported correctly
- [ ] Workshop detail pages show student rosters
- [ ] CSV export works
- [ ] Email sending works (test with your email)
- [ ] Mobile app can scan QR codes (see mobile README)
- [ ] Attendance appears in dashboard after scanning

---

## Support

**Documentation:**
- Main README: `admin/README.md`
- Google Sheets Setup: `admin/GOOGLE_SHEETS_SETUP.md`
- Mobile App: `mobile/README.md`

**Troubleshooting:**
- Check browser console (F12) for errors
- Check terminal output for server errors
- Review Supabase logs in dashboard

**Sample Data:**
- `admin/sample-data.csv` - 30 sample students
- Includes 12 different workshops
- 5 supervisors
- Both time slots

---

## Quick Reference

**Dashboard URLs:**
- Home: http://localhost:3000
- Workshops: http://localhost:3000/workshops
- Emails: http://localhost:3000/emails
- Import: http://localhost:3000/import

**Commands:**
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Check types
npm run type-check
```

**Files to edit:**
- `.env.local` - Environment variables
- `app/api/send-emails/route.ts` - Email template
- `app/globals.css` - Styling
- `tailwind.config.ts` - Theme colors

**Files to never commit:**
- `.env.local`
- `google-credentials.json`
- `node_modules/`

---

Ready to go! 🎭
