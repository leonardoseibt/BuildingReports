# Recreando o Relatório PDE no Metabase

## 🎯 ANÁLISE: O que é possível recriar

### ✅ **POSSÍVEL NO METABASE:**
- **Estrutura hierárquica**: Requisito → Critério → Análise → Parâmetros
- **Filtros por edificação**: Seleção de building específico
- **Filtros por níveis**: Mínimo, Intermediário, Superior
- **Dados dos parâmetros**: Valores, unidades, observações
- **Informações da edificação**: Nome, área, altura, zona bioclimática
- **Exportação**: PDF para relatório final

### ❌ **LIMITAÇÕES DO METABASE:**
- **Layout exact**: Não replica o CSS/HTML específico
- **Filtros dinâmicos complexos**: Sistema de atributos condicionais
- **Interatividade**: Não é uma aplicação web interativa
- **Lógica de negócio**: Funções JavaScript customizadas

## 📊 QUERIES SQL PARA RECRIAR O RELATÓRIO PDE

### 1. Informações da Edificação (Cabeçalho)
```sql
-- Informações básicas da edificação para o cabeçalho do relatório
SELECT 
    b.id AS "ID",
    b.name AS "Nome da Edificação",
    b.city AS "Cidade",
    b.total_area AS "Área Total (m²)",
    b.building_height AS "Altura (m)",
    b.floors AS "Pavimentos",
    b.units AS "Unidades",
    b.bioclimatic_zone AS "Zona Bioclimática",
    t.name AS "Tipologia",
    nc.name AS "Classe de Ruído",
    ac.name AS "Classe de Agressividade",
    u.full_name AS "Técnico Responsável",
    b.created_at AS "Data de Cadastro"
FROM buildings b
LEFT JOIN typologies t ON b.typology_id = t.id
LEFT JOIN noise_classes nc ON b.noise_class_id = nc.id
LEFT JOIN aggressiveness_classes ac ON b.aggressiveness_class_id = ac.id
LEFT JOIN users u ON b.technician_id = u.id
WHERE b.id = {{building_id}}  -- Filtro dinâmico
```

### 2. Estrutura Hierárquica Completa (Requisitos → Critérios → Análises)
```sql
-- Estrutura hierárquica do relatório para uma edificação específica
SELECT 
    r.id AS "req_id",
    r.code AS "req_code", 
    r.label AS "req_label",
    c.id AS "crit_id",
    c.code AS "crit_code",
    c.label AS "crit_label", 
    a.id AS "analysis_id",
    a.code AS "analysis_code",
    a.label AS "analysis_label",
    -- Contadores para validação
    COUNT(p.id) AS "total_parametros"
FROM requirements r
JOIN criteria c ON c.requirement_id = r.id
JOIN analyses a ON a.criterion_id = c.id
LEFT JOIN parameters p ON p.analysis_id = a.id
WHERE r.is_active = true 
  AND c.is_active = true 
  AND a.is_active = true
GROUP BY r.id, r.code, r.label, c.id, c.code, c.label, a.id, a.code, a.label
HAVING COUNT(p.id) > 0  -- Só mostrar análises com parâmetros
ORDER BY r.code, c.code, a.code;
```

### 3. Parâmetros Detalhados por Análise
```sql
-- Todos os parâmetros de uma análise específica com seus valores
SELECT 
    p.id AS "param_id",
    p.label AS "Parâmetro",
    p.unit AS "Unidade",
    p.minimum_value AS "Valor Mínimo",
    p.intermediate_value AS "Valor Intermediário", 
    p.superior_value AS "Valor Superior",
    p.notes AS "Observações",
    -- Informações da hierarquia para contexto
    a.label AS "Análise",
    c.label AS "Critério",
    r.label AS "Requisito"
FROM parameters p
JOIN analyses a ON p.analysis_id = a.id
JOIN criteria c ON a.criterion_id = c.id  
JOIN requirements r ON c.requirement_id = r.id
WHERE a.id = {{analysis_id}}  -- Filtro dinâmico por análise
  AND p.is_active = true
ORDER BY p.label;
```

### 4. Relatório Consolidado (Versão Simplificada)
```sql
-- Relatório consolidado - versão "flat" para dashboard único
SELECT 
    -- Informações da edificação
    b.name AS "Edificação",
    b.city AS "Cidade", 
    b.total_area AS "Área (m²)",
    b.bioclimatic_zone AS "Zona Bioclimática",
    
    -- Hierarquia do relatório
    r.code AS "Req. Código",
    r.label AS "Requisito",
    c.code AS "Crit. Código", 
    c.label AS "Critério",
    a.code AS "Anál. Código",
    a.label AS "Análise",
    
    -- Parâmetros
    p.label AS "Parâmetro",
    p.unit AS "Unidade",
    p.minimum_value AS "Mínimo",
    p.intermediate_value AS "Intermediário",
    p.superior_value AS "Superior",
    p.notes AS "Observações"

FROM buildings b
CROSS JOIN requirements r
JOIN criteria c ON c.requirement_id = r.id
JOIN analyses a ON a.criterion_id = c.id
JOIN parameters p ON p.analysis_id = a.id
WHERE b.id = {{building_id}}  -- Filtro dinâmico
  AND r.is_active = true
  AND c.is_active = true
  AND a.is_active = true
  AND p.is_active = true
ORDER BY r.code, c.code, a.code, p.label;
```

