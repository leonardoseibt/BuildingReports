# ⚡ Comandos Rápidos de Deploy

## 🚀 Deploy em 1 Comando

### **Do Windows (PowerShell):**

```powershell
# Deploy simples (mais comum)
ssh deploy@143.198.123.45 "cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports && pm2 status"
```

### **Criar Alias no PowerShell (Recomendado):**

```powershell
# Adicionar ao perfil do PowerShell
notepad $PROFILE

# Cole isso no arquivo:
function Deploy-PDEReports {
    ssh deploy@143.198.123.45 "cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports && pm2 logs pdereports --lines 10 --nostream"
}

# Salve e recarregue
. $PROFILE

# Agora você pode simplesmente:
Deploy-PDEReports
```

---

## 📋 Workflow Completo (Linha por Linha)

```powershell
# 1. No seu computador - Commitar mudanças
git add .
git commit -m "feat: sua descrição aqui"
git push origin main

# 2. Deploy no servidor (escolha um):

# Opção A: Tudo em 1 linha
ssh deploy@143.198.123.45 "cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports"

# Opção B: Passo a passo (mais controle)
ssh deploy@143.198.123.45
cd /var/www/BuildingReports
git pull
npm run build
pm2 restart pdereports
pm2 logs pdereports --lines 20
exit

# 3. Testar no navegador
# https://pdereports.com.br
```

---

## 🔧 Comandos Úteis

### **Status:**
```powershell
ssh deploy@143.198.123.45 "pm2 status"
```

### **Ver Logs:**
```powershell
ssh deploy@143.198.123.45 "pm2 logs pdereports --lines 50"
```

### **Reiniciar:**
```powershell
ssh deploy@143.198.123.45 "pm2 restart pdereports"
```

### **Backup:**
```powershell
ssh deploy@143.198.123.45 "cd /var/www && tar -czf ~/backup_$(date +%Y%m%d).tar.gz BuildingReports/"
```

---

## ⚡ Super Rápido (Copy & Paste)

```powershell
# LOCAL
git add . && git commit -m "update" && git push

# SERVIDOR (Cole tudo de uma vez)
ssh deploy@143.198.123.45 "cd /var/www/BuildingReports && git pull && npm run build && pm2 restart pdereports && echo '✅ Deploy concluído!' && pm2 status"
```

**Tempo total: ~2 minutos!** 🚀
