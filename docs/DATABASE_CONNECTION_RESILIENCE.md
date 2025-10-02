# Melhorias no Tratamento de Conexões PostgreSQL

## Problema Identificado

Erros de conexão com o banco de dados PostgreSQL (Neon serverless) estavam causando:

```
Error: Connection terminated unexpectedly
Error: read ECONNRESET
```

Estes erros são **transientes** e ocorrem quando:
- Conexão fica inativa por muito tempo
- Banco de dados serverless hiberna (Neon)
- Problemas temporários de rede
- Pool de conexões precisa ser renovado

## Soluções Implementadas

### 1. Melhorias no Pool de Conexões Principal (`server/db.ts`)

✅ **Configurações otimizadas para Neon serverless:**
```typescript
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo de conexões
  idleTimeoutMillis: 30000, // 30s antes de fechar inativa
  connectionTimeoutMillis: 10000, // 10s para estabelecer
  allowExitOnIdle: false, // Não fechar pool automaticamente
});
```

✅ **Event listeners para monitoramento:**
```typescript
pool.on('error', (err) => {
  // Log específico por tipo de erro
  if (err?.code === 'ECONNRESET') { ... }
  if (err?.code === 'ETIMEDOUT') { ... }
  if (err?.message?.includes('Connection terminated')) { ... }
});

pool.on('connect', () => console.log('✅ New connection'));
pool.on('remove', () => console.log('🔄 Connection removed'));
```

### 2. Melhorias no Session Store (`server/auth.ts`)

✅ **Configurações de erro customizadas:**
```typescript
const store = new PgStore({
  conString: process.env.DATABASE_URL,
  pruneSessionInterval: 60, // Reduzir para evitar timeout
  errorLog: (err) => {
    // Log específico por tipo de erro de sessão
    if (err?.code === 'ECONNRESET') { ... }
  },
});
```

✅ **Event handler para erros de sessão:**
```typescript
store.on('error', (err) => {
  // Não limpar cache - deixar pool reconectar
  console.warn('Connection reset - will reconnect automatically');
});
```

### 3. Middleware Global de Erro (`server/index.ts`)

✅ **Tratamento específico para erros de DB:**
```typescript
app.use((err, req, res, next) => {
  // Erros de conexão DB → 503 Service Unavailable
  if (err?.code === 'ECONNRESET' || 
      err?.message?.includes('Connection terminated')) {
    return res.status(503).json({ 
      message: 'Serviço temporariamente indisponível',
      code: 'DB_CONNECTION_ERROR' 
    });
  }
  
  // Timeout DB → 504 Gateway Timeout
  if (err?.code === 'ETIMEDOUT') {
    return res.status(504).json({ 
      message: 'Tempo de resposta excedido',
      code: 'DB_TIMEOUT' 
    });
  }
  
  // Outros erros...
});
```

### 4. Handlers de Processo (`server/index.ts`)

✅ **Evitar crash do servidor em erros transientes:**
```typescript
process.on('unhandledRejection', (reason) => {
  // DB connection errors são transientes - não crashar
  if (reason?.code === 'ECONNRESET') {
    console.warn('⚠️  Transient DB error (will recover)');
    return; // Não crashar
  }
  // Outros erros...
});

process.on('uncaughtException', (err) => {
  // DB connection errors são transientes - não crashar
  if (err?.code === 'ECONNRESET') {
    console.warn('⚠️  Transient DB error (will recover)');
    return; // Não crashar
  }
  // Outros erros...
});
```

## Tipos de Erros Tratados

| Código | Descrição | Tratamento |
|--------|-----------|------------|
| `ECONNRESET` | Conexão fechada inesperadamente | ⚠️  Log de aviso + reconexão automática |
| `ETIMEDOUT` | Timeout ao conectar | ⚠️  Log de aviso + retry automático |
| `Connection terminated` | Banco hibernou ou reiniciou | ⚠️  Log de aviso + reconexão automática |

## Benefícios

### ✅ Resiliência
- Servidor **não cai** com erros de conexão
- Reconexão **automática** pelo pool
- Requests retornam erro apropriado (503/504)

