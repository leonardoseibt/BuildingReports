# 📘 Guia de Integração - Rate Limiters e Validadores

## 1️⃣ **Atualizar `server/routes.ts`**

### Passo 1: Importar os rate limiters

```typescript
// No topo do arquivo server/routes.ts, adicionar:
import { 
  strictLoginLimiter, 
  readLimiter, 
  writeLimiter, 
  heavyOperationLimiter,
  userCreationLimiter 
} from './rate-limiters';
import { validateNumericId, sanitizeBody, validateFileSize } from './validators';
import logger, { requestLogger, errorLogger, logAudit, AuditEventType, logSecurityEvent } from './logger';
```

### Passo 2: Aplicar rate limiters nos endpoints

```typescript
// ============ AUTH ROUTES ============
// Substituir o authLimiter atual por strictLoginLimiter
app.post('/api/auth/login', strictLoginLimiter, async (req, res, next) => {
  // ... código existente
});

app.post('/api/auth/logout', readLimiter, async (req, res) => {
  // ... código existente
});

// ============ USER ROUTES ============
// Aplicar userCreationLimiter em criação de usuários
app.post('/api/users', 
  isAuthenticated, 
  requireModuleAccess('users'), 
  userCreationLimiter,  // <-- ADICIONAR
  express.json(), 
  async (req: any, res) => {
    // ... código existente
  }
);

// Aplicar readLimiter em leituras
app.get('/api/users', 
  isAuthenticated, 
  requireModuleAccess('users'), 
  readLimiter,  // <-- ADICIONAR
  async (req, res) => {
    // ... código existente
  }
);

// Aplicar writeLimiter em updates
app.put('/api/users/:id', 
  isAuthenticated, 
  requireModuleAccess('users'),
  validateNumericId(),  // <-- ADICIONAR validação de ID
  writeLimiter,  // <-- ADICIONAR
  express.json(), 
  async (req: any, res) => {
    const id = (req as any).validatedId;  // <-- Usar ID validado
    // ... código existente
  }
);

// Aplicar writeLimiter em deletes
app.delete('/api/users/:id', 
  isAuthenticated, 
  requireModuleAccess('users'), 
  validateNumericId(),  // <-- ADICIONAR
  writeLimiter,  // <-- ADICIONAR
  async (req: any, res) => {
    const id = (req as any).validatedId;  // <-- Usar ID validado
    // ... código existente
  }
);

// ============ BUILDING ROUTES ============
app.get('/api/buildings', 
  isAuthenticated, 
  requireModuleAccess('buildings'), 
  readLimiter,  // <-- ADICIONAR
  async (req: any, res) => {
    // ... código existente
  }
);

app.post('/api/buildings', 
  isAuthenticated, 
  requireModuleAccess('buildings'), 
  writeLimiter,  // <-- ADICIONAR
  sanitizeBody,  // <-- ADICIONAR sanitização
  express.json(), 
  async (req: any, res) => {
    // ... código existente
  }
);

app.put('/api/buildings/:id', 
  isAuthenticated, 
  requireModuleAccess('buildings'), 
  validateNumericId(),  // <-- ADICIONAR
  writeLimiter,  // <-- ADICIONAR
  sanitizeBody,  // <-- ADICIONAR
  express.json(), 
  async (req: any, res) => {
    const id = (req as any).validatedId;  // <-- Usar ID validado
    // ... código existente
  }
);

app.delete('/api/buildings/:id', 
  isAuthenticated, 
  requireModuleAccess('buildings'), 
  validateNumericId(),  // <-- ADICIONAR
  writeLimiter,  // <-- ADICIONAR
  async (req: any, res) => {
    const id = (req as any).validatedId;  // <-- Usar ID validado
    // ... código existente
  }
);

// ============ REPORT ROUTES (Heavy Operations) ============
app.post('/api/reports/:id/pdf', 
  isAuthenticated, 
  requireModuleAccess('reports'), 
  validateNumericId(),  // <-- ADICIONAR
  heavyOperationLimiter,  // <-- USAR limiter de operações pesadas
  async (req: any, res) => {
    const id = (req as any).validatedId;
    // ... código existente
  }
);

// ============ PADRÃO PARA TODOS OS OUTROS ENDPOINTS ============
// GETs: readLimiter
// POST/PUT/PATCH/DELETE: writeLimiter
// PDF/Export/Heavy: heavyOperationLimiter
```

### Passo 3: Adicionar logging middleware

```typescript
// Depois de setupAuth(app), adicionar:
export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  
  // Logging de todas as requisições
  app.use('/api', requestLogger);  // <-- ADICIONAR
  
  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    // ...
  });
  
  // ... resto das rotas
  
  // Error logger deve vir DEPOIS de todas as rotas
  app.use(errorLogger);  // <-- ADICIONAR no final
  
  return httpServer;
}
```

## 2️⃣ **Adicionar Validação de SESSION_SECRET no `server/auth.ts`**

```typescript
// No topo do arquivo server/auth.ts, após os imports:

if (!process.env.SESSION_SECRET) {
  console.error('❌ CRITICAL: SESSION_SECRET não configurado no .env');
  process.exit(1);
}

// Validar força do secret em produção
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.SESSION_SECRET;
  
  // Verificar se não é o exemplo do .env.example
  if (secret === 'dev-super-secret-change-me') {
    console.error('❌ CRITICAL: SESSION_SECRET ainda está usando o valor de exemplo!');
    console.error('Gere um novo secret com: openssl rand -base64 64');
    process.exit(1);
  }
  
  // Verificar tamanho mínimo
  if (secret.length < 32) {
    console.error('❌ CRITICAL: SESSION_SECRET muito curto (mínimo 32 caracteres)');
    console.error('Gere um novo secret com: openssl rand -base64 64');
    process.exit(1);
  }
  
  console.log('✅ SESSION_SECRET configurado corretamente');
}
```

