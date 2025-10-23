# 🔄 Guia de Atualização do Sistema em Produção

**Sistema:** BuildingReports (pdereports.com.br)  
**Servidor:** DigitalOcean Droplet  
**Ambiente:** Node.js + React + PostgreSQL (Neon) + jsreport

---

## 📋 **CENÁRIOS DE ATUALIZAÇÃO**

### **Cenário 1: Atualização de Código (Mais Comum)**
- Correção de bugs
- Novas funcionalidades
- Melhorias de performance
- Ajustes de UI

### **Cenário 2: Atualização de Dependências**
- Atualização de pacotes npm
- Patches de segurança
- Novas bibliotecas

### **Cenário 3: Atualização de Banco de Dados**
- Novas tabelas
- Alteração de colunas
- Novos índices
- Migrations SQL

---

## 🚀 **MÉTODO 1: ATUALIZAÇÃO SIMPLES (Deploy Rápido)**

### **Quando Usar:**
- ✅ Mudanças apenas no código (frontend/backend)
- ✅ Sem alterações no banco de dados
- ✅ Sem novas dependências npm
- ✅ Downtime aceitável (< 30 segundos)

### **Passo a Passo:**

#### **1. No Seu Computador Local:**

```powershell
# 1. Commitar suas mudanças
git add .
git commit -m "fix: correção de bug no relatório"

# 2. Push para o repositório
git push origin main
```

#### **2. No Servidor (SSH):**

```bash
# Conectar ao servidor
ssh deploy@143.198.123.45

# Navegar para o diretório do projeto
cd /var/www/BuildingReports

# Baixar atualizações do Git
git pull origin main

# Fazer rebuild (frontend + backend)
npm run build

# Reiniciar aplicação
pm2 restart pdereports

# Verificar se está rodando
pm2 status

# Ver logs para confirmar
pm2 logs pdereports --lines 20

# Sair do servidor
exit
```

#### **3. Verificar no Navegador:**

```
https://pdereports.com.br
- Testar funcionalidade alterada
- Verificar se não há erros
- Testar geração de PDF
```

**⏱️ Tempo total: ~3-5 minutos**

---

## 🔧 **MÉTODO 2: ATUALIZAÇÃO COM DEPENDÊNCIAS**

### **Quando Usar:**
- ✅ Adicionou/removeu pacotes npm
- ✅ Atualizou versões de dependências
- ✅ Mudanças no package.json
- ✅ Downtime aceitável (1-2 minutos)

### **Passo a Passo:**

#### **1. No Seu Computador:**

```powershell
# Commitar mudanças (incluindo package.json)
git add .
git commit -m "feat: adicionar biblioteca X para funcionalidade Y"
git push origin main
```

#### **2. No Servidor:**

```bash
# Conectar
ssh deploy@143.198.123.45

# Navegar
cd /var/www/BuildingReports

# Parar aplicação (evitar conflitos)
pm2 stop pdereports

# Baixar atualizações
git pull origin main

# Reinstalar dependências
npm install

# Rebuild
npm run build

# Reiniciar aplicação
pm2 start pdereports

# Verificar
pm2 status
pm2 logs pdereports --lines 30

# Sair
exit
```

**⏱️ Tempo total: ~5-10 minutos**

---

## 🗄️ **MÉTODO 3: ATUALIZAÇÃO COM BANCO DE DADOS**

### **Quando Usar:**
- ✅ Novas tabelas ou colunas
- ✅ Alterações de schema
- ✅ Migrations SQL
- ✅ Requer cuidado extra (backup!)

### **Passo a Passo:**

#### **1. SEMPRE Fazer Backup Primeiro:**

```bash
# No Neon Console (https://console.neon.tech):
# 1. Acessar seu projeto
# 2. Settings → Backups
# 3. Clicar em "Create Backup"
# 4. Aguardar confirmação

# OU via linha de comando (se tiver acesso):
# pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### **2. No Seu Computador:**

```powershell
# Criar arquivo de migration
# Exemplo: migrations/20251023_add_new_field.sql

# Commitar
git add .
git commit -m "feat: adicionar campo X na tabela Y"
git push origin main
```

#### **3. No Servidor:**

```bash
# Conectar
ssh deploy@143.198.123.45
cd /var/www/BuildingReports

# Baixar atualizações
git pull origin main

# Executar migration (IMPORTANTE: fazer antes de atualizar código)
# Método 1: Se tiver script npm
npm run db:migrate

# Método 2: Executar SQL manualmente
# (Conectar ao Neon via psql ou Neon Console)

# Reinstalar dependências (se necessário)
npm install

# Rebuild
npm run build

# Reiniciar
pm2 restart pdereports

# Verificar logs
pm2 logs pdereports --lines 50

# Testar conexão com banco
# (Verificar se app não está dando erro de schema)

# Sair
exit
```

#### **4. Rollback (Se Algo Der Errado):**

```bash
# Se a migration falhou:

# 1. Reverter código
cd /var/www/BuildingReports
git reset --hard HEAD~1

# 2. Rebuild e restart
npm run build
pm2 restart pdereports

