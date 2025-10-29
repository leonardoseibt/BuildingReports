import { db } from '../../server/db';
import { attributeDefinitions, buildings, parameters } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  console.log('\n=== Verificando Atributo Zona Bioclimática ===\n');

  // 1. Buscar a definição do atributo zona bioclimática
  const attrs = await db.select().from(attributeDefinitions).where(
    eq(attributeDefinitions.name, 'zona bioclimática')
  );
  
  console.log('1. Definição do Atributo:');
  console.log(JSON.stringify(attrs, null, 2));

  if (attrs.length === 0) {
    console.log('\n❌ Atributo "zona bioclimática" não encontrado!');
    process.exit(1);
  }

  const attr = attrs[0];
  console.log(`\n   - Source Table: ${attr.sourceTable}`);
  console.log(`   - Source Column: ${attr.sourceColumn}`);

  // 2. Buscar uma edificação de exemplo
  const sampleBuildings = await db.select().from(buildings).limit(1);
  
  if (sampleBuildings.length > 0) {
    const building = sampleBuildings[0];
    console.log(`\n2. Edificação de Exemplo (ID ${building.id}):`);
    console.log(`   - bioclimaticZoneId: ${building.bioclimaticZoneId}`);
    console.log(`   - Nome: ${building.name}`);
  }

  // 3. Buscar parâmetros que filtram por zona bioclimática
  const paramsWithZone = await db.select().from(parameters).where(
    eq(parameters.attributeId, attr.id)
  );

  console.log(`\n3. Parâmetros com Filtro de Zona Bioclimática: ${paramsWithZone.length} encontrado(s)`);
  
  paramsWithZone.forEach(param => {
    console.log(`\n   Parâmetro ID ${param.id}:`);
    console.log(`   - Nome: ${param.name}`);
    console.log(`   - attributeId: ${param.attributeId}`);
    console.log(`   - attributeValueId: ${param.attributeValueId}`);
    console.log(`   - attribute2Id: ${param.attribute2Id}`);
    console.log(`   - attributeValue2Id: ${param.attributeValue2Id}`);
  });

  console.log('\n=== Fim da Verificação ===\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
