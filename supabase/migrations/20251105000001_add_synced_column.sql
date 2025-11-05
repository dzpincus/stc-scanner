-- Add synced column to attendance table
-- This column is used by the mobile app to track which records have been uploaded

ALTER TABLE attendance
ADD COLUMN synced BOOLEAN DEFAULT true;

-- Create index for performance when querying unsynced records
CREATE INDEX idx_attendance_synced ON attendance(synced);

-- Comment explaining the column
COMMENT ON COLUMN attendance.synced IS 'Tracks whether this attendance record has been synced from mobile app. Always true for records created server-side.';
