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

console.log('snakeToCamelMap:', snakeToCamelMap);
console.log('\nBuscar "bioclimatic_zone_id":', snakeToCamelMap['bioclimatic_zone_id']);

// Simular getAttributeValue
const building = {
  id: 2,
  bioclimaticZoneId: 1,
  bioclimatic_zone_id: undefined  // Não existe em camelCase
};

const attribute = {
  sourceColumn: 'bioclimatic_zone_id',
  sourceTable: 'buildings'
};

console.log('\n=== Simulação getAttributeValue ===');
console.log('1. Tentando building[attribute.sourceColumn]:', building[attribute.sourceColumn as keyof typeof building]);
console.log('2. attribute.sourceTable === "buildings":', attribute.sourceTable === 'buildings');
console.log('3. snakeToCamelMap[attribute.sourceColumn]:', snakeToCamelMap[attribute.sourceColumn]);
const camel = snakeToCamelMap[attribute.sourceColumn];
console.log('4. building[camel]:', camel ? building[camel as keyof typeof building] : 'N/A');
