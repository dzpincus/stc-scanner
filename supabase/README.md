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

### 5. Realtime

Migration `20261105120000_realtime_attendance.sql` adds `attendance` to the `supabase_realtime` publication. Phones use the change events only as a nudge to pull; nothing depends on realtime being up.

## Database Schema Overview

### Tables

- **events**: One row per conference year; exactly one `is_active`. `locked` = doors open
- **students**, **workshops**: Per event (`event_id`), unique per event by registration id / name+slot
- **attendance**: One row per `(student, workshop)`; `event_id` set by trigger from the student
- **attendance_history**: Trigger-written copy of every insert/update/delete on attendance
- **devices**: Phone heartbeats (label, version, selected workshop, unsynced count, last error)
- **email_log**: Which supervisor got which slot's report
- **supervisors**, **sync_queue**: legacy, unused

Functions: `current_event_id()`, `is_admin()`, `upsert_attendance(rows jsonb)` (earliest scan wins, per-row status), `delete_attendance(ids uuid[])`.

Full description: `../CLAUDE.md` (Data model section).

### Key Features

- **UUID primary keys**: Compatible with offline-first architecture
- **Row Level Security (RLS)**: anon (phones) can read only the active event and write attendance only through the two RPCs; admins are authenticated users with an `@stagethechange.org` email
- **Automatic timestamps**: `created_at` and `updated_at` auto-update
- **Unique constraints**: One attendance row per student and workshop
- **Foreign keys `ON DELETE RESTRICT`**: a student or workshop with attendance cannot be deleted

## Security Notes

- The anon key is in every phone binary. It can read the active event's students (names, supervisor emails) and nothing from past years. Rotate it after the event if that matters.
- Never apply a migration containing `DROP` through the MCP client (it auto-cancels); use `ALTER` or a separate migration.
- Applied migrations are tracked in `supabase_migrations.schema_migrations`; apply new ones with the MCP `apply_migration` so they stay tracked.

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
