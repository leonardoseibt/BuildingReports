import type { Readable } from 'node:stream';

import { storage } from '../storage';
import type {
  Report,
  Building,
  Requirement,
  Criterion,
  Analysis,
  Parameter,
  AttributeDefinition
} from '@shared/schema';

let jsreportInstancePromise: Promise<any> | null = null;

const technicalFields = [
  { key: 'totalArea', label: 'Área Total', unit: 'm2' },
  { key: 'buildingHeight', label: 'Altura', unit: 'm' },
  { key: 'basementDepth', label: 'Profundidade de Subsolo', unit: 'm' },
  { key: 'floors', label: 'Pavimentos', unit: '' },
  { key: 'units', label: 'Unidades', unit: '' }
];

const levelOrder: Array<'minimum' | 'intermediate' | 'superior'> = ['minimum', 'intermediate', 'superior'];
const levelLabels: Record<string, string> = {
  minimum: 'Min',
  intermediate: 'Int',
  superior: 'Sup'
};

const technicalFieldMap = technicalFields.reduce<Record<string, string>>((acc, field) => {
  const snake = field.key.replace(/([A-Z])/g, '_$1').toLowerCase();
  acc[snake] = field.key;
  return acc;
}, {});

const snakeToCamelOverrides: Record<string, string> = {
  typology_id: 'typologyId',
  noise_class_id: 'noiseClassId',
  aggressiveness_class_id: 'aggressivenessClassId',
  bioclimatic_zone: 'bioclimaticZone',
  isopleth_code: 'isoplethCode'
};

const snakeToCamelMap: Record<string, string> = { ...technicalFieldMap, ...snakeToCamelOverrides };

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatWithSeparators(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeText(value).replace(/\r?\n/g, ' \u2022 ');
}

function hasValuesForSelectedLevels(parameter: Parameter, selectedLevels: string[]): boolean {
  if (!selectedLevels || selectedLevels.length === 0) return true;
  const valueMap: Record<string, unknown> = {
    minimum: parameter.minimumValue,
    intermediate: parameter.intermediateValue,
    superior: parameter.superiorValue
  };
  return selectedLevels.some((level) => {
    const direct = valueMap[level];
    if (direct !== null && direct !== undefined && String(direct).trim() !== '') return true;
    const nested: any = (parameter as any).values?.[level];
    const nestedValue = nested?.value;
    return nestedValue !== null && nestedValue !== undefined && String(nestedValue).trim() !== '';
  });
}

function getAttributeValue(sourceData: any, attribute: AttributeDefinition | undefined): any {
  if (!sourceData || !attribute) return null;

  if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
    return sourceData[attribute.sourceColumn];
  }

  if (attribute.sourceTable === 'buildings') {
    const camel = snakeToCamelMap[attribute.sourceColumn];
    if (camel && sourceData[camel] !== undefined && sourceData[camel] !== null) {
      return sourceData[camel];
    }
  }
  return null;
}

function findRelatedRecord(tableData: any[], attribute: AttributeDefinition, building: Building | undefined): any {
  if (!building || tableData.length === 0) return null;
  const strategies: Array<() => any> = [
    () => {
      const camelCaseId = attribute.sourceTable.replace(/s$/, '') + 'Id';
      const snakeCaseId = attribute.sourceTable.slice(0, -1) + '_id';
      const buildingValue = (building as any)[camelCaseId] || (building as any)[snakeCaseId];
      if (buildingValue) {
        return tableData.find((record) => record.id === buildingValue);
      }
      return null;
    },
    () => {
      const buildingValue = (building as any)[attribute.sourceColumn];
      if (buildingValue !== undefined && buildingValue !== null) {
        return tableData.find((record) =>
          record[attribute.sourceColumn] === buildingValue ||
          record.id === buildingValue ||
          record.code === buildingValue
        );
      }
      return null;
    },
    () => tableData[0]
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result) return result;
  }
  return null;
}