### 5. Filtros por Níveis de Desempenho
```sql
-- Parâmetros filtrados por níveis selecionados (similar ao report-print.tsx)
SELECT 
    r.label AS "Requisito",
    c.label AS "Critério", 
    a.label AS "Análise",
    p.label AS "Parâmetro",
    p.unit AS "Unidade",
    
    -- Mostrar apenas níveis selecionados
    CASE WHEN '{{nivel_minimo}}' = 'true' THEN p.minimum_value END AS "Mínimo",
    CASE WHEN '{{nivel_intermediario}}' = 'true' THEN p.intermediate_value END AS "Intermediário", 
    CASE WHEN '{{nivel_superior}}' = 'true' THEN p.superior_value END AS "Superior",
    
    p.notes AS "Observações"

FROM parameters p
JOIN analyses a ON p.analysis_id = a.id
JOIN criteria c ON a.criterion_id = c.id
JOIN requirements r ON c.requirement_id = r.id
WHERE p.is_active = true
  AND (
    ('{{nivel_minimo}}' = 'true' AND p.minimum_value IS NOT NULL AND p.minimum_value != '') OR
    ('{{nivel_intermediario}}' = 'true' AND p.intermediate_value IS NOT NULL AND p.intermediate_value != '') OR
    ('{{nivel_superior}}' = 'true' AND p.superior_value IS NOT NULL AND p.superior_value != '')
  )
ORDER BY r.code, c.code, a.code, p.label;
```

## 🎨 CONFIGURAÇÃO NO METABASE

### Dashboard: "PDE - Perfil de Desempenho da Edificação"

#### Filtros Globais:
1. **Building ID**: Dropdown com lista de edificações
2. **Níveis**: Checkboxes (Mínimo, Intermediário, Superior)
3. **Período**: Data de cadastro/geração

#### Seções do Dashboard:

**1. Cabeçalho (Cards/Métricas):**
- Nome da edificação
- Área total
- Zona bioclimática
- Técnico responsável

**2. Resumo Executivo (Gráficos):**
- Gráfico de barras: Requisitos vs Quantidade de parâmetros
- Gráfico de pizza: Distribuição de parâmetros por critério

**3. Tabela Principal:**
- Query consolidada com todos os parâmetros
- Agrupamento visual por Requisito → Critério → Análise

**4. Observações:**
- Lista de parâmetros com observações não-vazias

## 📄 RELATÓRIO EM PDF

### Configuração para PDF:
1. **Layout**: Usar "Fixed Width" 
2. **Orientação**: Retrato (A4)
3. **Título**: "PDE - Perfil de Desempenho da Edificação: {{Nome da Edificação}}"
4. **Rodapé**: Data de geração, versão, responsável

### Seções do PDF:
```
┌─────────────────────────────────────────┐
│ PDE - Perfil de Desempenho da Edificação │
│ Edificação: [Nome]                       │
│ Área: [X] m² | Zona: [Y] | Resp: [Z]    │
└─────────────────────────────────────────┘

┌─ REQUISITO X.X ─────────────────────────┐
│ [Nome do Requisito]                      │
│                                          │
│  ├─ CRITÉRIO X.X.X                      │
│  │  [Nome do Critério]                  │
│  │                                      │
│  │   └─ ANÁLISE X.X.X.X                │
│  │      [Nome da Análise]               │
│  │      ┌─────────────────────────────┐ │
│  │      │ Parâmetro | Un. | M | I | S │ │
│  │      │ Param1    | m²  | 10| 15| 20│ │
│  │      │ Param2    | %   | 5 | 7 | 10│ │
│  │      └─────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 🔧 IMPLEMENTAÇÃO PASSO-A-PASSO

### Passo 1: Criar as Queries
1. **New** → **SQL Query**
2. Cole cada query acima
3. Configure filtros dinâmicos (`{{variavel}}`)
4. **Save** com nomes descritivos

### Passo 2: Configurar Filtros
1. **Settings** → **Variables**
2. Configure dropdowns para Building ID
3. Configure checkboxes para níveis

### Passo 3: Montar Dashboard
1. **New** → **Dashboard**
2. Adicione cards de informações
3. Adicione tabela principal
4. Configure layout responsivo

### Passo 4: Configurar PDF
1. **Dashboard Settings**
2. **Fixed Width** layout
3. Configure exportação automática
4. Teste com dados reais

## 🎯 RESULTADO ESPERADO

**✅ Funcionalidades que funcionarão:**
- Relatório hierárquico estruturado
- Filtros por edificação e níveis  
- Exportação PDF profissional
- Dados completos dos parâmetros
- Layout limpo e organizado

**⚠️ Diferenças do sistema atual:**
- Layout visual diferente (mas informações iguais)
- Sem filtros de atributos complexos
- Sem interatividade real-time
- Formatação de texto mais simples

**O Metabase criará um relatório PDE funcional e profissional, equivalente ao `report-print.tsx` em termos de conteúdo e dados! 🎯**