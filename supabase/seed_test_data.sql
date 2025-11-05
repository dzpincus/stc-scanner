-- Test Data for Stage the Change
-- Run this in Supabase SQL Editor to populate sample data

-- Insert test workshops
INSERT INTO workshops (workshop_name, time_slot, room_location, capacity) VALUES
('Art Workshop', 1, 'Room 101', 25),
('Music Workshop', 1, 'Room 102', 20),
('Dance Workshop', 1, 'Room 103', 30),
('Theater Workshop', 1, 'Room 104', 25),
('Photography Workshop', 1, 'Room 105', 15),
('Creative Writing', 1, 'Room 106', 20),
('Sculpture', 2, 'Room 101', 25),
('Digital Art', 2, 'Room 102', 20),
('Film Making', 2, 'Room 103', 15),
('Poetry', 2, 'Room 104', 20),
('Graphic Design', 2, 'Room 105', 25),
('Animation', 2, 'Room 106', 20);

-- Get workshop IDs for student assignments (you'll need to adjust these after running the above)
-- First, check the IDs that were created:
-- SELECT id, workshop_name, time_slot FROM workshops ORDER BY time_slot, workshop_name;

-- Example: Insert test students (update the UUIDs with your actual workshop IDs)
-- You can get workshop IDs by running: SELECT id, workshop_name FROM workshops WHERE time_slot = 1 LIMIT 2;

-- For now, let's just insert students without workshop assignments
INSERT INTO students (registration_id, student_name, supervisor_name, supervisor_email) VALUES
('STU001', 'Alice Johnson', 'Dr. Jane Smith', 'jane.smith@example.com'),
('STU002', 'Bob Williams', 'Dr. Jane Smith', 'jane.smith@example.com'),
('STU003', 'Carol Davis', 'Prof. John Doe', 'john.doe@example.com'),
('STU004', 'David Brown', 'Prof. John Doe', 'john.doe@example.com'),
('STU005', 'Emma Wilson', 'Dr. Sarah Lee', 'sarah.lee@example.com'),
('STU006', 'Frank Miller', 'Dr. Sarah Lee', 'sarah.lee@example.com'),
('STU007', 'Grace Taylor', 'Dr. Jane Smith', 'jane.smith@example.com'),
('STU008', 'Henry Anderson', 'Prof. John Doe', 'john.doe@example.com'),
('STU009', 'Iris Martinez', 'Dr. Sarah Lee', 'sarah.lee@example.com'),
('STU010', 'Jack Thompson', 'Dr. Jane Smith', 'jane.smith@example.com');

-- Now assign workshops to students
-- First, let's create a temporary view to see workshop IDs
DO $$
DECLARE
    art_workshop_id UUID;
    music_workshop_id UUID;
    dance_workshop_id UUID;
    theater_workshop_id UUID;
    sculpture_workshop_id UUID;
    digital_art_workshop_id UUID;
BEGIN
    -- Get workshop IDs
    SELECT id INTO art_workshop_id FROM workshops WHERE workshop_name = 'Art Workshop';
    SELECT id INTO music_workshop_id FROM workshops WHERE workshop_name = 'Music Workshop';
    SELECT id INTO dance_workshop_id FROM workshops WHERE workshop_name = 'Dance Workshop';
    SELECT id INTO theater_workshop_id FROM workshops WHERE workshop_name = 'Theater Workshop';
    SELECT id INTO sculpture_workshop_id FROM workshops WHERE workshop_name = 'Sculpture';
    SELECT id INTO digital_art_workshop_id FROM workshops WHERE workshop_name = 'Digital Art';

    -- Update students with workshop assignments
    UPDATE students SET workshop_slot1_id = art_workshop_id, workshop_slot2_id = sculpture_workshop_id
    WHERE registration_id = 'STU001';

    UPDATE students SET workshop_slot1_id = music_workshop_id, workshop_slot2_id = digital_art_workshop_id
    WHERE registration_id = 'STU002';

    UPDATE students SET workshop_slot1_id = dance_workshop_id, workshop_slot2_id = sculpture_workshop_id
    WHERE registration_id = 'STU003';

    UPDATE students SET workshop_slot1_id = theater_workshop_id, workshop_slot2_id = digital_art_workshop_id
    WHERE registration_id = 'STU004';

    UPDATE students SET workshop_slot1_id = art_workshop_id, workshop_slot2_id = sculpture_workshop_id
    WHERE registration_id = 'STU005';

    UPDATE students SET workshop_slot1_id = music_workshop_id, workshop_slot2_id = digital_art_workshop_id
    WHERE registration_id = 'STU006';

    UPDATE students SET workshop_slot1_id = dance_workshop_id, workshop_slot2_id = sculpture_workshop_id
    WHERE registration_id = 'STU007';

    UPDATE students SET workshop_slot1_id = theater_workshop_id, workshop_slot2_id = digital_art_workshop_id
    WHERE registration_id = 'STU008';

    UPDATE students SET workshop_slot1_id = art_workshop_id, workshop_slot2_id = sculpture_workshop_id
    WHERE registration_id = 'STU009';

    UPDATE students SET workshop_slot1_id = music_workshop_id, workshop_slot2_id = digital_art_workshop_id
    WHERE registration_id = 'STU010';
END $$;

-- Verify the data
SELECT 'Workshops created:' as info, COUNT(*) as count FROM workshops
UNION ALL
SELECT 'Students created:', COUNT(*) FROM students;

-- Show sample data
SELECT s.student_name, s.registration_id,
       w1.workshop_name as slot1_workshop,
       w2.workshop_name as slot2_workshop
FROM students s
LEFT JOIN workshops w1 ON s.workshop_slot1_id = w1.id
LEFT JOIN workshops w2 ON s.workshop_slot2_id = w2.id
LIMIT 5;
