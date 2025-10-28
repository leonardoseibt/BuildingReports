import { db } from "./server/db";
import { buildings, parameters, attributeDefinitions, bioclimaticZones } from "./shared/schema";
import { eq } from "drizzle-orm";

async function debugBioclimaticFilter() {
  console.log("\n=== DEBUG: Bioclimatic Zone Filtering ===\n");

  // 1. Verificar edificação com zona 1R
  console.log("1. Buscando edificações com zona bioclimática...");
  const allBuildings = await db.select().from(buildings);
  console.log(`Total de edificações: ${allBuildings.length}`);
  
  for (const building of allBuildings.slice(0, 3)) {
    console.log(`\nEdificação: ${building.name}`);
    console.log(`  - bioclimaticZoneId: ${building.bioclimaticZoneId}`);
    
    if (building.bioclimaticZoneId) {
      const [zone] = await db.select().from(bioclimaticZones).where(eq(bioclimaticZones.id, building.bioclimaticZoneId));
      console.log(`  - Zona: ${zone?.code} - ${zone?.label}`);
    }
  }

  // 2. Verificar definição do atributo zona bioclimática
  console.log("\n2. Verificando attribute_definitions para zona bioclimática...");
  const attrs = await db.select().from(attributeDefinitions);
  const bioclimaticAttr = attrs.find(a => 
    a.sourceTable === 'buildings' && 
    (a.sourceColumn.includes('bioclimatic') || a.label?.includes('bioclim'))
  );
  
  if (bioclimaticAttr) {
    console.log("Atributo encontrado:");
    console.log(JSON.stringify(bioclimaticAttr, null, 2));
  } else {
    console.log("❌ ERRO: Atributo de zona bioclimática não encontrado!");
  }

  // 3. Verificar parâmetros que filtram por zona bioclimática
  console.log("\n3. Verificando parâmetros com filtro de zona bioclimática...");
  const allParams = await db.select().from(parameters);
  const bioclimaticParams = allParams.filter(p => 
    p.attributeId === bioclimaticAttr?.id || p.attribute2Id === bioclimaticAttr?.id
  );
  
  console.log(`Total de parâmetros com filtro de zona: ${bioclimaticParams.length}`);
  
  for (const param of bioclimaticParams.slice(0, 5)) {
    console.log(`\nParâmetro: ${param.label}`);
    console.log(`  - attributeId: ${param.attributeId}`);
    console.log(`  - attributeValueId: ${param.attributeValueId}`);
    console.log(`  - attribute2Id: ${param.attribute2Id}`);
    console.log(`  - attributeValue2Id: ${param.attributeValue2Id}`);
    
    if (param.attributeValueId && param.attributeId === bioclimaticAttr?.id) {
      const [zone] = await db.select().from(bioclimaticZones).where(eq(bioclimaticZones.id, param.attributeValueId));
      console.log(`  - Zona do filtro: ${zone?.code} - ${zone?.label} (ID: ${zone?.id})`);
    }
    
    if (param.attributeValue2Id && param.attribute2Id === bioclimaticAttr?.id) {
      const [zone] = await db.select().from(bioclimaticZones).where(eq(bioclimaticZones.id, param.attributeValue2Id));
      console.log(`  - Zona do filtro 2: ${zone?.code} - ${zone?.label} (ID: ${zone?.id})`);
    }
  }

  // 4. Simular a comparação
  console.log("\n4. Simulando comparação de filtro...");
  const testBuilding = allBuildings.find(b => b.bioclimaticZoneId);
  if (testBuilding && bioclimaticAttr) {
    console.log(`\nEdificação teste: ${testBuilding.name}`);
    console.log(`  - bioclimaticZoneId da edificação: ${testBuilding.bioclimaticZoneId} (tipo: ${typeof testBuilding.bioclimaticZoneId})`);
    
    const matchingParams = bioclimaticParams.filter(p => {
      const attrValueId = p.attributeId === bioclimaticAttr.id ? p.attributeValueId : p.attributeValue2Id;
      console.log(`  Comparando: ${testBuilding.bioclimaticZoneId} === ${attrValueId} ? ${testBuilding.bioclimaticZoneId === attrValueId}`);
      return testBuilding.bioclimaticZoneId === attrValueId;
    });
    
    console.log(`\nParâmetros que devem aparecer: ${matchingParams.length}`);
    matchingParams.forEach(p => console.log(`  - ${p.label}`));
  }

  process.exit(0);
}

debugBioclimaticFilter().catch(console.error);
