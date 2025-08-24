CREATE TABLE IF NOT EXISTS parameters (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  label varchar(255) NOT NULL,
  minimum_value numeric(10,2),
  intermediate_value numeric(10,2),
  superior_value numeric(10,2),
  unit varchar(32),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameters_analysis ON parameters(analysis_id);
