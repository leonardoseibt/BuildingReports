import { db } from '../../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('\n=== PRODUÇÃO: Verificando Configuração do Atributo ===\n');

  // Query direta em SQL
  const result = await db.execute(sql`
    SELECT 
      id,
      friendly_name,
      source_table,
      source_column,
      data_kind,
      value_source,
      value_id_field,
      value_label_field
    FROM attribute_definitions 
    WHERE LOWER(friendly_name) LIKE '%zona%bioclim%'
    ORDER BY id
  `);

  console.log('Atributos encontrados:', result.rows.length);
  result.rows.forEach((row: any) => {
    console.log('\n---');
    console.log('ID:', row.id);
    console.log('Friendly Name:', row.friendly_name);
    console.log('Source Table:', row.source_table);
    console.log('Source Column:', row.source_column);
    console.log('Data Kind:', row.data_kind);
    console.log('Value Source:', row.value_source);
    console.log('Value ID Field:', row.value_id_field);
    console.log('Value Label Field:', row.value_label_field);
  });

  // Buscar parâmetros que usam esse atributo
  const params = await db.execute(sql`
    SELECT p.id, p.label, p.attribute_id, p.attribute_value_id, a.analysis_id, an.name_pt as analysis_name
    FROM parameters p
    LEFT JOIN analyses a ON a.id = p.analysis_id
    LEFT JOIN analyses an ON an.id = a.id
    WHERE p.attribute_id IN (
      SELECT id FROM attribute_definitions WHERE LOWER(friendly_name) LIKE '%zona%bioclim%'
    )
    ORDER BY p.id
    LIMIT 10
  `);

  console.log('\n\n=== Parâmetros que usam Zona Bioclimática ===');
  console.log('Total encontrado:', params.rows.length);
  params.rows.forEach((row: any) => {
    console.log(`\nParâmetro ${row.id}:`);
    console.log(`  Label: ${row.label.substring(0, 60)}...`);
    console.log(`  Analysis: ${row.analysis_name}`);
    console.log(`  attribute_id: ${row.attribute_id}`);
    console.log(`  attribute_value_id: ${row.attribute_value_id}`);
  });

  // Verificar uma edificação
  const building = await db.execute(sql`
    SELECT id, name, bioclimatic_zone_id
    FROM buildings
    WHERE bioclimatic_zone_id = 1
    LIMIT 1
  `);

  console.log('\n\n=== Edificação com Zona 1 ===');
  if (building.rows.length > 0) {
    const b = building.rows[0] as any;
    console.log(`ID ${b.id}: ${b.name}`);
    console.log(`bioclimatic_zone_id: ${b.bioclimatic_zone_id}`);
    
    // Buscar a zona
    const zone = await db.execute(sql`
      SELECT id, code, label
      FROM bioclimatic_zones
      WHERE id = 1
    `);
    
    if (zone.rows.length > 0) {
      const z = zone.rows[0] as any;
      console.log(`Zona: ${z.code} - ${z.label}`);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
