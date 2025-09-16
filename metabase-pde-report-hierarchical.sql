-- RELATÓRIO PDE HIERÁRQUICO - Metabase
-- Esta query organiza os dados para criar um relatório estruturado como o report-print.tsx

-- PARTE 1: CABEÇALHO DA EDIFICAÇÃO (Query separada para o cabeçalho)
-- Cole esta primeira query em uma "Question" separada no Metabase para o cabeçalho:

SELECT 
    'CABEÇALHO' as secao,
    b.name AS edificacao,
    CONCAT(b.city, COALESCE(CONCAT(', ', b.address_number::text), '')) AS localizacao,
    CONCAT(COALESCE(b.total_area::text, '—'), ' m²') AS area_total,
    CONCAT(COALESCE(b.building_height::text, '—'), ' m') AS altura,
    b.floors AS pavimentos,
    b.bioclimatic_zone AS zona_bioclimatica,
    b.created_at as data_criacao
FROM buildings b
WHERE b.id = 1;  -- 🎯 SUBSTITUA pelo ID da edificação

-- ================================================================================
-- PARTE 2: DADOS HIERÁRQUICOS (Query principal para o conteúdo do relatório)
-- Cole esta segunda query em outra "Question" no Metabase:

SELECT 
    -- HIERARQUIA PARA AGRUPAMENTO
    CAST(r.code AS INTEGER) as req_ordem,
    r.code as req_code,
    r.label as req_label,
    
    c.code as crit_code,
    c.label as crit_label,
    
    a.code as anal_code,
    a.label as anal_label,
    
    -- DADOS DO PARÂMETRO
    p.label as parametro,
    COALESCE(p.unit, '') as unidade,
    
    -- VALORES FORMATADOS
    CASE 
        WHEN p.minimum_value IS NOT NULL AND p.minimum_value != '' 
        THEN p.minimum_value 
        ELSE '' 
    END as valor_minimo,
    
    CASE 
        WHEN p.intermediate_value IS NOT NULL AND p.intermediate_value != '' 
        THEN p.intermediate_value 
        ELSE '' 
    END as valor_intermediario,
    
    CASE 
        WHEN p.superior_value IS NOT NULL AND p.superior_value != '' 
        THEN p.superior_value 
        ELSE '' 
    END as valor_superior,
    
    CASE 
        WHEN p.notes IS NOT NULL AND p.notes != '' 
        THEN p.notes 
        ELSE '' 
    END as observacoes,
    
    -- CAMPOS PARA IDENTIFICAÇÃO DA EDIFICAÇÃO
    b.id as building_id,
    b.name as building_name

FROM buildings b
CROSS JOIN requirements r
INNER JOIN analyses a ON a.requirement_id = r.id
INNER JOIN criteria c ON c.id = a.criterion_id
INNER JOIN parameters p ON p.analysis_id = a.id

WHERE 
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

-- ================================================================================
-- PARTE 3: QUERY ALTERNATIVA - DADOS CONSOLIDADOS COM QUEBRAS DE HIERARQUIA
-- Esta versão inclui marcadores para facilitar a criação de quebras visuais:

SELECT 
    -- IDENTIFICADORES DE QUEBRA HIERÁRQUICA
    CONCAT('REQ_', CAST(r.code AS INTEGER)) as grupo_requisito,
    CONCAT('CRIT_', r.code, '_', c.code) as grupo_criterio,
    CONCAT('ANAL_', r.code, '_', c.code, '_', a.code) as grupo_analise,
    
    -- TEXTOS FORMATADOS PARA EXIBIÇÃO
    CONCAT('🏗️ ', CAST(r.code AS INTEGER), ' - ', r.label) as requisito_display,
    CONCAT('📊 ', c.code, ' - ', c.label) as criterio_display,
    CONCAT('🔍 ', a.code, ' - ', a.label) as analise_display,
    
    -- DADOS DO PARÂMETRO
    p.label as parametro,
    COALESCE(p.unit, '—') as unidade,
    
    -- VALORES COM EMOJIS
    CASE 
        WHEN p.minimum_value IS NOT NULL AND p.minimum_value != '' 
        THEN CONCAT('🟢 ', p.minimum_value)
        ELSE '🟢 —' 
    END as minimo,
    
    CASE 
        WHEN p.intermediate_value IS NOT NULL AND p.intermediate_value != '' 
        THEN CONCAT('🟡 ', p.intermediate_value)
        ELSE '🟡 —' 
    END as intermediario,
    
    CASE 
        WHEN p.superior_value IS NOT NULL AND p.superior_value != '' 
        THEN CONCAT('🔴 ', p.superior_value)
        ELSE '🔴 —' 
    END as superior,
    
    CASE 
        WHEN p.notes IS NOT NULL AND p.notes != '' 
        THEN CONCAT('💬 ', p.notes)
        ELSE '💬 —' 
    END as observacoes,
    
    -- ORDENAÇÃO
    CAST(r.code AS INTEGER) as ordem_req,
    c.code as ordem_crit,
    a.code as ordem_anal,
    p.label as ordem_param

FROM buildings b
CROSS JOIN requirements r
INNER JOIN analyses a ON a.requirement_id = r.id
INNER JOIN criteria c ON c.id = a.criterion_id
INNER JOIN parameters p ON p.analysis_id = a.id

WHERE 
    b.id = 1  -- 🎯 SUBSTITUA pelo ID da edificação desejada
    AND r.is_active = true
    AND c.is_active = true
    AND a.is_active = true
    AND p.is_active = true

ORDER BY 
    ordem_req,
    ordem_crit,
    ordem_anal,
    ordem_param;