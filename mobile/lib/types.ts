/**
 * Stage the Change - Workshop Attendance System
 * TypeScript Type Definitions
 */

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

export interface Supervisor {
  id: string;
  email: string;
  supervisor_name: string | null;
  email_sent_slot1: boolean;
  email_sent_slot2: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  supervisor_email: string;
  time_slot: 1 | 2;
  sent_at: string;
  student_count: number;
  email_status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  created_at: string;
}

export interface SyncQueue {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  table_name: string;
  record_data: string; // JSONB as string
  device_id: string;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
}
