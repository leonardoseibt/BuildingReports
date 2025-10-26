-- Migration: Add notifications system
-- Description: Creates notifications table and enum for alerting users about unused analyses and other events
-- Date: 2025-10-26

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'analysis_unused',
  'report_generated',
  'report_error',
  'building_updated',
  'system_alert'
);

-- Create notifications table
CREATE TABLE notifications (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Add comment to table
COMMENT ON TABLE notifications IS 'Stores user notifications for system events like unused analyses';
COMMENT ON COLUMN notifications.type IS 'Type of notification (analysis_unused, report_generated, etc.)';
COMMENT ON COLUMN notifications.metadata IS 'Additional context data in JSON format (analysisId, analysisCode, etc.)';
