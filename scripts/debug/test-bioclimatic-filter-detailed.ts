import { db } from '../../server/db';
import { sql } from 'drizzle-orm';

// Simular as funções do report-generator.tsx
const snakeToCamelOverrides: Record<string, string> = {
  typology_id: 'typologyId',
  noise_class_id: 'noiseClassId',
  aggressiveness_class_id: 'aggressivenessClassId',
  bioclimatic_zone_id: 'bioclimaticZoneId',
  isopleth_id: 'isoplethId'
};

const technicalFieldMap: Record<string, string> = {
  total_area: 'totalArea',
  building_height: 'buildingHeight',
  basement_depth: 'basementDepth',
  floors: 'floors',
  units: 'units'
};

const snakeToCamelMap: Record<string, string> = { ...technicalFieldMap, ...snakeToCamelOverrides };

function getAttributeValue(sourceData: any, attribute: any): any {
  if (!sourceData || !attribute) return null;

  console.log('  [getAttributeValue] Trying sourceData[attribute.sourceColumn]');
  console.log('    attribute.sourceColumn:', attribute.sourceColumn);
  console.log('    sourceData[attribute.sourceColumn]:', sourceData[attribute.sourceColumn]);

  if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
    console.log('  ✓ Found via direct snake_case access');
    return sourceData[attribute.sourceColumn];
  }

  if (attribute.sourceTable === 'buildings') {
    const camel = snakeToCamelMap[attribute.sourceColumn];
    console.log('  [getAttributeValue] Trying camelCase conversion');
    console.log('    snakeToCamelMap[attribute.sourceColumn]:', camel);
    console.log('    sourceData[camel]:', camel ? sourceData[camel] : 'N/A');
    
    if (camel && sourceData[camel] !== undefined && sourceData[camel] !== null) {
      console.log('  ✓ Found via camelCase access:', sourceData[camel]);
      return sourceData[camel];
    }
  }
  
  console.log('  ✗ Not found - returning null');
  return null;
}

function checkAttributeMatch(
  parameter: any,
  attributeValueId: number | null,
  attribute: any,
  building: any
): boolean {
  console.log('\n--- Checking Attribute Match ---');
  console.log('Parameter ID:', parameter.id);
  console.log('Parameter Label:', parameter.label?.substring(0, 60));
  console.log('Parameter attributeValueId:', attributeValueId);
  console.log('Attribute Definition:', {
    id: attribute.id,
    friendlyName: attribute.friendlyName,
    sourceTable: attribute.sourceTable,
    sourceColumn: attribute.sourceColumn,
    dataKind: attribute.dataKind
  });

  // No attribute filter = always match
  if (!parameter.attribute_id) {
    console.log('✓ No attribute filter - MATCH');
    return true;
  }
  
  if (!attribute) {
    console.log('✓ No attribute definition - MATCH');
    return true;
  }

  // Get source data for this attribute
  let sourceData: any = null;
  if (attribute.sourceTable === 'buildings') {
    sourceData = building;
    console.log('Source data: building object');
  } else {
    console.log('⚠️ Source table is not buildings:', attribute.sourceTable);
    return true; // Para este teste, focamos em buildings
  }

  if (!sourceData) {
    console.log('✓ No source data - MATCH');
    return true;
  }

  let attributeValue = getAttributeValue(sourceData, attribute);
  console.log('Extracted attribute value:', attributeValue);
  console.log('Building bioclimaticZoneId:', building.bioclimatic_zone_id);

  // Handle null/undefined attribute values
  if (attributeValue === null || attributeValue === undefined) {
    console.log('✗ Attribute value is null/undefined - NO MATCH');
    if (attributeValueId !== null && attributeValueId !== undefined) {
      return false;
    }
    return true;
  }

  // Check specific value match
  if (attributeValueId !== null && attributeValueId !== undefined) {
    const match = String(attributeValueId) === String(attributeValue);
    console.log(`Comparison: String(${attributeValueId}) === String(${attributeValue}) = ${match}`);
    if (!match) {
      console.log('✗ Value does not match - NO MATCH');
      return false;
    } else {
      console.log('✓ Value matches - MATCH');
    }
  }

  return true;
}

async function main() {
  console.log('\n========================================');
  console.log('TESTE DE FILTRAGEM DE ZONA BIOCLIMÁTICA');
  console.log('========================================\n');

  // 1. Buscar o atributo zona bioclimática
  const attrResult = await db.execute(sql`
    SELECT * FROM attribute_definitions 
    WHERE LOWER(friendly_name) LIKE '%zona%bioclim%'
  `);

  if (attrResult.rows.length === 0) {
    console.log('❌ Atributo zona bioclimática não encontrado!');
    process.exit(1);
  }

  const attributeDef = attrResult.rows[0] as any;
  
  console.log('DEBUG - Raw attributeDef from DB:', attributeDef);
  
  // Converter snake_case para camelCase para simular o que o Drizzle faz
  const attributeDefCamel = {
    id: attributeDef.id,
    friendlyName: attributeDef.friendly_name,
    sourceTable: attributeDef.source_table,
    sourceColumn: attributeDef.source_column,
    dataKind: attributeDef.data_kind,
    valueSource: attributeDef.value_source,
    valueIdField: attributeDef.value_id_field,
    valueLabelField: attributeDef.value_label_field
  };
  
  console.log('DEBUG - Converted attributeDefCamel:', attributeDefCamel);
  
  console.log('\n1. Atributo Encontrado:');
  console.log('   ID:', attributeDefCamel.id);
  console.log('   Nome:', attributeDefCamel.friendlyName);
  console.log('   Source Table:', attributeDefCamel.sourceTable);
  console.log('   Source Column:', attributeDefCamel.sourceColumn);
  console.log('   Data Kind:', attributeDefCamel.dataKind);
  console.log('   Value Source:', attributeDefCamel.valueSource);

  // 2. Buscar uma edificação com zona bioclimática 1
  const buildingResult = await db.execute(sql`
    SELECT * FROM buildings 
    WHERE bioclimatic_zone_id = 1
    LIMIT 1
  `);

  if (buildingResult.rows.length === 0) {
    console.log('\n❌ Nenhuma edificação com zona bioclimática 1 encontrada!');
    process.exit(1);
  }

  const building = buildingResult.rows[0] as any;
  console.log('\n2. Edificação de Teste:');
  console.log('   ID:', building.id);
  console.log('   Nome:', building.name);
  console.log('   bioclimatic_zone_id:', building.bioclimatic_zone_id);

  // 3. Buscar parâmetros que filtram por zona bioclimática 1
  const paramsResult = await db.execute(sql`
    SELECT * FROM parameters 
    WHERE attribute_id = ${attributeDef.id}
      AND attribute_value_id = 1
    LIMIT 5
  `);

  console.log(`\n3. Parâmetros que Filtram por Zona 1: ${paramsResult.rows.length} encontrado(s)`);

  if (paramsResult.rows.length === 0) {
    console.log('   ⚠️ Nenhum parâmetro encontrado para zona 1');
    process.exit(0);
  }

  // 4. Testar cada parâmetro
  console.log('\n4. Testando Filtragem:');
  console.log('=====================================');

  for (const param of paramsResult.rows) {
    const parameter = param as any;
    const shouldMatch = checkAttributeMatch(
      parameter,
      parameter.attribute_value_id,
      attributeDefCamel,  // Usar a versão camelCase
      building
    );

    console.log('\n>>> RESULTADO:', shouldMatch ? '✅ DEVERIA APARECER' : '❌ NÃO DEVERIA APARECER');
    console.log('=====================================');
  }

  console.log('\n✅ Teste concluído!\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
