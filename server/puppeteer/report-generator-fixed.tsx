import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import puppeteer from 'puppeteer';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  reports,
  buildings,
  requirements,
  criteriaTable,
  analysesTable,
  parametersTable,
  typologiesTable,
  noiseClassesTable,
  aggressivenessClassesTable,
  techniciansTable,
  bioclimaticZonesTable,
  isoplethsTable,
  type Report,
  type Building,
  type Requirement,
  type Criterion,
  type Analysis,
  type Parameter,
  type Typology,
  type NoiseClass,
  type AggressivenessClass,
  type Technician,
  type BioclimaticZone,
  type Isopleth
} from '../../shared/schema';

type ReportContext = {
  report: Report;
  building: Building;
  sections: RequirementRender[];
  typologies: Typology[];
  noiseClasses: NoiseClass[];
  aggressivenessClasses: AggressivenessClass[];
  technicians: Technician[];
  bioclimaticZones: BioclimaticZone[];
  isopleths: Isopleth[];
};

type RequirementRender = Requirement & {
  criteria: CriterionRender[];
};

type CriterionRender = Criterion & {
  analyses: AnalysisRender[];
};

type AnalysisRender = Analysis & {
  selectedLevels: string[];
  parameters: Parameter[];
};

const levelOrder = ['1', '2', '3', '4', '5'] as const;

const hasValuesForSelectedLevels = (parameter: Parameter, selectedLevels: string[]): boolean => {
  return selectedLevels.some(level => {
    const key = `level${level}Value` as keyof Parameter;
    const value = parameter[key];
    return value !== null && value !== undefined && value !== '';
  });
};

const buildFilename = (building: Building, report: Report): string => {
  const buildingName = building.name || 'Sem Nome';
  const cleanBuildingName = buildingName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const reportId = report.id || 'sem_id';
  const timestamp = new Date().toISOString().slice(0, 10);
  return `Relatorio_${cleanBuildingName}_${reportId}_${timestamp}.pdf`;
};

