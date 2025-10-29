import { db } from './db';
import { parameters, reports } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function debugParameterValues(buildingId: number, reportId: number) {
  // 1. Buscar relatório e suas configurações
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId)
  });

  if (!report) {
    return { error: 'Relatório não encontrado' };
  }

  // 2. Buscar os 3 parâmetros aprovados (IDs 257, 366, 374)
  const approvedIds = [257, 366, 374];
  const approvedParams = await db.query.parameters.findMany({
    where: (params, { inArray }) => inArray(params.id, approvedIds)
  });

  // 3. Parsear configuração do relatório
  const reportStructure = report.reportStructure ? JSON.parse(report.reportStructure) : {};
  
  // 4. Encontrar selectedLevels para a análise 131
  let selectedLevelsFor131: string[] = [];
  if (reportStructure.selectedEvaluations) {
    const eval131 = reportStructure.selectedEvaluations.find((e: any) => 
      e.id === 'analysis-131' || e.key === 'analysis-131'
    );
    if (eval131) {
      selectedLevelsFor131 = eval131.levels || [];
    }
  }

  // 5. Verificar cada parâmetro
  const parameterDetails = approvedParams.map(param => {
    const hasMinimum = param.minimumValue !== null && param.minimumValue !== undefined && String(param.minimumValue).trim() !== '';
    const hasIntermediate = param.intermediateValue !== null && param.intermediateValue !== undefined && String(param.intermediateValue).trim() !== '';
    const hasSuperior = param.superiorValue !== null && param.superiorValue !== undefined && String(param.superiorValue).trim() !== '';

    const availableLevels: string[] = [];
    if (hasMinimum) availableLevels.push('minimum');
    if (hasIntermediate) availableLevels.push('intermediate');
    if (hasSuperior) availableLevels.push('superior');

    const matchesSelectedLevels = selectedLevelsFor131.length === 0 || 
      selectedLevelsFor131.some(level => availableLevels.includes(level));

    return {
      id: param.id,
      label: param.label,
      values: {
        minimum: param.minimumValue,
        intermediate: param.intermediateValue,
        superior: param.superiorValue
      },
      availableLevels,
      matchesSelectedLevels,
      wouldAppearInReport: matchesSelectedLevels
    };
  });

  return {
    reportId,
    reportName: report.name,
    selectedLevelsFor131,
    approvedParameters: parameterDetails,
    summary: {
      total: parameterDetails.length,
      wouldAppear: parameterDetails.filter(p => p.wouldAppearInReport).length,
      wouldBeFiltered: parameterDetails.filter(p => !p.wouldAppearInReport).length
    }
  };
}
