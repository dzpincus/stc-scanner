-- Add unique constraint to workshops table to ensure idempotent CSV imports
-- This prevents duplicate workshops with the same name and time_slot

-- Add unique constraint on workshop_name and time_slot combination
ALTER TABLE workshops
ADD CONSTRAINT unique_workshop_name_time_slot
UNIQUE (workshop_name, time_slot);
