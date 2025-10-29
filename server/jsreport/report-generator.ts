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
  predominant_color_id: 'predominantColorId',
  bioclimatic_zone_id: 'bioclimaticZoneId',
  isopleth_id: 'isoplethId',
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

  // CORRIGIDO: Tentar camelCase PRIMEIRO (Drizzle ORM retorna camelCase)
  if (attribute.sourceTable === 'buildings') {
    const camel = snakeToCamelMap[attribute.sourceColumn];
    if (camel && sourceData[camel] !== undefined && sourceData[camel] !== null) {
      return sourceData[camel];
    }
  }

  // Fallback: snake_case (compatibilidade com SQL direto)
  if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
    return sourceData[attribute.sourceColumn];
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
  // Verifica primeiro atributo
  if (parameter.attributeId) {
    const attribute = attributeDefs.get(parameter.attributeId);
    if (attribute) {
      if (!checkAttributeMatch(parameter, attribute, parameter.attributeValueId, parameter.minLimit, parameter.maxLimit, building, tableDataByName)) {
        return false;
      }
    }
  }

  // Verifica segundo atributo (se definido)
  if ((parameter as any).attribute2Id) {
    const attribute2 = attributeDefs.get((parameter as any).attribute2Id);
    if (attribute2) {
      if (!checkAttributeMatch(parameter, attribute2, (parameter as any).attributeValue2Id, null, null, building, tableDataByName)) {
        return false;
      }
    }
  }

  return true;
}

