import { db } from '../server/db';
import { requirements, criteria, analyses } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function validateRelations() {
  console.log('🔍 Validando relações após remoção de requirements_criteria...\n');

  // Verificar se a tabela foi removida
  const tableCheckResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'requirements_criteria'
    ) as exists
  `);
  
  const tableExists = (tableCheckResult.rows[0] as any)?.exists;
  
  if (tableExists) {
    console.log('❌ ERRO: Tabela requirements_criteria ainda existe no banco!');
    process.exit(1);
  }
  console.log('✅ Tabela requirements_criteria removida com sucesso\n');

  // Contar requisitos
  const [reqCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(requirements);
  console.log(`📊 Total de Requirements: ${reqCount.count}`);

  // Contar critérios
  const [critCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(criteria);
  console.log(`📊 Total de Criteria: ${critCount.count}`);

  // Contar análises
  const [analCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(analyses);
  console.log(`📊 Total de Analyses: ${analCount.count}`);

  // Contar relações únicas via analyses
  const [relCount] = await db
    .select({ 
      count: sql<number>`COUNT(DISTINCT (requirement_id, criterion_id))::int` 
    })
    .from(analyses);
  console.log(`📊 Relações únicas (Requirement ↔ Criterion) via Analyses: ${relCount.count}\n`);

  // Buscar alguns exemplos de relações
  const sampleRelations = await db
    .selectDistinct({
      requirementId: analyses.requirementId,
      requirementCode: requirements.code,
      criterionId: analyses.criterionId,
      criterionCode: criteria.code,
    })
    .from(analyses)
    .innerJoin(requirements, sql`${analyses.requirementId} = ${requirements.id}`)
    .innerJoin(criteria, sql`${analyses.criterionId} = ${criteria.id}`)
    .limit(10);

  console.log('📋 Exemplos de relações (via analyses):');
  sampleRelations.forEach(rel => {
    console.log(`  - Requirement [${rel.requirementCode}] ↔ Criterion [${rel.criterionCode}]`);
  });

  console.log('\n✅ SISTEMA VALIDADO COM SUCESSO!');
  console.log('💡 As relações entre Requirements e Criteria estão sendo gerenciadas via tabela Analyses.');
  
  process.exit(0);
}

validateRelations().catch(console.error);
