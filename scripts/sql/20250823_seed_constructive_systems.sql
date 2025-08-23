-- Idempotent seed for constructive_systems (safe to re-run)
INSERT INTO constructive_systems (code, label, is_active) VALUES
  ('alv_conv', 'Alvenaria Convencional', true),
  ('alv_est', 'Alvenaria Estrutural', true),
  ('concreto_mold', 'Concreto Moldado in loco', true),
  ('concreto_prem', 'Concreto Pré-moldado', true),
  ('aco', 'Estrutura em Aço', true),
  ('madeira', 'Estrutura em Madeira', true)
ON CONFLICT (code) DO NOTHING;