function checkAttributeMatch(
  parameter: Parameter,
  attribute: AttributeDefinition,
  attributeValueId: number | null | undefined,
  minLimit: string | null | undefined,
  maxLimit: string | null | undefined,
  building: Building | undefined,
  tableDataByName: Map<string, any[]>
): boolean {
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

  if (attributeValueId !== null && attributeValueId !== undefined) {
    if (String(attributeValueId) !== String(attributeValue)) return false;
  }

  const numericValue = Number(attributeValue);

  if (!Number.isNaN(numericValue)) {
    if (minLimit !== null && minLimit !== undefined) {
      const minLimitNum = Number(minLimit);
      if (!Number.isNaN(minLimitNum) && numericValue <= minLimitNum) return false;
    }
    if (maxLimit !== null && maxLimit !== undefined) {
      const maxLimitNum = Number(maxLimit);
      if (!Number.isNaN(maxLimitNum) && numericValue > maxLimitNum) return false;
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
  technician?: any;
  typology?: any;
  noiseClass?: any;
  aggressivenessClass?: any;
  bioclimaticZone?: any;
  isopleth?: any;
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

  // Load report structure from relational tables
  const reportStructure = await storage.loadReportStructure(reportId);

  // Build set of enabled requirement IDs
  const enabledRequirementIds = new Set<number>();
  for (const req of reportStructure.requirements) {
    if (req.isEnabled) {
      enabledRequirementIds.add(req.id);
    }
  }

  // Build selectedEvaluations map - only include analyses that are actually in the report structure
  const selectedEvaluations = new Map<string, string[]>();
  for (const analysis of reportStructure.analyses) {
    const key = `analysis-${analysis.id}`;
    // Only set if there are levels selected. Empty levels means the analysis is not selected.
    if (analysis.levels && analysis.levels.length > 0) {
      selectedEvaluations.set(key, analysis.levels);
    }
  }

  const [
    requirements,
    criteria,
    analysesRaw,
    parametersRaw,
    attributeDefinitions,
    typologies,
    technicians,
    noiseClasses,
    aggressivenessClasses,
    bioclimaticZones,
    isopleths
  ] = await Promise.all([
    storage.listRequirements(),
    storage.listCriteria(),
    storage.listAnalyses(),
    storage.listParameters(),
    storage.listAttributeDefinitions({}),
    storage.listTypologies(),
    storage.listTechnicians(building.userId, undefined, undefined),
    storage.listNoiseClasses(),
    storage.listAggressivenessClasses(),
    storage.listBioclimaticZones(),
    storage.listIsopleths()
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
      // Skip disabled requirements
      if (!enabledRequirementIds.has(requirement.id)) {
        return null;
      }

      const mappedCriteria = requirement.criteria
        .map((criterion) => {
          const analysesWithLevels = criterion.analyses
            .map((analysis) => {
              // Get selected levels from map. If not in map, analysis is not selected - return null.
              const selectedLevels = selectedEvaluations.get(`analysis-${analysis.id}`);
              if (!selectedLevels || selectedLevels.length === 0) return null;

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

  // Match related records by ID/code
  const techniciansList = (technicians as any)?.items || technicians || [];
  const technician = building.technicianId 
    ? Array.isArray(techniciansList) 
      ? techniciansList.find((t: any) => t.id === building.technicianId)
      : undefined
    : undefined;
  
  const typology = building.typologyId 
    ? typologies.find((t: any) => t.id === building.typologyId) 
    : undefined;
  
  const noiseClass = building.noiseClassId 
    ? noiseClasses.find((nc: any) => nc.id === building.noiseClassId) 
    : undefined;
  
  const aggressivenessClass = building.aggressivenessClassId 
    ? aggressivenessClasses.find((ac: any) => ac.id === building.aggressivenessClassId) 
    : undefined;
  
  const bioclimaticZone = building.bioclimaticZoneId 
    ? bioclimaticZones.find((z: any) => z.id === building.bioclimaticZoneId) 
    : undefined;
  
  const isopleth = building.isoplethId 
    ? isopleths.find((i: any) => i.id === building.isoplethId) 
    : undefined;

  return {
    report,
    building,
    sections: sortedSections,
    technician,
    typology,
    noiseClass,
    aggressivenessClass,
    bioclimaticZone,
    isopleth
  };
}

function buildFilename(building: Building, report: Report): string {
  const name = building.name ? building.name.replace(/[^a-zA-Z0-9-_]+/g, '_') : 'Relatorio';
  const date = (report.generatedAt ? new Date(report.generatedAt) : new Date())
    .toLocaleDateString('pt-BR')
    .replace(/\//g, '-');
  return `PDE_${name}_${date}.pdf`;
}

function buildBuildingInfoPage(context: ReportRenderContext): string {
  const { building, technician, typology, noiseClass, aggressivenessClass, bioclimaticZone, isopleth } = context;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '—';
    return escapeHtml(String(value));
  };

  const formatDecimal = (value: any, unit: string = ''): string => {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(2).replace('.', ',')} ${unit}`.trim();
  };

  const formatWithDescription = (code: any, description: any): string => {
    if (!code && !description) return '—';
    if (code && description) return `${formatValue(code)} - ${formatValue(description)}`;
    return formatValue(code || description);
  };

  return `
    <div style="page-break-after: always; padding: 40px 20px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #1e3a8a; text-align: center; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 4px solid #1e40af; padding-bottom: 16px;">
        PERFIL DE DESEMPENHO DA EDIFICAÇÃO - PDE
      </h1>

      <h2 style="font-size: 16px; font-weight: 700; color: #1e3a8a; margin-bottom: 16px; text-transform: uppercase; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
        IDENTIFICAÇÃO
      </h2>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; width: 35%; font-size: 11px;">NOME DA EDIFICAÇÃO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.name)}</td>
        </tr>
        ${technician ? `
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">RESPONSÁVEL TÉCNICO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(technician.fullName)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">ENDEREÇO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.street)}${building.addressNumber ? ', ' + formatValue(building.addressNumber) : ''}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">BAIRRO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.neighborhood)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">CIDADE / ESTADO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.city)} / ${formatValue(building.state)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">CEP</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.cep)}</td>
        </tr>
      </table>

      <h2 style="font-size: 16px; font-weight: 700; color: #1e3a8a; margin-top: 32px; margin-bottom: 16px; text-transform: uppercase; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
        CARACTERÍSTICAS TÉCNICAS
      </h2>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        ${typology ? `
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; width: 35%; font-size: 11px;">TIPOLOGIA</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(typology.label)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; width: 35%; font-size: 11px;">ÁREA TOTAL</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatDecimal(building.totalArea, 'm²')}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">ALTURA DA EDIFICAÇÃO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatDecimal(building.buildingHeight, 'm')}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">PROFUNDIDADE DE SUBSOLO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatDecimal(building.basementDepth, 'm')}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">NÚMERO DE PAVIMENTOS</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.floors)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">NÚMERO DE UNIDADES</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(building.units)}</td>
        </tr>
      </table>

      <h2 style="font-size: 16px; font-weight: 700; color: #1e3a8a; margin-top: 32px; margin-bottom: 16px; text-transform: uppercase; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
        CLASSIFICAÇÕES AMBIENTAIS
      </h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; width: 35%; font-size: 11px;">ZONA BIOCLIMÁTICA</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatWithDescription(bioclimaticZone?.code, bioclimaticZone?.label)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">ISOPLETA</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatWithDescription(isopleth?.code, isopleth?.label)}</td>
        </tr>
        ${noiseClass ? `
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">CLASSE DE RUÍDO</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(noiseClass.label)}</td>
        </tr>
        ` : ''}
        ${aggressivenessClass ? `
        <tr>
          <td style="padding: 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: 700; font-size: 11px;">CLASSE DE AGRESSIVIDADE</td>
          <td style="padding: 12px; border: 1px solid #cbd5e1; font-size: 11px;">${formatValue(aggressivenessClass.label)}</td>
        </tr>
        ` : ''}
      </table>
    </div>
  `;
}

function buildReportHtml(context: ReportRenderContext): string {
  const { report, building, sections } = context;
  const title = building?.name ? normalizeText(building.name) : `Relatório ${report.id}`;

  const requirementsHtml = sections.map((requirement) => {
    const criteriaHtml = requirement.criteria.map((criterion) => {
      const analysesHtml = criterion.analyses.map((analysis) => {
        // Build table rows for parameters
        const parametersRows = analysis.parameters.map((parameter) => {
          const paramLabel = escapeHtml(formatWithSeparators(parameter.label ?? ''));
          const unit = parameter.unit ? escapeHtml(normalizeDisplayValue(parameter.unit)) : '';
          const observation = parameter.notes ?? (parameter as any).observation ?? null;
          const notes = observation ? `<div style="font-size: 9px; color: #4b5563; margin-top: 2px;">${escapeHtml(formatWithSeparators(observation))}</div>` : '';
          
          // Build cells for each selected level
          const levelCells = analysis.selectedLevels.map((level) => {
            const value = resolveParameterLevelValue(parameter, level);
            const displayValue = normalizeDisplayValue(value);
            return `<td style="text-align: center; padding: 6px 8px; border: 1px solid #94a3b8; font-size: 10px; width: 50px; min-width: 50px; white-space: nowrap;">${escapeHtml(displayValue)}</td>`;
          }).join('');
          
          return `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #94a3b8; font-size: 10px;">
                ${paramLabel}
                ${notes}
              </td>
              <td style="text-align: center; padding: 6px 8px; border: 1px solid #94a3b8; font-weight: 700; font-size: 10px; width: 50px; min-width: 50px;">${unit}</td>
              ${levelCells}
            </tr>
          `;
        }).join('');

        // Build header cells for selected levels
        const levelHeaders = analysis.selectedLevels.map((level) => {
          return `<th style="text-align: center; padding: 6px 8px; background-color: #e2e8f0; border: 1px solid #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 10px; width: 50px; min-width: 50px;">${escapeHtml(levelLabels[level])}</th>`;
        }).join('');

        const tableHtml = analysis.parameters.length > 0
          ? `
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 4px; table-layout: fixed;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 6px 8px; background-color: #e2e8f0; border: 1px solid #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 10px;">PARÂMETRO</th>
                  <th style="text-align: center; padding: 6px 8px; background-color: #e2e8f0; border: 1px solid #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 10px; width: 50px; min-width: 50px;">UN</th>
                  ${levelHeaders}
                </tr>
              </thead>
              <tbody>
                ${parametersRows}
              </tbody>
            </table>
          `
          : '<p style="font-style: italic; color: #6b7280; margin: 8px 0; font-size: 10px;">Nenhum parâmetro disponível.</p>';

        return `
          <div style="margin: 12px 0;">
            <div style="background-color: #dbeafe; padding: 6px 10px; font-weight: 600; text-transform: uppercase; font-size: 10px; color: #1e40af; letter-spacing: 0.3px;">
              ANÁLISE: ${escapeHtml(formatWithSeparators(analysis.label ?? ''))}
            </div>
            ${tableHtml}
          </div>
        `;
      }).join('');

      return `
        <div style="margin: 16px 0;">
          <div style="background-color: #dbeafe; padding: 7px 12px; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #1e3a8a; letter-spacing: 0.4px; border-bottom: 2px solid #3b82f6;">
            CRITÉRIO: ${escapeHtml(formatWithSeparators(criterion.label ?? ''))}
          </div>
          ${analysesHtml}
        </div>
      `;
    }).join('');

    return `
      <div style="page-break-after: auto; margin: 24px 0 32px 0;">
        <h2 style="font-size: 16px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; padding-bottom: 6px; border-bottom: 3px solid #1e40af; margin: 0 0 12px 0; letter-spacing: 0.5px;">
          REQUISITO: ${escapeHtml(formatWithSeparators(requirement.label ?? ''))}
        </h2>
        ${criteriaHtml}
      </div>
    `;
  }).join('');

  const buildingInfoPage = buildBuildingInfoPage(context);
  const content = requirementsHtml || '<p style="font-style: italic; color: #6b7280; font-size: 10px;">Nenhum requisito disponível.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title || 'Relatório')}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 10mm 15mm 10mm;
      }
      body {
        font-family: 'Arial', sans-serif;
        color: #1e293b;
        margin: 0;
        padding: 0;
        font-size: 10pt;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      h1, h2 {
        page-break-after: avoid;
      }
    </style>
  </head>
  <body>
    ${buildingInfoPage}
    ${content}
  </body>
</html>`;
}

async function getJsReportInstance() {
  if (!jsreportInstancePromise) {
    jsreportInstancePromise = (async () => {
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