# 🚀 Guia Completo de Deploy: BuildingReports no DigitalOcean (jsreport)

**Sistema:** BuildingReports (Node.js + React + PostgreSQL + jsreport)  
**Domínio:** pdereports.com.br (Registro.br)  
**Database:** Neon (já existente)  
**Servidor:** DigitalOcean Droplet  
**Gerador de PDF:** jsreport (principal)

---

## 📋 **PRÉ-REQUISITOS**

Antes de começar, tenha em mãos:

- ✅ Conta no DigitalOcean (criar em: https://www.digitalocean.com)
- ✅ Conta no Neon com database criado (você já tem)
- ✅ Connection string do Neon (formato: `postgresql://user:pass@ep-xxx-pooler.neon.tech/buildingreports?sslmode=require`)
- ✅ Acesso ao painel do Registro.br (para configurar DNS)
- ✅ Repositório Git do projeto (GitHub, GitLab, etc.)

---

## 🎯 **PARTE 1: CRIAR DROPLET NO DIGITALOCEAN**

### **Passo 1.1: Criar Conta e Adicionar Método de Pagamento**

1. Acesse: https://www.digitalocean.com
2. Clique em **"Sign Up"** (ou faça login se já tiver conta)
3. Adicione um método de pagamento (cartão de crédito ou PayPal)
4. DigitalOcean oferece **$200 de crédito grátis por 60 dias** para novos usuários

### **Passo 1.2: Criar Droplet**

1. No painel do DigitalOcean, clique em **"Create" → "Droplets"**

2. **Choose Region (Região)**
   - Selecione: **New York 3** (mais próximo do Brasil)
   - Alternativa: **Toronto** (também bom para Brasil)

3. **Choose an Image (Sistema Operacional)**
   - Selecione: **Ubuntu 22.04 LTS x64**

4. **Choose Size (Plano)**
   - Clique em **"Basic"**
   - Selecione: **Regular** (CPU Regular)
   - Escolha: **2 GB RAM / 1 vCPU / 50 GB SSD / 2 TB transfer**
   - Custo: **$18/mês**
   - **Nota:** jsreport é mais leve que Puppeteer, 2GB é suficiente

5. **Choose Authentication Method (Autenticação)**
   - Opção 1 (Recomendada): **SSH Key**
     - Clique em **"New SSH Key"**
     - No seu computador Windows, abra PowerShell e execute:
       ```powershell
       ssh-keygen -t rsa -b 4096 -C "seu-email@exemplo.com"
       ```
     - Pressione Enter 3x (aceitar padrões)
     - Copie a chave pública:
       ```powershell
       cat ~/.ssh/id_rsa.pub
       ```
     - Cole no campo do DigitalOcean
   - Opção 2 (Mais simples): **Password**
     - Marque "Password" e você receberá a senha por email

6. **Hostname (Nome do servidor)**
   - Digite: `pdereports-prod`

7. **Tags (Opcional)**
   - Adicione: `production`, `nodejs`, `buildingreports`

8. **Enable Backups (Opcional, +$3/mês)**
   - Recomendado marcar para ter backups automáticos semanais

9. Clique em **"Create Droplet"**

⏰ **Aguarde 1-2 minutos** enquanto o Droplet é criado.

### **Passo 1.3: Anotar Informações do Droplet**

1. Após criado, você verá o **IP público** do droplet (ex: `143.198.123.45`)
2. **Anote esse IP** - você usará várias vezes

---

## 🔐 **PARTE 2: ACESSAR E CONFIGURAR O SERVIDOR**

### **Passo 2.1: Conectar via SSH**

**No Windows (PowerShell ou CMD):**

```powershell
# Se usou SSH Key:
ssh root@143.198.123.45

# Se usou Password:
ssh root@143.198.123.45
# Digite a senha que recebeu por email
```

**Primeira conexão:**
- Aparecerá: `Are you sure you want to continue connecting?`
- Digite: `yes` e pressione Enter

### **Passo 2.2: Atualizar Sistema**

```bash
# Atualizar lista de pacotes
apt update

# Atualizar pacotes instalados
apt upgrade -y

# Isso pode levar 5-10 minutos
```

### **Passo 2.3: Criar Usuário Não-Root (Segurança)**

```bash
# Criar usuário 'deploy'
adduser deploy

# Defina uma senha forte
# Pressione Enter nas outras perguntas (aceitar padrões)

# Adicionar ao grupo sudo
usermod -aG sudo deploy

# Copiar SSH keys para o novo usuário (se usou SSH)
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Testar login do novo usuário
su - deploy

# Se funcionou, saia do usuário root
exit
```

**A partir de agora, use o usuário `deploy`:**

```powershell
# No seu computador, reconecte como deploy
ssh deploy@143.198.123.45
```

---

## 🛠️ **PARTE 3: INSTALAR FERRAMENTAS NECESSÁRIAS**

### **Passo 3.1: Instalar Node.js 18**

```bash
# Baixar script de instalação do Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js e npm
sudo apt install -y nodejs

# Verificar instalação
node --version  # Deve mostrar v18.x.x
npm --version   # Deve mostrar 9.x.x ou superior
```

### **Passo 3.2: Instalar Dependências do jsreport**

```bash
# jsreport usa Chrome/Chromium internamente para renderização
# Instalar dependências necessárias para o Chrome headless

# Adicionar repositório Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

# Atualizar lista de pacotes
sudo apt update

# Instalar Chrome (usado pelo jsreport internamente)
sudo apt install -y google-chrome-stable

# Instalar dependências adicionais do Chrome
sudo apt install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2 \
  libxrandr2 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3

# Verificar instalação
google-chrome --version  # Deve mostrar versão instalada
```

**Nota sobre jsreport:**
- jsreport usa Chrome headless internamente para renderizar PDFs
- Não precisa configurar Puppeteer separadamente
- jsreport gerencia o Chrome automaticamente

### **Passo 3.3: Instalar PM2 (Gerenciador de Processos Node.js)**

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Verificar instalação
pm2 --version  # Deve mostrar versão instalada
```

### **Passo 3.4: Instalar Nginx (Servidor Web)**

```bash
# Instalar Nginx
sudo apt install -y nginx

# Verificar status
sudo systemctl status nginx
# Deve mostrar "active (running)"

# Pressione 'q' para sair
```

### **Passo 3.5: Instalar Git**

```bash
# Instalar Git
sudo apt install -y git

# Verificar instalação
git --version  # Deve mostrar versão instalada
```

### **Passo 3.6: Instalar Certbot (para SSL/HTTPS)**

```bash
# Instalar Certbot e plugin do Nginx
sudo apt install -y certbot python3-certbot-nginx

# Verificar instalação
certbot --version  # Deve mostrar versão instalada
```

---

## 📂 **PARTE 4: CLONAR E CONFIGURAR O PROJETO**

### **Passo 4.1: Criar Diretório e Clonar Repositório**

```bash
# Criar diretório para aplicações
sudo mkdir -p /var/www

# Dar permissão ao usuário deploy
sudo chown deploy:deploy /var/www

# Navegar para o diretório
cd /var/www

# Clonar repositório (substitua pela URL do seu repo)
git clone https://github.com/leonardoseibt/BuildingReports.git

# Entrar no diretório
cd BuildingReports

# Listar arquivos para confirmar
ls -la
```

### **Passo 4.2: Configurar Variáveis de Ambiente**

```bash
# Copiar exemplo de .env
cp .env.example .env

# Editar .env
nano .env
```

**Configuração do `.env` para produção com jsreport:**

```bash
# ==========================================
# AMBIENTE
# ==========================================
NODE_ENV=production
PORT=5000

# ==========================================
# DATABASE (NEON)
# ==========================================
# IMPORTANTE: Use a connection string com "-pooler" para melhor performance
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.neon.tech/buildingreports?sslmode=require

# ==========================================
# SEGURANÇA
# ==========================================
# GERAR SESSION_SECRET FORTE:
# No terminal, execute: openssl rand -base64 64
# Cole o resultado aqui:
SESSION_SECRET=COLE_AQUI_O_SECRET_GERADO

# Cookies seguros em produção
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=strict
SESSION_MAX_AGE=86400000

# ==========================================
# CORS
# ==========================================
CORS_ORIGIN=https://pdereports.com.br
CORS_ALLOW_LOCALHOST=false

# ==========================================
# JSREPORT CONFIGURAÇÃO
# ==========================================
# jsreport usa Chrome headless automaticamente
# Não precisa de configurações adicionais
# O Chrome será detectado em /usr/bin/google-chrome-stable

# ==========================================
# LOGS
# ==========================================
LOG_LEVEL=warn
```

**Como obter a CONNECTION STRING do Neon:**

1. Acesse: https://console.neon.tech
2. Selecione seu projeto
3. Clique em **"Connection Details"**
4. Copie a string que termina com `-pooler.neon.tech`
5. Exemplo: `postgresql://user:pass@ep-aged-dream-12345-pooler.neon.tech/buildingreports?sslmode=require`

**Como gerar SESSION_SECRET forte:**

```bash
# No terminal do servidor, execute:
openssl rand -base64 64

# Copie o resultado e cole no .env
```

**Salvar e sair do nano:**
- Pressione `Ctrl + X`
- Digite `Y` (Yes)
- Pressione `Enter`

### **Passo 4.3: Instalar Dependências e Fazer Build**

```bash
# Instalar dependências do projeto
npm install

# Isso pode levar 2-5 minutos
# jsreport será instalado automaticamente

# Verificar se há erros
# Se tudo estiver OK, prossiga

# Fazer build do frontend (React)
npm run build

# Isso criará a pasta 'dist' com os arquivos estáticos
# Pode levar 1-2 minutos
```

### **Passo 4.4: Executar Migrações do Banco de Dados**

```bash
# Verificar conexão com Neon
# (assumindo que você tem um script de teste)

# Se tiver migrations SQL pendentes, execute-as
# Exemplo:
# npm run db:migrate
```

---

## 🌐 **PARTE 5: CONFIGURAR NGINX E DOMÍNIO**

### **Passo 5.1: Configurar Arquivo do Nginx**

```bash
# Criar arquivo de configuração do site
sudo nano /etc/nginx/sites-available/pdereports
```

**Cole a seguinte configuração:**

```nginx
server {
    listen 80;
    server_name pdereports.com.br www.pdereports.com.br;

    # Limite de tamanho de upload (para PDFs gerados)
    client_max_body_size 50M;

    # Logs
    access_log /var/log/nginx/pdereports-access.log;
    error_log /var/log/nginx/pdereports-error.log;

    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # Headers necessários
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts para jsreport (geração de PDF pode demorar)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        proxy_cache_bypass $http_upgrade;
    }
    
    # Cache de assets estáticos (JS, CSS, imagens)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:5000;
        proxy_cache_valid 200 1d;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Salvar e sair:** `Ctrl + X` → `Y` → `Enter`

### **Passo 5.2: Habilitar Site e Testar Configuração**

```bash
# Criar link simbólico para habilitar o site
sudo ln -s /etc/nginx/sites-available/pdereports /etc/nginx/sites-enabled/

# Testar configuração do Nginx
sudo nginx -t

# Deve aparecer:
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Recarregar Nginx
sudo systemctl reload nginx

# Verificar status
sudo systemctl status nginx
# Deve mostrar "active (running)"
```

---

## 🔗 **PARTE 6: CONFIGURAR DNS NO REGISTRO.BR**

### **Passo 6.1: Acessar Painel do Registro.br**

1. Acesse: https://registro.br
2. Faça login com seu CPF e senha
3. Clique em **"Meus Domínios"**
4. Selecione **pdereports.com.br**

### **Passo 6.2: Editar Zona DNS**

1. Clique em **"Editar Zona"** ou **"DNS"**
2. Você verá uma lista de registros DNS

### **Passo 6.3: Adicionar/Editar Registros A**

**Registro 1: Domínio raiz (pdereports.com.br)**

```
Tipo: A
Nome: @ (ou deixe em branco)
Dados: 143.198.123.45 (IP do seu Droplet)
TTL: 3600
```

**Registro 2: Subdomínio www (www.pdereports.com.br)**

```
Tipo: A
Nome: www
Dados: 143.198.123.45 (IP do seu Droplet)
TTL: 3600
```

### **Passo 6.4: Salvar e Aguardar Propagação**

1. Clique em **"Salvar"** ou **"Aplicar"**
2. **Aguarde propagação DNS**: 15 minutos a 48 horas (geralmente < 2 horas)

### **Passo 6.5: Testar Propagação**

**No seu computador Windows (PowerShell):**

```powershell
# Testar domínio raiz
nslookup pdereports.com.br

# Deve retornar:
# Address: 143.198.123.45

# Testar subdomínio www
nslookup www.pdereports.com.br

# Deve retornar:
# Address: 143.198.123.45
```

---

## 🚀 **PARTE 7: INICIAR APLICAÇÃO COM PM2**

### **Passo 7.1: Criar Diretório de Logs**

```bash
# Voltar para o diretório do projeto
cd /var/www/BuildingReports

# Criar pasta de logs
mkdir -p logs

# Dar permissões
chmod 755 logs
```

### **Passo 7.2: Iniciar Aplicação**

```bash
# Iniciar aplicação com PM2
pm2 start npm --name "pdereports" -- start

# Deve aparecer:
# ┌─────┬──────────────┬─────────┬─────────┬─────────┬──────────┐
# │ id  │ name         │ mode    │ ↺       │ status  │ cpu      │
# ├─────┼──────────────┼─────────┼─────────┼─────────┼──────────┤
# │ 0   │ pdereports   │ fork    │ 0       │ online  │ 0%       │
# └─────┴──────────────┴─────────┴─────────┴─────────┴──────────┘
```

### **Passo 7.3: Verificar Logs**

```bash
# Ver logs em tempo real
pm2 logs pdereports

# Deve mostrar:
# > buildingreports@1.0.0 start
# > node dist/index.js
# ✅ Database connection pool initialized
# ✅ jsreport initialized
# 🚀 Server running at http://localhost:5000

# Pressione Ctrl+C para sair dos logs
```

### **Passo 7.4: Configurar PM2 para Iniciar no Boot**

```bash
# Salvar configuração atual do PM2
pm2 save

# Configurar PM2 para iniciar automaticamente no boot
pm2 startup

# Copie e execute o comando que aparecer, algo como:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

### **Passo 7.5: Comandos Úteis do PM2**

```bash
# Ver status das aplicações
pm2 status

# Ver logs
pm2 logs pdereports

# Reiniciar aplicação
pm2 restart pdereports

# Parar aplicação
pm2 stop pdereports

# Ver consumo de recursos
pm2 monit

# Informações detalhadas
pm2 info pdereports
```

---

## 🔒 **PARTE 8: CONFIGURAR SSL/HTTPS COM LET'S ENCRYPT**

### **Passo 8.1: Testar Acesso HTTP (Antes do SSL)**

**No navegador:**
1. Acesse: `http://pdereports.com.br`
2. Deve carregar a aplicação (sem HTTPS ainda)
3. Se não carregar, volte e revise:
   - DNS está propagado? (nslookup)
   - Nginx está rodando? (`sudo systemctl status nginx`)
   - Aplicação está online? (`pm2 status`)
   - Firewall permite porta 80? (`sudo ufw status`)

### **Passo 8.2: Configurar Firewall**

```bash
# Permitir SSH (porta 22)
sudo ufw allow 22/tcp

# Permitir HTTP (porta 80)
sudo ufw allow 80/tcp

# Permitir HTTPS (porta 443)
sudo ufw allow 443/tcp

# Habilitar firewall
sudo ufw enable

# Confirme com 'y'

# Verificar regras
sudo ufw status

# Deve mostrar:
# Status: active
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
```

### **Passo 8.3: Obter Certificado SSL**

```bash
# Executar Certbot com plugin do Nginx
sudo certbot --nginx -d pdereports.com.br -d www.pdereports.com.br

# Responda as perguntas:
# 1. Email: Digite seu email (para notificações de renovação)
# 2. Terms of Service: Digite 'Y' (aceitar)
# 3. Share email with EFF: Digite 'N' (não compartilhar) ou 'Y' (compartilhar)
# 4. Redirect HTTP to HTTPS: Digite '2' (redirecionar - recomendado)
```

**Certbot irá:**
- ✅ Obter certificado SSL gratuito
- ✅ Configurar Nginx automaticamente
- ✅ Configurar redirecionamento HTTP → HTTPS
- ✅ Agendar renovação automática (cronjob)

### **Passo 8.4: Testar HTTPS**

**No navegador:**
1. Acesse: `https://pdereports.com.br`
2. Deve aparecer **cadeado verde** na barra de endereço
3. Certificado válido emitido por "Let's Encrypt"

**Testar redirecionamento:**
- Acesse: `http://pdereports.com.br` (sem S)
- Deve redirecionar automaticamente para `https://pdereports.com.br`

---

## ✅ **PARTE 9: TESTES FINAIS E VERIFICAÇÕES**

### **Checklist de Verificação:**

```bash
# 1. Verificar Node.js
node --version  # v18.x.x

# 2. Verificar Chrome (usado pelo jsreport)
google-chrome --version  # Google Chrome xxx.x.xxxx.xxx

# 3. Verificar Nginx
sudo systemctl status nginx  # active (running)

# 4. Verificar PM2
pm2 status  # pdereports → online

# 5. Verificar SSL
curl -I https://pdereports.com.br | grep "HTTP/2 200"  # Deve retornar HTTP/2 200

# 6. Verificar logs
pm2 logs pdereports --lines 20  # Ver últimas 20 linhas

# 7. Verificar jsreport nos logs
# Deve aparecer: "✅ jsreport initialized"
```

### **Testes no Navegador:**

1. **Login:**
   - Acesse: https://pdereports.com.br
   - Faça login com usuário admin

2. **Criar Edificação:**
   - Teste criar uma nova edificação
   - Verifique se salva no banco Neon

3. **Gerar PDF (jsreport):**
   - Crie um relatório
   - Clique em "Gerar PDF (jsreport)"
   - PDF deve ser gerado (pode demorar 10-30 segundos na primeira vez)
   - Verifique se o PDF foi gerado corretamente
   - Teste download do PDF

4. **Performance:**
   - Navegue pelas páginas
   - Deve carregar rápido (< 1 segundo)

---

## 🔧 **PARTE 10: MANUTENÇÃO E MONITORAMENTO**

### **Comandos Úteis do Dia-a-Dia:**

```bash
# Conectar ao servidor
ssh deploy@143.198.123.45

# Ver status da aplicação
pm2 status

# Ver logs em tempo real
pm2 logs pdereports

# Ver logs específicos do jsreport
pm2 logs pdereports | grep jsreport

# Reiniciar aplicação (após mudanças)
cd /var/www/BuildingReports
git pull origin main
npm install
npm run build
pm2 restart pdereports

# Ver uso de recursos
pm2 monit

# Ver consumo do servidor
htop  # Instalar com: sudo apt install htop

# Ver espaço em disco
df -h

# Ver memória RAM
free -h
```

### **Monitoramento de jsreport:**

```bash
# Ver logs de geração de PDF
pm2 logs pdereports --lines 50 | grep -i pdf

# Verificar performance do jsreport
# (jsreport usa menos recursos que Puppeteer)
pm2 monit  # Ver uso de CPU e RAM
```

### **Solução de Problemas jsreport:**

```bash
# Se PDFs não gerarem, verificar:

# 1. Chrome está instalado?
google-chrome --version

# 2. Dependências do Chrome estão instaladas?
dpkg -l | grep -E "libnss3|libatk-bridge"

# 3. Logs do jsreport
pm2 logs pdereports | grep -i "jsreport\|chrome"

# 4. Testar jsreport manualmente
cd /var/www/BuildingReports
node -e "const jsreport = require('jsreport'); jsreport().init().then(() => console.log('jsreport OK'))"
```

---

## 📊 **COMPARAÇÃO: jsreport vs Puppeteer**

### **Vantagens do jsreport:**
- ✅ **Menor consumo de memória** (~200 MB vs ~500 MB do Puppeteer)
- ✅ **Mais fácil de configurar** (configuração automática)
- ✅ **Templates reutilizáveis** (mais flexível)
- ✅ **Menos dependências** (gerencia Chrome internamente)
- ✅ **Melhor para relatórios complexos** (tabelas, gráficos)

### **Desvantagens do jsreport:**
- ⚠️ **Primeira geração mais lenta** (inicialização do Chrome)
- ⚠️ **Menos controle granular** sobre o Chrome

### **Requisitos de Sistema:**

**jsreport:**
```
RAM mínima: 1 GB (recomendado 2 GB)
CPU: 1 vCPU suficiente
Storage: 5 GB
```

**Puppeteer:**
```
RAM mínima: 2 GB (recomendado 4 GB)
CPU: 1 vCPU (2 vCPUs recomendado)
Storage: 5 GB
```

---

## 🎯 **RESUMO - jsreport vs Puppeteer**

| Aspecto | jsreport | Puppeteer |
|---------|----------|-----------|
| **RAM** | 1-2 GB | 2-4 GB |
| **Setup** | Mais simples | Mais complexo |
| **Performance** | Boa | Muito boa |
| **Flexibilidade** | Templates | Programático |
| **Manutenção** | Baixa | Média |
| **Custo** | $18/mês (2GB) | $18-36/mês (2-4GB) |

---

## 🎉 **CONCLUSÃO**

### **✅ Você configurou com sucesso:**

1. ✅ Servidor DigitalOcean com Ubuntu 22.04
2. ✅ Node.js 18 + npm
3. ✅ Chrome para jsreport
4. ✅ Nginx como reverse proxy
5. ✅ PM2 para gerenciar aplicação
6. ✅ Banco de dados Neon PostgreSQL
7. ✅ DNS configurado (pdereports.com.br)
8. ✅ SSL/HTTPS com Let's Encrypt
9. ✅ jsreport configurado e funcional
10. ✅ Firewall configurado

### **🌐 Sua aplicação está acessível em:**

- ✅ https://pdereports.com.br
- ✅ https://www.pdereports.com.br
- ✅ Com certificado SSL válido
- ✅ Geração de PDF via jsreport funcionando

### **📈 Próximos Passos:**

1. ✅ Testar geração de múltiplos PDFs
2. ✅ Configurar alertas de monitoramento (UptimeRobot)
3. ✅ Implementar backup automático de logs
4. ✅ Otimizar templates jsreport

---

**🎊 Parabéns! Seu sistema BuildingReports está em produção com jsreport!** 🎊

**Nota:** Se futuramente quiser usar Puppeteer, o Chrome já está instalado e você pode habilitar o gerador Puppeteer sem reinstalar nada.
