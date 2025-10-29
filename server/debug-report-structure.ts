import { db } from './db';
import { reports } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function debugReportStructure(reportId: number) {
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId)
  });

  if (!report) {
    return { error: 'Relatório não encontrado' };
  }

  const structure = report.reportStructure ? JSON.parse(report.reportStructure) : null;

  return {
    reportId: report.id,
    reportName: report.name,
    buildingId: report.buildingId,
    hasStructure: !!structure,
    structure: structure,
    selectedEvaluations: structure?.selectedEvaluations || [],
    analysis131: structure?.selectedEvaluations?.find((e: any) => 
      e.id === 'analysis-131' || e.key === 'analysis-131' || 
      String(e.id).includes('131') || String(e.key).includes('131')
    ) || null
  };
}
