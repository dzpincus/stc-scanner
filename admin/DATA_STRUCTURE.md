# Data Structure & Workflow

Understanding how data flows through the Stage the Change system.

## Database Schema Overview

```
┌─────────────────┐
│   WORKSHOPS     │
│─────────────────│
│ id (PK)         │───┐
│ workshop_name   │   │
│ time_slot       │   │
│ room_location   │   │
│ description     │   │
│ capacity        │   │
└─────────────────┘   │
                      │
                      │ Referenced by
                      │
┌─────────────────┐   │
│    STUDENTS     │   │
│─────────────────│   │
│ id (PK)         │   │
│ registration_id │───┼──── Unique identifier (for QR codes)
│ student_name    │   │
│ supervisor_name │   │
│ supervisor_email│───┼──── Groups students by supervisor
│ slot1_id (FK)   │◄──┘
│ slot2_id (FK)   │◄──┐
│ notes           │   │
└─────────────────┘   │
         │            │
         │ Referenced by
         │            │
         ▼            │
┌─────────────────┐   │
│   ATTENDANCE    │   │
│─────────────────│   │
│ id (PK)         │   │
│ student_id (FK) │───┘
│ workshop_id (FK)│───┐
│ scanned_at      │   │
│ scanner_device  │   │
│ is_correct_shop │   │
│ manually_added  │   │
│ checked_out_at  │   │
└─────────────────┘   │
                      │
                      │
┌─────────────────┐   │
│   EMAIL_LOG     │   │
│─────────────────│   │
│ id (PK)         │   │
│ supervisor_email│   │
│ time_slot       │   │
│ sent_at         │   │
│ student_count   │   │
│ email_status    │   │
└─────────────────┘   │
                      │
┌─────────────────┐   │
│   SYNC_QUEUE    │   │
│─────────────────│   │
│ id (PK)         │   │
│ table_name      │   │
│ record_id       │   │
│ operation       │   │
│ synced          │   │
└─────────────────┘   │
```

## Table Details

### WORKSHOPS
Stores workshop information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier |
| `workshop_name` | TEXT | Display name (e.g., "Introduction to Theater") |
| `time_slot` | INTEGER | 1 or 2 (when workshop occurs) |
| `room_location` | TEXT | Physical location |
| `description` | TEXT | Workshop description |
| `capacity` | INTEGER | Max students allowed |

**Example:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "workshop_name": "Introduction to Theater",
  "time_slot": 1,
  "room_location": "Theater Room A",
  "capacity": 25
}
```

### STUDENTS
Stores student registration information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier |
| `registration_id` | TEXT | QR code value (e.g., "ST001") |
| `student_name` | TEXT | Full name |
| `supervisor_name` | TEXT | Supervisor's name |
| `supervisor_email` | TEXT | For email reports |
| `workshop_slot1_id` | UUID | First workshop (FK to workshops) |
| `workshop_slot2_id` | UUID | Second workshop (FK to workshops) |
| `notes` | TEXT | Additional info |

**Example:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "registration_id": "ST001",
  "student_name": "Alice Anderson",
  "supervisor_email": "mjohnson@school.com",
  "workshop_slot1_id": "550e8400-e29b-41d4-a716-446655440000",
  "workshop_slot2_id": "550e8400-e29b-41d4-a716-446655440010"
}
```

### ATTENDANCE
Records when students attend workshops.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier |
| `student_id` | UUID | FK to students |
| `workshop_id` | UUID | FK to workshops |
| `scanned_at` | TIMESTAMP | When QR code was scanned |
| `scanner_device_id` | TEXT | Which device scanned |
| `is_correct_workshop` | BOOLEAN | True if student in right place |
| `manually_added` | BOOLEAN | True if manually checked in |
| `manually_overridden` | BOOLEAN | True if admin override |
| `checked_out_at` | TIMESTAMP | When student left (optional) |

**Example:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "student_id": "660e8400-e29b-41d4-a716-446655440001",
  "workshop_id": "550e8400-e29b-41d4-a716-446655440000",
  "scanned_at": "2025-10-23T10:15:00Z",
  "scanner_device_id": "device-001",
  "is_correct_workshop": true,
  "manually_added": false
}
```

## Data Relationships

### Student → Workshops (Many-to-Many)
- Each student is registered for up to 2 workshops (slot1 and slot2)
- Each workshop can have multiple students
- Relationship stored in `students.workshop_slot1_id` and `students.workshop_slot2_id`

### Student → Attendance (One-to-Many)
- Each student can have multiple attendance records
- Each attendance record belongs to one student
- Unique constraint prevents duplicate attendance per workshop

### Workshop → Attendance (One-to-Many)
- Each workshop can have multiple attendance records
- Each attendance record belongs to one workshop

### Supervisor → Students (One-to-Many)
- Students grouped by `supervisor_email`
- Same email = same supervisor
- Used for email report grouping

## Data Flow Diagrams

### Import Flow

```
Google Sheets / CSV
       │
       │ Parse data
       ▼
┌──────────────┐
│ Extract      │
│ Workshop     │ ──► Create/Find Workshops
│ Names        │     in database
└──────────────┘
       │
       │ Map workshop names to IDs
       ▼
┌──────────────┐
│ Create       │
│ Student      │ ──► Insert/Update Students
│ Records      │     with workshop_slot1_id
└──────────────┘     and workshop_slot2_id
       │
       │
       ▼
   Dashboard displays data
```

### Attendance Flow (Mobile → Dashboard)

```
Student presents QR code
       │
       ▼
