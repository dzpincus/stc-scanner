/**
 * SQLite Database Operations
 * Handles local offline storage for students, workshops, and attendance
 */

import * as SQLite from 'expo-sqlite';
import { Student, Workshop, Attendance } from './types';

// Database instance - initialized lazily
let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Get or initialize database connection
 * Uses async initialization to prevent race conditions with new architecture
 */
const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) {
    return db;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      db = await SQLite.openDatabaseAsync('stage-the-change.db');
      return db;
    })();
  }

  return await dbPromise;
};

/**
 * Add a column if it does not exist yet (SQLite has no ADD COLUMN IF NOT EXISTS).
 */
const ensureColumn = async (
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  ddl: string
): Promise<void> => {
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
};

/**
 * Initialize SQLite database schema
 * Creates all tables and indexes for offline storage
 * Uses a single transaction to prevent race conditions
 */
export const initDatabase = async (): Promise<void> => {
  // Prevent multiple simultaneous initializations
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const database = await getDatabase();

      // Run all schema setup in a single transaction
      await database.execAsync(`
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

        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_students_registration ON students(registration_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_workshop ON attendance(workshop_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance(synced);
      `);

      // Additive migrations for installs that already have the 2025 schema.
      await ensureColumn(database, 'students', 'event_id', 'TEXT');
      await ensureColumn(database, 'workshops', 'event_id', 'TEXT');
      await ensureColumn(database, 'attendance', 'event_id', 'TEXT');
      await ensureColumn(database, 'attendance', 'last_sync_error', 'TEXT');
      await ensureColumn(database, 'attendance', 'sync_attempts', 'INTEGER DEFAULT 0');

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      initPromise = null; // Reset so it can be retried
      throw error;
    }
  })();

  return initPromise;
};

// ============================================================================
// STUDENT OPERATIONS
// ============================================================================

/**
 * Get a student by their registration ID
 */
export const getStudentByRegistrationId = async (
  registrationId: string
): Promise<Student | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Student>(
    'SELECT * FROM students WHERE registration_id = ?',
    [registrationId]
  );
  return result || null;
};

/**
 * Get all students ordered by name
 */
export const getAllStudents = async (): Promise<Student[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Student>('SELECT * FROM students ORDER BY student_name');
};

/**
 * Get students registered for a specific workshop
 */
export const getStudentsByWorkshop = async (workshopId: string): Promise<Student[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Student>(
    'SELECT * FROM students WHERE workshop_slot1_id = ? OR workshop_slot2_id = ? ORDER BY student_name',
    [workshopId, workshopId]
  );
};

/**
 * Insert or update a student record
 */
export const upsertStudent = async (student: Student): Promise<void> => {
  const database = await getDatabase();
  // A re-created student (same registration id, new server id) must not violate the local UNIQUE.
  await database.runAsync('DELETE FROM students WHERE registration_id = ? AND id != ?', [
    student.registration_id,
    student.id,
  ]);
  await database.runAsync(
    `INSERT INTO students (id, event_id, registration_id, student_name, supervisor_name, supervisor_email,
     workshop_slot1_id, workshop_slot2_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
     event_id = excluded.event_id,
     registration_id = excluded.registration_id,
     student_name = excluded.student_name,
     supervisor_name = excluded.supervisor_name,
     supervisor_email = excluded.supervisor_email,
     workshop_slot1_id = excluded.workshop_slot1_id,
     workshop_slot2_id = excluded.workshop_slot2_id,
     notes = excluded.notes,
     updated_at = excluded.updated_at`,
    [
      student.id,
      student.event_id ?? null,
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

/**
 * Bulk insert students (more efficient for initial sync)
 */
export const bulkInsertStudents = async (students: Student[]): Promise<void> => {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const student of students) {
      await upsertStudent(student);
    }
  });
};

// ============================================================================
// WORKSHOP OPERATIONS
// ============================================================================

/**
 * Get all workshops ordered by time slot and name
 */
export const getAllWorkshops = async (): Promise<Workshop[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Workshop>(
    'SELECT * FROM workshops ORDER BY time_slot, workshop_name'
  );
};

/**
 * Get workshops by time slot
 */
export const getWorkshopsByTimeSlot = async (timeSlot: 1 | 2): Promise<Workshop[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Workshop>(
    'SELECT * FROM workshops WHERE time_slot = ? ORDER BY workshop_name',
    [timeSlot]
  );
};

/**
 * Get a single workshop by ID
 */
export const getWorkshopById = async (id: string): Promise<Workshop | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Workshop>(
    'SELECT * FROM workshops WHERE id = ?',
    [id]
  );
  return result || null;
};

/**
 * Insert or update a workshop record
 */
