-- Add email notification preferences to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS report_frequency TEXT DEFAULT 'weekly' CHECK (report_frequency IN ('daily', 'weekly', 'monthly', 'disabled'));

-- Create reports configuration table
CREATE TABLE IF NOT EXISTS reports_config (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- 'weekly_summary', 'daily_stats', etc.
  enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  frequency_value INTEGER DEFAULT 1, -- e.g., every 2 weeks = frequency='weekly', frequency_value=2
  day_of_week INTEGER, -- 0-6 for weekly reports (0=Sunday)
  day_of_month INTEGER, -- 1-31 for monthly reports
  hour_of_day INTEGER DEFAULT 9, -- 24-hour format
  
  -- Report content configuration
  report_type TEXT NOT NULL DEFAULT 'summary' CHECK (report_type IN ('summary', 'detailed', 'custom')),
  include_metrics JSONB DEFAULT '{"total_calls": true, "qualified_leads": true, "conversion_rate": true}',
  include_call_details BOOLEAN DEFAULT true,
  include_charts BOOLEAN DEFAULT false,
  
  -- Email template settings
  subject_template TEXT DEFAULT 'TruckRecruit Pro - {period} Report',
  template_data JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sent_at TIMESTAMP,
  next_send_at TIMESTAMP
);

-- Create email logs table to track sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  report_config_id INTEGER REFERENCES reports_config(id),
  recipient_email TEXT NOT NULL,
  recipient_user_id INTEGER REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  postmark_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  
  -- Report data snapshot
  report_period_start TIMESTAMP,
  report_period_end TIMESTAMP,
  report_data JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_config_enabled ON reports_config(enabled);
CREATE INDEX IF NOT EXISTS idx_reports_config_next_send ON reports_config(next_send_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_users_email_notifications ON users(email_notifications);

-- Insert default report configurations
INSERT INTO reports_config (name, frequency, day_of_week, hour_of_day, report_type, subject_template) 
VALUES 
  ('weekly_summary', 'weekly', 1, 9, 'summary', 'TruckRecruit Pro - Weekly Summary Report'),
  ('daily_qualified_leads', 'daily', NULL, 8, 'summary', 'TruckRecruit Pro - Daily Qualified Leads')
ON CONFLICT (name) DO NOTHING;

-- Update next_send_at for initial scheduling
UPDATE reports_config 
SET next_send_at = 
  CASE 
    WHEN frequency = 'daily' THEN 
      DATE_TRUNC('day', NOW() + INTERVAL '1 day') + (hour_of_day || ' hours')::INTERVAL
    WHEN frequency = 'weekly' THEN 
      DATE_TRUNC('week', NOW()) + (day_of_week || ' days')::INTERVAL + (hour_of_day || ' hours')::INTERVAL +
      CASE WHEN NOW() < DATE_TRUNC('week', NOW()) + (day_of_week || ' days')::INTERVAL + (hour_of_day || ' hours')::INTERVAL 
           THEN INTERVAL '0 days' 
           ELSE INTERVAL '7 days' END
    WHEN frequency = 'monthly' THEN 
      DATE_TRUNC('month', NOW()) + ((day_of_month - 1) || ' days')::INTERVAL + (hour_of_day || ' hours')::INTERVAL +
      CASE WHEN NOW() < DATE_TRUNC('month', NOW()) + ((day_of_month - 1) || ' days')::INTERVAL + (hour_of_day || ' hours')::INTERVAL 
           THEN INTERVAL '0 days' 
           ELSE INTERVAL '1 month' END
  END
WHERE next_send_at IS NULL AND enabled = true; 