### ✅ Visibilidade
- Logs específicos por tipo de erro
- Ícones para fácil identificação (⚠️  ❌ ✅ 🔄)
- Monitoramento de conexões (connect/remove events)

### ✅ User Experience
- Mensagens de erro apropriadas ao usuário
- Códigos de erro específicos (`DB_CONNECTION_ERROR`, `DB_TIMEOUT`)
- Frontend pode implementar retry automático

### ✅ Performance
- Pool otimizado para Neon serverless
- Timeouts configurados apropriadamente
- Conexões inativas fechadas após 30s

## Como Funciona na Prática

### Cenário 1: Conexão Perdida Durante Request
```
1. Request chega → usa conexão do pool
2. Conexão falha (ECONNRESET)
3. ⚠️  Log: "Connection reset detected"
4. Pool cria nova conexão automaticamente
5. Response 503 ao cliente
6. Próximo request funciona normalmente ✅
```

### Cenário 2: Sessão com Conexão Expirada
```
1. Session store tenta buscar sessão
2. Conexão expirou (Connection terminated)
3. ⚠️  Log: "[session-store] Connection issue"
4. Pool interno reconecta
5. Próxima operação de sessão funciona ✅
```

### Cenário 3: Banco Hibernou (Neon)
```
1. Banco sem atividade → hiberna
2. Primeira request após hibernar
3. ⚠️  Log: "Connection terminated unexpectedly"
4. Pool detecta e cria nova conexão
5. Request pode falhar (503), mas próximos funcionam ✅
```

## Monitoramento

### Logs a Observar

**Conexões estabelecidas:**
```
✅ New database connection established
```

**Conexões removidas:**
```
🔄 Database connection removed from pool
```

**Problemas transientes (OK):**
```
⚠️  Database connection reset (ECONNRESET). Pool will create new connection.
⚠️  [session-store] Connection issue (will auto-retry)
```

**Problemas graves (investigar):**
```
❌ Database pool error: ...
❌ [session-store] Unexpected error: ...
```

## Configurações Disponíveis

### Variáveis de Ambiente

```bash
# Pool principal
DATABASE_URL=postgresql://...

# Session store
SESSION_PRUNE_INTERVAL_SEC=60  # Intervalo de limpeza de sessões

# Sessão
SESSION_IDLE_MS=3600000        # 1h cookie idle
SESSION_TTL_MS=604800000       # 7d absolute
```

### Ajustes no Código

**Pool principal (`server/db.ts`):**
- `max`: 20 conexões (ajustar conforme carga)
- `idleTimeoutMillis`: 30s (ajustar se muitas reconexões)
- `connectionTimeoutMillis`: 10s (ajustar se rede lenta)

**Session store (`server/auth.ts`):**
- `pruneSessionInterval`: 60s (ajustar conforme volume)

## Troubleshooting

### Problema: Muitos logs de reconexão
**Causa**: Pool muito grande ou idle timeout muito baixo  
**Solução**: Aumentar `idleTimeoutMillis` ou reduzir `max`

### Problema: Requests lentos após inatividade
**Causa**: Primeira conexão após hibernação demora  
**Solução**: Normal para Neon serverless, considerar warm-up automático

### Problema: 503 frequentes
**Causa**: Banco instável ou configurações incorretas  
**Solução**: Verificar logs do Neon, aumentar `connectionTimeoutMillis`

### Problema: Session lost
**Causa**: Sessão expirou durante reconexão  
**Solução**: Implementar refresh token ou aumentar `SESSION_TTL_MS`

## Próximos Passos (Opcional)

1. ⏳ Implementar retry automático no frontend para 503/504
2. ⏳ Adicionar health check endpoint para monitoramento
3. ⏳ Implementar connection warm-up periódico
4. ⏳ Configurar alertas para erros frequentes

## Conclusão

✅ Servidor **não cai** mais com erros de conexão  
✅ Pool **reconecta automaticamente**  
✅ Logs **claros e informativos**  
✅ Erros retornam **códigos HTTP apropriados**  
✅ User experience **mantida** durante problemas transientes  

**O sistema agora é resiliente a problemas de conexão PostgreSQL/Neon! 🎉**