# 3. Restaurar backup do banco (Neon Console)
# Settings → Backups → Restore
```

**⏱️ Tempo total: ~10-20 minutos (incluindo backup)**

---

## 🚦 **MÉTODO 4: ZERO DOWNTIME (Avançado)**

### **Quando Usar:**
- ✅ Sistema crítico 24/7
- ✅ Downtime não é aceitável
- ✅ Muitos usuários simultâneos

### **Estratégia:**

```bash
# 1. Rodar duas instâncias da aplicação
pm2 start npm --name "pdereports-v1" -- start
pm2 start npm --name "pdereports-v2" -- start

# 2. Configurar Nginx para fazer load balancing
# 3. Atualizar uma instância por vez
# 4. Trocar tráfego gradualmente

# Isso requer configuração mais avançada
# Não necessário para MVP
```

---

## 📝 **SCRIPT DE ATUALIZAÇÃO AUTOMATIZADO**

Crie um script para facilitar atualizações rotineiras:

### **No Servidor:**

```bash
# Criar script de deploy
nano ~/deploy-pdereports.sh
```

**Cole o seguinte conteúdo:**

```bash
#!/bin/bash

# Script de Deploy Automatizado - BuildingReports
# Uso: ./deploy-pdereports.sh [simple|full|db]

set -e  # Parar em caso de erro

DEPLOY_TYPE=${1:-simple}
PROJECT_DIR="/var/www/BuildingReports"
APP_NAME="pdereports"

echo "🚀 Iniciando deploy do BuildingReports..."
echo "📦 Tipo: $DEPLOY_TYPE"
echo ""

cd $PROJECT_DIR

# Backup do código atual
echo "📦 Criando backup..."
BACKUP_DIR="$HOME/backups/buildingreports"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp -r $PROJECT_DIR "$BACKUP_DIR/backup_$TIMESTAMP"
echo "✅ Backup criado em: $BACKUP_DIR/backup_$TIMESTAMP"

# Git pull
echo ""
echo "⬇️  Baixando atualizações do Git..."
git pull origin main

# Verificar se houve mudanças
if [ $? -ne 0 ]; then
    echo "❌ Erro ao fazer git pull!"
    exit 1
fi

# Atualização baseada no tipo
case $DEPLOY_TYPE in
    simple)
        echo ""
        echo "🔨 Build simples (sem reinstalar dependências)..."
        npm run build
        ;;
    full)
        echo ""
        echo "🔨 Build completo (com dependências)..."
        pm2 stop $APP_NAME
        npm install
        npm run build
        pm2 start $APP_NAME
        ;;
    db)
        echo ""
        echo "🗄️  Deploy com migration de banco..."
        echo "⚠️  ATENÇÃO: Certifique-se de ter feito backup do banco!"
        read -p "Continuar? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm run db:migrate
            npm install
            npm run build
        else
            echo "❌ Deploy cancelado!"
            exit 1
        fi
        ;;
    *)
        echo "❌ Tipo inválido: $DEPLOY_TYPE"
        echo "Uso: ./deploy-pdereports.sh [simple|full|db]"
        exit 1
        ;;
esac

# Reiniciar aplicação (se não foi no 'full')
if [ "$DEPLOY_TYPE" != "full" ]; then
    echo ""
    echo "🔄 Reiniciando aplicação..."
    pm2 restart $APP_NAME
fi

# Verificar status
echo ""
echo "📊 Status da aplicação:"
pm2 status $APP_NAME

# Mostrar logs recentes
echo ""
echo "📜 Logs recentes (últimas 10 linhas):"
pm2 logs $APP_NAME --lines 10 --nostream

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🌐 Acesse: https://pdereports.com.br"
echo ""
echo "💡 Dica: Verifique a aplicação no navegador"
```

**Tornar executável:**

```bash
chmod +x ~/deploy-pdereports.sh
```

### **Usar o Script:**

```bash
# Atualização simples (mais rápida)
~/deploy-pdereports.sh simple

# Atualização completa (com dependências)
~/deploy-pdereports.sh full

# Atualização com banco de dados
~/deploy-pdereports.sh db
```

---

## 🔐 **BOAS PRÁTICAS**

### **1. Sempre Fazer Backup Antes:**

```bash
# Backup do código
cd /var/www
tar -czf BuildingReports_backup_$(date +%Y%m%d).tar.gz BuildingReports/

# Backup do banco (Neon Console)
# https://console.neon.tech → Settings → Backups → Create
```

### **2. Testar em Ambiente Local Primeiro:**

```powershell
# No seu computador:
npm install
npm run build
npm start

# Testar todas as funcionalidades
# Só fazer deploy se tudo funcionar
```

### **3. Usar Git Tags para Versões:**

```powershell
# Marcar versão estável
git tag -a v1.2.0 -m "Versão 1.2.0 - Correção de bugs"
git push origin v1.2.0

# No servidor, fazer checkout de versão específica
git checkout v1.2.0
```

### **4. Monitorar Logs Após Deploy:**

```bash
# Ver logs em tempo real por 2 minutos
pm2 logs pdereports --lines 100