export const upsertWorkshop = async (workshop: Workshop): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO workshops (id, event_id, workshop_name, time_slot, room_location, description, capacity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
     event_id = excluded.event_id,
     workshop_name = excluded.workshop_name,
     time_slot = excluded.time_slot,
     room_location = excluded.room_location,
     description = excluded.description,
     capacity = excluded.capacity,
     updated_at = excluded.updated_at`,
    [
      workshop.id,
      workshop.event_id ?? null,
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

/**
 * Bulk insert workshops (more efficient for initial sync)
 */
export const bulkInsertWorkshops = async (workshops: Workshop[]): Promise<void> => {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const workshop of workshops) {
      await upsertWorkshop(workshop);
    }
  });
};

// ============================================================================
// ATTENDANCE OPERATIONS
// ============================================================================

/**
 * Create a new attendance record
 * Deletes any existing record for the same student+workshop first, then inserts
 */
export const createAttendance = async (attendance: Attendance): Promise<void> => {
  try {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      // First, delete any existing attendance for this student+workshop combination
      await database.runAsync(
        'DELETE FROM attendance WHERE student_id = ? AND workshop_id = ?',
        [attendance.student_id, attendance.workshop_id]
      );

      // Then insert the new record
      await database.runAsync(
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
    });
  } catch (error) {
    console.error('Error creating attendance:', error);
    throw error;
  }
};

/**
 * Get all attendance records for a workshop
 */
export const getAttendanceByWorkshop = async (workshopId: string): Promise<Attendance[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Attendance>(
    'SELECT * FROM attendance WHERE workshop_id = ? ORDER BY scanned_at DESC',
    [workshopId]
  );
};

/**
 * Get attendance record for a specific student in a specific workshop
 */
export const getAttendanceByStudentAndWorkshop = async (
  studentId: string,
  workshopId: string
): Promise<Attendance | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Attendance>(
    'SELECT * FROM attendance WHERE student_id = ? AND workshop_id = ?',
    [studentId, workshopId]
  );
  return result || null;
};

/**
 * Check if a student has already checked in to a workshop
 */
export const hasStudentCheckedIn = async (
  studentId: string,
  workshopId: string
): Promise<boolean> => {
  const attendance = await getAttendanceByStudentAndWorkshop(studentId, workshopId);
  return attendance !== null;
};

/**
 * Check out a student from a workshop
 */
export const checkOutStudent = async (
  studentId: string,
  workshopId: string
): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE attendance SET checked_out_at = ?, synced = 0 WHERE student_id = ? AND workshop_id = ?',
    [new Date().toISOString(), studentId, workshopId]
  );
};

/**
 * Update attendance notes
 */
export const updateAttendanceNotes = async (
  attendanceId: string,
  notes: string
): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE attendance SET notes = ?, synced = 0, updated_at = ? WHERE id = ?',
    [notes, new Date().toISOString(), attendanceId]
  );
};

/**
 * Update full attendance record
 */
export const updateAttendance = async (
  attendanceId: string,
  updates: {
    scanned_at?: string;
    is_correct_workshop?: boolean;
    manually_added?: boolean;
    manually_overridden?: boolean;
    checked_out_at?: string | null;
    notes?: string;
  }
): Promise<void> => {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.scanned_at !== undefined) {
    fields.push('scanned_at = ?');
    values.push(updates.scanned_at);
  }
  if (updates.is_correct_workshop !== undefined) {
    fields.push('is_correct_workshop = ?');
    values.push(updates.is_correct_workshop ? 1 : 0);
  }
  if (updates.manually_added !== undefined) {
    fields.push('manually_added = ?');
    values.push(updates.manually_added ? 1 : 0);
  }
  if (updates.manually_overridden !== undefined) {
    fields.push('manually_overridden = ?');
    values.push(updates.manually_overridden ? 1 : 0);
  }
  if (updates.checked_out_at !== undefined) {
    fields.push('checked_out_at = ?');
    values.push(updates.checked_out_at);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }

  if (fields.length === 0) return;

  fields.push('synced = ?', 'updated_at = ?');
  values.push(0, new Date().toISOString());

  values.push(attendanceId);

  const database = await getDatabase();
  await database.runAsync(
    `UPDATE attendance SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

/**
 * Delete an attendance record
 * First adds it to deletion queue for sync, then removes from local DB
 */
export const deleteAttendance = async (attendanceId: string): Promise<void> => {
  const database = await getDatabase();
  // Add to sync queue for deletion
  await database.runAsync(
    `INSERT INTO sync_queue (id, operation, table_name, record_data, created_at, retry_count)
     VALUES (?, 'DELETE', 'attendance', ?, ?, 0)`,
    [
      `delete-${attendanceId}-${Date.now()}`,
      JSON.stringify({ id: attendanceId }),
      new Date().toISOString(),
    ]
  );

  // Delete from local database
  await database.runAsync('DELETE FROM attendance WHERE id = ?', [attendanceId]);
};

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Get all unsynced attendance records
 */
export const getUnsyncedAttendance = async (): Promise<Attendance[]> => {
  const database = await getDatabase();
  return await database.getAllAsync<Attendance>(
    'SELECT * FROM attendance WHERE synced = 0'
  );
};

/**
 * Mark attendance records as synced
 */
export const markAttendanceSynced = async (attendanceIds: string[]): Promise<void> => {
  if (attendanceIds.length === 0) return;

  const database = await getDatabase();
  const placeholders = attendanceIds.map(() => '?').join(',');
  await database.runAsync(
    `UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`,
    attendanceIds
  );
};

/**
 * Get count of unsynced records (including pending deletions)
 */
export const getUnsyncedCount = async (): Promise<number> => {
  const database = await getDatabase();
  const attendanceCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM attendance WHERE synced = 0'
  );
  const queueCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue'
  );
  return (attendanceCount?.count || 0) + (queueCount?.count || 0);
};

