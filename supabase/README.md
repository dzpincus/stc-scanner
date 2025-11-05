# Supabase Database Setup

## Quick Setup Instructions

### 1. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Choose a name (e.g., "stage-the-change-scanner")
4. Set a strong database password
5. Select a region close to your event location
6. Wait for project initialization (~2 minutes)

### 2. Run Database Migration

#### Option A: Using Supabase Dashboard (Recommended for quick setup)
1. Go to your project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `migrations/20251023000000_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl/Cmd + Enter`
7. Verify all tables were created in the **Table Editor**

#### Option B: Using Supabase CLI (For development)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### 3. Get API Credentials

1. Go to **Project Settings** > **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (for admin dashboard only)

### 4. Verify Setup

Run this test query in SQL Editor to verify everything is working:

```sql
-- Check all tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return:
-- attendance
-- email_log
-- students
-- supervisors
-- sync_queue
-- workshops

-- Test the attendance summary function
SELECT * FROM get_workshop_attendance_summary('00000000-0000-0000-0000-000000000000');
```

### 5. Enable Realtime (Optional but Recommended)

For live sync between devices:

1. Go to **Database** > **Replication**
2. Enable replication for these tables:
   - `attendance`
   - `students`
   - `workshops`

## Database Schema Overview

### Tables

- **students**: Student registration data with workshop assignments
- **workshops**: Workshop sessions (slot 1 and slot 2)
- **attendance**: QR scan records with offline sync support
- **supervisors**: Supervisor contact information for email reports
- **email_log**: Audit trail of sent attendance emails
- **sync_queue**: Queue for offline-to-online synchronization

### Key Features

- **UUID primary keys**: Compatible with offline-first architecture
- **Row Level Security (RLS)**: Open policies for event day (can be tightened for production)
- **Automatic timestamps**: `created_at` and `updated_at` auto-update
- **Unique constraints**: Prevents duplicate attendance records
- **Foreign key cascades**: Maintains referential integrity

## Security Notes

### For Development/Event Day
Current RLS policies allow public access (no authentication required). This is intentional for:
- Quick setup without user management
- Offline-first mobile app architecture
- Multiple simultaneous scanners without login friction

### For Production/Reuse
To secure for production use:
1. Enable Supabase Auth
2. Update RLS policies to require authentication
3. Create user roles (admin, scanner, viewer)
4. Use service_role key only in secure backend/admin contexts

## Troubleshooting

### Migration fails with "relation already exists"
The tables are already created. You can either:
- Drop all tables and re-run: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
- Or skip migration if schema is correct

### RLS prevents data access
Ensure policies are enabled correctly. Test with:
```sql
SELECT * FROM students; -- Should work without auth
```

### Function not found
Verify the function exists:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public';
```

## Next Steps

After database setup:
1. Save your API credentials securely
2. Configure the mobile app `.env` file
3. Configure the admin dashboard `.env.local` file
4. Import initial workshop data
5. Generate student QR codes
