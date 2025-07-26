-- Database Migration Update: Add name and phone columns to existing call_records table
-- Run this if you already have a call_records table without the name/phone columns

-- Add new columns if they don't exist
ALTER TABLE call_records 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS qualified BOOLEAN;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_call_records_first_name ON call_records(first_name);
CREATE INDEX IF NOT EXISTS idx_call_records_last_name ON call_records(last_name);
CREATE INDEX IF NOT EXISTS idx_call_records_phone ON call_records(phone);
CREATE INDEX IF NOT EXISTS idx_call_records_qualified ON call_records(qualified);

-- Update existing records to populate the new columns from JSONB data
-- This will extract data from existing records and populate the new columns
UPDATE call_records 
SET 
  first_name = extracted_data->>'firstName',
  last_name = extracted_data->>'lastName', 
  phone = extracted_data->>'phoneNumber',
  qualified = (extracted_data->>'qualified')::boolean
WHERE first_name IS NULL AND extracted_data IS NOT NULL;

-- Update the view to use the new direct columns
CREATE OR REPLACE VIEW call_records_view AS
SELECT 
  id,
  conversation_id,
  agent_id,
  status,
  first_name,
  last_name,
  phone,
  qualified,
  (extracted_data->>'callDuration')::integer as call_duration,
  (extracted_data->>'callCost')::integer as call_cost,
  (extracted_data->>'interviewSchedule') as interview_schedule,
  (extracted_data->>'cdlA')::boolean as cdl_a,
  (extracted_data->>'experience24Months')::boolean as experience_24_months,
  created_at,
  updated_at
FROM call_records
ORDER BY created_at DESC; 