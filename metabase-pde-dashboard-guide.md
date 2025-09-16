# 📊 Guia: Criando Relatório PDE Hierárquico no Metabase

## 🎯 Objetivo
Recriar a estrutura hierárquica do `report-print.tsx` no Metabase, com cabeçalho da edificação e dados organizados por hierarquia (Requisito → Critério → Análise → Parâmetros).

## 📋 Passos para Implementação

### 1️⃣ Criar o Dashboard Principal
1. No Metabase, vá em **Dashboards** → **New Dashboard**
2. Nome: `"PDE - Perfil de Desempenho da Edificação"`
3. Descrição: `"Relatório completo de desempenho de edificações com estrutura hierárquica"`

### 2️⃣ Criar Question do Cabeçalho
1. **New** → **Question** → **Native Query**
2. Nome: `"PDE - Cabeçalho da Edificação"`
3. Cole a **PARTE 1** do arquivo `metabase-pde-report-hierarchical.sql`
4. Configure como **Table** visualization
5. **Configurações visuais:**
   - Desabilitar cabeçalhos de coluna
   - Usar formatação de texto grande
   - Aplicar cores do tema da empresa

### 3️⃣ Criar Question dos Dados Hierárquicos
1. **New** → **Question** → **Native Query**  
2. Nome: `"PDE - Dados Hierárquicos"`
3. Cole a **PARTE 2** do arquivo `metabase-pde-report-hierarchical.sql`
4. Configure como **Table** visualization

### 4️⃣ Configurar Agrupamento Visual
**Opção A: Usando Table Groups**
1. Na Question dos dados hierárquicos
2. **Settings** → **Display** → **Table**
3. Configurar agrupamento por:
   - `req_code` (Requisito)
   - `crit_code` (Critério) 
   - `anal_code` (Análise)

**Opção B: Usando Pivot Table**
1. Alterar visualização para **Pivot Table**
2. **Rows**: `req_label`, `crit_label`, `anal_label`
3. **Columns**: `parametro`, `unidade`
4. **Values**: `valor_minimo`, `valor_intermediario`, `valor_superior`

### 5️⃣ Criar Question com Formatação Avançada
1. **New** → **Question** → **Native Query**
2. Nome: `"PDE - Relatório Visual"`  
3. Cole a **PARTE 3** do arquivo `metabase-pde-report-hierarchical.sql`
4. Esta versão já inclui emojis e formatação visual

### 6️⃣ Organizar o Dashboard
1. Adicione as Questions criadas ao Dashboard
2. **Layout sugerido:**
   ```
   +-------------------------+
   |    CABEÇALHO            |
   +-------------------------+
   |                         |
   |    DADOS HIERÁRQUICOS   |
   |                         |
   |                         |
   +-------------------------+
   ```

### 7️⃣ Configurar Filtros
1. **Add Filter** → **Text or Category** 
2. Nome: `"ID da Edificação"`
3. Conectar aos campos `building_id` de todas as Questions
4. Configurar como **Required** e **Single Select**

### 8️⃣ Personalizar Styling
**Cabeçalho:**
- Fonte: 16-18px
- Peso: Bold
- Cor: Azul escuro (#1f2937)
- Remover bordas da tabela

**Dados Hierárquicos:**
- Fonte: 14px  
- Zebra striping habilitado
- Cores alternadas para agrupamentos
- Destacar hierarquia com indentação visual

## 🎨 Formatação Visual Avançada

### Custom CSS (se disponível)
```css
/* Cabeçalho da edificação */
.edificacao-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

/* Agrupamento de requisitos */
.requisito-group {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  margin: 1rem 0;
}

/* Agrupamento de critérios */
.criterio-group {
  border-left: 3px solid #10b981;
  padding-left: 0.75rem;
  margin-left: 1rem;
}

/* Agrupamento de análises */
.analise-group {
  border-left: 2px solid #f59e0b;
  padding-left: 0.5rem;
  margin-left: 2rem;
}
```

## 📊 Alternativas de Visualização

### 1. Relatório Expandível
- Usar **Question Drilldown** 
- Requisito → Lista de Critérios → Lista de Análises → Parâmetros

### 2. Tabs por Requisito  
- Criar um Dashboard com **Tabs**
- Cada tab = um Requisito
- Conteúdo = Critérios e Análises daquele Requisito

### 3. Cards Hierárquicos
- Cada nível da hierarquia como um **Card** separado
- Layout em **Grid** responsivo
- Usar **Action Buttons** para navegação

## 🔄 Parâmetros Dinâmicos

### Filtro por Edificação
```sql
WHERE b.id = {{edificacao_id}}
```

### Filtro por Requisito (Opcional)
```sql
AND ({{requisito}} IS NULL OR r.code = {{requisito}})
```

### Filtro por Nível de Desempenho
```sql
AND (
  ({{nivel}} = 'minimo' AND p.minimum_value IS NOT NULL AND p.minimum_value != '') OR
  ({{nivel}} = 'intermediario' AND p.intermediate_value IS NOT NULL AND p.intermediate_value != '') OR  
  ({{nivel}} = 'superior' AND p.superior_value IS NOT NULL AND p.superior_value != '') OR
  {{nivel}} IS NULL
)
```

## 📱 Responsividade

### Mobile Layout
1. Configurar **Mobile Layout** no Dashboard
2. Empilhar componentes verticalmente
3. Reduzir tamanho de fonte
4. Usar **Collapse/Expand** para hierarquia

### Export/Print
1. Configurar **Print Layout** 
2. Quebras de página entre Requisitos
3. Cabeçalho em todas as páginas
4. Numeração de páginas

## 🚀 Próximos Passos

1. ✅ Implementar queries básicas
2. ⏳ Configurar visualizações
3. ⏳ Aplicar formatação visual
4. ⏳ Testar com dados reais
5. ⏳ Configurar filtros dinâmicos
6. ⏳ Otimizar para mobile/print

---

**💡 Dica:** Para replicar exatamente a experiência do `report-print.tsx`, considere usar a **PARTE 3** da query que já inclui formatação visual com emojis e agrupamentos prontos.