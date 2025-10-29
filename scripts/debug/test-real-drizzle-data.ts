import { storage } from '../../server/storage';

async function main() {
  console.log('\n=== TESTE COM DADOS REAIS DO DRIZZLE ===\n');

  // 1. Buscar edificação via storage (como o report faz)
  const building = await storage.getBuilding(2);
  
  if (!building) {
    console.log('❌ Edificação 2 não encontrada');
    process.exit(1);
  }

  console.log('1. Edificação do storage.getBuilding():');
  console.log('   ID:', building.id);
  console.log('   Nome:', building.name);
  console.log('   bioclimaticZoneId:', building.bioclimaticZoneId);
  console.log('   Tipo do objeto:', typeof building);
  console.log('   Propriedades:', Object.keys(building));

  // 2. Buscar attribute definitions via storage
  const attributeDefs = await storage.listAttributeDefinitions({});
  const zonaBioclimatica = attributeDefs.find(a => 
    a.friendlyName?.toLowerCase().includes('zona') && 
    a.friendlyName?.toLowerCase().includes('bioclim')
  );

  if (!zonaBioclimatica) {
    console.log('\n❌ Atributo zona bioclimática não encontrado');
    process.exit(1);
  }

  console.log('\n2. Attribute Definition do storage:');
  console.log('   ID:', zonaBioclimatica.id);
  console.log('   friendlyName:', zonaBioclimatica.friendlyName);
  console.log('   sourceTable:', zonaBioclimatica.sourceTable);
  console.log('   sourceColumn:', zonaBioclimatica.sourceColumn);
  console.log('   dataKind:', zonaBioclimatica.dataKind);
  console.log('   Propriedades:', Object.keys(zonaBioclimatica));

  // 3. Simular getAttributeValue
  console.log('\n3. Teste do getAttributeValue:');
  console.log('   building[sourceColumn]:', (building as any)[zonaBioclimatica.sourceColumn]);
  console.log('   building["bioclimaticZoneId"]:', building.bioclimaticZoneId);
  console.log('   building["bioclimatic_zone_id"]:', (building as any)['bioclimatic_zone_id']);

  process.exit(0);
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
