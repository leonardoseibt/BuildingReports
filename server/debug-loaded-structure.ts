import { storage } from './storage';

export async function debugLoadedStructure(reportId: number) {
  try {
    const structure = await storage.loadReportStructure(reportId);
    
    const analysis131 = structure.analyses.find((a: any) => a.id === 131 || a.analysisId === 131);
    
    // Check if criterion 5 is in the structure
    const criterion5 = structure.criteria.find((c: any) => c.id === 5 || c.criterionId === 5);
    
    return {
      reportId,
      totalRequirements: structure.requirements.length,
      totalCriteria: structure.criteria.length,
      totalAnalyses: structure.analyses.length,
      analysis131: analysis131 || null,
      criterion5: criterion5 || null,
      allCriteria: structure.criteria.map((c: any) => ({
        id: c.id || c.criterionId,
        name: c.namePt || c.name,
        position: c.position
      })),
      allAnalyses: structure.analyses.map((a: any) => ({
        id: a.id || a.analysisId,
        name: a.namePt || a.name,
        levels: a.levels || [],
        hasLevels: (a.levels || []).length > 0
      })),
      requirements: structure.requirements.map((r: any) => ({
        id: r.id || r.requirementId,
        isEnabled: r.isEnabled
      }))
    };
  } catch (error: any) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}
