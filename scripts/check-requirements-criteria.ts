import { db } from '../server/db';
import { requirements, criteria, analyses, requirementsCriteria } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function checkRequirementsCriteria() {
  console.log('🔍 Verificando uso da tabela requirements_criteria...\n');

  // Contar registros em requirements_criteria
  const [rcCount] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(requirementsCriteria);
  console.log(`📊 Registros em requirements_criteria: ${rcCount.count}`);

  // Contar relações únicas via analyses (requirementId, criterionId)
  const [analysesCount] = await db
    .select({ 
      count: sql<number>`COUNT(DISTINCT (requirement_id, criterion_id))::int` 
    })
    .from(analyses);
  console.log(`📊 Relações únicas (requirement_id, criterion_id) em analyses: ${analysesCount.count}`);

  // Buscar relações em requirements_criteria
  const rcRelations = await db
    .select({
      requirementId: requirementsCriteria.requirementId,
      criterionId: requirementsCriteria.criterionId,
    })
    .from(requirementsCriteria)
    .orderBy(requirementsCriteria.requirementId, requirementsCriteria.criterionId);

  console.log('\n📋 Relações em requirements_criteria:');
  rcRelations.forEach(rel => {
    console.log(`  - Requirement ${rel.requirementId} -> Criterion ${rel.criterionId}`);
  });

  // Buscar relações únicas em analyses
  const analysesRelations = await db
    .selectDistinct({
      requirementId: analyses.requirementId,
      criterionId: analyses.criterionId,
    })
    .from(analyses)
    .orderBy(analyses.requirementId, analyses.criterionId);

  console.log('\n📋 Relações únicas em analyses:');
  analysesRelations.forEach(rel => {
    console.log(`  - Requirement ${rel.requirementId} -> Criterion ${rel.criterionId}`);
  });

  // Verificar se há relações em analyses que NÃO estão em requirements_criteria
  console.log('\n🔍 Relações em analyses que NÃO estão em requirements_criteria:');
  let missingCount = 0;
  for (const analysisRel of analysesRelations) {
    const existsInRC = rcRelations.some(
      rc => rc.requirementId === analysisRel.requirementId && rc.criterionId === analysisRel.criterionId
    );
    if (!existsInRC) {
      console.log(`  ❌ Requirement ${analysisRel.requirementId} -> Criterion ${analysisRel.criterionId}`);
      missingCount++;
    }
  }
  
  if (missingCount === 0) {
    console.log('  ✅ Todas as relações de analyses estão em requirements_criteria');
  } else {
    console.log(`  ⚠️  Total de relações ausentes: ${missingCount}`);
  }

  // Verificar se há relações em requirements_criteria que NÃO estão em analyses
  console.log('\n🔍 Relações em requirements_criteria que NÃO estão em analyses:');
  let extraCount = 0;
  for (const rcRel of rcRelations) {
    const existsInAnalyses = analysesRelations.some(
      a => a.requirementId === rcRel.requirementId && a.criterionId === rcRel.criterionId
    );
    if (!existsInAnalyses) {
      console.log(`  ❌ Requirement ${rcRel.requirementId} -> Criterion ${rcRel.criterionId}`);
      extraCount++;
    }
  }
  
  if (extraCount === 0) {
    console.log('  ✅ Todas as relações de requirements_criteria estão em analyses');
  } else {
    console.log(`  ⚠️  Total de relações extras (órfãs): ${extraCount}`);
  }

  console.log('\n📌 CONCLUSÃO:');
  if (missingCount > 0) {
    console.log('❌ A tabela requirements_criteria está DESATUALIZADA e NÃO reflete as relações reais.');
    console.log('✅ O sistema usa a tabela ANALYSES para determinar a relação requirement -> criterion.');
    console.log('💡 A tabela requirements_criteria pode ser REMOVIDA com segurança.');
  } else if (extraCount > 0) {
    console.log('⚠️  A tabela requirements_criteria tem relações órfãs que não existem em analyses.');
  } else {
    console.log('✅ As tabelas estão sincronizadas (mas requirements_criteria ainda é redundante).');
  }

  process.exit(0);
}

checkRequirementsCriteria().catch(console.error);