Mobile app scans QR
       │
       ▼
Parse registration_id
       │
       ▼
Look up student in local SQLite
       │
       ▼
Validate against selected workshop
       │
       ├──► Correct workshop
       │     │
       │     ▼
       │  Create attendance record
       │  is_correct_workshop = true
       │
       └──► Wrong workshop
             │
             ▼
          Create attendance record
          is_correct_workshop = false
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
  Save to     Save to
  SQLite      Supabase
  (offline)   (online)
       │           │
       └─────┬─────┘
             │
             ▼
    Dashboard updates in real-time
```

### Email Report Flow

```
Admin selects time slot
       │
       ▼
Load all students for selected time slot
       │
       ▼
Group students by supervisor_email
       │
       ▼
For each supervisor:
    │
    ├──► Get student list
    │
    ├──► Check attendance for each student
    │
    ├──► Generate HTML email
    │
    ├──► Send via Gmail SMTP
    │
    └──► Log to email_log table
             │
             ├──► Success: status = 'sent'
             │
             └──► Error: status = 'failed'
```

## QR Code Format

QR codes contain just the `registration_id`:

```
ST001
```

When scanned:
1. Mobile app looks up `registration_id` in SQLite
2. Finds student record with workshops
3. Compares scanned workshop to student's registered workshops
4. Creates attendance record with `is_correct_workshop` flag

## Email Grouping Logic

Students are grouped by `supervisor_email`:

```
mjohnson@school.com:
  - Alice Anderson (ST001)
  - Carol Chen (ST003)
  - Grace Green (ST007)

rsmith@school.com:
  - Bob Baker (ST002)
  - Emma Evans (ST005)
  - Henry Hill (ST008)
```

Each supervisor receives ONE email with ALL their students.

## Statistics Calculations

### Workshop Level

```typescript
registered = count(students where slot1_id = workshop_id OR slot2_id = workshop_id)
attended = count(attendance where workshop_id = workshop_id)
absent = registered - attended
wrong_workshop = count(attendance where workshop_id = workshop_id AND is_correct_workshop = false)
attendance_rate = (attended / registered) * 100
```

### Overall

```typescript
total_registered = sum(all workshops registered)
total_attended = count(all attendance records)
total_absent = total_registered - total_attended
total_wrong = count(attendance where is_correct_workshop = false)
overall_rate = (total_attended / total_registered) * 100
```

## Index Strategy

Indexes for fast queries:

```sql
-- Fast lookup by registration_id (for QR scanning)
CREATE INDEX idx_students_registration_id ON students(registration_id);

-- Fast lookup by workshop
CREATE INDEX idx_attendance_workshop ON attendance(workshop_id);

-- Fast lookup by student
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- Fast email grouping
CREATE INDEX idx_students_supervisor_email ON students(supervisor_email);

-- Fast time slot filtering
CREATE INDEX idx_workshops_time_slot ON workshops(time_slot);
```

## Data Validation Rules

### Students
- ✅ `registration_id` must be unique
- ✅ `supervisor_email` must be valid email format
- ✅ At least one workshop (slot1 or slot2) should be assigned
- ⚠️ `workshop_slot1_id` and `workshop_slot2_id` can be NULL

### Attendance
- ✅ Unique constraint on (`student_id`, `workshop_id`)
- ✅ Cannot create duplicate attendance for same student in same workshop
- ✅ `scanned_at` defaults to current timestamp
- ✅ `is_correct_workshop` auto-calculated by mobile app

### Workshops
- ✅ `time_slot` must be 1 or 2
- ✅ `workshop_name` should be descriptive
- ⚠️ No duplicate workshop names (recommended, not enforced)

## Sync Queue (Mobile Offline Support)

When mobile app is offline:

```
Scan QR → Save to SQLite → Add to sync_queue
                               │
                               │ When online
                               ▼
                          Process queue:
                               │
                               ├──► Upload to Supabase
                               │
                               ├──► Mark as synced
                               │
                               └──► Remove from queue
```

## Sample Data Structure

30 students example:
- 5 supervisors (6 students each)
- 12 unique workshops
- 2 time slots
- Each student in 2 workshops (60 workshop registrations)

Workshop distribution:
- 6 workshops in Slot 1
- 6 workshops in Slot 2
- ~5 students per workshop

## Useful Queries

### Find students not checked in to Slot 1
```sql
SELECT s.student_name, w.workshop_name
FROM students s
JOIN workshops w ON s.workshop_slot1_id = w.id
WHERE NOT EXISTS (
  SELECT 1 FROM attendance a
  WHERE a.student_id = s.id
  AND a.workshop_id = w.id
);
```

### Students in wrong workshop
```sql
SELECT s.student_name, w.workshop_name, a.scanned_at
FROM attendance a
JOIN students s ON a.student_id = s.id
JOIN workshops w ON a.workshop_id = w.id
WHERE a.is_correct_workshop = false;
```

### Supervisor email report data
```sql
SELECT
  s.supervisor_email,
  COUNT(*) as total_students,
  COUNT(a.id) as attended,
  COUNT(*) - COUNT(a.id) as absent
FROM students s
LEFT JOIN attendance a ON s.id = a.student_id
  AND a.workshop_id = s.workshop_slot1_id
WHERE s.workshop_slot1_id IN (
  SELECT id FROM workshops WHERE time_slot = 1
)
GROUP BY s.supervisor_email;
```

---

Understanding this structure helps with:
- Importing data correctly
- Troubleshooting issues
- Customizing the system
- Writing custom reports
