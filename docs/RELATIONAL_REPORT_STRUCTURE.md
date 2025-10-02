# Migração para Estrutura Relacional de Relatórios

## Resumo das Mudanças

Este documento descreve as alterações implementadas para tornar os relatórios compatíveis com o Crystal Reports, migrando de uma estrutura JSONB para tabelas relacionais.

## Problema Anterior

O sistema armazenava todas as seleções de relatórios (requirements, criteria, analyses e níveis) em um campo JSONB na tabela `reports`. Esta abordagem funciona bem para a aplicação web, mas o Crystal Reports não consegue ler e processar dados JSONB de forma eficiente.

## Solução Implementada

### 1. Novas Tabelas Relacionais

Criamos 4 novas tabelas para armazenar a estrutura dos relatórios:

#### `report_requirements`
```sql
CREATE TABLE report_requirements (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  requirement_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  UNIQUE(report_id, requirement_id)
);
```

#### `report_criteria`
```sql
CREATE TABLE report_criteria (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  criterion_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  UNIQUE(report_id, criterion_id)
);
```

#### `report_analyses`
```sql
CREATE TABLE report_analyses (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  analysis_id INTEGER REFERENCES analyses(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  UNIQUE(report_id, analysis_id)
);
```

#### `report_analysis_levels`
```sql
CREATE TABLE report_analysis_levels (
  id SERIAL PRIMARY KEY,
  report_analysis_id INTEGER REFERENCES report_analyses(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL
);
```

### 2. Schema Updates (shared/schema.ts)

- Adicionadas definições das 4 novas tabelas
- Adicionadas relações ORM para Drizzle
- Exportados novos tipos TypeScript: `ReportRequirement`, `ReportCriterion`, `ReportAnalysis`, `ReportAnalysisLevel`

### 3. Storage Layer (server/storage.ts)

#### Novas Funções

**`saveReportStructure(reportId, structure)`**
- Salva a estrutura do relatório nas tabelas relacionais
- Usa transação para garantir atomicidade
- Remove estrutura anterior antes de inserir nova
- Aceita formato:
  ```typescript
  {
    requirements: Array<{ id: number; position: number }>;
    criteria: Array<{ id: number; position: number }>;
    analyses: Array<{ id: number; position: number; levels: string[]; }>;
  }
  ```

**`loadReportStructure(reportId)`**
- Carrega a estrutura do relatório das tabelas relacionais
- Retorna objeto com requirements, criteria e analyses completos
- Inclui níveis selecionados para cada análise

### 4. API Routes (server/routes.ts)

#### Novos Endpoints

**`POST /api/reports/:id/structure`**
- Salva estrutura do relatório nas tabelas relacionais
- Requer autenticação
- Valida acesso do usuário ao relatório

**`GET /api/reports/:id/structure`**
- Carrega estrutura do relatório das tabelas relacionais
- Requer autenticação
- Valida acesso do usuário ao relatório

### 5. Report Generator (server/puppeteer/report-generator.tsx)

**Função `loadReportContext()` Atualizada**
- Tenta carregar estrutura das tabelas relacionais primeiro
- Faz fallback para JSONB se as tabelas relacionais estiverem vazias
- Mantém compatibilidade com relatórios antigos

### 6. Data Migration Script (scripts/migrate-report-structure.ts)

**Script de Migração**
- Lê todos os relatórios existentes
- Extrai estrutura do campo JSONB `reportData`
- Insere nas novas tabelas relacionais
- Reporta estatísticas de migração

**Execução:**
```bash
npm run db:migrate:report-structure
# ou
npx tsx scripts/migrate-report-structure.ts
```

### 7. Task Configuration (.vscode/tasks.json)

Adicionada task `db:migrate:report-structure` para facilitar execução da migração.

## Benefícios

1. **Compatibilidade com Crystal Reports**: Dados em formato relacional podem ser facilmente lidos
2. **Melhor Performance**: Queries SQL diretas são mais rápidas que parsing JSONB
3. **Integridade Referencial**: Constraints de FK garantem consistência
4. **Facilidade de Consulta**: Queries SQL padrão funcionam
5. **Manutenibilidade**: Estrutura mais clara e documentada

