# Metabase Integration para BuildingReports

## 🎯 Objetivo

Integrar o Metabase como ferramenta de BI para gerar relatórios avançados e dashboards dos dados do sistema BuildingReports.

## 🚀 Instalação Rápida

### Windows (PowerShell):
```powershell
.\install-metabase.ps1
```

### Linux/Mac (Bash):
```bash
chmod +x install-metabase.sh
./install-metabase.sh
```

### Manual (Docker):
```bash
docker-compose -f docker-compose.metabase.yml up -d
```

## 🔧 Configuração Inicial

1. **Acesse o Metabase**: http://localhost:3000

2. **Primeira configuração**:
   - Crie conta administrativa
   - Defina nome da organização: "BuildingReports"
   - Configure preferências de idioma

3. **Conectar ao PostgreSQL**:
   ```
   Database Type: PostgreSQL
   Host: host.docker.internal (Windows/Mac) ou IP da máquina
   Port: 5432
   Database Name: [nome do seu banco]
   Username: [seu usuário]
   Password: [sua senha]
   ```

## 📊 Relatórios Sugeridos

### 1. **Dashboard Executivo**
- Total de edificações por tipologia
- Distribuição geográfica de edificações
- Evolução temporal de cadastros
- Relatórios de desempenho por região

### 2. **Análise de Desempenho**
- Parâmetros mais utilizados
- Níveis de desempenho por critério
- Análise comparativa de requisitos
- Tendências de avaliação

### 3. **Relatórios Técnicos**
- Edificações por zona bioclimática
- Classificação por ruído/agressividade
- Análise de parâmetros por tipologia
- Distribuição de alturas/áreas

### 4. **Controle de Qualidade**
- Relatórios com dados incompletos
- Parâmetros sem valores
- Inconsistências nos dados
- Auditoria de alterações

## 🗂️ Estrutura de Dados

### Tabelas Principais:
- `buildings` - Dados das edificações
- `reports` - Relatórios gerados
- `parameters` - Parâmetros de desempenho
- `evaluations` - Avaliações realizadas
- `requirements` - Requisitos normativos
- `criteria` - Critérios de avaliação
- `analyses` - Análises técnicas

### Relacionamentos Importantes:
```sql
-- Edificação → Relatórios
buildings.id → reports.building_id

-- Relatório → Avaliações
reports.id → evaluations.report_id

-- Parâmetros → Análises → Critérios → Requisitos
parameters.analysis_id → analyses.id
analyses.criterion_id → criteria.id
criteria.requirement_id → requirements.id
```

## 🎨 Exemplos de Queries SQL

### Total de Edificações por Tipologia:
```sql
SELECT 
    t.name AS tipologia,
    COUNT(b.id) AS total_edificacoes
FROM buildings b
JOIN typologies t ON b.typology_id = t.id
GROUP BY t.name
ORDER BY total_edificacoes DESC;
```

### Relatórios Gerados por Mês:
```sql
SELECT 
    DATE_TRUNC('month', generated_at) AS mes,
    COUNT(*) AS total_relatorios
FROM reports
WHERE generated_at IS NOT NULL
GROUP BY mes
ORDER BY mes DESC;
```

### Parâmetros Mais Utilizados:
```sql
SELECT 
    p.label AS parametro,
    COUNT(e.id) AS total_avaliacoes
FROM parameters p
JOIN analyses a ON p.analysis_id = a.id
JOIN evaluations e ON a.id = e.analysis_id
GROUP BY p.label
ORDER BY total_avaliacoes DESC
LIMIT 10;
```

## 🔒 Segurança

### Usuários Recomendados:
- **Admin**: Acesso total, configuração
- **Analista**: Criação de relatórios, dashboards
- **Visualizador**: Apenas visualização de dashboards

### Permissões por Esquema:
- `public`: Acesso completo para admins
- Tabelas específicas para analistas
- Views somente leitura para visualizadores

## 🔧 Manutenção

### Backup Regular:
```bash
# Backup dos dados do Metabase
docker exec metabase_postgres pg_dump -U metabase_user metabase > metabase_backup.sql
```

### Atualização:
```bash
# Parar serviços
docker-compose -f docker-compose.metabase.yml down

# Atualizar imagens
docker-compose -f docker-compose.metabase.yml pull

# Reiniciar
docker-compose -f docker-compose.metabase.yml up -d
```

### Logs:
```bash
# Ver logs do Metabase
docker-compose -f docker-compose.metabase.yml logs -f metabase

# Ver logs do PostgreSQL
docker-compose -f docker-compose.metabase.yml logs -f postgres
```

## 🌐 Acesso e URLs

- **Metabase**: http://localhost:3000
- **PostgreSQL Metabase**: localhost:5433
- **Documentação**: https://www.metabase.com/docs/

## 🆘 Troubleshooting

### Problema: Metabase não inicia
```bash
# Verificar logs
docker-compose -f docker-compose.metabase.yml logs metabase

# Reiniciar serviços
docker-compose -f docker-compose.metabase.yml restart
```

### Problema: Não consegue conectar ao PostgreSQL
- Verificar se o PostgreSQL está rodando
- Confirmar host (host.docker.internal no Windows/Mac)
- Validar credenciais e permissões
- Verificar firewall/portas

### Problema: Performance lenta
- Aumentar memória do Docker
- Criar índices nas tabelas principais
- Otimizar queries complexas
- Considerar materialized views

## 📈 Próximos Passos

1. **Instalar e configurar** usando os scripts fornecidos
2. **Conectar ao banco** do BuildingReports
3. **Criar dashboards básicos** com os exemplos fornecidos
4. **Treinar usuários** nas funcionalidades
5. **Expandir relatórios** conforme necessidades específicas