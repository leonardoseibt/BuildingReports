# Script PowerShell para instalar Metabase no Windows
Write-Host "🚀 Instalando Metabase para BuildingReports..." -ForegroundColor Green

# Verificar se Docker está instalado
try {
    docker --version | Out-Null
    Write-Host "✅ Docker encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não está instalado. Por favor, instale o Docker Desktop primeiro." -ForegroundColor Red
    Write-Host "Download: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Verificar se Docker Compose está disponível
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose não está disponível." -ForegroundColor Red
    exit 1
}

# Criar diretório para dados do Metabase
if (!(Test-Path "metabase-data")) {
    New-Item -ItemType Directory -Path "metabase-data"
    Write-Host "📁 Diretório metabase-data criado" -ForegroundColor Blue
}

Write-Host "📦 Baixando e iniciando Metabase..." -ForegroundColor Blue

# Iniciar Metabase
docker-compose -f docker-compose.metabase.yml up -d

Write-Host "⏳ Aguardando Metabase inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "✅ Metabase instalado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Abra http://localhost:3000 no navegador"
Write-Host "2. Configure uma conta administrativa"
Write-Host "3. Conecte ao seu banco PostgreSQL do BuildingReports:"
Write-Host "   - Host: host.docker.internal"
Write-Host "   - Port: 5432 (ou a porta do seu PostgreSQL)"
Write-Host "   - Database: seu_database_name"
Write-Host "   - Username: seu_username"
Write-Host "   - Password: sua_password"
Write-Host ""
Write-Host "🔧 Para parar o Metabase:" -ForegroundColor Magenta
Write-Host "   docker-compose -f docker-compose.metabase.yml down"
Write-Host ""
Write-Host "🔧 Para ver logs:" -ForegroundColor Magenta
Write-Host "   docker-compose -f docker-compose.metabase.yml logs -f"