## Compatibilidade Retroativa

O sistema mantém compatibilidade total com relatórios antigos:
- O campo `reportData` (JSONB) ainda existe e é usado como fallback
- A função `loadReportContext()` verifica as tabelas relacionais primeiro
- Se não houver dados relacionais, usa o JSONB
- Novos relatórios podem usar ambas as abordagens simultaneamente

## Próximos Passos para Integração Completa

1. **Atualizar Frontend**: Modificar o formulário de relatórios para usar os novos endpoints
2. **Executar Migração**: Rodar script de migração em produção
3. **Configurar Crystal Reports**: Criar queries e relatórios no Crystal Reports
4. **Testar**: Validar que relatórios antigos e novos funcionam corretamente
5. **Deprecar JSONB**: Eventualmente, migrar completamente para estrutura relacional

## Estrutura de Dados

### Exemplo de Estrutura Salva

```typescript
{
  requirements: [
    { id: 1, position: 0 },
    { id: 3, position: 1 }
  ],
  criteria: [
    { id: 5, position: 0 },
    { id: 7, position: 1 }
  ],
  analyses: [
    { id: 10, position: 0, levels: ['minimum', 'intermediate'] },
    { id: 12, position: 1, levels: ['superior'] }
  ]
}
```

### Exemplo de Estrutura Carregada

```typescript
{
  requirements: [
    { id: 1, code: 'R01', label: 'Requirement 1', position: 0 },
    { id: 3, code: 'R03', label: 'Requirement 3', position: 1 }
  ],
  criteria: [
    { id: 5, code: 'C05', label: 'Criterion 5', position: 0 },
    { id: 7, code: 'C07', label: 'Criterion 7', position: 1 }
  ],
  analyses: [
    { 
      id: 10, 
      code: 'A10', 
      label: 'Analysis 10', 
      position: 0, 
      levels: ['minimum', 'intermediate'] 
    },
    { 
      id: 12, 
      code: 'A12', 
      label: 'Analysis 12', 
      position: 1, 
      levels: ['superior'] 
    }
  ]
}
```

## Queries Crystal Reports

### Exemplo de Query para Relatório

```sql
-- Buscar informações básicas do relatório
SELECT 
  r.id,
  r.generated_at,
  b.name as building_name,
  b.city,
  b.state
FROM reports r
JOIN buildings b ON r.building_id = b.id
WHERE r.id = @report_id;

-- Buscar requirements selecionados
SELECT 
  rr.position,
  req.code,
  req.label
FROM report_requirements rr
JOIN requirements req ON rr.requirement_id = req.id
WHERE rr.report_id = @report_id
ORDER BY rr.position;

-- Buscar criteria selecionados
SELECT 
  rc.position,
  c.code,
  c.label
FROM report_criteria rc
JOIN criteria c ON rc.criterion_id = c.id
WHERE rc.report_id = @report_id
ORDER BY rc.position;

-- Buscar analyses com níveis
SELECT 
  ra.position,
  a.code,
  a.label,
  STRING_AGG(ral.level, ', ' ORDER BY ral.level) as levels
FROM report_analyses ra
JOIN analyses a ON ra.analysis_id = a.id
LEFT JOIN report_analysis_levels ral ON ra.id = ral.report_analysis_id
WHERE ra.report_id = @report_id
GROUP BY ra.id, ra.position, a.code, a.label
ORDER BY ra.position;
```

## Manutenção

### Limpeza de Dados

As tabelas usam `ON DELETE CASCADE`, então quando um relatório é deletado, todos os registros relacionados são automaticamente removidos.

### Indices

Os índices foram criados para otimizar as queries mais comuns:
- `idx_report_requirements_report_id`
- `idx_report_criteria_report_id`
- `idx_report_analyses_report_id`
- `idx_report_analysis_levels_report_analysis_id`

### Constraints

- Unique constraints impedem duplicação de seleções
- Foreign keys garantem integridade referencial
- NOT NULL para campos obrigatórios (level)

## Suporte

Para dúvidas ou problemas, consulte:
- Schema: `shared/schema.ts`
- Storage: `server/storage.ts`
- Routes: `server/routes.ts`
- Migration: `scripts/migrate-report-structure.ts`
