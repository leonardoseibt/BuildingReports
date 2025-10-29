import { storage } from '../../server/storage';

// Copiar as funções do report-generator (versão CORRIGIDA)
const technicalFields = [
  { key: 'totalArea', label: 'Área Total', unit: 'm2' },
  { key: 'buildingHeight', label: 'Altura', unit: 'm' },
  { key: 'basementDepth', label: 'Profundidade de Subsolo', unit: 'm' },
  { key: 'floors', label: 'Pavimentos', unit: '' },
  { key: 'units', label: 'Unidades', unit: '' }
];

const technicalFieldMap = technicalFields.reduce<Record<string, string>>((acc, field) => {
  const snake = field.key.replace(/([A-Z])/g, '_$1').toLowerCase();
  acc[snake] = field.key;
  return acc;
}, {});

const snakeToCamelOverrides: Record<string, string> = {
  typology_id: 'typologyId',
  noise_class_id: 'noiseClassId',
  aggressiveness_class_id: 'aggressivenessClassId',
  bioclimatic_zone_id: 'bioclimaticZoneId',
  isopleth_id: 'isoplethId'
};

const snakeToCamelMap: Record<string, string> = { ...technicalFieldMap, ...snakeToCamelOverrides };

function getAttributeValue(sourceData: any, attribute: any): any {
  if (!sourceData || !attribute) return null;

  // Para buildings, tentar primeiro camelCase (como vem do Drizzle ORM)
  if (attribute.sourceTable === 'buildings') {
    const camel = snakeToCamelMap[attribute.sourceColumn];
    if (camel && sourceData[camel] !== undefined && sourceData[camel] !== null) {
      return sourceData[camel];
    }
  }

  // Fallback: tentar snake_case direto (para compatibilidade com queries SQL raw)
  if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
    return sourceData[attribute.sourceColumn];
  }

  return null;
}

async function main() {
  console.log('\n========================================');
  console.log('TESTE FINAL - CORREÇÃO DA FILTRAGEM');
  console.log('========================================\n');

  //  Buscar edificação via storage
  const building = await storage.getBuilding(2); // Residencial Vista Verde
  
  if (!building) {
    console.log('❌ Edificação não encontrada');
    process.exit(1);
  }

  console.log('Edificação:', building.name);
  console.log('Zona Bioclimática ID:', building.bioclimaticZoneId);

  // 2. Buscar attribute definition
  const attributeDefs = await storage.listAttributeDefinitions({});
  const zonaBioclimatica = attributeDefs.find(a => 
    a.friendlyName?.toLowerCase().includes('zona') && 
    a.friendlyName?.toLowerCase().includes('bioclim')
  );

  if (!zonaBioclimatica) {
    console.log('❌ Atributo não encontrado');
    process.exit(1);
  }

  console.log('\nAtributo:', zonaBioclimatica.friendlyName);
  console.log('Source Column:', zonaBioclimatica.sourceColumn);

  // 3. Testar getAttributeValue
  const value = getAttributeValue(building, zonaBioclimatica);
  
  console.log('\n=== RESULTADO DO getAttributeValue ===');
  console.log('Valor extraído:', value);
  console.log('Esperado:', building.bioclimaticZoneId);
  
  if (value === building.bioclimaticZoneId) {
    console.log('\n✅ SUCESSO! A função agora retorna o valor correto!');
  } else {
    console.log('\n❌ FALHA! O valor ainda não está correto');
  }

  // 4. Buscar parâmetros
  const parameters = await storage.listParameters();
  const paramsForZone1 = parameters.filter(p => 
    p.attributeId === zonaBioclimatica.id && p.attributeValueId === 1
  );

  console.log(`\n=== PARÂMETROS PARA ZONA 1 ===`);
  console.log(`Total encontrado: ${paramsForZone1.length}`);
  
  // 5. Simular a filtragem
  let matchCount = 0;
  for (const param of paramsForZone1.slice(0, 5)) {
    const paramValue = getAttributeValue(building, zonaBioclimatica);
    const shouldMatch = paramValue !== null && String(param.attributeValueId) === String(paramValue);
    
    if (shouldMatch) {
      matchCount++;
      console.log(`✅ ${param.label.substring(0, 60)}`);
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Parâmetros que deveriam aparecer: ${paramsForZone1.length}`);
  console.log(`Parâmetros que fariam match: ${matchCount}`);
  
  if (matchCount === paramsForZone1.length) {
    console.log('\n🎉 CORREÇÃO VALIDADA! Todos os parâmetros fazem match!');
  } else {
    console.log('\n⚠️ Ainda há problemas na filtragem');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
