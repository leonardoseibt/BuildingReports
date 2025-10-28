import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkMigrationStatus() {
  console.log("\n=== VERIFICANDO STATUS DA MIGRAÇÃO ===\n");

  // 1. Verificar estrutura da tabela buildings
  console.log("1. Estrutura da tabela buildings:");
  const buildingsColumns = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'buildings'
    AND column_name IN ('bioclimatic_zone', 'bioclimatic_zone_id', 'isopleth_code', 'isopleth_id')
    ORDER BY column_name
  `);
  
  console.log("Colunas encontradas:");
  buildingsColumns.rows.forEach((row: any) => {
    console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
  });

  // 2. Verificar se há dados nas colunas
  console.log("\n2. Verificando dados nas colunas:");
  const dataSample = await db.execute(sql`
    SELECT 
      id,
      name,
      bioclimatic_zone_id,
      isopleth_id
    FROM buildings
    LIMIT 3
  `);
  
  console.log("Amostra de dados:");
  dataSample.rows.forEach((row: any) => {
    console.log(`  Edificação: ${row.name}`);
    console.log(`    - bioclimatic_zone_id: ${row.bioclimatic_zone_id}`);
    console.log(`    - isopleth_id: ${row.isopleth_id}`);
  });

  // 3. Verificar attribute_definitions
  console.log("\n3. Verificando attribute_definitions:");
  const attrDefs = await db.execute(sql`
    SELECT 
      id,
      friendly_name,
      source_table,
      source_column,
      data_kind,
      value_source
    FROM attribute_definitions
    WHERE source_table = 'buildings'
    AND (source_column LIKE '%bioclimatic%' OR source_column LIKE '%isopleth%')
  `);
  
  console.log("Definições de atributos:");
  attrDefs.rows.forEach((row: any) => {
    console.log(`  - ${row.friendly_name} (ID: ${row.id})`);
    console.log(`      source_column: ${row.source_column}`);
    console.log(`      data_kind: ${row.data_kind}`);
    console.log(`      value_source: ${row.value_source}`);
  });

  // 4. Verificar constraints/foreign keys
  console.log("\n4. Verificando foreign keys:");
  const fks = await db.execute(sql`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'buildings'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('bioclimatic_zone_id', 'isopleth_id')
  `);
  
  if (fks.rows.length > 0) {
    console.log("Foreign keys encontradas:");
    fks.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name} -> ${row.foreign_table_name}`);
    });
  } else {
    console.log("❌ NENHUMA foreign key encontrada! A migration não foi completada.");
  }

  // 5. Status resumido
  console.log("\n=== RESUMO ===");
  const hasOldColumns = buildingsColumns.rows.some((r: any) => 
    r.column_name === 'bioclimatic_zone' || r.column_name === 'isopleth_code'
  );
  const hasNewColumns = buildingsColumns.rows.some((r: any) => 
    r.column_name === 'bioclimatic_zone_id' || r.column_name === 'isopleth_id'
  );
  const hasAttrDefsUpdated = attrDefs.rows.some((r: any) => 
    r.source_column === 'bioclimatic_zone_id'
  );
  const hasFKs = fks.rows.length > 0;

  console.log(`Colunas antigas (bioclimatic_zone, isopleth_code): ${hasOldColumns ? '❌ AINDA EXISTEM' : '✅ REMOVIDAS'}`);
  console.log(`Colunas novas (bioclimatic_zone_id, isopleth_id): ${hasNewColumns ? '✅ CRIADAS' : '❌ NÃO EXISTEM'}`);
  console.log(`attribute_definitions atualizado: ${hasAttrDefsUpdated ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`Foreign keys criadas: ${hasFKs ? '✅ SIM' : '❌ NÃO'}`);

  if (hasOldColumns && hasNewColumns) {
    console.log("\n⚠️  ESTADO INCONSISTENTE: Ambas as colunas existem! Migration parcialmente executada.");
    console.log("Ação necessária: Completar a migration manualmente.");
  } else if (!hasNewColumns) {
    console.log("\n❌ Migration não foi executada!");
  } else if (!hasAttrDefsUpdated || !hasFKs) {
    console.log("\n⚠️  Migration incompleta! Faltam passos.");
  } else {
    console.log("\n✅ Migration parece estar completa!");
  }

  process.exit(0);
}

checkMigrationStatus().catch(console.error);
