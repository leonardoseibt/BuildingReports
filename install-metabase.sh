#!/bin/bash

# Script para instalar e configurar Metabase
echo "🚀 Instalando Metabase para BuildingReports..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker Desktop primeiro."
    echo "Download: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Verificar se Docker Compose está disponível
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está disponível."
    exit 1
fi

# Criar diretório para dados do Metabase
mkdir -p metabase-data

echo "📦 Baixando e iniciando Metabase..."

# Iniciar Metabase
docker-compose -f docker-compose.metabase.yml up -d

echo "⏳ Aguardando Metabase inicializar..."
sleep 30

echo "✅ Metabase instalado com sucesso!"
echo ""
echo "🌐 Acesse: http://localhost:3000"
echo ""
echo "📊 Próximos passos:"
echo "1. Abra http://localhost:3000 no navegador"
echo "2. Configure uma conta administrativa"
echo "3. Conecte ao seu banco PostgreSQL do BuildingReports:"
echo "   - Host: host.docker.internal (Windows/Mac) ou IP da máquina"
echo "   - Port: 5432 (ou a porta do seu PostgreSQL)"
echo "   - Database: seu_database_name"
echo "   - Username: seu_username"
echo "   - Password: sua_password"
echo ""
echo "🔧 Para parar o Metabase:"
echo "   docker-compose -f docker-compose.metabase.yml down"
echo ""
echo "🔧 Para ver logs:"
echo "   docker-compose -f docker-compose.metabase.yml logs -f"