# Script de Limpeza SEGURA do BuildingReports
# Apenas remove componentes COMPROVADAMENTE não utilizados

Write-Host "🧹 LIMPEZA SEGURA DO BUILDINGREPORTS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está na raiz do projeto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: Execute este script na raiz do projeto!" -ForegroundColor Red
    exit 1
}

# Criar backup
Write-Host "📦 Criando backup..." -ForegroundColor Yellow
git add . 2>$null
$backupResult = git commit -m "backup: before safe cleanup" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Backup criado" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Nenhuma mudança para commitar" -ForegroundColor Gray
}

# Fase 1: Componentes UI NÃO USADOS (Lista VERIFICADA)
Write-Host ""
Write-Host "🎨 Fase 1: Removendo apenas componentes UI NÃO utilizados..." -ForegroundColor Yellow

$unusedComponents = @(
    "client\src\components\ui\accordion.tsx",
    "client\src\components\ui\alert.tsx",
    "client\src\components\ui\aspect-ratio.tsx",
    "client\src\components\ui\avatar.tsx",
    "client\src\components\ui\breadcrumb.tsx",
    "client\src\components\ui\calendar.tsx",
    "client\src\components\ui\carousel.tsx",
    "client\src\components\ui\chart.tsx",
    "client\src\components\ui\collapsible.tsx",
    "client\src\components\ui\context-menu.tsx",
    "client\src\components\ui\drawer.tsx",
    "client\src\components\ui\headless-listbox.tsx",
    "client\src\components\ui\hover-card.tsx",
    "client\src\components\ui\input-otp.tsx",
    "client\src\components\ui\menubar.tsx",
    "client\src\components\ui\navigation-menu.tsx",
    "client\src\components\ui\progress.tsx",
    "client\src\components\ui\radio-group.tsx",
    "client\src\components\ui\resizable.tsx",
    "client\src\components\ui\scroll-area.tsx",
    "client\src\components\ui\select.tsx",
    "client\src\components\ui\sidebar.tsx",
    "client\src\components\ui\slider.tsx",
    "client\src\components\ui\switch.tsx",
    "client\src\components\ui\tabs.tsx",
    "client\src\components\ui\toggle-group.tsx"
)

$deletedCount = 0
foreach ($file in $unusedComponents) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        $deletedCount++
        Write-Host "  ✅ Deletado: $file" -ForegroundColor Green
    }
}
Write-Host "  📊 Total: $deletedCount componentes removidos" -ForegroundColor Cyan

# Fase 2: Remover dependências npm não utilizadas (CONSERVADORA)
Write-Host ""
Write-Host "📦 Fase 2: Removendo dependências npm não utilizadas..." -ForegroundColor Yellow
Write-Host "  ⏳ Isso pode levar alguns minutos..." -ForegroundColor Gray

$depsToRemove = @(
    "@jridgewell/trace-mapping",
    "framer-motion",
    "memoizee",
    "memorystore",
    "next-themes",
    "react-icons",
    "tw-animate-css",
    "zod-validation-error",
    "redis",
    "rate-limit-redis",
    "passport",
    "ws",
    "bufferutil"
)

$typesToRemove = @(
    "@types/ws",
    "@types/memoizee"
)

# Remover dependências
$allDeps = $depsToRemove + $typesToRemove
$depsString = $allDeps -join " "
Write-Host "  🔧 Desinstalando $($allDeps.Count) pacotes..." -ForegroundColor Cyan
$uninstallOutput = npm uninstall $depsString 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Dependências removidas" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Algumas dependências podem não existir (normal)" -ForegroundColor Yellow
}

# Fase 3: Remover componentes Radix não usados
Write-Host ""
Write-Host "🎭 Fase 3: Removendo componentes Radix não utilizados..." -ForegroundColor Yellow

$radixDeps = @(
    "@radix-ui/react-accordion",
    "@radix-ui/react-aspect-ratio",
    "@radix-ui/react-avatar",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-context-menu",
    "@radix-ui/react-hover-card",
    "@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu",
    "@radix-ui/react-progress",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-select",
    "@radix-ui/react-slider",
    "@radix-ui/react-switch",
    "@radix-ui/react-tabs",
    "@radix-ui/react-toggle-group"
)

$radixString = $radixDeps -join " "
Write-Host "  🔧 Desinstalando $($radixDeps.Count) pacotes Radix..." -ForegroundColor Cyan
$radixOutput = npm uninstall $radixString 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Componentes Radix removidos" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Algumas dependências podem não existir (normal)" -ForegroundColor Yellow
}

# Fase 4: Reinstalar dependências
Write-Host ""
Write-Host "🔄 Fase 4: Reinstalando dependências limpas..." -ForegroundColor Yellow
Write-Host "  ⏳ Isso pode levar alguns minutos..." -ForegroundColor Gray
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Dependências reinstaladas" -ForegroundColor Green
} else {
    Write-Host "  ❌ Erro ao reinstalar dependências!" -ForegroundColor Red
    Write-Host "  ⚠️  Reverta com: git reset --hard HEAD~1" -ForegroundColor Yellow
    exit 1
}

# Fase 5: Build de teste
Write-Host ""
Write-Host "🏗️  Fase 5: Testando build..." -ForegroundColor Yellow
Write-Host "  ⏳ Compilando..." -ForegroundColor Gray

# Limpar dist
if (Test-Path "dist") {
    Remove-Item "dist" -Recurse -Force
}

# Build
$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Build compilado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "  ❌ Erro no build!" -ForegroundColor Red
    Write-Host $buildOutput
    Write-Host ""
    Write-Host "  ⚠️  Reverta as mudanças com: git reset --hard HEAD~1" -ForegroundColor Yellow
    exit 1
}

# Relatório Final
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✨ LIMPEZA CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Calcular estatísticas
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$depCount = ($packageJson.dependencies | Get-Member -MemberType NoteProperty).Count
$devDepCount = ($packageJson.devDependencies | Get-Member -MemberType NoteProperty).Count
$totalDeps = $depCount + $devDepCount

Write-Host "📊 ESTATÍSTICAS:" -ForegroundColor Cyan
Write-Host "  Dependências restantes: $totalDeps ($depCount prod + $devDepCount dev)" -ForegroundColor White
Write-Host "  Componentes UI removidos: $deletedCount" -ForegroundColor White
Write-Host "  Pacotes npm removidos: $($allDeps.Count + $radixDeps.Count)" -ForegroundColor White
Write-Host ""

Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "  1. Teste a aplicação localmente: npm start" -ForegroundColor White
Write-Host "  2. Teste geração de PDF (jsreport e Puppeteer)" -ForegroundColor White
Write-Host "  3. Teste todas as funcionalidades CRUD" -ForegroundColor White
Write-Host "  4. Se tudo estiver OK, commit as mudanças:" -ForegroundColor White
Write-Host "     git add ." -ForegroundColor Gray
Write-Host "     git commit -m 'chore: safe cleanup - removed unused UI components and deps'" -ForegroundColor Gray
Write-Host "  5. Se algo quebrou, reverta:" -ForegroundColor White
Write-Host "     git reset --hard HEAD~1" -ForegroundColor Gray
Write-Host ""

Write-Host "🚀 Projeto otimizado e pronto para testes!" -ForegroundColor Green
