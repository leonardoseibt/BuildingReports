# 🚀 IMPLEMENTAÇÃO RÁPIDA: Relatório PDE no Metabase

## ⚡ PASSO-A-PASSO (15 minutos)

### 1. Criar Query Básica (5 min)
1. Acesse: http://localhost:3000
2. **New** → **SQL Query**
3. Selecione sua conexão BuildingReports
4. Cole a query do arquivo `metabase-pde-query.sql`
5. **IMPORTANTE**: Altere `b.id = 1` para um ID real da sua base
6. Clique **Run** (▶️)
7. **Save** como "PDE - Relatório Completo"

### 2. Configurar Visualização (3 min)
1. Aba **Visualization**
2. Escolha **Table**
3. **Settings** → **Columns**:
   - Oculte colunas desnecessárias se houver
   - Ajuste larguras das colunas
4. **Save**

### 3. Criar Dashboard (5 min)
1. **New** → **Dashboard**
2. Nome: "PDE - Perfil de Desempenho da Edificação"
3. **Add Question** → Selecione "PDE - Relatório Completo"
4. Redimensione para ocupar toda a tela
5. **Save**

### 4. Exportar PDF (2 min)
1. Abra o dashboard
2. **Share** (📤) → **Download PDF**
3. Configure:
   - **Landscape** (paisagem)
   - **All cards**
4. Download

## 📊 RESULTADO ESPERADO

Você terá uma tabela como esta:

```
🏢 Edificação | 📍 Localização | 📐 Área Total | 📋 Requisito | 📊 Critério | 🔍 Análise | 📝 Parâmetro | 🟢 Mínimo | 🟡 Intermediário | 🔴 Superior | 💬 Observações
═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
Edifício ABC  | São Paulo, 123 | 1500 m²      | 1 - Desempenho | 1.1 - Térmico | 1.1.1 - Verão | Temperatura | 23°C      | 25°C           | 27°C        | Zona 3
```

## 🎨 MELHORIAS OPCIONAIS

### Adicionar Filtros Dinâmicos
1. **Edit** a query
2. Substitua `b.id = 1` por `b.id = {{building_id}}`
3. **Settings** → **Variables**:
   - **Variable type**: Field Filter
   - **Field**: Buildings → ID
   - **Widget type**: Dropdown

### Criar Múltiplas Visualizações
```sql
-- Query para Resumo por Requisito
SELECT 
    CONCAT(r.code, ' - ', r.label) AS "Requisito",
    COUNT(p.id) AS "Total Parâmetros",
    COUNT(CASE WHEN p.minimum_value IS NOT NULL THEN 1 END) AS "Com Valor Mínimo",
    COUNT(CASE WHEN p.notes IS NOT NULL THEN 1 END) AS "Com Observações"
FROM requirements r
JOIN criteria c ON c.requirement_id = r.id
JOIN analyses a ON a.criterion_id = c.id
JOIN parameters p ON p.analysis_id = a.id
WHERE r.is_active = true
GROUP BY r.id, r.code, r.label
ORDER BY r.code;
```

### Configurar Agendamento
1. Dashboard → **Share** → **Subscription**
2. **Email**: Adicione destinatários
3. **Frequency**: Semanal/Mensal
4. **Format**: PDF

## 🔧 TROUBLESHOOTING

### Problema: Query demora muito
**Solução**: Adicione índices:
```sql
CREATE INDEX idx_parameters_analysis ON parameters(analysis_id);
CREATE INDEX idx_analyses_criterion ON analyses(criterion_id);
CREATE INDEX idx_criteria_requirement ON criteria(requirement_id);
```

### Problema: Dados não aparecem
**Solução**: Verifique se há:
- Dados nas tabelas
- `is_active = true`
- JOINs corretos

### Problema: Layout quebrado no PDF
**Solução**: 
- Use orientação **Landscape**
- Limite número de colunas
- Ajuste tamanho da fonte

## 🎯 COMPARAÇÃO: Metabase vs report-print.tsx

| Recurso | report-print.tsx | Metabase | Observações |
|---------|------------------|----------|-------------|
| **Dados hierárquicos** | ✅ | ✅ | Igual funcionalidade |
| **Filtros por edificação** | ✅ | ✅ | ID dropdown no Metabase |
| **Filtros por níveis** | ✅ | ⚠️ | Possível, mas menos elegante |
| **Observações parâmetros** | ✅ | ✅ | Texto completo |
| **Layout customizado** | ✅ | ❌ | Metabase usa templates fixos |
| **Interatividade** | ✅ | ⚠️ | Limitada a filtros básicos |
| **Exportação PDF** | ✅ | ✅ | Ambos geram PDF |
| **Facilidade de uso** | ❌ | ✅ | Metabase é mais simples |
| **Manutenção** | ❌ | ✅ | Metabase sem código |

## ✅ CONCLUSÃO

**SIM, é possível recriar o relatório PDE no Metabase!**

### ✅ **Vantagens:**
- **Sem código**: Interface visual
- **Agendamento**: Emails automáticos  
- **Filtros**: Fáceis de configurar
- **PDF**: Exportação nativa
- **Manutenção**: Zero código para manter

### ⚠️ **Limitações:**
- **Layout**: Menos flexível que HTML/CSS custom
- **Lógica complexa**: Filtros de atributos limitados
- **Interatividade**: Não é uma SPA

### 🎯 **Recomendação:**
Use **ambos**:
- **Metabase**: Para relatórios regulares, executivos, agendados
- **report-print.tsx**: Para funcionalidades específicas, layout custom, interatividade

**O Metabase complementa perfeitamente seu sistema atual! 🚀**