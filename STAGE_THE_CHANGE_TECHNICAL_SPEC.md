# Stage the Change - Workshop Attendance System
## Technical Specification Document

**Version:** 1.0  
**Date:** October 21, 2025  
**Project Timeline:** 14 days  
**Target Delivery:** November 4, 2025

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Mobile Application Specification](#mobile-application-specification)
5. [Admin Dashboard Specification](#admin-dashboard-specification)
6. [Email System Specification](#email-system-specification)
7. [QR Code Generation](#qr-code-generation)
8. [Google Sheets Integration](#google-sheets-integration)
9. [Implementation Plan](#implementation-plan)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)
12. [Environment Configuration](#environment-configuration)

---

## Executive Summary

### Project Overview
A mobile-first attendance tracking system for Stage the Change's one-day workshop event. The system enables simultaneous QR code scanning across multiple workshop sessions, offline operation capability, and automated email reporting to student supervisors.

### Key Requirements
- **Scale:** ~200-300 students, 12+ workshops, 2 time slots
- **Devices:** Multiple simultaneous scanners (iOS + Android)
- **Connectivity:** Offline-first with periodic sync
- **Cost:** 100% free infrastructure
- **Timeline:** 14 days for development, testing, and deployment

### Technology Stack

```
┌─────────────────────────────────────────────────┐
│ Mobile App                                       │
│ - React Native (Expo SDK 52)                    │
│ - TypeScript                                     │
│ - Expo SQLite (offline storage)                 │
│ - Expo Camera (QR scanning)                     │
│ - React Query (data management)                 │
│ - Zustand (state management)                    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Backend                                          │
│ - Supabase (PostgreSQL + Real-time + Auth)     │
│ - Supabase Edge Functions (Deno/TypeScript)    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Admin Dashboard                                  │
│ - Next.js 14 (App Router)                       │
│ - TypeScript                                     │
│ - Tailwind CSS                                   │
│ - shadcn/ui components                          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ External Integrations                            │
│ - Google Sheets API (data import/export)       │
│ - Gmail SMTP (email delivery)                   │
└─────────────────────────────────────────────────┘
```

---

## System Architecture

### High-Level Data Flow

```
DAY BEFORE EVENT:
Access DB → CSV Export → Python Script
                            ↓
                    [QR Code Generator]
                            ↓
                    PNG files (one per student)
                            ↓
                    Upload to Google Sheets

EVENT DAY MORNING:
Google Sheets → [Admin Dashboard Import] → Supabase Database
                                              ↓
                                    [Mobile Apps Sync]

DURING EVENT:
QR Scan → Local SQLite → Periodic Sync → Supabase
                                            ↓
                                    [Real-time Sync to All Devices]

POST-SESSION:
[Admin Triggers Email] → Edge Function → Query Data → Group by Supervisor → Send Emails
```

### Network Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Internet Layer                         │
│                                                           │
│  ┌────────────┐    ┌────────────┐    ┌──────────────┐   │
│  │  Supabase  │    │   Google   │    │ Gmail SMTP   │   │
│  │    API     │    │  Sheets API│    │   Service    │   │
│  └────────────┘    └────────────┘    └──────────────┘   │
│         ↑                 ↑                  ↑            │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          │                 │                  │
┌─────────┼─────────────────┼──────────────────┼───────────┐
│         │                 │                  │            │
│  ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐    │
│  │   Scanner   │   │   Scanner   │   │    Admin    │    │
│  │   Device 1  │   │   Device 2  │   │  Dashboard  │    │
│  │             │   │             │   │   (Web)     │    │
│  │  [SQLite]   │   │  [SQLite]   │   │             │    │
│  └─────────────┘   └─────────────┘   └─────────────┘    │
│                                                           │
│              Local Network / Offline Capable              │
└──────────────────────────────────────────────────────────┘
```

### Offline Sync Strategy

**Write-Through Cache Pattern:**
1. All attendance scans write to local SQLite immediately
2. Background job attempts to sync to Supabase every 30 seconds
3. Failed syncs queue in local storage with retry logic
4. On reconnection, batch upload queued records
5. Supabase broadcasts updates to all connected devices

**Conflict Resolution:**
- Last-write-wins for manual overrides
- Attendance records are immutable once created
- Use unique constraint on (student_id, workshop_id) to prevent duplicates

---

## Database Schema

### Supabase PostgreSQL Tables

#### 1. `students` Table

```sql
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id TEXT UNIQUE NOT NULL,
    student_name TEXT NOT NULL,
    supervisor_name TEXT,
    supervisor_email TEXT NOT NULL,
    workshop_slot1_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
    workshop_slot2_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_students_registration_id ON students(registration_id);
CREATE INDEX idx_students_supervisor_email ON students(supervisor_email);
CREATE INDEX idx_students_workshop_slot1 ON students(workshop_slot1_id);
CREATE INDEX idx_students_workshop_slot2 ON students(workshop_slot2_id);

-- RLS Policies
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students are viewable by anyone"
    ON students FOR SELECT
    USING (true);

CREATE POLICY "Students are insertable by authenticated users"
    ON students FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Students are updatable by authenticated users"
    ON students FOR UPDATE
    USING (true);
```

#### 2. `workshops` Table

```sql
CREATE TABLE workshops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workshop_name TEXT NOT NULL,
    time_slot INTEGER NOT NULL CHECK (time_slot IN (1, 2)),
    room_location TEXT,
    description TEXT,
    capacity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workshops_time_slot ON workshops(time_slot);

-- RLS Policies
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workshops are viewable by anyone"
    ON workshops FOR SELECT
    USING (true);

CREATE POLICY "Workshops are insertable by authenticated users"
    ON workshops FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Workshops are updatable by authenticated users"
    ON workshops FOR UPDATE
    USING (true);
```

#### 3. `attendance` Table

```sql
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanner_device_id TEXT,
    is_correct_workshop BOOLEAN DEFAULT true,
    manually_added BOOLEAN DEFAULT false,
    manually_overridden BOOLEAN DEFAULT false,
    checked_out_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate check-ins
    CONSTRAINT unique_student_workshop UNIQUE(student_id, workshop_id)
);

-- Indexes
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_workshop_id ON attendance(workshop_id);
CREATE INDEX idx_attendance_scanned_at ON attendance(scanned_at);

-- RLS Policies
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendance is viewable by anyone"
    ON attendance FOR SELECT
    USING (true);

CREATE POLICY "Attendance is insertable by anyone"
    ON attendance FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Attendance is updatable by anyone"
    ON attendance FOR UPDATE
    USING (true);

CREATE POLICY "Attendance is deletable by anyone"
    ON attendance FOR DELETE
    USING (true);
```

#### 4. `supervisors` Table

```sql
CREATE TABLE supervisors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    supervisor_name TEXT,
    email_sent_slot1 BOOLEAN DEFAULT false,
    email_sent_slot2 BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_supervisors_email ON supervisors(email);

-- RLS Policies
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors are viewable by anyone"
    ON supervisors FOR SELECT
    USING (true);

CREATE POLICY "Supervisors are insertable by authenticated users"
    ON supervisors FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Supervisors are updatable by authenticated users"
    ON supervisors FOR UPDATE
    USING (true);
```

#### 5. `email_log` Table

```sql
CREATE TABLE email_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervisor_email TEXT NOT NULL,
    time_slot INTEGER NOT NULL CHECK (time_slot IN (1, 2)),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    student_count INTEGER NOT NULL,
    email_status TEXT NOT NULL CHECK (email_status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_log_supervisor ON email_log(supervisor_email);
CREATE INDEX idx_email_log_time_slot ON email_log(time_slot);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at);

-- RLS Policies
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Email log is viewable by anyone"
    ON email_log FOR SELECT
    USING (true);

CREATE POLICY "Email log is insertable by authenticated users"
    ON email_log FOR INSERT
    WITH CHECK (true);
```

#### 6. `sync_queue` Table (for offline sync)

```sql
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    table_name TEXT NOT NULL,
    record_data JSONB NOT NULL,
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Indexes
CREATE INDEX idx_sync_queue_device_id ON sync_queue(device_id);
CREATE INDEX idx_sync_queue_processed_at ON sync_queue(processed_at);

-- RLS Policies
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sync queue is manageable by anyone"
    ON sync_queue FOR ALL
    USING (true);
```

### Database Functions

#### Auto-update timestamp function

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workshops_updated_at BEFORE UPDATE ON workshops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON supervisors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Get attendance summary for workshop

```sql
CREATE OR REPLACE FUNCTION get_workshop_attendance_summary(workshop_uuid UUID)
RETURNS TABLE (
    total_registered INTEGER,
    total_attended INTEGER,
    total_absent INTEGER,
    total_wrong_workshop INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT s.id)::INTEGER as total_registered,
        COUNT(DISTINCT a.id)::INTEGER as total_attended,
        (COUNT(DISTINCT s.id) - COUNT(DISTINCT a.id))::INTEGER as total_absent,
        COUNT(DISTINCT a.id) FILTER (WHERE a.is_correct_workshop = false)::INTEGER as total_wrong_workshop
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id AND a.workshop_id = workshop_uuid
    WHERE s.workshop_slot1_id = workshop_uuid OR s.workshop_slot2_id = workshop_uuid;
END;
$$ LANGUAGE plpgsql;
```

---

## Mobile Application Specification

### Project Structure

```
stage-the-change-scanner/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Home/Setup screen
│   │   ├── scan.tsx             # Scanning screen
│   │   └── roster.tsx           # Roster view
│   ├── session-select.tsx       # Workshop selection
│   ├── manual-checkin.tsx       # Manual check-in modal
│   └── _layout.tsx
├── components/
│   ├── AttendanceList.tsx
│   ├── QRScanner.tsx
│   ├── StudentCard.tsx
│   ├── SyncStatus.tsx
│   ├── WorkshopCard.tsx
│   └── WrongWorkshopAlert.tsx
├── lib/
│   ├── supabase.ts              # Supabase client
│   ├── database.ts              # SQLite operations
│   ├── sync.ts                  # Sync logic
│   └── types.ts                 # TypeScript types
├── hooks/
│   ├── useAttendance.ts
│   ├── useStudents.ts
│   ├── useWorkshops.ts
│   └── useSync.ts
├── store/
│   └── useStore.ts              # Zustand store
├── utils/
│   ├── qr-parser.ts
│   └── date-utils.ts
├── app.json
├── package.json
└── tsconfig.json
```

### Core Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-camera": "~15.0.0",
    "expo-sqlite": "~15.0.0",
    "react-native": "0.76.0",
    "react": "18.3.1",
    "react-native-screens": "~4.0.0",
    "react-native-safe-area-context": "4.11.0",
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.7",
    "expo-router": "~4.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "expo-dev-client": "~5.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.3.0",
    "typescript": "~5.3.0"
  }
}
```

### App Configuration (app.json)

```json
{
  "expo": {
    "name": "Stage the Change Scanner",
    "slug": "stage-the-change-scanner",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#4A90E2"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "org.stagethechange.scanner",
      "infoPlist": {
        "NSCameraUsageDescription": "This app needs camera access to scan QR codes for attendance tracking."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#4A90E2"
      },
      "package": "org.stagethechange.scanner",
      "permissions": ["CAMERA"]
    },
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan QR codes."
        }
      ],
      "expo-router"
    ],
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

### TypeScript Types (lib/types.ts)

```typescript
export interface Student {
  id: string;
  registration_id: string;
  student_name: string;
  supervisor_name: string | null;
  supervisor_email: string;
  workshop_slot1_id: string | null;
  workshop_slot2_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workshop {
  id: string;
  workshop_name: string;
  time_slot: 1 | 2;
  room_location: string | null;
  description: string | null;
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  workshop_id: string;
  scanned_at: string;
  scanner_device_id: string | null;
  is_correct_workshop: boolean;
  manually_added: boolean;
  manually_overridden: boolean;
  checked_out_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceWithDetails extends Attendance {
  student: Student;
  workshop: Workshop;
}

export interface SyncStatus {
  lastSync: string | null;
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
}

export interface SessionSelection {
  workshopId: string;
  workshopName: string;
  timeSlot: 1 | 2;
  roomLocation: string | null;
}

export type AttendanceStatus = 'present' | 'absent' | 'wrong-workshop';
```

### Supabase Client (lib/supabase.ts)

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### SQLite Database (lib/database.ts)

```typescript
import * as SQLite from 'expo-sqlite';
import { Student, Workshop, Attendance } from './types';

const db = SQLite.openDatabaseSync('stage-the-change.db');

export const initDatabase = async () => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      registration_id TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      supervisor_name TEXT,
      supervisor_email TEXT NOT NULL,
      workshop_slot1_id TEXT,
      workshop_slot2_id TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS workshops (
      id TEXT PRIMARY KEY,
      workshop_name TEXT NOT NULL,
      time_slot INTEGER NOT NULL,
      room_location TEXT,
      description TEXT,
      capacity INTEGER,
      created_at TEXT,
      updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      workshop_id TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      scanner_device_id TEXT,
      is_correct_workshop INTEGER DEFAULT 1,
      manually_added INTEGER DEFAULT 0,
      manually_overridden INTEGER DEFAULT 0,
      checked_out_at TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced INTEGER DEFAULT 0,
      UNIQUE(student_id, workshop_id)
    );
    
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_students_registration ON students(registration_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_workshop ON attendance(workshop_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance(synced);
  `);
};

// Student operations
export const getStudentByRegistrationId = async (
  registrationId: string
): Promise<Student | null> => {
  const result = await db.getFirstAsync<Student>(
    'SELECT * FROM students WHERE registration_id = ?',
    [registrationId]
  );
  return result || null;
};

export const getAllStudents = async (): Promise<Student[]> => {
  return await db.getAllAsync<Student>('SELECT * FROM students ORDER BY student_name');
};

export const upsertStudent = async (student: Student): Promise<void> => {
  await db.runAsync(
    `INSERT INTO students (id, registration_id, student_name, supervisor_name, supervisor_email, 
     workshop_slot1_id, workshop_slot2_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
     student_name = excluded.student_name,
     supervisor_name = excluded.supervisor_name,
     supervisor_email = excluded.supervisor_email,
     workshop_slot1_id = excluded.workshop_slot1_id,
     workshop_slot2_id = excluded.workshop_slot2_id,
     notes = excluded.notes,
     updated_at = excluded.updated_at`,
    [
      student.id,
      student.registration_id,
      student.student_name,
      student.supervisor_name,
      student.supervisor_email,
      student.workshop_slot1_id,
      student.workshop_slot2_id,
      student.notes,
      student.created_at,
      student.updated_at,
    ]
  );
};

// Workshop operations
export const getAllWorkshops = async (): Promise<Workshop[]> => {
  return await db.getAllAsync<Workshop>(
    'SELECT * FROM workshops ORDER BY time_slot, workshop_name'
  );
};

export const getWorkshopsByTimeSlot = async (timeSlot: 1 | 2): Promise<Workshop[]> => {
  return await db.getAllAsync<Workshop>(
    'SELECT * FROM workshops WHERE time_slot = ? ORDER BY workshop_name',
    [timeSlot]
  );
};

export const upsertWorkshop = async (workshop: Workshop): Promise<void> => {
  await db.runAsync(
    `INSERT INTO workshops (id, workshop_name, time_slot, room_location, description, capacity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
     workshop_name = excluded.workshop_name,
     time_slot = excluded.time_slot,
     room_location = excluded.room_location,
     description = excluded.description,
     capacity = excluded.capacity,
     updated_at = excluded.updated_at`,
    [
      workshop.id,
      workshop.workshop_name,
      workshop.time_slot,
      workshop.room_location,
      workshop.description,
      workshop.capacity,
      workshop.created_at,
      workshop.updated_at,
    ]
  );
};

// Attendance operations
export const createAttendance = async (attendance: Attendance): Promise<void> => {
  await db.runAsync(
    `INSERT INTO attendance (id, student_id, workshop_id, scanned_at, scanner_device_id, 
     is_correct_workshop, manually_added, manually_overridden, checked_out_at, notes, 
     created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      attendance.id,
      attendance.student_id,
      attendance.workshop_id,
      attendance.scanned_at,
      attendance.scanner_device_id,
      attendance.is_correct_workshop ? 1 : 0,
      attendance.manually_added ? 1 : 0,
      attendance.manually_overridden ? 1 : 0,
      attendance.checked_out_at,
      attendance.notes,
      attendance.created_at,
      attendance.updated_at,
    ]
  );
};

export const getAttendanceByWorkshop = async (workshopId: string): Promise<Attendance[]> => {
  return await db.getAllAsync<Attendance>(
    'SELECT * FROM attendance WHERE workshop_id = ? ORDER BY scanned_at DESC',
    [workshopId]
  );
};

export const checkOutStudent = async (
  studentId: string,
  workshopId: string
): Promise<void> => {
  await db.runAsync(
    'UPDATE attendance SET checked_out_at = ?, synced = 0 WHERE student_id = ? AND workshop_id = ?',
    [new Date().toISOString(), studentId, workshopId]
  );
};

// Sync operations
export const getUnsyncedAttendance = async (): Promise<Attendance[]> => {
  return await db.getAllAsync<Attendance>(
    'SELECT * FROM attendance WHERE synced = 0'
  );
};

export const markAttendanceSynced = async (attendanceIds: string[]): Promise<void> => {
  const placeholders = attendanceIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`,
    attendanceIds
  );
};

export const clearAllData = async (): Promise<void> => {
  await db.execAsync(`
    DELETE FROM attendance;
    DELETE FROM students;
    DELETE FROM workshops;
    DELETE FROM sync_queue;
  `);
};
```

### Sync Logic (lib/sync.ts)

```typescript
import { supabase } from './supabase';
import * as db from './database';
import { Student, Workshop, Attendance } from './types';
import * as Device from 'expo-device';

export const syncFromSupabase = async (): Promise<{
  success: boolean;
  studentsCount: number;
  workshopsCount: number;
  error?: string;
}> => {
  try {
    // Fetch students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*');

    if (studentsError) throw studentsError;

    // Fetch workshops
    const { data: workshops, error: workshopsError } = await supabase
      .from('workshops')
      .select('*');

    if (workshopsError) throw workshopsError;

    // Clear local data and insert new data
    await db.clearAllData();

    for (const student of students || []) {
      await db.upsertStudent(student as Student);
    }

    for (const workshop of workshops || []) {
      await db.upsertWorkshop(workshop as Workshop);
    }

    return {
      success: true,
      studentsCount: students?.length || 0,
      workshopsCount: workshops?.length || 0,
    };
  } catch (error) {
    console.error('Sync from Supabase error:', error);
    return {
      success: false,
      studentsCount: 0,
      workshopsCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const syncToSupabase = async (): Promise<{
  success: boolean;
  syncedCount: number;
  error?: string;
}> => {
  try {
    const unsyncedAttendance = await db.getUnsyncedAttendance();

    if (unsyncedAttendance.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Convert SQLite boolean integers to actual booleans
    const attendanceToSync = unsyncedAttendance.map((a) => ({
      ...a,
      is_correct_workshop: Boolean(a.is_correct_workshop),
      manually_added: Boolean(a.manually_added),
      manually_overridden: Boolean(a.manually_overridden),
    }));

    const { error } = await supabase.from('attendance').upsert(attendanceToSync, {
      onConflict: 'id',
    });

    if (error) throw error;

    // Mark as synced
    await db.markAttendanceSynced(unsyncedAttendance.map((a) => a.id));

    return {
      success: true,
      syncedCount: unsyncedAttendance.length,
    };
  } catch (error) {
    console.error('Sync to Supabase error:', error);
    return {
      success: false,
      syncedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const getDeviceId = async (): Promise<string> => {
  const deviceName = await Device.deviceName;
  const deviceId = Device.modelId || 'unknown';
  return `${deviceName}-${deviceId}`.replace(/\s/g, '-');
};
```

### Zustand Store (store/useStore.ts)

```typescript
import { create } from 'zustand';
import { SessionSelection, SyncStatus } from '../lib/types';

interface AppState {
  // Session selection
  selectedSession: SessionSelection | null;
  setSelectedSession: (session: SessionSelection | null) => void;

  // Sync status
  syncStatus: SyncStatus;
  setSyncStatus: (status: Partial<SyncStatus>) => void;

  // Device ID
  deviceId: string | null;
  setDeviceId: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  selectedSession: null,
  setSelectedSession: (session) => set({ selectedSession: session }),

  syncStatus: {
    lastSync: null,
    pendingCount: 0,
    isOnline: false,
    isSyncing: false,
  },
  setSyncStatus: (status) =>
    set((state) => ({
      syncStatus: { ...state.syncStatus, ...status },
    })),

  deviceId: null,
  setDeviceId: (id) => set({ deviceId: id }),
}));
```

### Screen: Home/Setup (app/(tabs)/index.tsx)

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as db from '../../lib/database';
import { syncFromSupabase, getDeviceId } from '../../lib/sync';
import { useStore } from '../../store/useStore';
import { SyncStatus } from '../../components/SyncStatus';

export default function HomeScreen() {
  const router = useRouter();
  const { syncStatus, setSyncStatus, setDeviceId } = useStore();
  const [studentCount, setStudentCount] = useState(0);
  const [workshopCount, setWorkshopCount] = useState(0);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    await db.initDatabase();
    const deviceId = await getDeviceId();
    setDeviceId(deviceId);
    await loadCounts();
  };

  const loadCounts = async () => {
    const students = await db.getAllStudents();
    const workshops = await db.getAllWorkshops();
    setStudentCount(students.length);
    setWorkshopCount(workshops.length);
  };

  const handleSync = async () => {
    setSyncStatus({ isSyncing: true });

    const result = await syncFromSupabase();

    if (result.success) {
      setSyncStatus({
        isSyncing: false,
        lastSync: new Date().toISOString(),
        isOnline: true,
      });
      setStudentCount(result.studentsCount);
      setWorkshopCount(result.workshopsCount);
      Alert.alert(
        'Sync Complete',
        `Downloaded ${result.studentsCount} students and ${result.workshopsCount} workshops.`
      );
    } else {
      setSyncStatus({ isSyncing: false, isOnline: false });
      Alert.alert('Sync Failed', result.error || 'Unable to sync with server.');
    }
  };

  const handleStartScanning = () => {
    if (studentCount === 0 || workshopCount === 0) {
      Alert.alert(
        'No Data',
        'Please sync data from the server before starting to scan.'
      );
      return;
    }
    router.push('/session-select');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stage the Change</Text>
        <Text style={styles.subtitle}>Workshop Scanner</Text>
      </View>

      <SyncStatus />

      <View style={styles.stats}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{studentCount}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{workshopCount}</Text>
          <Text style={styles.statLabel}>Workshops</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={handleSync}
        disabled={syncStatus.isSyncing}
      >
        <Text style={styles.buttonText}>
          {syncStatus.isSyncing ? 'Syncing...' : 'Sync Data from Server'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={handleStartScanning}
      >
        <Text style={styles.buttonTextSecondary}>Start Scanning</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 8,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 30,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Screen: Session Selection (app/session-select.tsx)

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as db from '../lib/database';
import { Workshop } from '../lib/types';
import { useStore } from '../store/useStore';

export default function SessionSelectScreen() {
  const router = useRouter();
  const { setSelectedSession } = useStore();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    const allWorkshops = await db.getAllWorkshops();
    setWorkshops(allWorkshops);
  };

  const handleStartScanning = () => {
    if (!selectedWorkshopId) {
      Alert.alert('No Session Selected', 'Please select a workshop session.');
      return;
    }

    const workshop = workshops.find((w) => w.id === selectedWorkshopId);
    if (!workshop) return;

    setSelectedSession({
      workshopId: workshop.id,
      workshopName: workshop.workshop_name,
      timeSlot: workshop.time_slot,
      roomLocation: workshop.room_location,
    });

    router.push('/(tabs)/scan');
  };

  const renderWorkshop = (workshop: Workshop) => {
    const isSelected = selectedWorkshopId === workshop.id;

    return (
      <TouchableOpacity
        key={workshop.id}
        style={[styles.workshopCard, isSelected && styles.workshopCardSelected]}
        onPress={() => setSelectedWorkshopId(workshop.id)}
      >
        <View style={styles.workshopHeader}>
          <View
            style={[
              styles.slotBadge,
              { backgroundColor: workshop.time_slot === 1 ? '#4CAF50' : '#FF9800' },
            ]}
          >
            <Text style={styles.slotBadgeText}>Slot {workshop.time_slot}</Text>
          </View>
          <View style={styles.radioButton}>
            {isSelected && <View style={styles.radioButtonInner} />}
          </View>
        </View>
        <Text style={styles.workshopName}>{workshop.workshop_name}</Text>
        {workshop.room_location && (
          <Text style={styles.workshopRoom}>Room: {workshop.room_location}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const slot1Workshops = workshops.filter((w) => w.time_slot === 1);
  const slot2Workshops = workshops.filter((w) => w.time_slot === 2);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Workshop Session</Text>

      <ScrollView style={styles.scrollView}>
        {slot1Workshops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Slot 1</Text>
            {slot1Workshops.map(renderWorkshop)}
          </View>
        )}

        {slot2Workshops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Slot 2</Text>
            {slot2Workshops.map(renderWorkshop)}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, !selectedWorkshopId && styles.buttonDisabled]}
        onPress={handleStartScanning}
        disabled={!selectedWorkshopId}
      >
        <Text style={styles.buttonText}>Start Scanning</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 60,
    marginBottom: 20,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  workshopCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workshopCardSelected: {
    borderColor: '#4A90E2',
  },
  workshopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slotBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A90E2',
  },
  workshopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  workshopRoom: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Screen: QR Scanning (app/(tabs)/scan.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStore } from '../../store/useStore';
import * as db from '../../lib/database';
import { syncToSupabase } from '../../lib/sync';
import { Attendance, Student } from '../../lib/types';
import { format } from 'date-fns';

interface RecentScan {
  id: string;
  studentName: string;
  time: string;
  isCorrect: boolean;
}

export default function ScanScreen() {
  const { selectedSession, deviceId } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCount, setScannedCount] = useState(0);
  const [expectedCount, setExpectedCount] = useState(0);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => {
      syncToSupabase();
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(interval);
  }, [selectedSession]);

  const loadStats = async () => {
    if (!selectedSession) return;

    const students = await db.getAllStudents();
    const expected = students.filter(
      (s) =>
        s.workshop_slot1_id === selectedSession.workshopId ||
        s.workshop_slot2_id === selectedSession.workshopId
    ).length;

    const attendance = await db.getAttendanceByWorkshop(selectedSession.workshopId);

    setExpectedCount(expected);
    setScannedCount(attendance.length);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || !selectedSession) return;

    setIsScanning(false);

    try {
      // Lookup student by registration ID
      const student = await db.getStudentByRegistrationId(data);

      if (!student) {
        Alert.alert('Student Not Found', `Registration ID: ${data}`);
        setTimeout(() => setIsScanning(true), 2000);
        return;
      }

      // Check if student is registered for this workshop
      const isCorrectWorkshop =
        student.workshop_slot1_id === selectedSession.workshopId ||
        student.workshop_slot2_id === selectedSession.workshopId;

      if (!isCorrectWorkshop) {
        Alert.alert(
          '⚠️ Wrong Workshop',
          `${student.student_name} is not registered for ${selectedSession.workshopName}.\n\nMark attended anyway?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsScanning(true),
            },
            {
              text: 'Mark Attended',
              onPress: () => recordAttendance(student, false),
            },
          ]
        );
        return;
      }

      await recordAttendance(student, true);
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Error', 'Failed to process scan');
      setTimeout(() => setIsScanning(true), 2000);
    }
  };

  const recordAttendance = async (student: Student, isCorrect: boolean) => {
    if (!selectedSession || !deviceId) return;

    const now = new Date().toISOString();

    const attendance: Attendance = {
      id: `${student.id}-${selectedSession.workshopId}`,
      student_id: student.id,
      workshop_id: selectedSession.workshopId,
      scanned_at: now,
      scanner_device_id: deviceId,
      is_correct_workshop: isCorrect,
      manually_added: false,
      manually_overridden: false,
      checked_out_at: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    try {
      await db.createAttendance(attendance);

      // Add to recent scans
      setRecentScans((prev) => [
        {
          id: attendance.id,
          studentName: student.student_name,
          time: format(new Date(), 'h:mm a'),
          isCorrect,
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);

      setScannedCount((prev) => prev + 1);

      // Try to sync immediately
      syncToSupabase();
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        Alert.alert('Already Scanned', `${student.student_name} has already checked in.`);
      } else {
        Alert.alert('Error', 'Failed to record attendance');
      }
    }

    setTimeout(() => setIsScanning(true), 1000);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required to scan QR codes</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!selectedSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No session selected</Text>
      </View>
    );
  }

  const renderRecentScan = ({ item }: { item: RecentScan }) => (
    <View style={styles.recentScan}>
      <Text style={styles.recentScanIcon}>{item.isCorrect ? '✓' : '⚠'}</Text>
      <View style={styles.recentScanInfo}>
        <Text style={styles.recentScanName}>{item.studentName}</Text>
        {!item.isCorrect && (
          <Text style={styles.recentScanWarning}>Wrong workshop</Text>
        )}
      </View>
      <Text style={styles.recentScanTime}>{item.time}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.workshopName}>{selectedSession.workshopName}</Text>
        {selectedSession.roomLocation && (
          <Text style={styles.roomLocation}>{selectedSession.roomLocation}</Text>
        )}
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerBox} />
        </View>
      </CameraView>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Scanned: {scannedCount} / {expectedCount}
        </Text>
      </View>

      <View style={styles.recentContainer}>
        <Text style={styles.recentTitle}>Recent Scans</Text>
        <FlatList
          data={recentScans}
          renderItem={renderRecentScan}
          keyExtractor={(item) => item.id}
          style={styles.recentList}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 16,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
  },
  workshopName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  roomLocation: {
    fontSize: 14,
    color: 'white',
    marginTop: 4,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 12,
  },
  statsContainer: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  statsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  recentContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    maxHeight: 200,
  },
  recentTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentList: {
    flexGrow: 0,
  },
  recentScan: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  recentScanIcon: {
    fontSize: 20,
    width: 30,
  },
  recentScanInfo: {
    flex: 1,
    marginLeft: 8,
  },
  recentScanName: {
    color: 'white',
    fontSize: 16,
  },
  recentScanWarning: {
    color: '#FF9800',
    fontSize: 12,
    marginTop: 2,
  },
  recentScanTime: {
    color: '#999',
    fontSize: 14,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    margin: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## Admin Dashboard Specification

### Project Structure

```
stage-the-change-admin/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Dashboard home
│   ├── workshops/
│   │   └── [id]/page.tsx       # Workshop detail
│   ├── emails/
│   │   └── page.tsx            # Email management
│   └── import/
│       └── page.tsx            # Data import
├── components/
│   ├── DashboardStats.tsx
│   ├── WorkshopCard.tsx
│   ├── AttendanceTable.tsx
│   ├── EmailPreview.tsx
│   └── ImportForm.tsx
├── lib/
│   ├── supabase.ts
│   ├── google-sheets.ts
│   ├── email-sender.ts
│   └── types.ts
├── public/
├── package.json
└── tsconfig.json
```

### Core Dependencies (package.json)

```json
{
  "name": "stage-the-change-admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0",
    "googleapis": "^131.0.0",
    "nodemailer": "^6.9.8",
    "@tanstack/react-query": "^5.17.0",
    "date-fns": "^3.0.0",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/nodemailer": "^6.4.14",
    "typescript": "^5",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33"
  }
}
```

### Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Sheets
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email
GOOGLE_SHEETS_PRIVATE_KEY=your_private_key
GOOGLE_SHEET_ID=your_sheet_id

# Gmail SMTP
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Dashboard Home Page (app/page.tsx)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface WorkshopStats {
  id: string;
  workshop_name: string;
  time_slot: number;
  room_location: string | null;
  registered: number;
  attended: number;
  absent: number;
  wrong_workshop: number;
}

export default function DashboardPage() {
  const [workshopStats, setWorkshopStats] = useState<WorkshopStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const supabase = createClient();

    const { data: workshops } = await supabase.from('workshops').select('*');
    const { data: students } = await supabase.from('students').select('*');
    const { data: attendance } = await supabase.from('attendance').select('*');

    if (!workshops || !students || !attendance) {
      setLoading(false);
      return;
    }

    const stats: WorkshopStats[] = workshops.map((workshop) => {
      const registered = students.filter(
        (s) =>
          s.workshop_slot1_id === workshop.id || s.workshop_slot2_id === workshop.id
      ).length;

      const workshopAttendance = attendance.filter(
        (a) => a.workshop_id === workshop.id
      );

      const attended = workshopAttendance.length;
      const wrongWorkshop = workshopAttendance.filter(
        (a) => !a.is_correct_workshop
      ).length;

      return {
        id: workshop.id,
        workshop_name: workshop.workshop_name,
        time_slot: workshop.time_slot,
        room_location: workshop.room_location,
        registered,
        attended,
        absent: registered - attended,
        wrong_workshop: wrongWorkshop,
      };
    });

    setWorkshopStats(stats);
    setLoading(false);
  };

  const handleSendEmails = async (timeSlot: 1 | 2) => {
    const confirmText = `Send attendance emails for Time Slot ${timeSlot}?`;
    if (!confirm(confirmText)) return;

    toast.loading('Sending emails...');

    try {
      const response = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlot }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Sent ${result.emailCount} emails successfully!`);
      } else {
        toast.error(`Failed to send emails: ${result.error}`);
      }
    } catch (error) {
      toast.error('Error sending emails');
    }
  };

  const slot1Stats = workshopStats.filter((w) => w.time_slot === 1);
  const slot2Stats = workshopStats.filter((w) => w.time_slot === 2);

  const slot1Totals = {
    registered: slot1Stats.reduce((sum, w) => sum + w.registered, 0),
    attended: slot1Stats.reduce((sum, w) => sum + w.attended, 0),
  };

  const slot2Totals = {
    registered: slot2Stats.reduce((sum, w) => sum + w.registered, 0),
    attended: slot2Stats.reduce((sum, w) => sum + w.attended, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Stage the Change - Event Dashboard
          </h1>
        </div>

        {/* Time Slot 1 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Time Slot 1
            </h2>
            <button
              onClick={() => handleSendEmails(1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Send Slot 1 Emails
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {slot1Stats.map((workshop) => (
              <Link
                key={workshop.id}
                href={`/workshops/${workshop.id}`}
                className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                <h3 className="font-semibold text-lg mb-2">
                  {workshop.workshop_name}
                </h3>
                {workshop.room_location && (
                  <p className="text-sm text-gray-600 mb-4">
                    Room: {workshop.room_location}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Attended:</span>
                    <span className="font-semibold text-green-600">
                      {workshop.attended}/{workshop.registered}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Absent:</span>
                    <span className="font-semibold text-red-600">
                      {workshop.absent}
                    </span>
                  </div>
                  {workshop.wrong_workshop > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Wrong Workshop:</span>
                      <span className="font-semibold text-orange-600">
                        {workshop.wrong_workshop}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700">
              Total Slot 1: {slot1Totals.attended}/{slot1Totals.registered} (
              {slot1Totals.registered > 0
                ? Math.round((slot1Totals.attended / slot1Totals.registered) * 100)
                : 0}
              %)
            </p>
          </div>
        </div>

        {/* Time Slot 2 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Time Slot 2
            </h2>
            <button
              onClick={() => handleSendEmails(2)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={slot2Totals.attended === 0}
            >
              Send Slot 2 Emails
            </button>
          </div>

          {slot2Stats.length === 0 ? (
            <p className="text-gray-600">No workshops for Slot 2</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {slot2Stats.map((workshop) => (
                  <Link
                    key={workshop.id}
                    href={`/workshops/${workshop.id}`}
                    className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                  >
                    <h3 className="font-semibold text-lg mb-2">
                      {workshop.workshop_name}
                    </h3>
                    {workshop.room_location && (
                      <p className="text-sm text-gray-600 mb-4">
                        Room: {workshop.room_location}
                      </p>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Attended:</span>
                        <span className="font-semibold text-green-600">
                          {workshop.attended}/{workshop.registered}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Absent:</span>
                        <span className="font-semibold text-red-600">
                          {workshop.absent}
                        </span>
                      </div>
                      {workshop.wrong_workshop > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Wrong Workshop:</span>
                          <span className="font-semibold text-orange-600">
                            {workshop.wrong_workshop}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">
                  Total Slot 2: {slot2Totals.attended}/{slot2Totals.registered} (
                  {slot2Totals.registered > 0
                    ? Math.round((slot2Totals.attended / slot2Totals.registered) * 100)
                    : 0}
                  %)
                </p>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/import"
            className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow text-center"
          >
            <h3 className="font-semibold text-lg mb-2">Import Data</h3>
            <p className="text-sm text-gray-600">
              Import from Google Sheets
            </p>
          </Link>

          <button
            onClick={loadDashboard}
            className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow text-center"
          >
            <h3 className="font-semibold text-lg mb-2">Refresh Data</h3>
            <p className="text-sm text-gray-600">
              Reload from database
            </p>
          </button>

          <Link
            href="/emails"
            className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow text-center"
          >
            <h3 className="font-semibold text-lg mb-2">Email Log</h3>
            <p className="text-sm text-gray-600">
              View sent emails
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### API Route: Send Emails (app/api/send-emails/route.ts)

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(request: Request) {
  try {
    const { timeSlot } = await request.json();

    // Get all attendance for this time slot
    const { data: workshops } = await supabase
      .from('workshops')
      .select('*')
      .eq('time_slot', timeSlot);

    if (!workshops) {
      return NextResponse.json({ success: false, error: 'No workshops found' });
    }

    const workshopIds = workshops.map((w) => w.id);

    // Get students registered for these workshops
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .or(
        workshopIds
          .map((id) => `workshop_slot${timeSlot}_id.eq.${id}`)
          .join(',')
      );

    // Get attendance records
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .in('workshop_id', workshopIds);

    if (!students) {
      return NextResponse.json({ success: false, error: 'No students found' });
    }

    // Group students by supervisor
    const supervisorGroups: Record<
      string,
      Array<{
        student: any;
        workshop: any;
        attendance: any | null;
      }>
    > = {};

    for (const student of students) {
      if (!supervisorGroups[student.supervisor_email]) {
        supervisorGroups[student.supervisor_email] = [];
      }

      const registeredWorkshopId =
        timeSlot === 1 ? student.workshop_slot1_id : student.workshop_slot2_id;

      const workshop = workshops.find((w) => w.id === registeredWorkshopId);

      const studentAttendance = attendance?.find(
        (a) => a.student_id === student.id
      );

      supervisorGroups[student.supervisor_email].push({
        student,
        workshop,
        attendance: studentAttendance || null,
      });
    }

    // Send emails
    let emailCount = 0;
    const errors: string[] = [];

    for (const [supervisorEmail, studentData] of Object.entries(
      supervisorGroups
    )) {
      try {
        const emailHtml = generateEmailHtml(studentData, timeSlot);

        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: supervisorEmail,
          subject: `Stage the Change - Time Slot ${timeSlot} Attendance Report`,
          html: emailHtml,
        });

        // Log email
        await supabase.from('email_log').insert({
          supervisor_email: supervisorEmail,
          time_slot: timeSlot,
          student_count: studentData.length,
          email_status: 'sent',
        });

        emailCount++;
      } catch (error) {
        console.error(`Failed to send email to ${supervisorEmail}:`, error);
        errors.push(supervisorEmail);

        // Log failure
        await supabase.from('email_log').insert({
          supervisor_email: supervisorEmail,
          time_slot: timeSlot,
          student_count: studentData.length,
          email_status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update supervisor records
    await supabase
      .from('supervisors')
      .update({ [`email_sent_slot${timeSlot}`]: true })
      .in(
        'email',
        Object.keys(supervisorGroups)
      );

    return NextResponse.json({
      success: true,
      emailCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Send emails error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function generateEmailHtml(
  studentData: Array<{
    student: any;
    workshop: any;
    attendance: any | null;
  }>,
  timeSlot: number
): string {
  const presentCount = studentData.filter((s) => s.attendance).length;
  const absentCount = studentData.filter((s) => !s.attendance).length;
  const wrongWorkshopCount = studentData.filter(
    (s) => s.attendance && !s.attendance.is_correct_workshop
  ).length;

  const studentRows = studentData
    .map((data) => {
      const { student, workshop, attendance } = data;

      let statusIcon = '✗';
      let statusText = 'Absent';
      let statusClass = 'absent';
      let actualWorkshop = '-';

      if (attendance) {
        if (attendance.is_correct_workshop) {
          statusIcon = '✓';
          statusText = 'Present';
          statusClass = 'present';
          actualWorkshop = workshop?.workshop_name || 'Unknown';
        } else {
          statusIcon = '⚠️';
          statusText = 'Wrong Workshop';
          statusClass = 'wrong';
          // Find actual workshop they attended
          actualWorkshop = 'Different Workshop';
        }
      }

      const scannedTime = attendance
        ? new Date(attendance.scanned_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : '-';

      return `
        <tr class="${statusClass}">
          <td style="padding: 12px; border-bottom: 1px solid #ddd;">${student.student_name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;">${workshop?.workshop_name || 'Not registered'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;">${actualWorkshop}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;">${statusIcon} ${statusText}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;">${scannedTime}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #4A90E2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
        th { background: #4A90E2; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ddd; }
        .present { background: #f1f8f4; }
        .absent { background: #ffebee; }
        .wrong { background: #fff3e0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        ul { margin: 10px 0; }
        li { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Stage the Change</h1>
          <p>Workshop Attendance Report - Time Slot ${timeSlot}</p>
        </div>
        
        <div class="content">
          <p>Hello,</p>
          
          <p>Here's the attendance report for your students at today's Stage the Change event:</p>
          
          <h3>Summary</h3>
          <ul>
            <li><strong>Present:</strong> ${presentCount} student${presentCount !== 1 ? 's' : ''}</li>
            <li><strong>Absent:</strong> ${absentCount} student${absentCount !== 1 ? 's' : ''}</li>
            ${wrongWorkshopCount > 0 ? `<li><strong>Wrong Workshop:</strong> ${wrongWorkshopCount} student${wrongWorkshopCount !== 1 ? 's' : ''}</li>` : ''}
          </ul>
          
          <h3>Student Details</h3>
          
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Registered Workshop</th>
                <th>Actual Workshop</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${studentRows}
            </tbody>
          </table>
          
          <p><strong>Legend:</strong></p>
          <ul>
            <li>✓ Present - Student attended their registered workshop</li>
            <li>⚠️ Wrong Workshop - Student attended a different workshop</li>
            <li>✗ Absent - Student did not check in</li>
          </ul>
          
          <p>If you have any questions or concerns about this attendance, please contact the event coordinator.</p>
          
          <p>Thank you for your support of Stage the Change!</p>
        </div>
        
        <div class="footer">
          <p>Stage the Change © 2025</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

---

## QR Code Generation

### Python Script (scripts/generate_qr_codes.py)

```python
#!/usr/bin/env python3
"""
QR Code Generator for Stage the Change
Generates individual QR code images for each student registration ID
"""

import qrcode
import csv
import sys
from pathlib import Path
from typing import List, Dict

def generate_qr_codes(csv_path: str, output_dir: str) -> None:
    """
    Generate QR codes for each student in the CSV file.
    
    Args:
        csv_path: Path to the CSV file containing student data
        output_dir: Directory where QR code images will be saved
    """
    # Create output directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Track statistics
    generated_count = 0
    errors: List[str] = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            # Validate CSV has required column
            if 'Registration ID' not in reader.fieldnames:
                print("Error: CSV must contain 'Registration ID' column")
                sys.exit(1)
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    reg_id = row['Registration ID'].strip()
                    
                    if not reg_id:
                        errors.append(f"Row {row_num}: Empty registration ID")
                        continue
                    
                    # Generate QR code
                    qr = qrcode.QRCode(
                        version=1,
                        error_correction=qrcode.constants.ERROR_CORRECT_M,
                        box_size=10,
                        border=4,
                    )
                    
                    qr.add_data(reg_id)
                    qr.make(fit=True)
                    
                    # Create image
                    img = qr.make_image(fill_color="black", back_color="white")
                    
                    # Save with registration ID as filename
                    # Sanitize filename to remove invalid characters
                    safe_filename = "".join(
                        c for c in reg_id if c.isalnum() or c in ('-', '_')
                    )
                    img_path = output_path / f"{safe_filename}.png"
                    img.save(img_path)
                    
                    generated_count += 1
                    
                    if generated_count % 50 == 0:
                        print(f"Generated {generated_count} QR codes...")
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"QR Code Generation Complete")
        print(f"{'='*60}")
        print(f"Total generated: {generated_count}")
        print(f"Output directory: {output_path.absolute()}")
        
        if errors:
            print(f"\nErrors encountered: {len(errors)}")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more")
        else:
            print("\n✓ All QR codes generated successfully!")
        
    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_qr_codes.py <csv_file> [output_dir]")
        print("\nExample:")
        print("  python generate_qr_codes.py students.csv qr_codes/")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "qr_codes"
    
    generate_qr_codes(csv_path, output_dir)

if __name__ == "__main__":
    main()
```

### Requirements (scripts/requirements.txt)

```
qrcode[pil]==7.4.2
Pillow==10.2.0
```

---

## Google Sheets Integration

### Python Script (scripts/import_from_sheets.py)

```python
#!/usr/bin/env python3
"""
Google Sheets Import Script
Imports student and workshop data from Google Sheets to Supabase
"""

import os
import sys
from typing import List, Dict, Any
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from supabase import create_client, Client

# Configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SPREADSHEET_ID = os.getenv('GOOGLE_SHEET_ID')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

def get_sheets_service():
    """Create and return Google Sheets API service"""
    creds = Credentials.from_service_account_file(
        'credentials.json',
        scopes=SCOPES
    )
    return build('sheets', 'v4', credentials=creds)

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def read_sheet_data(service, range_name: str) -> List[List[str]]:
    """Read data from Google Sheet"""
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=range_name
    ).execute()
    
    return result.get('values', [])

def parse_students(rows: List[List[str]]) -> List[Dict[str, Any]]:
    """Parse student rows into structured data"""
    if not rows or len(rows) < 2:
        return []
    
    headers = rows[0]
    students = []
    
    for row in rows[1:]:
        # Pad row if it's shorter than headers
        row = row + [''] * (len(headers) - len(row))
        
        student = {
            'registration_id': row[headers.index('Registration ID')],
            'student_name': row[headers.index('Student Name')],
            'supervisor_name': row[headers.index('Supervisor Name')] if 'Supervisor Name' in headers else None,
            'supervisor_email': row[headers.index('Supervisor Email')],
            'workshop_slot1': row[headers.index('Workshop Slot 1')] if 'Workshop Slot 1' in headers else None,
            'workshop_slot2': row[headers.index('Workshop Slot 2')] if 'Workshop Slot 2' in headers else None,
        }
        
        if student['registration_id'] and student['student_name']:
            students.append(student)
    
    return students

def parse_workshops(rows: List[List[str]]) -> List[Dict[str, Any]]:
    """Parse workshop rows into structured data"""
    if not rows or len(rows) < 2:
        return []
    
    headers = rows[0]
    workshops = []
    
    for row in rows[1:]:
        row = row + [''] * (len(headers) - len(row))
        
        workshop = {
            'workshop_name': row[headers.index('Workshop Name')],
            'time_slot': int(row[headers.index('Time Slot')]),
            'room_location': row[headers.index('Room')] if 'Room' in headers else None,
            'capacity': int(row[headers.index('Capacity')]) if 'Capacity' in headers and row[headers.index('Capacity')] else None,
        }
        
        if workshop['workshop_name']:
            workshops.append(workshop)
    
    return workshops

def import_data():
    """Main import function"""
    print("Starting import from Google Sheets...")
    
    # Initialize services
    sheets_service = get_sheets_service()
    supabase = get_supabase_client()
    
    # Read data from sheets
    print("\nReading workshops...")
    workshop_rows = read_sheet_data(sheets_service, 'Workshops!A:E')
    workshops = parse_workshops(workshop_rows)
    print(f"Found {len(workshops)} workshops")
    
    print("\nReading students...")
    student_rows = read_sheet_data(sheets_service, 'Students!A:G')
    students_data = parse_students(student_rows)
    print(f"Found {len(students_data)} students")
    
    # Clear existing data
    print("\nClearing existing data...")
    supabase.table('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('students').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('workshops').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    
    # Import workshops first
    print("\nImporting workshops...")
    workshop_map = {}  # Map workshop names to IDs
    
    for workshop in workshops:
        result = supabase.table('workshops').insert(workshop).execute()
        if result.data:
            workshop_map[workshop['workshop_name']] = result.data[0]['id']
    
    print(f"Imported {len(workshop_map)} workshops")
    
    # Import students with workshop references
    print("\nImporting students...")
    imported_count = 0
    
    for student_data in students_data:
        # Map workshop names to IDs
        workshop_slot1_id = workshop_map.get(student_data.pop('workshop_slot1'))
        workshop_slot2_id = workshop_map.get(student_data.pop('workshop_slot2'))
        
        student_data['workshop_slot1_id'] = workshop_slot1_id
        student_data['workshop_slot2_id'] = workshop_slot2_id
        
        result = supabase.table('students').insert(student_data).execute()
        if result.data:
            imported_count += 1
    
    print(f"Imported {imported_count} students")
    
    # Extract unique supervisors
    print("\nExtracting supervisors...")
    supervisors = {}
    for student in students_data:
        email = student['supervisor_email']
        if email and email not in supervisors:
            supervisors[email] = {
                'email': email,
                'supervisor_name': student.get('supervisor_name'),
            }
    
    for supervisor in supervisors.values():
        supabase.table('supervisors').upsert(supervisor).execute()
    
    print(f"Processed {len(supervisors)} supervisors")
    
    print("\n" + "="*60)
    print("Import completed successfully!")
    print("="*60)

if __name__ == "__main__":
    try:
        import_data()
    except Exception as e:
        print(f"\nError: {str(e)}", file=sys.stderr)
        sys.exit(1)
```

---

## Implementation Plan

### Phase 1: Foundation (Days 1-2)

**Day 1: Supabase Setup**
- [ ] Create Supabase project
- [ ] Run database schema SQL scripts
- [ ] Test RLS policies
- [ ] Generate API keys
- [ ] Document connection details

**Day 2: Scripts Setup**
- [ ] Create QR code generation script
- [ ] Test with sample CSV
- [ ] Generate 10 test QR codes
- [ ] Create Google Sheets import script
- [ ] Test import with sample data

### Phase 2: Mobile App Development (Days 3-7)

**Day 3: Project Initialization**
```bash
npx create-expo-app@latest stage-the-change-scanner --template blank-typescript
cd stage-the-change-scanner
npx expo install expo-camera expo-sqlite expo-router @supabase/supabase-js
npx expo install @tanstack/react-query zustand react-native-safe-area-context
npx expo install react-native-screens @react-native-async-storage/async-storage
```
- [ ] Configure app.json
- [ ] Set up environment variables
- [ ] Initialize database schema
- [ ] Create TypeScript types

**Day 4: Core Features**
- [ ] Build Supabase client
- [ ] Implement SQLite database operations
- [ ] Create sync logic (to/from Supabase)
- [ ] Build Zustand store
- [ ] Test offline/online sync

**Day 5: UI Screens**
- [ ] Home/Setup screen
- [ ] Session selection screen
- [ ] QR scanning screen
- [ ] Test camera permissions
- [ ] Test QR code scanning with generated codes

**Day 6: Attendance Logic**
- [ ] Implement attendance recording
- [ ] Wrong workshop alert
- [ ] Manual check-in modal
- [ ] Roster view
- [ ] Check-out functionality

**Day 7: Testing & Polish**
- [ ] Test full offline workflow
- [ ] Test sync with Supabase
- [ ] Test multiple devices simultaneously
- [ ] Fix bugs
- [ ] Improve UI/UX

### Phase 3: Admin Dashboard (Days 8-10)

**Day 8: Dashboard Initialization**
```bash
npx create-next-app@latest stage-the-change-admin --typescript --tailwind --app
cd stage-the-change-admin
npm install @supabase/supabase-js @supabase/ssr googleapis nodemailer
npm install --save-dev @types/nodemailer
```
- [ ] Configure environment variables
- [ ] Set up Supabase client
- [ ] Create basic layout

**Day 9: Dashboard Pages**
- [ ] Build main dashboard
- [ ] Create workshop detail view
- [ ] Implement data import page
- [ ] Add manual override capability
- [ ] Test Google Sheets import

**Day 10: Email System**
- [ ] Create email API route
- [ ] Implement email grouping logic
- [ ] Build email template HTML
- [ ] Set up Gmail SMTP
- [ ] Test email sending

### Phase 4: Integration & Testing (Days 11-12)

**Day 11: End-to-End Testing**
- [ ] Import real student data
- [ ] Generate all QR codes
- [ ] Test complete workflow:
  1. Data import
  2. QR code generation
  3. Mobile app sync
  4. Scanning students
  5. Viewing dashboard
  6. Sending emails
- [ ] Fix any integration issues

**Day 12: Multi-Device Testing**
- [ ] Test on multiple iOS devices
- [ ] Test on multiple Android devices
- [ ] Test simultaneous scanning
- [ ] Test offline sync conflicts
- [ ] Verify email delivery

### Phase 5: Deployment (Days 13-14)

**Day 13: Build & Deploy**
- [ ] Configure EAS Build
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
eas build --platform android
```
- [ ] Deploy admin dashboard to Vercel
- [ ] Set up production environment variables
- [ ] Create deployment documentation

**Day 14: Distribution & Documentation**
- [ ] Distribute mobile app builds
- [ ] Create user guides:
  - Scanner operator quick start
  - Admin dashboard guide
  - Troubleshooting guide
- [ ] Conduct final training session
- [ ] Create emergency contact list

---

## Testing Strategy

### Unit Testing
- Database operations (SQLite)
- Sync logic
- QR code parsing
- Email template generation

### Integration Testing
- Mobile app → Supabase sync
- Admin dashboard → Supabase queries
- Email sending → Gmail SMTP

### End-to-End Testing Scenarios

**Scenario 1: Happy Path**
1. Import student data from Google Sheets
2. Generate QR codes
3. Scanner syncs data
4. Student scans correct workshop
5. Attendance recorded and synced
6. Admin sends emails
7. Supervisor receives correct email

**Scenario 2: Wrong Workshop**
1. Student scans into wrong workshop
2. Alert appears
3. Operator marks attended anyway
4. Flagged in dashboard
5. Supervisor email shows warning

**Scenario 3: Offline Operation**
1. Scanner loses internet
2. Students continue scanning
3. Attendance saved locally
4. Scanner regains internet
5. Data syncs automatically
6. Dashboard updates

**Scenario 4: Multiple Scanners**
1. 3 scanners running simultaneously
2. Different workshops
3. Some students attend wrong workshops
4. All data syncs to Supabase
5. No duplicate records
6. Real-time updates across devices

---

## Deployment Guide

### Prerequisites
- Supabase account (free tier)
- Google Cloud account (for Sheets API)
- Gmail account with app password
- Apple Developer account ($99/year)
- Google Play Developer account ($25 one-time)
- Vercel account (free tier)

### Environment Setup

**.env for Mobile App**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**.env.local for Admin Dashboard**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_SHEET_ID=your_sheet_id
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Deployment Commands

**Mobile App:**
```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to App Store (optional)
eas submit --platform ios

# Submit to Play Store (optional)
eas submit --platform android
```

**Admin Dashboard:**
```bash
# Deploy to Vercel
vercel --prod
```

---

## Environment Configuration

### Supabase Setup
1. Create project at https://supabase.com
2. Go to Project Settings → API
3. Copy:
   - Project URL
   - anon/public key
   - service_role key (keep secret!)
4. Go to SQL Editor
5. Run all schema SQL from this spec

### Google Sheets API Setup
1. Go to https://console.cloud.google.com
2. Create new project
3. Enable Google Sheets API
4. Create service account
5. Download JSON credentials
6. Share your Google Sheet with service account email

### Gmail SMTP Setup
1. Enable 2-Factor Authentication
2. Go to Google Account → Security
3. App Passwords → Generate new password
4. Select "Mail" and "Other"
5. Copy generated password

### EAS Build Setup
```bash
eas login
eas build:configure

# Answer prompts:
# - Bundle identifier: org.stagethechange.scanner
# - Generate new credentials
```

---

## Troubleshooting

### Common Issues

**Issue: Camera not working**
- Verify permissions in app.json
- Check iOS Info.plist has NSCameraUsageDescription
- Test on physical device (simulator cameras don't work well)

**Issue: Sync not working**
- Check internet connectivity
- Verify Supabase URL and keys
- Check RLS policies allow anonymous access
- Look at Supabase logs

**Issue: QR codes not scanning**
- Ensure QR codes are high contrast
- Check lighting conditions
- Verify QR data matches registration IDs
- Test with different QR code sizes

**Issue: Emails not sending**
- Verify Gmail app password
- Check Gmail daily send limit (500/day)
- Look at email_log table for errors
- Test with single email first

**Issue: Duplicate attendance records**
- Check UNIQUE constraint on (student_id, workshop_id)
- Verify sync isn't creating duplicates
- Look at database triggers

---

## Success Criteria

✅ **System is ready when:**
- [ ] All students imported to database
- [ ] All QR codes generated and printed
- [ ] Mobile app built and distributed
- [ ] 3+ scanners tested simultaneously
- [ ] Offline sync verified working
- [ ] Test emails sent and received correctly
- [ ] Admin dashboard accessible
- [ ] All documentation complete
- [ ] Training session conducted
- [ ] Emergency contact list created

---

## Next Steps for Claude Code

When you start implementation with Claude Code:

1. **Start with:** `stage-the-change-scanner` mobile app
2. **Then:** Database scripts and QR generator
3. **Then:** `stage-the-change-admin` dashboard
4. **Finally:** Integration testing

Use this command to begin:
```bash
# In your project directory
claude-code "Create the Stage the Change mobile scanner app according to the spec at STAGE_THE_CHANGE_TECHNICAL_SPEC.md. Start with project initialization and database setup."
```

---

**Questions or need clarification? Ready to proceed with implementation!**
