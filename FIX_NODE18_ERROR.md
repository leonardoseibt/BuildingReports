# Correção: Erro ERR_INVALID_ARG_TYPE no Node.js 18

## ❌ Problema Identificado

Ao executar `pm2 logs pdereports` no servidor DigitalOcean, apareceu o seguinte erro:

```
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined
    at Object.resolve (node:path:1115:7)
    at file:///var/www/BuildingReports/dist/index.js:6660:18
```

### Causa Raiz

O código estava usando `import.meta.dirname`, que **só existe no Node.js 20+**, mas o servidor está rodando **Node.js 18.20.8**.

## ✅ Solução Aplicada

Substituí `import.meta.dirname` pela alternativa compatível com Node.js 18:

```typescript
// ❌ ANTES (Node 20+ apenas)
import.meta.dirname

// ✅ DEPOIS (Node 18+ compatível)
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

### Arquivos Corrigidos

1. **server/vite.ts**
2. **vite.config.ts**

## 📋 Como Aplicar no Servidor

### Opção 1: Deploy Atualizado (Recomendado)

```bash
# No Windows (PowerShell)
git add .
git commit -m "fix: Compatibilidade com Node.js 18 (import.meta.dirname)"
git push

# No Servidor (SSH)
cd /var/www/BuildingReports
git pull
npm run build
pm2 restart pdereports
pm2 logs pdereports --lines 20
```

### Opção 2: Atualizar Node.js no Servidor para Versão 20+ (Alternativa)

Se preferir usar Node.js 20+ no servidor:

```bash
# No servidor DigitalOcean
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Deve mostrar v20.x.x
npm --version

# Rebuild e restart
cd /var/www/BuildingReports
npm install
npm run build
pm2 restart pdereports
pm2 save
```

## ⚠️ Recomendação

**Opção 1 (Deploy Atualizado)** é mais segura porque:
- Mantém Node.js 18 LTS (estável até Abril 2025)
- Não requer mudanças no servidor de produção
- Código continua compatível com ambas as versões

**Opção 2 (Node 20)** só deve ser usada se:
- Você precisa de recursos específicos do Node 20+
- Está disposto a testar toda a aplicação novamente
- Tem tempo para resolver possíveis incompatibilidades

## 📝 Verificação

Após aplicar a correção, execute:

```bash
pm2 logs pdereports --lines 50
```

Você deve ver:
```
✅ SESSION_SECRET configurado com segurança
[express] Server is running at http://localhost:5000
```

## 🔍 Detalhes Técnicos

### Diferença entre as Abordagens

| Feature | Node 18 | Node 20+ |
|---------|---------|----------|
| `import.meta.url` | ✅ | ✅ |
| `import.meta.dirname` | ❌ | ✅ |
| `fileURLToPath()` | ✅ | ✅ |

### Código Completo da Correção

**server/vite.ts:**
```typescript
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Usar __dirname ao invés de import.meta.dirname
const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");
const distPath = path.resolve(__dirname, "public");
```

**vite.config.ts:**
```typescript
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
  },
});
```

## 🚀 Deploy Rápido

```bash
# PowerShell (local)
git add server/vite.ts vite.config.ts
git commit -m "fix: Node 18 compatibility"
git push

# SSH (servidor)
ssh deploy@SEU_IP "cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports"
```

## 📚 Referências

- [Node.js ESM Documentation](https://nodejs.org/api/esm.html#importmetaurl)
- [import.meta.dirname - Added in Node v20.11.0](https://nodejs.org/api/esm.html#importmetadirname)
- [fileURLToPath() - Compatible with Node v10.12.0+](https://nodejs.org/api/url.html#urlfileurltopathurl)
