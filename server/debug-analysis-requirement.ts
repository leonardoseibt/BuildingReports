import { db } from './db';

export async function debugAnalysisRequirement(analysisId: number) {
  try {
    const analysis = await db.query.analyses.findFirst({
      where: (analyses, { eq }) => eq(analyses.id, analysisId),
      with: {
        criterion: true,
        requirement: true
      }
    });

    if (!analysis) {
      return { error: 'Análise não encontrada' };
    }

    return {
      analysisId: analysis.id,
      analysisCode: analysis.code,
      analysisName: analysis.namePt,
      requirementId: analysis.requirement?.id,
      requirementCode: analysis.requirement?.code,
      requirementName: analysis.requirement?.namePt,
      criterionId: analysis.criterion?.id,
      criterionCode: analysis.criterion?.code,
      criterionName: analysis.criterion?.namePt
    };
  } catch (error: any) {
    return { error: error.message, stack: error.stack };
  }
}