function shouldShowParameter(
  parameter: Parameter,
  attributeDefs: Map<number, AttributeDefinition>,
  building: Building | undefined,
  tableDataByName: Map<string, any[]>
): boolean {
  if (!parameter.attributeId) return true;
  const attribute = attributeDefs.get(parameter.attributeId);
  if (!attribute) return true;
  let sourceData: any = null;

  if (attribute.sourceTable === 'buildings') {
    sourceData = building;
  } else {
    const tableData = tableDataByName.get(attribute.sourceTable) ?? [];
    sourceData = findRelatedRecord(tableData, attribute, building);
  }

  if (!sourceData) return true;

  const attributeValue = getAttributeValue(sourceData, attribute);

  if (attributeValue === null || attributeValue === undefined) return false;

  if (parameter.attributeValueId !== null && parameter.attributeValueId !== undefined) {
    if (String(parameter.attributeValueId) !== String(attributeValue)) return false;
  }

  const numericValue = Number(attributeValue);

  if (!Number.isNaN(numericValue)) {
    if (parameter.minLimit !== null && parameter.minLimit !== undefined) {
      const minLimit = Number(parameter.minLimit);
      if (!Number.isNaN(minLimit) && numericValue <= minLimit) return false;
    }
    if (parameter.maxLimit !== null && parameter.maxLimit !== undefined) {
      const maxLimit = Number(parameter.maxLimit);
      if (!Number.isNaN(maxLimit) && numericValue > maxLimit) return false;
    }
  }
  return true;
}

function sortParameters(params: Parameter[]): Parameter[] {
  return [...params].sort((a, b) => {
    const labelCompare = (a.label || '').localeCompare(b.label || '', 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    });

    if (labelCompare !== 0) return labelCompare;

    const project = (param: Parameter) => {
      const entries = [
        { value: param.minimumValue, priority: 1 },
        { value: param.intermediateValue, priority: 2 },
        { value: param.superiorValue, priority: 3 }
      ].filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');

      if (entries.length === 0) {
        return { numericValue: Number.MAX_SAFE_INTEGER, columnPriority: 999, textValue: undefined as string | undefined };
      }

      let bestNumeric = Number.MAX_SAFE_INTEGER;
      let bestPriority = 999;

      for (const entry of entries) {
        const numeric = Number(entry.value);
        if (Number.isNaN(numeric)) continue;
        if (numeric < bestNumeric) {
          bestNumeric = numeric;
          bestPriority = entry.priority;
        } else if (numeric === bestNumeric && entry.priority < bestPriority) {
          bestPriority = entry.priority;
        }
      }

      if (bestNumeric === Number.MAX_SAFE_INTEGER) {
        const textValue = String(entries[0].value).toLowerCase();
        return { numericValue: Number.MAX_SAFE_INTEGER, columnPriority: entries[0].priority, textValue };
      }
      return { numericValue: bestNumeric, columnPriority: bestPriority, textValue: undefined };
    };

    const aData = project(a);
    const bData = project(b);

    if (aData.numericValue !== bData.numericValue) return aData.numericValue - bData.numericValue;
    if (aData.columnPriority !== bData.columnPriority) return aData.columnPriority - bData.columnPriority;
    if (aData.textValue && bData.textValue) return aData.textValue.localeCompare(bData.textValue, 'pt-BR');
    return 0;
  });
}

function normalizeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'boolean') return value ? 'Sim' : '\u2014';
  const text = normalizeText(value);
  if (!text) return '\u2014';
  const lowered = text.toLowerCase();
  if (lowered === 'false' || lowered === 'null' || lowered === 'undefined') return '\u2014';
  return text;
}

function resolveParameterLevelValue(parameter: Parameter, level: string): unknown {
  const map: Record<string, unknown> = {
    minimum: parameter.minimumValue,
    intermediate: parameter.intermediateValue,
    superior: parameter.superiorValue
  };
  const direct = map[level];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
    return direct;
  }
  const nested: any = (parameter as any).values?.[level];
  const nestedValue = nested?.value;
  if (nestedValue !== undefined && nestedValue !== null && String(nestedValue).trim() !== '') {
    return nestedValue;
  }
  return null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type AnalysisRender = Analysis & {
  selectedLevels: string[];
  parameters: Parameter[];
};

