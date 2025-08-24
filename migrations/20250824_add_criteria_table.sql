DO $$
BEGIN
    -- Create criteria table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'criteria'
    ) THEN
        CREATE TABLE criteria (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code varchar(16) NOT NULL UNIQUE,
            label varchar(255) NOT NULL,
            is_active boolean DEFAULT true,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now()
        );
    END IF;
END $$;

-- Seed initial criteria list (id auto; code unique). Codes are textual numbers per specification.
INSERT INTO criteria (code, label, is_active) VALUES
('1','Segurança Estrutural', true),
('2','Segurança Contra Incêndio', true),
('3','Segurança no Uso e Operação', true),
('4','Estanqueidade à Água', true),
('5','Desempenho Térmico', true),
('6','Desempenho Acústico', true),
('7','Desempenho Lumínico', true),
('8','Saúde, Higiene e Qualidade do Ar', true),
('9','Funcionalidade e Acessibilidade', true),
('10','Conforto Tátil e Antropodinâmico', true),
('11','Durabilidade e Manutenibilidade', true),
('12','Impacto Ambiental', true)
ON CONFLICT (code) DO NOTHING;
