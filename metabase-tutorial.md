# Guia Passo-a-Passo: Criando Relatórios no Metabase

## 🎯 MÉTODO 1: Usando o Editor SQL (Recomendado para queries prontas)

### Passo 1: Acessar o Editor SQL
1. No menu superior, clique em **"New"**
2. Selecione **"SQL Query"**
3. Escolha sua conexão com o banco BuildingReports

### Passo 2: Criar sua primeira visualização
1. Copie e cole uma das queries do arquivo `metabase-queries.md`
2. Exemplo - Total por Tipologia:
```sql
SELECT 
    t.name AS "Tipologia",
    COUNT(b.id) AS "Total de Edificações"
FROM buildings b
LEFT JOIN typologies t ON b.typology_id = t.id
GROUP BY t.name, t.id
ORDER BY COUNT(b.id) DESC;
```
3. Clique em **"Run"** (▶️)
4. Escolha o tipo de visualização (barra, pizza, tabela)
5. Clique em **"Save"** e dê um nome

### Passo 3: Personalizar a visualização
- **Eixo X**: Tipologia
- **Eixo Y**: Total de Edificações
- **Cores**: Automático ou personalizado
- **Título**: "Edificações por Tipologia"

## 🎯 MÉTODO 2: Usando o Query Builder (Interface Visual)

### Passo 1: Nova Pergunta
1. Clique em **"New"** → **"Question"**
2. Escolha **"Simple question"**
3. Selecione a tabela **"buildings"**

### Passo 2: Configurar a query
1. **Summarize**: Count (para contar registros)
2. **Group by**: Escolha o campo (ex: typology_id)
3. **Filter**: Adicione filtros se necessário
4. **Sort**: Ordene por contagem (descendente)

### Passo 3: Visualizar
1. Clique na aba **"Visualization"**
2. Escolha o tipo de gráfico
3. Configure cores e labels
4. **Save** com um nome descritivo

## 📊 CRIANDO SEU PRIMEIRO DASHBOARD

### Passo 1: Criar Dashboard
1. Menu **"New"** → **"Dashboard"**
2. Dê um nome: "BuildingReports - Visão Geral"
3. Clique em **"Create"**

### Passo 2: Adicionar Visualizações
1. Clique em **"Add a question"**
2. Selecione as visualizações que você criou
3. Organize arrastando e redimensionando
4. Adicione títulos e descrições

### Passo 3: Configurar Filtros
1. Clique em **"Add a filter"**
2. Escolha campos como:
   - Data de criação
   - Tipologia
   - Zona bioclimática
3. Configure valores padrão
4. **Save** o dashboard

## 🚀 EXEMPLOS PRÁTICOS - COMECE AGORA!

### 1. Relatório Simples: "Resumo Executivo"
**Query:**
```sql
SELECT 
    COUNT(*) AS "Total de Edificações",
    COUNT(DISTINCT typology_id) AS "Tipos Diferentes",
    ROUND(AVG(total_area), 2) AS "Área Média (m²)",
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS "Cadastros Últimos 30 dias"
FROM buildings;
```

**Tipo de visualização:** Number/Metric
**Resultado:** 4 cartões com métricas principais

### 2. Gráfico de Barras: "Top 5 Tipologias"
**Query:**
```sql
SELECT 
    t.name AS "Tipologia",
    COUNT(b.id) AS "Quantidade"
FROM buildings b
LEFT JOIN typologies t ON b.typology_id = t.id
GROUP BY t.name
ORDER BY COUNT(b.id) DESC
LIMIT 5;
```

**Tipo:** Bar Chart
**Configuração:** X = Tipologia, Y = Quantidade

### 3. Gráfico de Linha: "Crescimento Mensal"
**Query:**
```sql
SELECT 
    DATE_TRUNC('month', created_at) AS "Mês",
    COUNT(*) AS "Novos Cadastros"
FROM buildings
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY "Mês";
```

**Tipo:** Line Chart
**Configuração:** X = Mês, Y = Novos Cadastros

## 📱 RECURSOS AVANÇADOS (FREE)

### Filtros Interativos
```sql
-- Adicione {{variavel}} para criar filtros dinâmicos
SELECT 
    t.name AS "Tipologia",
    COUNT(b.id) AS "Total"
FROM buildings b
LEFT JOIN typologies t ON b.typology_id = t.id
WHERE b.created_at >= {{data_inicio}}
  AND b.created_at <= {{data_fim}}
  [[AND t.name = {{tipologia}}]]  -- Filtro opcional
GROUP BY t.name
ORDER BY COUNT(b.id) DESC;
```

### Agendamento de Relatórios
1. Abra um dashboard
2. Clique no ícone **"📤 Share"**
3. Configure **"Set up a subscription"**
4. Escolha frequência (diário, semanal, mensal)
5. Adicione emails dos destinatários

### Exportação
- **PDF**: Para relatórios executivos
- **CSV/Excel**: Para análises detalhadas
- **PNG**: Para apresentações

## 🎨 DICAS DE VISUALIZAÇÃO

### Cores por Categoria
- **Verde**: Métricas positivas (total, crescimento)
- **Azul**: Informações neutras (distribuições)
- **Laranja**: Alertas/atenção (dados incompletos)
- **Vermelho**: Problemas/urgente

### Títulos Descritivos
- ❌ "Query 1"
- ✅ "Edificações por Tipologia - Últimos 12 meses"

### Organização do Dashboard
```
[Métricas Principais - Linha Superior]
[Total] [Novos] [Área Média] [Relatórios]

[Gráficos Principais - Meio]
[Gráfico Barras: Tipologias] [Gráfico Linha: Crescimento]

[Tabelas Detalhadas - Inferior]
[Top Parâmetros] [Qualidade dos Dados]
```

## 🔧 TROUBLESHOOTING

### Problema: Query muito lenta
**Solução:** Adicione filtros de data e LIMIT

### Problema: Dados não aparecem
**Solução:** Verifique JOINs e dados NULL

### Problema: Gráfico confuso
**Solução:** Limite a 5-10 categorias, use TOP N

### Problema: Dashboard sobrecarregado
**Solução:** Máximo 6-8 visualizações por dashboard

## ⚡ PRÓXIMOS PASSOS

1. **Teste a primeira query** (Resumo Executivo)
2. **Crie seu primeiro gráfico** (Tipologias)
3. **Monte um dashboard simples** (3-4 visualizações)
4. **Adicione filtros interativos**
5. **Configure agendamento** para envio automático

**Comece simples e vá evoluindo! 🚀**