ALTER TABLE IF EXISTS reports DROP CONSTRAINT IF EXISTS reports_evaluation_id_fkey;
ALTER TABLE IF EXISTS reports DROP COLUMN IF EXISTS evaluation_id;
DROP TABLE IF EXISTS performance_evaluations;
