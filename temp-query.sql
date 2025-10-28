SELECT id, friendly_name, source_table, source_column, data_kind, value_source, value_id_field, value_label_field 
FROM attribute_definitions 
WHERE source_column = 'bioclimatic_zone' OR value_source = 'bioclimatic_zones';
