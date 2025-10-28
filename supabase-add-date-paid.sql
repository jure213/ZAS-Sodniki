-- Add date_paid column to payments table
-- This tracks when the payment was actually made (different from competition date)

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS date_paid TEXT;

-- Optionally: Set existing 'paid' payments to have date_paid = date
-- UPDATE payments SET date_paid = date WHERE status = 'paid' AND date_paid IS NULL;