## 3️⃣ **Atualizar `.env.example`**

```bash
# ⚠️ SECURITY WARNING: NUNCA use este valor em produção!
# Gere um secret forte com: openssl rand -base64 64
SESSION_SECRET=dev-super-secret-change-me

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/building_reports

# Node Environment
NODE_ENV=development

# CORS Configuration
# Em produção, defina o domínio exato (ex: https://pdereports.com.br)
CORS_ORIGIN=http://localhost:5173
CORS_ALLOW_LOCALHOST=true

# Session Configuration
SESSION_MAX_AGE=86400000  # 24 horas em ms
SESSION_ROLLING=true
SESSION_COOKIE_SECURE=false  # true em produção (requer HTTPS)
SESSION_COOKIE_SAME_SITE=lax  # strict em produção

# Rate Limiting (opcional - usar Redis em produção)
# REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info  # warn ou error em produção
```

## 4️⃣ **Criar diretório de logs**

```bash
# Criar diretório para logs
mkdir logs

# Adicionar ao .gitignore
echo "logs/" >> .gitignore
```

## 5️⃣ **Instalar dependências necessárias**

```bash
npm install winston zod
npm install --save-dev @types/express
```

## 6️⃣ **Executar migrações**

```bash
# Executar a migração de índices
npm run db:migrate -- migrations/20251023_add_performance_indexes.sql

# Verificar índices criados
psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;"
```

## 7️⃣ **Testes antes do deploy**

### Testar rate limiting

```bash
# Testar login rate limit (deve bloquear após 5 tentativas)
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
# Deve retornar 429 (Too Many Requests) após 5 tentativas
```

### Testar validação de ID

```bash
# ID inválido deve retornar 400
curl http://localhost:5000/api/users/abc
curl http://localhost:5000/api/users/-1
curl http://localhost:5000/api/users/999999999999999999
```

### Verificar logs

```bash
# Verificar se logs estão sendo gerados
tail -f logs/combined.log
tail -f logs/error.log
```

## 8️⃣ **Configuração Nginx (Produção)**

```nginx
# Rate limiting no nível do Nginx (camada extra)
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

server {
    listen 443 ssl http2;
    server_name pdereports.com.br;
    
    ssl_certificate /etc/ssl/certs/pdereports.crt;
    ssl_certificate_key /etc/ssl/private/pdereports.key;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://localhost:5000;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:5000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
    
    location / {
        root /var/www/pdereports/client;
        try_files $uri $uri/ /index.html;
    }
}
```

## 9️⃣ **Monitoramento (PM2)**

```bash
# Instalar PM2
npm install -g pm2

# Criar ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'pdereports-api',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
  }]
};
EOF

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

# Configurar auto-start
pm2 startup
```

## 🔟 **Checklist Final de Deploy**

- [ ] `SESSION_SECRET` gerado com `openssl rand -base64 64`
- [ ] `NODE_ENV=production` no `.env`
- [ ] `SESSION_COOKIE_SECURE=true` (requer HTTPS)
- [ ] `SESSION_COOKIE_SAME_SITE=strict`
- [ ] `CORS_ORIGIN` configurado com domínio exato
- [ ] `CORS_ALLOW_LOCALHOST=false`
- [ ] Migração de índices executada
- [ ] Dependências instaladas (`winston`, `zod`)
- [ ] Diretório `logs/` criado
- [ ] Rate limiters integrados em `routes.ts`
- [ ] Logging middleware adicionado
- [ ] Validação de `SESSION_SECRET` adicionada em `auth.ts`
- [ ] `.env.example` atualizado com warnings
- [ ] Nginx configurado com SSL
- [ ] PM2 configurado para auto-restart
- [ ] Teste de rate limiting realizado
- [ ] Teste de validação de IDs realizado
- [ ] Logs verificados
- [ ] Backup do banco de dados criado
- [ ] SSL certificado válido instalado
- [ ] Firewall configurado (apenas portas 80, 443)
- [ ] PostgreSQL rodando com `sslmode=require`
- [ ] Redis configurado (opcional, para rate limiting distribuído)

---

## 🚨 **Ações Críticas Antes de Publicar**

```bash
# 1. Gerar SESSION_SECRET forte
openssl rand -base64 64

# 2. Atualizar .env de produção
echo "SESSION_SECRET=$(openssl rand -base64 64)" >> .env.production

# 3. Executar migrações
npm run db:migrate -- migrations/20251023_add_performance_indexes.sql

# 4. Rodar testes de segurança
npm run test:security  # Se existir suite de testes

# 5. Build de produção
npm run build

# 6. Iniciar servidor
NODE_ENV=production pm2 start ecosystem.config.js
```

---

**✅ Com estas implementações, o sistema estará protegido contra:**
- Brute force de login (5 tentativas/15min)
- DoS (rate limiting por tipo de operação)
- SQL Injection (já protegido pelo Drizzle ORM)
- XSS (sanitização de inputs)
- Session hijacking (secret forte, cookies seguros)
- Performance issues (índices no banco)
- Falta de auditoria (logs estruturados)
