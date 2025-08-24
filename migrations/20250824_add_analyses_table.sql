CREATE TABLE IF NOT EXISTS analyses (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    criterion_id integer NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
    code varchar(32) NOT NULL,
    label varchar(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    CONSTRAINT uq_analysis_per_criterion UNIQUE (criterion_id, code)
);

CREATE INDEX IF NOT EXISTS idx_analyses_criterion ON analyses(criterion_id);
