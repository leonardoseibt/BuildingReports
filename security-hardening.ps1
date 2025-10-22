#!/usr/bin/env pwsh
# =========================================
# 🔒 PDEReports - Security Hardening Script
# =========================================
# Este script automatiza as correções de segurança identificadas na auditoria
# Execute com: pwsh security-hardening.ps1

Write-Host "🔒 PDEReports - Security Hardening Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# =========================================
# 1. Verificar NODE_ENV
# =========================================
Write-Host "📋 [1/9] Verificando NODE_ENV..." -ForegroundColor Yellow

if ($env:NODE_ENV -ne "production") {
    Write-Host "   ⚠️  NODE_ENV não é 'production' (atual: $($env:NODE_ENV))" -ForegroundColor Yellow
    Write-Host "   💡 Para produção, defina: `$env:NODE_ENV='production'" -ForegroundColor Gray
    $warnings++
} else {
    Write-Host "   ✅ NODE_ENV=production" -ForegroundColor Green
}

# =========================================
# 2. Verificar SESSION_SECRET
# =========================================
Write-Host ""
Write-Host "📋 [2/9] Verificando SESSION_SECRET..." -ForegroundColor Yellow

if (-not $env:SESSION_SECRET) {
    Write-Host "   ❌ SESSION_SECRET não definido!" -ForegroundColor Red
    Write-Host "   💡 Gere um com: openssl rand -base64 64" -ForegroundColor Gray
    $errors++
} elseif ($env:SESSION_SECRET -eq "dev-super-secret-change-me") {
    Write-Host "   ❌ SESSION_SECRET ainda é o valor de exemplo!" -ForegroundColor Red
    Write-Host "   💡 NUNCA use o valor padrão em produção!" -ForegroundColor Gray
    $errors++
} elseif ($env:SESSION_SECRET.Length -lt 32) {
    Write-Host "   ❌ SESSION_SECRET muito curto ($($env:SESSION_SECRET.Length) chars)" -ForegroundColor Red
    Write-Host "   💡 Mínimo recomendado: 32 caracteres" -ForegroundColor Gray
    $errors++
} else {
    Write-Host "   ✅ SESSION_SECRET configurado ($($env:SESSION_SECRET.Length) chars)" -ForegroundColor Green
}

# =========================================
# 3. Verificar DATABASE_URL
# =========================================
Write-Host ""
Write-Host "📋 [3/9] Verificando DATABASE_URL..." -ForegroundColor Yellow

if (-not $env:DATABASE_URL) {
    Write-Host "   ❌ DATABASE_URL não definido!" -ForegroundColor Red
    $errors++
} elseif ($env:DATABASE_URL -match "sslmode=require") {
    Write-Host "   ✅ DATABASE_URL configurado com SSL" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  DATABASE_URL sem sslmode=require" -ForegroundColor Yellow
    Write-Host "   💡 Adicione: ?sslmode=require ao final da URL" -ForegroundColor Gray
    $warnings++
}

# =========================================
# 4. Verificar CORS
# =========================================
Write-Host ""
Write-Host "📋 [4/9] Verificando CORS..." -ForegroundColor Yellow

if (-not $env:CORS_ORIGIN) {
    Write-Host "   ⚠️  CORS_ORIGIN não definido" -ForegroundColor Yellow
    Write-Host "   💡 Defina o domínio exato: CORS_ORIGIN=https://seudominio.com" -ForegroundColor Gray
    $warnings++
} elseif ($env:CORS_ORIGIN -eq "*") {
    Write-Host "   ❌ CORS_ORIGIN permite qualquer origem!" -ForegroundColor Red
    $errors++
} else {
    Write-Host "   ✅ CORS_ORIGIN configurado: $($env:CORS_ORIGIN)" -ForegroundColor Green
}

if ($env:CORS_ALLOW_LOCALHOST -eq "true" -and $env:NODE_ENV -eq "production") {
    Write-Host "   ❌ CORS_ALLOW_LOCALHOST=true em produção!" -ForegroundColor Red
    $errors++
}

# =========================================
# 5. Verificar arquivos de segurança criados
# =========================================
Write-Host ""
Write-Host "📋 [5/9] Verificando arquivos de segurança..." -ForegroundColor Yellow

$securityFiles = @(
    "server/rate-limiters.ts",
    "server/validators.ts",
    "server/logger.ts",
    "migrations/20251023_add_performance_indexes.sql"
)

foreach ($file in $securityFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file não encontrado!" -ForegroundColor Red
        $errors++
    }
}

# =========================================
# 6. Verificar dependências necessárias
# =========================================
Write-Host ""
Write-Host "📋 [6/9] Verificando dependências..." -ForegroundColor Yellow

