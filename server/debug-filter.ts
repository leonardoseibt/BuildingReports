import { storage } from './storage';

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

export async function debugParameterFiltering(buildingId: number) {
  const building = await storage.getBuilding(buildingId);
  
  if (!building) {
    return { error: 'Building not found' };
  }

  const attributeDefs = await storage.listAttributeDefinitions({});
  const parameters = await storage.listParameters();

  const zonaBioclimatica = attributeDefs.find(a => 
    a.friendlyName?.toLowerCase().includes('zona') && 
    a.friendlyName?.toLowerCase().includes('bioclim')
  );

  if (!zonaBioclimatica) {
    return { error: 'Zona bioclimática attribute not found' };
  }

  // Testar getAttributeValue
  const extractedValue = getAttributeValue(building, zonaBioclimatica);

  // Filtrar parâmetros para análise 131
  const paramsForAnalysis131 = parameters.filter(p => p.analysisId === 131 && p.isActive !== false);
  
  // Filtrar por zona bioclimática
  const paramsWithZone = paramsForAnalysis131.filter(p => p.attributeId === zonaBioclimatica.id);

  const debugInfo = {
    building: {
      id: building.id,
      name: building.name,
      bioclimaticZoneId: building.bioclimaticZoneId,
      hasProperty_bioclimatic_zone_id: 'bioclimatic_zone_id' in building,
      hasProperty_bioclimaticZoneId: 'bioclimaticZoneId' in building,
      allKeys: Object.keys(building)
    },
    attributeDefinition: {
      id: zonaBioclimatica.id,
      friendlyName: zonaBioclimatica.friendlyName,
      sourceTable: zonaBioclimatica.sourceTable,
      sourceColumn: zonaBioclimatica.sourceColumn,
      dataKind: zonaBioclimatica.dataKind
    },
    extraction: {
      extractedValue,
      expectedValue: building.bioclimaticZoneId,
      matches: extractedValue === building.bioclimaticZoneId,
      snakeToCamelMap_lookup: snakeToCamelMap[zonaBioclimatica.sourceColumn]
    },
    parameters: {
      totalForAnalysis131: paramsForAnalysis131.length,
      withZoneFilter: paramsWithZone.length,
      matchingZone1: paramsWithZone.filter(p => {
        const value = getAttributeValue(building, zonaBioclimatica);
        return String(p.attributeValueId) === String(value);
      }).map(p => ({
        id: p.id,
        label: p.label.substring(0, 60),
        attributeValueId: p.attributeValueId,
        extractedValue,
        matches: String(p.attributeValueId) === String(extractedValue)
      }))
    }
  };

  return debugInfo;
}
