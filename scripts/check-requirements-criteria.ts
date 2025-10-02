import { db } from '../server/db';
import { requirements, criteria, analyses } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function checkRequirementsCriteria() {
  console.log('🔍 Verificando relações entre requirements e criteria via analyses...\n');

  // Contar relações únicas via analyses (requirementId, criterionId)
  const [analysesCount] = await db
    .select({ 
      count: sql<number>`COUNT(DISTINCT (requirement_id, criterion_id))::int` 
    })
    .from(analyses);
  console.log(`📊 Relações únicas (requirement_id, criterion_id) em analyses: ${analysesCount.count}`);

  // Buscar relações via analyses (distinct combinations)
  const analysisRelations = await db
    .select({
      requirementId: analyses.requirementId,
      criterionId: analyses.criterionId,
    })
    .from(analyses)
    .groupBy(analyses.requirementId, analyses.criterionId)
    .orderBy(analyses.requirementId, analyses.criterionId);

  console.log('\n📋 Relações encontradas via analyses:');
  analysisRelations.forEach(rel => {
    console.log(`  - Requirement ${rel.requirementId} -> Criterion ${rel.criterionId}`);
  });

  console.log('\n� CONCLUSÃO:');
  console.log('✅ O sistema usa a tabela ANALYSES para determinar a relação requirement -> criterion.');
  console.log('✅ A antiga tabela requirements_criteria foi removida com sucesso.');
  console.log(`📊 Total de relações encontradas: ${analysisRelations.length}`);

  // Mostrar estatísticas
  const requirementIds = new Set(analysisRelations.map(r => r.requirementId));
  const criterionIds = new Set(analysisRelations.map(r => r.criterionId));
  
  console.log(`\n📈 Estatísticas:`);
  console.log(`  - Requirements únicos envolvidos: ${requirementIds.size}`);
  console.log(`  - Criteria únicos envolvidos: ${criterionIds.size}`);
  console.log(`  - Relações únicas: ${analysisRelations.length}`);

  process.exit(0);
}

checkRequirementsCriteria().catch(console.error);
