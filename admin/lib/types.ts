/**
 * Stage the Change Admin Dashboard
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

export interface WorkshopStats {
  id: string;
  workshop_name: string;
  time_slot: number;
  room_location: string | null;
  registered: number;
  attended: number;
  absent: number;
  wrong_workshop: number;
  attendance_rate: number;
}

export interface SupervisorEmailData {
  supervisor_email: string;
  supervisor_name: string | null;
  students: Array<{
    student_name: string;
    registration_id: string;
    workshop_slot1: string | null;
    workshop_slot2: string | null;
    attended_slot1: boolean;
    attended_slot2: boolean;
  }>;
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