if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    $requiredDeps = @{
        "winston" = "logging"
        "zod" = "validação"
        "express-rate-limit" = "rate limiting"
        "helmet" = "security headers"
        "csurf" = "CSRF protection"
    }
    
    foreach ($dep in $requiredDeps.Keys) {
        $purpose = $requiredDeps[$dep]
        if ($packageJson.dependencies.$dep -or $packageJson.devDependencies.$dep) {
            Write-Host "   ✅ $dep ($purpose)" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $dep não instalado ($purpose)" -ForegroundColor Red
            Write-Host "      💡 Execute: npm install $dep" -ForegroundColor Gray
            $errors++
        }
    }
} else {
    Write-Host "   ❌ package.json não encontrado!" -ForegroundColor Red
    $errors++
}

# =========================================
# 7. Verificar diretório de logs
# =========================================
Write-Host ""
Write-Host "📋 [7/9] Verificando diretório de logs..." -ForegroundColor Yellow

if (Test-Path "logs") {
    Write-Host "   ✅ Diretório logs/ existe" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Diretório logs/ não existe" -ForegroundColor Yellow
    Write-Host "      💡 Criando diretório..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Host "      ✅ Criado!" -ForegroundColor Green
}

# Verificar .gitignore
if (Test-Path ".gitignore") {
    $gitignore = Get-Content ".gitignore"
    if ($gitignore -match "logs/") {
        Write-Host "   ✅ logs/ no .gitignore" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  logs/ não está no .gitignore" -ForegroundColor Yellow
        Write-Host "      💡 Adicionando..." -ForegroundColor Gray
        Add-Content ".gitignore" "`nlogs/"
        Write-Host "      ✅ Adicionado!" -ForegroundColor Green
    }
}

# =========================================
# 8. Verificar migrações executadas
# =========================================
Write-Host ""
Write-Host "📋 [8/9] Verificando migrações..." -ForegroundColor Yellow

if ($env:DATABASE_URL) {
    Write-Host "   💡 Conectando ao banco de dados..." -ForegroundColor Gray
    
    # Tentar verificar se índices existem
    $query = @"
SELECT 
    schemaname, 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_buildings_%'
LIMIT 1;
"@
    
    try {
        $result = psql $env:DATABASE_URL -t -c $query 2>&1
        if ($result -match "idx_buildings_") {
            Write-Host "   ✅ Índices de performance já aplicados" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Índices de performance não encontrados" -ForegroundColor Yellow
            Write-Host "      💡 Execute: npm run db:migrate -- migrations/20251023_add_performance_indexes.sql" -ForegroundColor Gray
            $warnings++
        }
    } catch {
        Write-Host "   ⚠️  Não foi possível verificar índices (psql não disponível ou erro de conexão)" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ⚠️  DATABASE_URL não definido, não é possível verificar índices" -ForegroundColor Yellow
    $warnings++
}

# =========================================
# 9. Gerar relatório de segurança
# =========================================
Write-Host ""
Write-Host "📋 [9/9] Gerando relatório..." -ForegroundColor Yellow

$report = @"

╔════════════════════════════════════════╗
║   RELATÓRIO DE HARDENING FINALIZADO    ║
╚════════════════════════════════════════╝

📊 RESUMO:
   ❌ Erros Críticos: $errors
   ⚠️  Warnings:       $warnings

"@

Write-Host $report -ForegroundColor Cyan

if ($errors -gt 0) {
    Write-Host "🚨 AÇÃO REQUERIDA:" -ForegroundColor Red
    Write-Host "   Corrija os $errors erro(s) crítico(s) antes de publicar!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📖 Consulte:" -ForegroundColor Yellow
    Write-Host "   - SECURITY_AUDIT_REPORT.md" -ForegroundColor Gray
    Write-Host "   - SECURITY_INTEGRATION_GUIDE.md" -ForegroundColor Gray
    Write-Host ""
    exit 1
} elseif ($warnings -gt 0) {
    Write-Host "⚠️  ATENÇÃO:" -ForegroundColor Yellow
    Write-Host "   $warnings warning(s) encontrado(s)" -ForegroundColor Yellow
    Write-Host "   Revise as recomendações antes de publicar" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📖 Consulte:" -ForegroundColor Yellow
    Write-Host "   - SECURITY_AUDIT_REPORT.md" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "✅ TUDO OK!" -ForegroundColor Green
    Write-Host "   Sistema pronto para produção" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Próximos passos:" -ForegroundColor Cyan
    Write-Host "   1. Integrar rate limiters em server/routes.ts" -ForegroundColor Gray
    Write-Host "   2. Adicionar validação de SESSION_SECRET em server/auth.ts" -ForegroundColor Gray
    Write-Host "   3. Executar migração de índices" -ForegroundColor Gray
    Write-Host "   4. Configurar Nginx com SSL" -ForegroundColor Gray
    Write-Host "   5. Setup PM2 para clustering" -ForegroundColor Gray
    Write-Host ""
    exit 0
}
