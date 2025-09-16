-- QUERY PRONTA: Relatório PDE Completo no Metabase
-- Cole esta query no Metabase SQL Editor

SELECT 
    -- CABEÇALHO DA EDIFICAÇÃO
    b.name AS "🏢 Edificação",
    CONCAT(b.city, COALESCE(', ' || b.address_number::text, '')) AS "📍 Localização",
    CONCAT(COALESCE(b.total_area::text, '—'), ' m²') AS "📐 Área Total",
    CONCAT(COALESCE(b.building_height::text, '—'), ' m') AS "📏 Altura",
    b.floors AS "🏗️ Pavimentos",
    b.bioclimatic_zone AS "🌡️ Zona Bioclimática",
    
    -- HIERARQUIA DO RELATÓRIO  
    CONCAT(r.code, ' - ', r.label) AS "📋 Requisito",
    CONCAT(c.code, ' - ', c.label) AS "📊 Critério",
    CONCAT(a.code, ' - ', a.label) AS "🔍 Análise",
    
    -- PARÂMETROS DETALHADOS
    p.label AS "📝 Parâmetro",
    COALESCE(p.unit, '—') AS "📏 Unidade",
    
    -- VALORES POR NÍVEL
    CASE 
        WHEN p.minimum_value IS NOT NULL AND p.minimum_value != '' 
        THEN p.minimum_value 
        ELSE '—' 
    END AS "🟢 Mínimo",
    
    CASE 
        WHEN p.intermediate_value IS NOT NULL AND p.intermediate_value != '' 
        THEN p.intermediate_value 
        ELSE '—' 
    END AS "🟡 Intermediário",
    
    CASE 
        WHEN p.superior_value IS NOT NULL AND p.superior_value != '' 
        THEN p.superior_value 
        ELSE '—' 
    END AS "🔴 Superior",
    
    -- OBSERVAÇÕES
    CASE 
        WHEN p.notes IS NOT NULL AND p.notes != '' 
        THEN p.notes 
        ELSE '—' 
    END AS "💬 Observações"

FROM buildings b
CROSS JOIN requirements r
INNER JOIN analyses a ON a.requirement_id = r.id
INNER JOIN criteria c ON c.id = a.criterion_id
INNER JOIN parameters p ON p.analysis_id = a.id

WHERE 
    -- FILTROS PRINCIPAIS
    b.id = 1  -- 🎯 SUBSTITUA pelo ID da edificação desejada
    AND r.is_active = true
    AND c.is_active = true
    AND a.is_active = true
    AND p.is_active = true

ORDER BY 
    CAST(r.code AS INTEGER),  -- Ordenação numérica dos requisitos
    c.code,                   -- Ordenação dos critérios  
    a.code,                   -- Ordenação das análises
    p.label;                  -- Ordenação alfabética dos parâmetros