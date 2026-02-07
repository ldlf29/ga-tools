-- Add image_url column to class_changes table
ALTER TABLE class_changes 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'class_changes';
