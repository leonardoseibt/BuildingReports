-- Adicionar atributo de cor predominante para referência em parâmetros
INSERT INTO attribute_definitions (
  friendly_name, 
  source_table, 
  source_column, 
  data_kind, 
  value_source,
  value_id_field,
  value_label_field,
  is_active
) VALUES (
  'Cor Predominante (Fachada)',
  'buildings',
  'predominant_color_id',
  'reference',
  'predominant_colors',
  'id',
  'label',
  true
);

COMMENT ON TABLE predominant_colors IS 'Tabela de cores predominantes das fachadas para cálculo de absortância térmica';
