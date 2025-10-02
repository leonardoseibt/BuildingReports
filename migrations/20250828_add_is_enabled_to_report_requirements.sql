-- Migration: Add is_enabled column to report_requirements table
-- Date: 2025-08-28
-- Reason: Allow toggling requirements visibility in PDF without losing criteria/analyses selection

-- Add is_enabled column (default true - all existing requirements remain enabled)
ALTER TABLE report_requirements 
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment explaining the purpose
COMMENT ON COLUMN report_requirements.is_enabled IS 'Controls if requirement is shown in PDF generation. When false, criteria and analyses remain saved but requirement is hidden from report.';