function ReportHtml({ context }: { context: ReportContext }) {
  const { report, building, sections, typologies, noiseClasses, aggressivenessClasses, technicians, bioclimaticZones, isopleths } = context;

  const buildingTypology = typologies.find(t => t.id === building.typologyId);
  const buildingNoiseClass = noiseClasses.find(nc => nc.id === building.noiseClassId);
  const buildingAggressivenessClass = aggressivenessClasses.find(ac => ac.id === building.aggressivenessClassId);
  const reportTechnician = technicians.find(tech => tech.id === report.technicianId);
  const buildingBioclimaticZone = bioclimaticZones.find(bz => bz.id === building.bioclimaticZoneId);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Relatório de Desempenho</title>
        <style>{`
          @page { size: A4; margin: 0; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 11px; 
            line-height: 1.4; 
            margin: 0; 
            padding: 18mm 8mm 15mm 10mm; 
            color: #333;
          }
          h1 { font-size: 18px; margin: 0 0 12px 0; font-weight: bold; }
          h2 { font-size: 14px; margin: 16px 0 8px 0; font-weight: bold; }
          h3 { font-size: 12px; margin: 12px 0 6px 0; font-weight: bold; }
          .header-info { margin-bottom: 20px; }
          .requirement-section { margin-bottom: 20px; }
          .criterion-section { margin-bottom: 16px; }
          table.criterion-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 8px; 
          }
          table.criterion-table th, 
          table.criterion-table td { 
            border: 1px solid #ddd; 
            padding: 6px; 
            text-align: left; 
            vertical-align: top; 
          }
          table.criterion-table th { 
            background-color: #f5f5f5; 
            font-weight: bold; 
          }
          .criterion-header { 
            background-color: #e8f4f8; 
            font-weight: bold; 
          }
          .criterion-header--hidden { 
            display: none !important; 
          }
          .analysis-header { 
            background-color: #f0f8ff; 
            font-weight: bold; 
          }
          .level-value { 
            text-align: center; 
            font-weight: bold; 
          }
          .parameter-name { 
            font-weight: bold; 
          }
        `}</style>
      </head>
      <body>
        <div className="header-info">
          <h1>Relatório de Desempenho - Edificação</h1>
          <p><strong>Edificação:</strong> {building.name || 'N/A'}</p>
          <p><strong>Tipologia:</strong> {buildingTypology?.name || 'N/A'}</p>
          <p><strong>Classe de Ruído:</strong> {buildingNoiseClass?.name || 'N/A'}</p>
          <p><strong>Classe de Agressividade:</strong> {buildingAggressivenessClass?.name || 'N/A'}</p>
          <p><strong>Zona Bioclimática:</strong> {buildingBioclimaticZone?.name || 'N/A'}</p>
          <p><strong>Técnico Responsável:</strong> {reportTechnician?.name || 'N/A'}</p>
          <p><strong>Data do Relatório:</strong> {report.createdAt ? new Date(report.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
        </div>

        {sections.map((requirement) => (
          <div key={requirement.id} data-requirement-id={requirement.id} className="requirement-section">
            <h2 data-role="requirement-title">{requirement.code} - {requirement.name}</h2>
            
            {requirement.criteria.map((criterion) => (
              <div key={criterion.id} className="criterion-section">
                {criterion.analyses.map((analysis) => (
                  <table key={analysis.id} className="criterion-table" data-criterion-id={criterion.id} data-analysis-id={analysis.id}>
                    <thead>
                      <tr className="criterion-header">
                        <th colSpan={analysis.selectedLevels.length + 1}>
                          {criterion.code} - {criterion.name}
                        </th>
                      </tr>
                      <tr className="analysis-header">
                        <th colSpan={analysis.selectedLevels.length + 1}>
                          {analysis.code} - {analysis.name}
                        </th>
                      </tr>
                      <tr>
                        <th>Parâmetro</th>
                        {analysis.selectedLevels.map(level => (
                          <th key={level} className="level-value">Nível {level}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.parameters.map((parameter) => (
                        <tr key={parameter.id}>
                          <td className="parameter-name">{parameter.name}</td>
                          {analysis.selectedLevels.map(level => {
                            const key = `level${level}Value` as keyof Parameter;
                            const value = parameter[key];
                            return (
                              <td key={level} className="level-value">
                                {value || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            ))}
          </div>
        ))}
      </body>
    </html>
  );
}

async function loadReportContext(reportId: number, userId: number): Promise<ReportContext> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!report) throw new Error('Report not found');

  const [building] = await db.select().from(buildings).where(eq(buildings.id, report.buildingId));
  if (!building) throw new Error('Building not found');

  const [typologies, noiseClasses, aggressivenessClasses, technicians, bioclimaticZones, isopleths] = await Promise.all([
    db.select().from(typologiesTable),
    db.select().from(noiseClassesTable),
    db.select().from(aggressivenessClassesTable),
    db.select().from(techniciansTable),
    db.select().from(bioclimaticZonesTable),
    db.select().from(isoplethsTable)
  ]);

  const requirementsData = await db.select().from(requirements);
  const criteriaData = await db.select().from(criteriaTable);
  const analysesData = await db.select().from(analysesTable);
  const parametersData = await db.select().from(parametersTable);

  const selectedEvaluations = new Map<string, string[]>();

  const groupedData = requirementsData
    .map((requirement) => {
      const criteriaForRequirement = criteriaData
        .filter((criterion) => criterion.requirementId === requirement.id)
        .map((criterion) => {
          const analysesForCriterion = analysesData
            .filter((analysis) => analysis.criterionId === criterion.id)
            .map((analysis) => {
              const parametersForAnalysis = parametersData.filter((parameter) => parameter.analysisId === analysis.id);
              if (parametersForAnalysis.length === 0) return null;
              return { ...analysis, parameters: parametersForAnalysis };
            })
            .filter((analysis) => Boolean(analysis)) as (Analysis & { parameters: Parameter[] })[];
          if (analysesForCriterion.length === 0) return null;
          return { ...criterion, analyses: analysesForCriterion };
        })
        .filter((criterion) => Boolean(criterion)) as (Criterion & { analyses: (Analysis & { parameters: Parameter[] })[] })[];

      if (criteriaForRequirement.length === 0) return null;

      return { ...requirement, criteria: criteriaForRequirement };
    })
    .filter((requirement) => Boolean(requirement)) as (Requirement & { criteria: (Criterion & { analyses: (Analysis & { parameters: Parameter[] })[] })[] })[];

  const sections = groupedData
    .map((requirement) => {
      const mappedCriteria = requirement.criteria
        .map((criterion) => {
          const analysesWithLevels = criterion.analyses
            .map((analysis) => {
              let selectedLevels = selectedEvaluations.get(`analysis-${analysis.id}`)?.slice() ?? levelOrder.slice();
              const filteredParameters = analysis.parameters.filter((parameter) =>
                hasValuesForSelectedLevels(parameter, selectedLevels)
              );
              if (filteredParameters.length === 0) return null;
              return {
                ...analysis,
                selectedLevels,
                parameters: filteredParameters
              } as AnalysisRender;
            })
            .filter((analysis) => Boolean(analysis)) as AnalysisRender[];
          if (analysesWithLevels.length === 0) return null;
          return { ...criterion, analyses: analysesWithLevels };
        })
        .filter((criterion) => Boolean(criterion)) as CriterionRender[];
      if (mappedCriteria.length === 0) return null;
      return { ...requirement, criteria: mappedCriteria };
    })
    .filter((requirement) => Boolean(requirement)) as RequirementRender[];

  const sortedSections = sections
    .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true, sensitivity: 'base' }))
    .map((requirement) => ({
      ...requirement,
      criteria: requirement.criteria
        .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true, sensitivity: 'base' }))
        .map((criterion) => ({
          ...criterion,
          analyses: criterion.analyses
            .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true, sensitivity: 'base' }))
        }))
    }));

  return {
    report,
    building,
    sections: sortedSections,
    typologies,
    noiseClasses,
    aggressivenessClasses,
    technicians,
    bioclimaticZones,
    isopleths
  };
}

export async function generateReportPdf(reportId: number, userId: number): Promise<{ filename: string; pdf: Buffer }> {
  const context = await loadReportContext(reportId, userId);
  const html = '<!DOCTYPE html>' + renderToStaticMarkup(<ReportHtml context={context} />);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page: any = null;

  try {
    page = await browser.newPage();

    // Carrega HTML e aplica mídia de tela
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    // Implementa o pseudo-algoritmo de paginação usando JavaScript puro
    await page.addScriptTag({
      content: `
        (function() {
          var MM_TO_PX = 96 / 25.4;
          var TOP_MARGIN_MM = 18;
          var BOTTOM_MARGIN_MM = 15;
          var PAGE_HEIGHT_PX = (297 - TOP_MARGIN_MM - BOTTOM_MARGIN_MM) * MM_TO_PX;
          var topMarginPx = TOP_MARGIN_MM * MM_TO_PX;
          var bodyStyle = window.getComputedStyle(document.body);
          var paddingTop = parseFloat(bodyStyle.paddingTop || '0') || 0;
          var layoutOffset = topMarginPx + paddingTop;

          function getElementTop(element) {
            var rect = element.getBoundingClientRect();
            return Math.max(0, rect.top + window.scrollY - layoutOffset);
          }

          function getElementHeight(element) {
            return element.getBoundingClientRect().height;
          }

          function applyPageBreak(element) {
            element.style.pageBreakBefore = 'always';
            element.style.setProperty('break-before', 'page');
          }

          function getAvailableSpace(element) {
            var elementTop = getElementTop(element);
            var currentPage = Math.floor(elementTop / PAGE_HEIGHT_PX);
            var pageBottom = (currentPage + 1) * PAGE_HEIGHT_PX;
            return pageBottom - elementTop;
          }

          function calculateConjuntoHeight(elements) {
            var total = 0;
            for (var i = 0; i < elements.length; i++) {
              total += getElementHeight(elements[i]);
            }
            return total;
          }

          function fitsInCurrentPage(elements) {
            if (elements.length === 0) return true;
            var firstElement = elements[0];
            var availableSpace = getAvailableSpace(firstElement);
            var totalHeight = calculateConjuntoHeight(elements);
            return totalHeight <= availableSpace - 10; // margem de segurança
          }

          // Implementa exatamente o pseudo-algoritmo fornecido
          function implementPseudoAlgorithm() {
            var requirements = Array.from(document.querySelectorAll('[data-requirement-id]'));
            
            // for requisitos
            for (var reqIndex = 0; reqIndex < requirements.length; reqIndex++) {
              var requirement = requirements[reqIndex];
              var requirementTitle = requirement.querySelector('[data-role="requirement-title"]');
              var criterionSections = requirement.querySelectorAll('.criterion-section');
              
              if (criterionSections.length === 0) continue;
              
              // Elementos do conjunto 1: requisito + critério + análise + cabeçalhos + pelo menos um parâmetro
              var firstCriterion = criterionSections[0];
              var firstTable = firstCriterion.querySelector('table.criterion-table');
              var conjunto1Elements = [];
              
              if (requirementTitle) conjunto1Elements.push(requirementTitle);
              if (firstTable) {
                var thead = firstTable.tHead;
                if (thead) conjunto1Elements.push(thead);
                var tbody = firstTable.tBodies[0];
                if (tbody && tbody.rows[0]) conjunto1Elements.push(tbody.rows[0]);
              }
              
              // (analisar se cabe na página atual o conjunto 1)
              if (!fitsInCurrentPage(conjunto1Elements)) {
                // caso não caiba -> quebra de página
                if (requirementTitle) applyPageBreak(requirementTitle);
              }
              
              // for critérios
              for (var criterionIndex = 0; criterionIndex < criterionSections.length; criterionIndex++) {
                var criterionSection = criterionSections[criterionIndex];
                var tables = criterionSection.querySelectorAll('table.criterion-table');
                
                if (tables.length === 0) continue;
                
                // Primeira tabela do critério
                var firstAnalysisTable = tables[0];
                
                // Elementos do conjunto 2: critério + análise + cabeçalhos + pelo menos um parâmetro
                var conjunto2Elements = [];
                var thead = firstAnalysisTable.tHead;
                if (thead) conjunto2Elements.push(thead);
                var tbody = firstAnalysisTable.tBodies[0];
                if (tbody && tbody.rows[0]) conjunto2Elements.push(tbody.rows[0]);
                
                // (analisar se cabe na página atual o conjunto 2)
                if (criterionIndex > 0 && !fitsInCurrentPage(conjunto2Elements)) {
                  // caso não caiba -> quebra de página + imprime o conjunto 2
                  applyPageBreak(firstAnalysisTable);
                }
                
                // for análises
                for (var analysisIndex = 0; analysisIndex < tables.length; analysisIndex++) {
                  var analysisTable = tables[analysisIndex];
                  
                  if (analysisIndex > 0) {
                    // Elementos do conjunto 3: análise + cabeçalhos + pelo menos um parâmetro
                    var conjunto3Elements = [];
                    var thead = analysisTable.tHead;
                    if (thead) conjunto3Elements.push(thead);
                    var tbody = analysisTable.tBodies[0];
                    if (tbody && tbody.rows[0]) conjunto3Elements.push(tbody.rows[0]);
                    
                    // (analisar se cabe na página atual o conjunto 3)
                    if (!fitsInCurrentPage(conjunto3Elements)) {
                      // caso não caiba -> quebra de página + imprime o conjunto 2
                      applyPageBreak(analysisTable);
                    }
                  }
                  
                  // for parâmetros
                  var tbody = analysisTable.querySelector('tbody');
                  if (tbody) {
                    var parameterRows = Array.from(tbody.children);
                    
                    for (var paramIndex = 0; paramIndex < parameterRows.length; paramIndex++) {
                      var parameterRow = parameterRows[paramIndex];
                      
                      // (analisar se cabe na página atual o parâmetro atual)
                      if (!fitsInCurrentPage([parameterRow])) {
                        // caso não caiba -> quebra de página + imprime o conjunto 2
                        if (paramIndex > 0) {
                          // Cria nova tabela para as linhas restantes
                          var newTable = analysisTable.cloneNode(false);
                          newTable.className = analysisTable.className;
                          
                          // Copia atributos de dados
                          if (analysisTable.dataset && analysisTable.dataset.criterionId) {
                            newTable.dataset.criterionId = analysisTable.dataset.criterionId;
                          }
                          if (analysisTable.dataset && analysisTable.dataset.analysisId) {
                            newTable.dataset.analysisId = analysisTable.dataset.analysisId;
                          }
                          
                          applyPageBreak(newTable);
                          
                          // Reimprime cabeçalhos (conjunto 2)
                          var originalThead = analysisTable.querySelector('thead');
                          if (originalThead) {
                            newTable.appendChild(originalThead.cloneNode(true));
                          }
                          
                          // Move parâmetros restantes
                          var newTbody = document.createElement('tbody');
                          newTable.appendChild(newTbody);
                          
                          for (var moveIndex = paramIndex; moveIndex < parameterRows.length; moveIndex++) {
                            newTbody.appendChild(parameterRows[moveIndex]);
                          }
                          
                          // Insere nova tabela
                          analysisTable.parentNode.insertBefore(newTable, analysisTable.nextSibling);
                          break; // Sai do loop de parâmetros
                        } else {
                          // Primeiro parâmetro não cabe - move tabela inteira
                          applyPageBreak(analysisTable);
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // Esconde cabeçalhos duplicados de critério na mesma página
          function hideDuplicateHeaders() {
            var tables = Array.from(document.querySelectorAll('table.criterion-table'));
            var criterionPages = {};
            
            for (var i = 0; i < tables.length; i++) {
              var table = tables[i];
              var criterionId = table.dataset && table.dataset.criterionId;
              var headerRow = table.querySelector('.criterion-header');
              
              if (!criterionId || !headerRow) continue;
              
              var tableTop = getElementTop(table);
              var tablePage = Math.floor(tableTop / PAGE_HEIGHT_PX);
              
              if (!criterionPages[criterionId]) {
                criterionPages[criterionId] = {};
              }
              
              if (criterionPages[criterionId][tablePage]) {
                // Já existe cabeçalho do critério nesta página - esconde
                headerRow.style.display = 'none';
              } else {
                // Primeira ocorrência do critério nesta página - mantém visível
                headerRow.style.display = '';
                criterionPages[criterionId][tablePage] = true;
              }
            }
          }

          // Executa o algoritmo
          implementPseudoAlgorithm();
          hideDuplicateHeaders();
        })();
      `
    });

    const footerTemplate = `
      <div style="font-size:10px;width:100%;text-align:right;color:#6b7280;padding-right:20mm;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>`;

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '18mm', right: '8mm', bottom: '15mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      printBackground: true
    });

    const filename = buildFilename(context.building, context.report);
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    return { filename, pdf: buffer };
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
    await browser.close();
  }
}