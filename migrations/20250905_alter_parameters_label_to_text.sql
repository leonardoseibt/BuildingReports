-- Migração: Altera o tipo da coluna label em parameters para text (multi-linha)
ALTER TABLE parameters ALTER COLUMN label TYPE text;
