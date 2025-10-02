-- Remover tabela requirements_criteria
-- Esta tabela estava desatualizada e não refletia as relações reais do sistema.
-- A relação entre requirements e criteria é estabelecida através da tabela analyses.

DROP TABLE IF EXISTS requirements_criteria CASCADE;