/**
 * Get pending deletion operations from sync queue
 */
export const getPendingDeletions = async (): Promise<Array<{ id: string; recordData: string }>> => {
  try {
    const database = await getDatabase();
    const results = await database.getAllAsync<{ id: string; record_data: string }>(
      "SELECT id, record_data FROM sync_queue WHERE operation = 'DELETE' AND table_name = 'attendance'"
    );

    // Map record_data to recordData for consistency
    return results.map(r => ({
      id: r.id,
      recordData: r.record_data
    }));
  } catch (error) {
    console.error('Error getting pending deletions:', error);
    return [];
  }
};

/**
 * Remove completed operations from sync queue
 */
export const clearSyncQueueItems = async (queueIds: string[]): Promise<void> => {
  if (queueIds.length === 0) return;

  const database = await getDatabase();
  const placeholders = queueIds.map(() => '?').join(',');
  await database.runAsync(
    `DELETE FROM sync_queue WHERE id IN (${placeholders})`,
    queueIds
  );
};

// ============================================================================
// DATA MANAGEMENT
// ============================================================================

/**
 * Clear all data from the database (use with caution!)
 */
export const clearAllData = async (): Promise<void> => {
  try {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM attendance');
      await database.runAsync('DELETE FROM students');
      await database.runAsync('DELETE FROM workshops');
      await database.runAsync('DELETE FROM sync_queue');
      await database.runAsync('DELETE FROM meta');
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async (): Promise<{
  studentCount: number;
  workshopCount: number;
  attendanceCount: number;
  unsyncedCount: number;
}> => {
  const database = await getDatabase();
  const studentCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM students'
  );
  const workshopCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workshops'
  );
  const attendanceCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM attendance'
  );
  const unsyncedCount = await getUnsyncedCount();

  return {
    studentCount: studentCount?.count || 0,
    workshopCount: workshopCount?.count || 0,
    attendanceCount: attendanceCount?.count || 0,
    unsyncedCount,
  };
};

// ============================================================================
// META (key/value), EVENT SCOPING, SERVER MERGE
// ============================================================================

export const getMeta = async (key: string): Promise<string | null> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
};

export const setMeta = async (key: string, value: string | null): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
};

/**
 * Replace reference data (students + workshops) for the active event.
 * Rows that disappeared on the server are removed locally unless a local attendance row
 * still points at them (those must survive until they have uploaded).
 */
export const replaceReferenceData = async (
  students: Student[],
  workshops: Workshop[]
): Promise<{ removedStudents: number; removedWorkshops: number }> => {
  const database = await getDatabase();
  let removedStudents = 0;
  let removedWorkshops = 0;
  await database.withTransactionAsync(async () => {
    for (const w of workshops) await upsertWorkshop(w);
    for (const s of students) await upsertStudent(s);

    const localStudents = await database.getAllAsync<{ id: string }>('SELECT id FROM students');
    const keepStudents = new Set(students.map((s) => s.id));
    for (const { id } of localStudents) {
      if (keepStudents.has(id)) continue;
      const r = await database.runAsync(
        'DELETE FROM students WHERE id = ? AND NOT EXISTS (SELECT 1 FROM attendance WHERE student_id = ?)',
        [id, id]
      );
      removedStudents += r.changes;
    }

    const localWorkshops = await database.getAllAsync<{ id: string }>('SELECT id FROM workshops');
    const keepWorkshops = new Set(workshops.map((w) => w.id));
    for (const { id } of localWorkshops) {
      if (keepWorkshops.has(id)) continue;
      const r = await database.runAsync(
        'DELETE FROM workshops WHERE id = ? AND NOT EXISTS (SELECT 1 FROM attendance WHERE workshop_id = ?)',
        [id, id]
      );
      removedWorkshops += r.changes;
    }
  });
  return { removedStudents, removedWorkshops };
};

