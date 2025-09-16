# Queries SQL Prontas para Metabase - BuildingReports

## 📊 RELATÓRIOS EXECUTIVOS

### 1. Total de Edificações por Tipologia
```sql
SELECT 
    t.name AS "Tipologia",
    COUNT(b.id) AS "Total de Edificações"
FROM buildings b
LEFT JOIN typologies t ON b.typology_id = t.id
GROUP BY t.name, t.id
ORDER BY COUNT(b.id) DESC;
```

### 2. Distribuição por Zona Bioclimática
```sql
SELECT 
    b.bioclimatic_zone AS "Zona Bioclimática",
    COUNT(b.id) AS "Quantidade",
    ROUND(AVG(b.total_area), 2) AS "Área Média (m²)"
FROM buildings b
WHERE b.bioclimatic_zone IS NOT NULL
GROUP BY b.bioclimatic_zone
ORDER BY COUNT(b.id) DESC;
```

### 3. Evolução de Cadastros por Mês
```sql
SELECT 
    DATE_TRUNC('month', b.created_at) AS "Mês",
    COUNT(b.id) AS "Novos Cadastros"
FROM buildings b
WHERE b.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', b.created_at)
ORDER BY "Mês";
```

### 4. Relatórios Gerados por Período
```sql
SELECT 
    DATE_TRUNC('month', r.generated_at) AS "Mês",
    COUNT(r.id) AS "Relatórios Gerados",
    COUNT(DISTINCT r.building_id) AS "Edificações Únicas"
FROM reports r
WHERE r.generated_at IS NOT NULL
GROUP BY DATE_TRUNC('month', r.generated_at)
ORDER BY "Mês" DESC;
```

## 🏗️ ANÁLISES TÉCNICAS

### 5. Distribuição de Alturas das Edificações
```sql
SELECT 
    CASE 
        WHEN b.building_height < 3 THEN 'Baixo (< 3m)'
        WHEN b.building_height BETWEEN 3 AND 12 THEN 'Médio (3-12m)'
        WHEN b.building_height BETWEEN 12 AND 30 THEN 'Alto (12-30m)'
        WHEN b.building_height > 30 THEN 'Muito Alto (> 30m)'
        ELSE 'Não Informado'
    END AS "Categoria de Altura",
    COUNT(b.id) AS "Quantidade",
    ROUND(AVG(b.building_height), 2) AS "Altura Média"
FROM buildings b
GROUP BY 1
ORDER BY "Quantidade" DESC;
```

### 6. Análise por Classe de Ruído
```sql
SELECT 
    nc.name AS "Classe de Ruído",
    COUNT(b.id) AS "Edificações",
    ROUND(AVG(b.total_area), 2) AS "Área Média"
FROM buildings b
LEFT JOIN noise_classes nc ON b.noise_class_id = nc.id
GROUP BY nc.name, nc.id
ORDER BY COUNT(b.id) DESC;
```

### 7. Top 10 Parâmetros Mais Utilizados
```sql
SELECT 
    p.label AS "Parâmetro",
    a.label AS "Análise",
    c.label AS "Critério",
    COUNT(DISTINCT r.building_id) AS "Edificações que Usam"
FROM parameters p
JOIN analyses a ON p.analysis_id = a.id
JOIN criteria c ON a.criterion_id = c.id
JOIN reports r ON r.id IS NOT NULL -- Aproximação para edificações com relatórios
GROUP BY p.label, a.label, c.label, p.id
ORDER BY COUNT(DISTINCT r.building_id) DESC
LIMIT 10;
```

## 📈 MÉTRICAS DE QUALIDADE

### 8. Completude dos Dados
```sql
SELECT 
    'Total de Edificações' AS "Métrica",
    COUNT(*) AS "Valor"
FROM buildings
UNION ALL
SELECT 
    'Com Área Informada',
    COUNT(*) 
FROM buildings WHERE total_area IS NOT NULL
UNION ALL
SELECT 
    'Com Altura Informada',
    COUNT(*) 
FROM buildings WHERE building_height IS NOT NULL
UNION ALL
SELECT 
    'Com Zona Bioclimática',
    COUNT(*) 
FROM buildings WHERE bioclimatic_zone IS NOT NULL
UNION ALL
SELECT 
    'Com Relatórios Gerados',
    COUNT(DISTINCT building_id) 
FROM reports WHERE generated_at IS NOT NULL;
```

### 9. Edificações por Técnico Responsável
```sql
SELECT 
    u.full_name AS "Técnico",
    COUNT(b.id) AS "Edificações Cadastradas",
    COUNT(r.id) AS "Relatórios Gerados"
FROM users u
LEFT JOIN buildings b ON b.technician_id = u.id
LEFT JOIN reports r ON r.building_id = b.id
WHERE u.full_name IS NOT NULL
GROUP BY u.full_name, u.id
ORDER BY COUNT(b.id) DESC;
```

### 10. Análise Geográfica (se tiver coordenadas)
```sql
SELECT 
    b.city AS "Cidade",
    COUNT(b.id) AS "Edificações",
    ROUND(AVG(b.total_area), 2) AS "Área Média",
    COUNT(r.id) AS "Relatórios"
FROM buildings b
LEFT JOIN reports r ON r.building_id = b.id
WHERE b.city IS NOT NULL
GROUP BY b.city
ORDER BY COUNT(b.id) DESC;
```

## 🎯 DASHBOARDS SUGERIDOS

### Dashboard 1: "Visão Executiva"
- Total de edificações (métrica única)
- Gráfico de barras: Edificações por tipologia
- Gráfico de linha: Evolução mensal de cadastros
- Gráfico de pizza: Distribuição por zona bioclimática

### Dashboard 2: "Análise Técnica"
- Histograma: Distribuição de alturas
- Tabela: Top 10 parâmetros mais utilizados
- Gráfico de barras: Edificações por classe de ruído
- Mapa: Distribuição geográfica (se aplicável)

### Dashboard 3: "Qualidade dos Dados"
- Métricas: Completude dos dados
- Gráfico de barras: Edificações por técnico
- Tabela: Edificações sem dados obrigatórios
- Linha do tempo: Relatórios gerados

## 📱 FILTROS RECOMENDADOS

Para todos os dashboards, adicione filtros para:
- **Período**: Data de criação/geração
- **Tipologia**: Tipo de edificação
- **Zona Bioclimática**: Região
- **Técnico**: Responsável pelo cadastro
- **Status**: Ativo/Inativo