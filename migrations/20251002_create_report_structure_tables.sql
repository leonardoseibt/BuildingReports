-- Criar tabelas relacionais para estrutura do relatório
-- Substituem o campo JSONB report_data

-- Tabela para requisitos selecionados no relatório
CREATE TABLE IF NOT EXISTS report_requirements (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_report_requirements_report ON report_requirements(report_id);
CREATE INDEX IF NOT EXISTS idx_report_requirements_requirement ON report_requirements(requirement_id);

-- Tabela para critérios selecionados no relatório
CREATE TABLE IF NOT EXISTS report_criteria (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_report_criteria_report ON report_criteria(report_id);
CREATE INDEX IF NOT EXISTS idx_report_criteria_criterion ON report_criteria(criterion_id);

-- Tabela para análises selecionadas no relatório
CREATE TABLE IF NOT EXISTS report_analyses (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  analysis_id INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_report_analyses_report ON report_analyses(report_id);
CREATE INDEX IF NOT EXISTS idx_report_analyses_analysis ON report_analyses(analysis_id);

-- Tabela para níveis de desempenho selecionados por análise
CREATE TABLE IF NOT EXISTS report_analysis_levels (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_analysis_id INTEGER NOT NULL REFERENCES report_analyses(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL CHECK (level IN ('minimum', 'intermediate', 'superior')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_analysis_id, level)
);

CREATE INDEX IF NOT EXISTS idx_report_analysis_levels_report_analysis ON report_analysis_levels(report_analysis_id);

-- Tornar report_data nullable (será deprecated)
ALTER TABLE reports ALTER COLUMN report_data DROP NOT NULL;
