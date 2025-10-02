-- Migration: Remove report_data column from reports table
-- Date: 2025-08-28
-- Reason: JSONB field deprecated - using relational tables (report_requirements, report_criteria, report_analyses, report_analysis_levels)

-- Drop the report_data column
ALTER TABLE reports DROP COLUMN IF EXISTS report_data;
