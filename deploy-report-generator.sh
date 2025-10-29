#!/bin/bash
# Script para atualizar report-generator.ts em produção

echo "1. Copiando arquivo atualizado..."
cp /tmp/report-generator.ts /var/www/BuildingReports/server/jsreport/report-generator.ts

echo "2. Ajustando permissões..."
chown deploy:deploy /var/www/BuildingReports/server/jsreport/report-generator.ts
chmod 644 /var/www/BuildingReports/server/jsreport/report-generator.ts

echo "3. Limpando diretório temporário do jsreport..."
rm -rf /tmp/jsreport
mkdir -p /tmp/jsreport
chown -R deploy:deploy /tmp/jsreport
chmod -R 755 /tmp/jsreport

echo "4. Reiniciando PM2..."
pm2 restart pdereports

echo "5. Aguardando inicialização..."
sleep 3

echo "✅ Deploy concluído! Logs:"
pm2 logs pdereports --lines 20
