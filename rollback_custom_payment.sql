-- Rollback: Remove custom_payment column from competition_officials table
-- Date: 2025-10-30
-- Description: Removes the custom_payment column that was added but is no longer needed

-- Check if column exists first
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'competition_officials' 
AND column_name = 'custom_payment';

-- If it exists, drop it
ALTER TABLE competition_officials 
DROP COLUMN IF EXISTS custom_payment;

-- Verify it's been removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'competition_officials'
ORDER BY ordinal_position;
