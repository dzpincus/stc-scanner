-- Stage the Change Workshop Attendance System
-- Initial Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Students Table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id TEXT UNIQUE NOT NULL,
    student_name TEXT NOT NULL,
    supervisor_name TEXT,
    supervisor_email TEXT NOT NULL,
    workshop_slot1_id UUID,
    workshop_slot2_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Workshops Table
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

-- 3. Attendance Table
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

-- 4. Supervisors Table
CREATE TABLE supervisors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    supervisor_name TEXT,
    email_sent_slot1 BOOLEAN DEFAULT false,
    email_sent_slot2 BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Email Log Table
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

-- 6. Sync Queue Table (for offline sync)
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

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Students indexes
CREATE INDEX idx_students_registration_id ON students(registration_id);
CREATE INDEX idx_students_supervisor_email ON students(supervisor_email);
CREATE INDEX idx_students_workshop_slot1 ON students(workshop_slot1_id);
CREATE INDEX idx_students_workshop_slot2 ON students(workshop_slot2_id);

-- Workshops indexes
CREATE INDEX idx_workshops_time_slot ON workshops(time_slot);

-- Attendance indexes
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_workshop_id ON attendance(workshop_id);
CREATE INDEX idx_attendance_scanned_at ON attendance(scanned_at);

-- Supervisors indexes
CREATE INDEX idx_supervisors_email ON supervisors(email);

-- Email log indexes
CREATE INDEX idx_email_log_supervisor ON email_log(supervisor_email);
CREATE INDEX idx_email_log_time_slot ON email_log(time_slot);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at);

-- Sync queue indexes
CREATE INDEX idx_sync_queue_device_id ON sync_queue(device_id);
CREATE INDEX idx_sync_queue_processed_at ON sync_queue(processed_at);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS (deferred from table creation for clarity)
-- ============================================================================

ALTER TABLE students
    ADD CONSTRAINT fk_students_workshop_slot1
    FOREIGN KEY (workshop_slot1_id) REFERENCES workshops(id) ON DELETE SET NULL;

ALTER TABLE students
    ADD CONSTRAINT fk_students_workshop_slot2
    FOREIGN KEY (workshop_slot2_id) REFERENCES workshops(id) ON DELETE SET NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get attendance summary for a workshop
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

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Apply auto-update triggers to all tables with updated_at
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workshops_updated_at
    BEFORE UPDATE ON workshops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisors_updated_at
    BEFORE UPDATE ON supervisors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Students policies
CREATE POLICY "Students are viewable by anyone"
    ON students FOR SELECT
    USING (true);

CREATE POLICY "Students are insertable by anyone"
    ON students FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Students are updatable by anyone"
    ON students FOR UPDATE
    USING (true);

-- Workshops policies
CREATE POLICY "Workshops are viewable by anyone"
    ON workshops FOR SELECT
    USING (true);

CREATE POLICY "Workshops are insertable by anyone"
    ON workshops FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Workshops are updatable by anyone"
    ON workshops FOR UPDATE
    USING (true);

-- Attendance policies
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

-- Supervisors policies
CREATE POLICY "Supervisors are viewable by anyone"
    ON supervisors FOR SELECT
    USING (true);

CREATE POLICY "Supervisors are insertable by anyone"
    ON supervisors FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Supervisors are updatable by anyone"
    ON supervisors FOR UPDATE
    USING (true);

-- Email log policies
CREATE POLICY "Email log is viewable by anyone"
    ON email_log FOR SELECT
    USING (true);

CREATE POLICY "Email log is insertable by anyone"
    ON email_log FOR INSERT
    WITH CHECK (true);

-- Sync queue policies
CREATE POLICY "Sync queue is manageable by anyone"
    ON sync_queue FOR ALL
    USING (true);
