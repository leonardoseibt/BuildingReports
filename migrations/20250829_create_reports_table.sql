CREATE TABLE IF NOT EXISTS reports (
    id serial PRIMARY KEY,
    building_id integer NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    report_data jsonb NOT NULL,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    generated_at timestamp DEFAULT now()
);