# Verificar erros
pm2 logs pdereports --err --lines 50

# Verificar se há crashes
pm2 status
```

### **5. Comunicar Usuários (Se Downtime):**

```
📢 Manutenção Programada:
Data: 25/10/2025
Horário: 02:00 - 02:30 (madrugada)
Impacto: Sistema ficará offline por ~30 minutos
Motivo: Atualização de segurança e novas funcionalidades
```

---

## 🆘 **ROLLBACK (Desfazer Deploy)**

### **Se algo der errado após deploy:**

```bash
# Conectar ao servidor
ssh deploy@143.198.123.45
cd /var/www/BuildingReports

# Opção 1: Voltar para commit anterior
git log --oneline -5  # Ver últimos commits
git reset --hard HEAD~1  # Voltar 1 commit
npm run build
pm2 restart pdereports

# Opção 2: Restaurar backup
cd /var/www
rm -rf BuildingReports
tar -xzf BuildingReports_backup_20251023.tar.gz
cd BuildingReports
pm2 restart pdereports

# Opção 3: Checkout de tag estável
git fetch --tags
git checkout v1.1.0  # Última versão estável
npm run build
pm2 restart pdereports
```

---

## 📊 **CHECKLIST DE DEPLOY**

### **Antes do Deploy:**
- [ ] Código testado localmente
- [ ] Testes passando
- [ ] Commit e push feitos
- [ ] Backup do banco de dados criado (se tiver migration)
- [ ] Usuários notificados (se downtime esperado)

### **Durante o Deploy:**
- [ ] SSH conectado ao servidor
- [ ] Git pull executado com sucesso
- [ ] npm install executado (se necessário)
- [ ] Build completado sem erros
- [ ] Aplicação reiniciada
- [ ] Logs verificados

### **Após o Deploy:**
- [ ] Site acessível via HTTPS
- [ ] Login funciona
- [ ] CRUD básico funciona
- [ ] Geração de PDF funciona (jsreport)
- [ ] Sem erros nos logs
- [ ] Performance normal
- [ ] Usuários notificados (deploy concluído)

---

## 🔄 **FLUXO RECOMENDADO DE DESENVOLVIMENTO**

### **Ambiente Local → Staging → Produção:**

```
┌─────────────────┐
│  LOCAL (DEV)    │  Desenvolvimento e testes
│  localhost:5000 │
└────────┬────────┘
         │ git push
         ↓
┌─────────────────┐
│  STAGING (OPC.) │  Testes em ambiente similar à produção
│  staging.pde... │  (Opcional, mas recomendado)
└────────┬────────┘
         │ aprovação
         ↓
┌─────────────────┐
│  PRODUCTION     │  Ambiente real dos usuários
│  pdereports.com │
└─────────────────┘
```

**Para adicionar staging no futuro:**
- Criar outro droplet menor ($12/mês)
- Usar subdomínio: staging.pdereports.com.br
- Testar atualizações lá antes de ir para produção

---

## 📚 **COMANDOS RÁPIDOS**

### **Deploy Simples (1 linha):**
```bash
ssh deploy@143.198.123.45 "cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports"
```

### **Ver Status Remoto:**
```bash
ssh deploy@143.198.123.45 "pm2 status && pm2 logs pdereports --lines 10 --nostream"
```

### **Backup Rápido:**
```bash
ssh deploy@143.198.123.45 "cd /var/www && tar -czf ~/BuildingReports_backup_$(date +%Y%m%d).tar.gz BuildingReports/"
```

---

## 🎯 **RESUMO: QUAL MÉTODO USAR?**

| Situação | Método | Tempo | Downtime |
|----------|--------|-------|----------|
| **Bug pequeno no código** | Método 1 (Simples) | 3-5 min | 10-30s |
| **Nova funcionalidade** | Método 1 (Simples) | 3-5 min | 10-30s |
| **Adicionar dependência** | Método 2 (Com deps) | 5-10 min | 1-2 min |
| **Atualizar React/Node** | Método 2 (Com deps) | 5-10 min | 1-2 min |
| **Alterar schema DB** | Método 3 (Com DB) | 10-20 min | 2-5 min |
| **Sistema crítico 24/7** | Método 4 (Zero downtime) | 20-30 min | 0s |

---

## 🚀 **RECOMENDAÇÃO PARA SEU CASO**

Para a maioria das atualizações, use:

```bash
# Criar alias no servidor para facilitar
echo 'alias deploy-simple="cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports"' >> ~/.bashrc
source ~/.bashrc

# Agora você pode simplesmente:
ssh deploy@143.198.123.45
deploy-simple
```

**Tempo total: < 5 minutos da sua máquina até o site atualizado!** ⚡

---

**💡 Dica Final:** Configure notificações no PM2 para ser alertado se a aplicação cair:

```bash
pm2 install pm2-slack  # Se usar Slack
pm2 set pm2-slack:slack_url https://hooks.slack.com/...
```

Ou use serviços como **UptimeRobot** (gratuito) para monitorar se o site está no ar! 📊