const insertAttendanceRow = async (
  database: SQLite.SQLiteDatabase,
  a: Attendance,
  synced: 0 | 1
): Promise<void> => {
  await database.runAsync(
    `INSERT INTO attendance (id, event_id, student_id, workshop_id, scanned_at, scanner_device_id,
     is_correct_workshop, manually_added, manually_overridden, checked_out_at, notes,
     created_at, updated_at, synced, last_sync_error, sync_attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
    [
      a.id,
      a.event_id ?? null,
      a.student_id,
      a.workshop_id,
      a.scanned_at,
      a.scanner_device_id,
      a.is_correct_workshop ? 1 : 0,
      a.manually_added ? 1 : 0,
      a.manually_overridden ? 1 : 0,
      a.checked_out_at,
      a.notes,
      a.created_at,
      a.updated_at,
      synced,
    ]
  );
};

/**
 * Merge the server's attendance for the active event into SQLite so every phone sees
 * every room's check-ins. Rules per (student, workshop):
 *  - no local row            -> insert server row as synced
 *  - local row already synced -> server row wins
 *  - local row unsynced       -> keep ours only if it is strictly earlier than the server's
 *                                (the RPC will then merge it); otherwise ours is a duplicate
 * Returns how many local rows changed.
 */
export const mergeRemoteAttendance = async (remote: Attendance[]): Promise<number> => {
  const database = await getDatabase();
  let changed = 0;
  await database.withTransactionAsync(async () => {
    for (const r of remote) {
      const local = await database.getFirstAsync<Attendance & { synced: number }>(
        'SELECT * FROM attendance WHERE student_id = ? AND workshop_id = ?',
        [r.student_id, r.workshop_id]
      );
      if (!local) {
        await insertAttendanceRow(database, r, 1);
        changed++;
        continue;
      }
      // Compare as instants: the phone writes "...Z", PostgREST returns "...+00:00".
      if (local.synced === 0 && Date.parse(local.scanned_at) < Date.parse(r.scanned_at)) {
        continue; // ours is earlier; upload will win
      }
      if (
        local.synced === 1 &&
        local.id === r.id &&
        Date.parse(local.updated_at) === Date.parse(r.updated_at)
      ) {
        continue; // identical
      }
      await database.runAsync('DELETE FROM attendance WHERE id = ?', [local.id]);
      await insertAttendanceRow(database, r, 1);
      changed++;
    }
  });
  return changed;
};

/**
 * After a complete pull, drop synced local rows the server no longer has
 * (voided by an admin or another phone). Unsynced rows are never touched.
 */
export const removeAttendanceNotIn = async (remoteIds: Set<string>): Promise<number> => {
  const database = await getDatabase();
  const local = await database.getAllAsync<{ id: string }>(
    'SELECT id FROM attendance WHERE synced = 1'
  );
  const stale = local.map((r) => r.id).filter((id) => !remoteIds.has(id));
  if (stale.length === 0) return 0;
  await database.withTransactionAsync(async () => {
    for (let i = 0; i < stale.length; i += 200) {
      const chunk = stale.slice(i, i + 200);
      await database.runAsync(
        `DELETE FROM attendance WHERE id IN (${chunk.map(() => '?').join(',')})`,
        chunk
      );
    }
  });
  return stale.length;
};

export type UpsertStatus = 'inserted' | 'merged_earlier' | 'already_synced' | 'duplicate' | 'error';

/**
 * Apply per-row results from the upsert_attendance RPC.
 * Everything except `error` means the server has the row (or an earlier one): mark synced.
 */
export const applyUploadResults = async (
  results: Array<{ id: string; status: UpsertStatus; detail: string | null }>
): Promise<void> => {
  if (results.length === 0) return;
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const r of results) {
      if (r.status === 'error') {
        await database.runAsync(
          'UPDATE attendance SET last_sync_error = ?, sync_attempts = sync_attempts + 1 WHERE id = ?',
          [r.detail ?? 'unknown error', r.id]
        );
      } else {
        await database.runAsync(
          'UPDATE attendance SET synced = 1, last_sync_error = NULL WHERE id = ?',
          [r.id]
        );
      }
    }
  });
};

export const getFailedUploadCount = async (): Promise<number> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM attendance WHERE synced = 0 AND last_sync_error IS NOT NULL'
  );
  return row?.count || 0;
};