type CriterionRender = Criterion & {
  analyses: AnalysisRender[];
};

type RequirementRender = Requirement & {
  criteria: CriterionRender[];
};

interface ReportRenderContext {
  report: Report;
  building: Building;
  sections: RequirementRender[];
}

async function loadTableData(
  table: string,
  building: Building,
  userId: number
): Promise<any[]> {
  switch (table) {
    case 'typologies':
      return storage.listTypologies();
    case 'noise-classes':
    case 'noise_classes':
      return storage.listNoiseClasses();
    case 'aggressiveness-classes':
    case 'aggressiveness_classes':
      return storage.listAggressivenessClasses();
    case 'technicians': {
      const { items } = await storage.listTechnicians(userId, undefined, undefined);
      return items;
    }
    case 'bioclimatic-zones':
    case 'bioclimatic_zones':
      return storage.listBioclimaticZones();
    case 'isopleths':
      return storage.listIsopleths();
    case 'buildings':
      return [building];
    default:
      return [];
  }
}

async function loadReportContext(reportId: number, userId: number): Promise<ReportRenderContext> {
  const report = await storage.getReport(reportId);
  if (!report || report.isActive === false) {
    throw Object.assign(new Error('Report not found'), { statusCode: 404 });
  }

  const building = await storage.getBuilding(report.buildingId);
  if (!building || building.userId !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  const reportData = typeof report.reportData === 'string'
    ? (() => {
        try {
          return JSON.parse(report.reportData);
        } catch {
          return {};
        }
      })()
    : (report.reportData || {});
  const evaluations = Array.isArray((reportData as any).evaluations) ? (reportData as any).evaluations : [];

  const selectedEvaluations = new Map<string, string[]>();
  for (const evaluation of evaluations) {
    const level = evaluation?.level;
    if (!level) continue;
    const key = evaluation?.analysisId
      ? `analysis-${evaluation.analysisId}`
      : evaluation?.criterionId
        ? `crit-${evaluation.criterionId}`
        : evaluation?.requirementId
          ? `req-${evaluation.requirementId}`
          : undefined;
    if (!key) continue;
    if (!selectedEvaluations.has(key)) selectedEvaluations.set(key, []);
    const list = selectedEvaluations.get(key)!;
    if (!list.includes(level)) list.push(level);
  }

  const [
    requirements,
    criteria,
    analysesRaw,
    parametersRaw,
    attributeDefinitions
  ] = await Promise.all([
    storage.listRequirements(),
    storage.listCriteria(),
    storage.listAnalyses(),
    storage.listParameters(),
    storage.listAttributeDefinitions({})
  ]);

  const attributeMap = new Map<number, AttributeDefinition>();
  for (const attribute of attributeDefinitions) {
    attributeMap.set(attribute.id, attribute);
  }

  const tableDataByName = new Map<string, any[]>();
  tableDataByName.set('buildings', [building]);
  const extraTables = Array.from(new Set(attributeDefinitions
    .map((attribute) => attribute.sourceTable)
    .filter((name) => name && name !== 'buildings')));
  for (const table of extraTables) {
    const data = await loadTableData(table, building, building.userId);
    tableDataByName.set(table, data);
  }

  const groupedData = requirements
    .map((requirement) => {
      const criteriaForRequirement = criteria
        .filter((criterion) =>
          analysesRaw.some((analysis) => analysis.requirementId === requirement.id && analysis.criterionId === criterion.id)
        )
        .map((criterion) => {
          const analysesForCriterion = analysesRaw
            .filter((analysis) => analysis.requirementId === requirement.id && analysis.criterionId === criterion.id)
            .map((analysis) => {
              const params = parametersRaw
                .filter((parameter) => parameter.analysisId === analysis.id && parameter.isActive !== false)
                .filter((parameter) => shouldShowParameter(parameter, attributeMap, building, tableDataByName));
              const sortedParams = sortParameters(params);
              if (sortedParams.length === 0) return null;
              return { ...analysis, parameters: sortedParams };
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
    sections: sortedSections
  };
}

function buildFilename(building: Building, report: Report): string {
  const name = building.name ? building.name.replace(/[^a-zA-Z0-9-_]+/g, '_') : 'Relatorio';
  const date = (report.generatedAt ? new Date(report.generatedAt) : new Date())
    .toLocaleDateString('pt-BR')
    .replace(/\//g, '-');
  return `PDE_${name}_${date}.pdf`;
}

function buildReportHtml(context: ReportRenderContext): string {
  const { report, building, sections } = context;
  const title = building?.name ? normalizeText(building.name) : `Relatório ${report.id}`;

  const requirementsHtml = sections.map((requirement) => {
    const criteriaHtml = requirement.criteria.map((criterion) => {
      const analysesHtml = criterion.analyses.map((analysis) => {
        const parametersHtml = analysis.parameters.map((parameter) => {
          const observation = parameter.notes ?? (parameter as any).observation ?? null;
          const levelsHtml = analysis.selectedLevels.map((level) => {
            const value = resolveParameterLevelValue(parameter, level);
            const display = normalizeDisplayValue(value);
            return `<li><span class="level-label">${escapeHtml(levelLabels[level] || level)}</span> <span class="level-value">${escapeHtml(display)}</span></li>`;
          }).join('');

          const unit = parameter.unit ? `<span class="parameter-unit">${escapeHtml(normalizeDisplayValue(parameter.unit))}</span>` : '';
          const notes = observation ? `<div class="parameter-notes">${escapeHtml(formatWithSeparators(observation))}</div>` : '';

          return `
            <li class="parameter">
              <div class="parameter-header">
                <span class="parameter-name">${escapeHtml(formatWithSeparators(parameter.label ?? ''))}</span>
                ${unit}
              </div>
              ${notes}
              <ul class="parameter-levels">${levelsHtml}</ul>
            </li>
          `;
        }).join('');

        return `
          <div class="analysis">
            <h4>${escapeHtml(analysis.code)} - ${escapeHtml(formatWithSeparators(analysis.label ?? ''))}</h4>
            <ul class="parameters">${parametersHtml}</ul>
          </div>
        `;
      }).join('');

      return `
        <div class="criterion">
          <h3>${escapeHtml(criterion.code)} - ${escapeHtml(formatWithSeparators(criterion.label ?? ''))}</h3>
          ${analysesHtml}
        </div>
      `;
    }).join('');

    return `
      <section class="requirement" data-requirement-id="${requirement.id}">
        <h2>${escapeHtml(requirement.code)} - ${escapeHtml(formatWithSeparators(requirement.label ?? ''))}</h2>
        ${criteriaHtml}
      </section>
    `;
  }).join('');

  const content = requirementsHtml || '<p class="empty">Nenhum requisito disponível.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title || 'Relatório')}</title>
    <style>
      body { font-family: 'Inter', Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
      h1, h2, h3, h4 { margin: 0 0 8px; font-weight: 600; }
      h1 { font-size: 24px; margin-bottom: 16px; }
      h2 { font-size: 20px; margin-top: 24px; color: #1f2937; }
      h3 { font-size: 18px; margin-top: 16px; color: #374151; }
      h4 { font-size: 16px; margin-top: 12px; color: #4b5563; }
      .requirement { border-top: 1px solid #d1d5db; padding-top: 16px; margin-top: 16px; }
      .criterion { margin-left: 16px; padding-left: 16px; border-left: 3px solid #e5e7eb; }
      .analysis { margin-left: 16px; padding-left: 16px; border-left: 2px solid #e5e7eb; }
      .parameters { list-style: none; padding-left: 0; margin: 8px 0 16px; }
      .parameter { margin-bottom: 12px; }
      .parameter-header { display: flex; gap: 8px; align-items: baseline; font-weight: 500; }
      .parameter-unit { font-size: 12px; color: #6b7280; text-transform: uppercase; }
      .parameter-notes { font-size: 12px; color: #4b5563; margin: 4px 0 8px; }
      .parameter-levels { list-style: none; padding-left: 0; margin: 0; display: flex; gap: 12px; flex-wrap: wrap; }
      .level-label { font-weight: 600; color: #2563eb; margin-right: 4px; }
      .level-value { color: #111827; }
      .empty { font-style: italic; color: #6b7280; }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
    </header>
    <main>
      ${content}
    </main>
  </body>
</html>`;
}

async function getJsReportInstance() {
  if (!jsreportInstancePromise) {
    jsreportInstancePromise = (async () => {
      // @ts-expect-error jsreport does not provide ESM typings compatible with dynamic import
      const mod = await import('jsreport');
      const factory = (mod as any)?.default ?? (mod as any);
      const instance = factory({
        trustUserCode: false,
        loadConfig: false,
        allowLocalFilesAccess: true,
        reportTimeout: 120000,
        extensions: {
          express: { enabled: false }
        },
        chrome: {
          strategy: 'chrome-pool',
          numberOfWorkers: 1,
          launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        }
      });
      await instance.init();
      return instance;
    })();
  }
  return jsreportInstancePromise;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (chunk == null) continue;
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, 'utf-8'));
    } else if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    } else if (typeof chunk === 'number') {
      chunks.push(Buffer.from([chunk]));
    } else if (Array.isArray(chunk) && chunk.every((value) => typeof value === 'number')) {
      chunks.push(Buffer.from(chunk));
    } else if (typeof chunk === 'object' && typeof (chunk as any).valueOf === 'function') {
      const value = (chunk as any).valueOf();
      if (typeof value === 'number') {
        chunks.push(Buffer.from([value]));
        continue;
      }
      if (Buffer.isBuffer(value)) {
        chunks.push(value);
        continue;
      }
    } else if ((chunk as any)?.pipe) {
      chunks.push(await streamToBuffer(chunk as unknown as Readable));
      continue;
    } else {
      chunks.push(Buffer.from(String(chunk)));
    }
  }
  return Buffer.concat(chunks);
}

export async function generateReportPdfJsreport(reportId: number, userId: number): Promise<{ filename: string; pdf: Buffer }> {
  const context = await loadReportContext(reportId, userId);
  const html = buildReportHtml(context);
  const filename = buildFilename(context.building, context.report);
  const instance = await getJsReportInstance();

  const commonTimeout = 120000;
  const result = await instance.render({
    template: {
      content: html,
      engine: 'none',
      recipe: 'chrome-pdf',
      chrome: {
        printBackground: true,
        waitForNetworkIdle: true,
        timeout: commonTimeout,
        marginTop: '18mm',
        marginBottom: '15mm',
        marginLeft: '10mm',
        marginRight: '8mm',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      }
    },
    timeout: commonTimeout
  });

  const content = result.content as Readable | Buffer | Uint8Array | string | null | undefined;
  let pdf: Buffer;
  if (Buffer.isBuffer(content)) {
    pdf = content;
  } else if (content instanceof Uint8Array) {
    pdf = Buffer.from(content);
  } else if (typeof content === 'string') {
    pdf = Buffer.from(content, 'utf-8');
  } else if (Array.isArray(content)) {
    const asArray = content as Array<unknown>;
    if (asArray.every((value) => typeof value === 'number')) {
      pdf = Buffer.from(asArray as number[]);
    } else {
      pdf = Buffer.from(String(content));
    }
  } else if (content && typeof (content as any).pipe === 'function') {
    const stream = content as Readable;
    pdf = await streamToBuffer(stream);
    if (typeof (stream as any)?.destroy === 'function') {
      try {
        (stream as any).destroy();
      } catch {
        // ignore stream cleanup errors
      }
    }
  } else if (content == null) {
    pdf = Buffer.alloc(0);
  } else {
    pdf = Buffer.from(String(content));
  }
  return { filename, pdf };
}
