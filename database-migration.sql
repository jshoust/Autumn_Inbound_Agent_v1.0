-- Database Migration: Add call_records table for JSONB-based storage
-- Run this SQL to add the new table structure

CREATE TABLE IF NOT EXISTS call_records (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT UNIQUE NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  qualified BOOLEAN,
  raw_data JSONB NOT NULL,
  extracted_data JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_call_records_agent_id ON call_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_conversation_id ON call_records(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_records_first_name ON call_records(first_name);
CREATE INDEX IF NOT EXISTS idx_call_records_last_name ON call_records(last_name);
CREATE INDEX IF NOT EXISTS idx_call_records_phone ON call_records(phone);
CREATE INDEX IF NOT EXISTS idx_call_records_qualified ON call_records(qualified);

-- Create indexes on JSONB fields for faster queries
CREATE INDEX IF NOT EXISTS idx_call_records_extracted_qualified ON call_records USING GIN ((extracted_data->'qualified'));
CREATE INDEX IF NOT EXISTS idx_call_records_extracted_phone ON call_records USING GIN ((extracted_data->'phoneNumber'));

-- Optional: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_call_records_updated_at ON call_records;
CREATE TRIGGER update_call_records_updated_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easier querying of call records with extracted data
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