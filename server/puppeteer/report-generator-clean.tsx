import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import puppeteer from 'puppeteer';
import * as storage from '../storage';
import type {
  Building,
  Report,
  Requirement,
  Criterion,
  Analysis,
  Parameter,
  AttributeDefinition,
  Typology,
  NoiseClass,
  AggressivenessClass,
  Technician,
  BioclimaticZone,
  Isopleth
} from '../../shared/schema';

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
  return normalizeText(value).replace(/\r?\n/g, ' • ');
}

function hasValuesForSelectedLevels(parameter: Parameter, selectedLevels: string[]): boolean {
  if (!selectedLevels || selectedLevels.length === 0) return false;
  const valueMap: Record<string, unknown> = {
    minimum: parameter.minimumValue,
    intermediate: parameter.intermediateValue,
    superior: parameter.superiorValue
  };
  return selectedLevels.some((level) => {
    const value = valueMap[level];
    return value !== null && value !== undefined && value !== '';
  });
}

function getAttributeValue(sourceData: any, attribute: AttributeDefinition | undefined): any {
  if (!sourceData || !attribute) return null;

  if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
    return sourceData[attribute.sourceColumn];
  }

  if (attribute.sourceTable === 'buildings') {
    const camelKey = snakeToCamelMap[attribute.sourceColumn] || attribute.sourceColumn;
    if (sourceData[camelKey] !== undefined && sourceData[camelKey] !== null) {
      return sourceData[camelKey];
    }
  }
  return null;
}

function findRelatedRecord(tableData: any[], attribute: AttributeDefinition, building: Building | undefined): any {
  if (!building || tableData.length === 0) return null;
  const strategies: Array<() => any> = [
    () => {
      if (attribute.sourceColumn === 'bioclimatic_zone' && building.bioclimaticZone) {
        return tableData.find((item) => item.code === building.bioclimaticZone);
      }
      if (attribute.sourceColumn === 'isopleth_code' && building.isoplethCode) {
        return tableData.find((item) => item.code === building.isoplethCode);
      }
      return null;
    },
    () => {
      const buildingValue = getAttributeValue(building, attribute);
      if (buildingValue === null || buildingValue === undefined) return null;
      return tableData.find((item) => item.id === buildingValue);
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
    const tableData = tableDataByName.get(attribute.sourceTable) || [];
    sourceData = findRelatedRecord(tableData, attribute, building);
  }

  if (!sourceData) return false;

  const attributeValue = getAttributeValue(sourceData, attribute);

  if (attributeValue === null || attributeValue === undefined) return false;

  if (parameter.attributeValueId !== null && parameter.attributeValueId !== undefined) {
    return attributeValue === parameter.attributeValueId;
  }

  const numericValue = Number(attributeValue);

  if (!Number.isNaN(numericValue)) {
    if (parameter.minValue !== null && parameter.minValue !== undefined && numericValue < parameter.minValue) {
      return false;
    }
    if (parameter.maxValue !== null && parameter.maxValue !== undefined && numericValue > parameter.maxValue) {
      return false;
    }
  }
  return true;
}

function sortParameters(params: Parameter[]): Parameter[] {
  return [...params].sort((a, b) => {
    const aPriority = a.columnPriority ?? 999;
    const bPriority = b.columnPriority ?? 999;
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aColumnLabel = a.columnLabel || '';
    const bColumnLabel = b.columnLabel || '';
    if (aColumnLabel !== bColumnLabel) return aColumnLabel.localeCompare(bColumnLabel, 'pt-BR');

    const getDisplayValue = (param: Parameter) => {
      if (param.minimumValue !== null && param.minimumValue !== undefined) {
        return normalizeDisplayValue(param.minimumValue);
      }
      if (param.intermediateValue !== null && param.intermediateValue !== undefined) {
        return normalizeDisplayValue(param.intermediateValue);
      }
      if (param.superiorValue !== null && param.superiorValue !== undefined) {
        return normalizeDisplayValue(param.superiorValue);
      }
      return '';
    };

    const aDisplayValue = getDisplayValue(a);
    const bDisplayValue = getDisplayValue(b);

    const parseValue = (val: string) => {
      const cleanedValue = val.replace(/[^\d.,\-+]/g, '').replace(',', '.');
      const numericValue = parseFloat(cleanedValue);
      return Number.isNaN(numericValue) ? null : numericValue;
    };

    const aData = {
      columnPriority: aPriority,
      textValue: aDisplayValue,
      numericValue: parseValue(aDisplayValue)
    };

    const bData = {
      columnPriority: bPriority,
      textValue: bDisplayValue,
      numericValue: parseValue(bDisplayValue)
    };

    if (aData.columnPriority !== bData.columnPriority) return aData.columnPriority - bData.columnPriority;
    if (aData.textValue && bData.textValue) return aData.textValue.localeCompare(bData.textValue, 'pt-BR');
    return 0;
  });
}

function normalizeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : '—';
  const text = normalizeText(value);
  if (!text) return '—';
  const lowered = text.toLowerCase();
  if (lowered === 'false' || lowered === 'null' || lowered === 'undefined') return '—';
  return text;
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
  typologies: Typology[];
  noiseClasses: NoiseClass[];
  aggressivenessClasses: AggressivenessClass[];
  technicians: Technician[];
  bioclimaticZones: BioclimaticZone[];
  isopleths: Isopleth[];
}

interface BuildingInfoRow {
  label: string;
  value: string;
  unit?: string | null;
}

interface BuildingInfoSection {
  title: string;
  rows: BuildingInfoRow[];
}

function formatNumericDisplay(value: number): string {
  const hasDecimal = Math.abs(value % 1) > 1e-6;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: hasDecimal ? 2 : 0
  });
}

function formatBuildingFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return formatNumericDisplay(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const direct = Number(trimmed);

    if (!Number.isNaN(direct) && Number.isFinite(direct)) {
      return formatNumericDisplay(direct);
    }

    if (trimmed.includes(',') && !trimmed.includes('.')) {
      const replaced = trimmed.replace(',', '.');
      const parsed = Number(replaced);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return formatNumericDisplay(parsed);
      }
    }

    if (
      trimmed.includes(',') &&
      trimmed.includes('.') &&
      trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
    ) {
      const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
      const parsed = Number(cleaned);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return formatNumericDisplay(parsed);
      }
    }

    return trimmed;
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Nao';
  }

  return String(value);
}

function buildBuildingInfoSections(
  building: Building,
  report: Report,
  helpers: {
    typologies: Typology[];
    technicians: Technician[];
    noiseClasses: NoiseClass[];
    aggressivenessClasses: AggressivenessClass[];
    bioclimaticZones: BioclimaticZone[];
    isopleths: Isopleth[];
  }
): BuildingInfoSection[] {
  const sections: BuildingInfoSection[] = [];

  const identificationRows: BuildingInfoRow[] = [];
  const buildingName = normalizeText(building?.name);
  const fallbackId = report.buildingId ?? building.id;
  const displayName = buildingName || (fallbackId ? `Edificacao ID ${fallbackId}` : 'Edificacao');

  identificationRows.push({
    label: 'Nome da Edificacao',
    value: displayName
  });

  const typologyInfo = getTypologyInfo(building, helpers.typologies);

  if (typologyInfo) {
    identificationRows.push({
      label: 'Tipologia',
      value: typologyInfo
    });
  }

  const technicianInfo = getTechnicianInfo(building, helpers.technicians);
  if (technicianInfo) {
    identificationRows.push({
      label: 'Responsável Técnico',
      value: technicianInfo
    });
  }

  if (identificationRows.length > 0) {
    sections.push({
      title: 'Identificação',
      rows: identificationRows
    });
  }

  const formattedAddress = getFormattedAddress(building);
  if (formattedAddress) {
    sections.push({
      title: 'Localização',
      rows: [
        {
          label: 'Endereço Completo',
          value: formattedAddress
        }
      ]
    });

  }

  const technicalRows = technicalFields
    .map((field) => {
      const rawValue = (building as any)[field.key];
      const formattedValue = formatBuildingFieldValue(rawValue);
      if (!formattedValue) return null;
      return {
        label: field.label,
        value: formattedValue,
        unit: field.unit || null
      } as BuildingInfoRow;
    })
    .filter(Boolean) as BuildingInfoRow[];

  if (technicalRows.length > 0) {
    sections.push({
      title: 'Características Técnicas',
      rows: technicalRows
    });
  }

  const environmentalRows: BuildingInfoRow[] = [];

  const bioclimaticInfo = getBioclimaticZoneInfo(building, helpers.bioclimaticZones);

  if (bioclimaticInfo) {
    environmentalRows.push({
      label: 'Zona Bioclimatica',
      value: bioclimaticInfo
    });
  }

  const isoplethInfo = getIsoplethInfo(building, helpers.isopleths);

  if (isoplethInfo) {
    environmentalRows.push({
      label: 'Isopleta',
      value: isoplethInfo
    });
  }

  const noiseClassInfo = getNoiseClassInfo(building, helpers.noiseClasses);

  if (noiseClassInfo) {
    environmentalRows.push({
      label: 'Classe de Ruido',
      value: noiseClassInfo
    });
  }

  const aggressivenessInfo = getAggressivenessClassInfo(building, helpers.aggressivenessClasses);

  if (aggressivenessInfo) {
    environmentalRows.push({
      label: 'Classe de Agressividade',
      value: aggressivenessInfo
    });
  }

  if (environmentalRows.length > 0) {
    sections.push({
      title: 'Condicoes Ambientais e Classificacoes',
      rows: environmentalRows
    });
  }

  return sections;
}

function getTypologyInfo(building: Building, typologies: Typology[]): string | null {
  if (!building.typologyId) return null;
  const item = typologies.find((t) => t.id === building.typologyId);
  return item ? item.label : null;
}

function getNoiseClassInfo(building: Building, noiseClasses: NoiseClass[]): string | null {
  if (!building.noiseClassId) return null;
  const item = noiseClasses.find((n) => n.id === building.noiseClassId);
  return item ? `${item.code} - ${item.label}` : null;
}

function getAggressivenessClassInfo(building: Building, aggressiveness: AggressivenessClass[]): string | null {
  if (!building.aggressivenessClassId) return null;
  const item = aggressiveness.find((a) => a.id === building.aggressivenessClassId);
  return item ? `${item.code} - ${item.label}` : null;
}

function getTechnicianInfo(building: Building, technicians: Technician[]): string | null {
  if (!building.technicianId) return null;
  const item = technicians.find((t) => t.id === building.technicianId);
  return item ? `${item.fullName} (${item.creaCau ?? 'CREA/CAU'})` : `ID ${building.technicianId}`;
}

function getBioclimaticZoneInfo(building: Building, zones: BioclimaticZone[]): string | null {
  if (!building.bioclimaticZone) return null;
  const item = zones.find((z) => z.code === building.bioclimaticZone);
  return item ? `${item.code} - ${item.label}` : building.bioclimaticZone;
}

function getIsoplethInfo(building: Building, isopleths: Isopleth[]): string | null {
  if (!building.isoplethCode) return null;
  const item = isopleths.find((i) => i.code === building.isoplethCode);
  if (!item) return building.isoplethCode;

  const formatNumber = (raw: any) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return null;
    return num.toFixed(1).replace(/\.0$/, '');
  };

  const min = formatNumber(item.windMinMS);
  const max = formatNumber(item.windMaxMS);
  let range = '';

  if (min !== null && max !== null) {
    range = ` (${min} - ${max} m/s)`;
  } else if (min !== null) {
    range = ` (>= ${min} m/s)`;
  } else if (max !== null) {
    range = ` (<= ${max} m/s)`;
  }

  return `${item.code} - ${item.label}${range}`;
}

function getFormattedAddress(building: Building | undefined): string | null {
  if (!building) return null;
  const parts: string[] = [];

  if (building.street) {
    let street = building.street;
    if (building.addressNumber) street += `, ${building.addressNumber}`;
    parts.push(street);
  }

  if (building.neighborhood) parts.push(building.neighborhood);

  const cityState = [building.city, building.state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);

  if (building.cep) parts.push(`CEP: ${building.cep}`);

  return parts.length ? parts.join(', ') : null;
}

function buildFilename(building: Building, report: Report): string {
  const name = building.name ? building.name.replace(/[^a-zA-Z0-9-_]+/g, '_') : 'Relatorio';
  const date = (report.generatedAt ? new Date(report.generatedAt) : new Date())
    .toLocaleDateString('pt-BR')
    .replace(/\//g, '-');
  return `PDE_${name}_${date}.pdf`;
}

function ReportHtml({ context }: { context: ReportRenderContext }) {
  const { building, sections, typologies, noiseClasses, aggressivenessClasses, technicians, bioclimaticZones, isopleths } = context;

  const buildingInfoSections = buildBuildingInfoSections(building, context.report, {
    typologies,
    technicians,
    noiseClasses,
    aggressivenessClasses,
    bioclimaticZones,
    isopleths
  });

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>Relatório PDE</title>
        <style>{`
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { color: #2563eb; margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #6b7280; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
          .card h2 { font-size: 16px; margin: 0 0 12px 0; color: #374151; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .info-section { }
          .info-section h3 { font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #1f2937; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .info-label { font-weight: 500; color: #4b5563; }
          .info-value { color: #111827; }
          .section { margin-bottom: 24px; }
          .requirement-title { font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 16px; }
          .criterion-section { margin-bottom: 16px; }
          .criterion-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
          .criterion-table th, .criterion-table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
          .criterion-table th { background: #f3f4f6; font-weight: 600; }
          .criterion-header { background: #e5e7eb !important; }
          .criterion-header td { font-weight: 600; color: #374151; }
          .criterion-header--hidden { display: none; }
          .analysis-header { background: #f9fafb !important; }
          .analysis-header td { font-weight: 500; color: #4b5563; }
          .parameter-row td { color: #111827; }
        `}</style>
      </head>

      <body>
        <div className="header">
          <h1>Relatório de Desempenho Energético (PDE)</h1>
          <p>Sistema de Análise e Certificação</p>
        </div>

        <div className="card">
          <h2>Informações da Edificação</h2>
          <div className="info-grid">
            {buildingInfoSections.map((section, index) => (
              <div key={index} className="info-section">
                <h3>{section.title}</h3>
                {section.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="info-row">
                    <span className="info-label">{row.label}:</span>
                    <span className="info-value">
                      {row.value} {row.unit && row.unit}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Quebra de página antes do conteúdo principal */}
        <div style={{ pageBreakBefore: 'always' }}></div>

        {sections.map((requirement) => (
          <div
            key={requirement.id}
            className="section"
            data-requirement-id={String(requirement.id)}
          >
            <h2 className="requirement-title" data-role="requirement-title">
              {requirement.code} - {requirement.label}
            </h2>

            {requirement.criteria.map((criterion, criterionIndex) => (
              <div key={criterion.id} className="criterion-section">
                {criterion.analyses.map((analysis, analysisIndex) => (
                  <table
                    key={analysis.id}
                    className="criterion-table"
                    data-criterion-id={String(criterion.id)}
                    data-analysis-id={String(analysis.id)}
                  >
                    <thead>
                      <tr className="criterion-header">
                        <td colSpan={analysis.selectedLevels.length + 1}>
                          <strong>{criterion.code} - {criterion.label}</strong>
                        </td>
                      </tr>
                      <tr className="analysis-header">
                        <td colSpan={analysis.selectedLevels.length + 1}>
                          {analysis.code} - {analysis.label}
                        </td>
                      </tr>
                      <tr>
                        <th>Parâmetro</th>
                        {analysis.selectedLevels.map((level) => (
                          <th key={level}>{levelLabels[level]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.parameters.map((parameter) => {
                        const values = analysis.selectedLevels.map((level) => {
                          const valueMap: Record<string, unknown> = {
                            minimum: parameter.minimumValue,
                            intermediate: parameter.intermediateValue,
                            superior: parameter.superiorValue
                          };
                          return normalizeDisplayValue(valueMap[level]);
                        });

                        return (
                          <tr key={parameter.id} className="parameter-row">
                            <td>{formatWithSeparators(parameter.columnLabel)}</td>
                            {values.map((value, valueIndex) => (
                              <td key={valueIndex}>{value}</td>
                            ))}
                          </tr>
                        );
                      })}
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
    attributeDefinitions,
    typologies,
    noiseClasses,
    aggressivenessClasses,
    techniciansWrapper,
    bioclimaticZones,
    isopleths
  ] = await Promise.all([
    storage.listRequirements(),
    storage.listCriteria(),
    storage.listAnalyses(),
    storage.listParameters(),
    storage.listAttributeDefinitions({}),
    storage.listTypologies(),
    storage.listNoiseClasses(),
    storage.listAggressivenessClasses(),
    storage.listTechnicians(building.userId, undefined, undefined),
    storage.listBioclimaticZones(),
    storage.listIsopleths()
  ]);

  const technicians = Array.isArray((techniciansWrapper as any)?.items)
    ? (techniciansWrapper as any).items as Technician[]
    : (techniciansWrapper as { items: Technician[] }).items;

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

    // Implementa o pseudo-algoritmo de paginação
    await page.evaluate(() => {
      const MM_TO_PX = 96 / 25.4;
      const TOP_MARGIN_MM = 18;
      const BOTTOM_MARGIN_MM = 15;
      const PAGE_HEIGHT_PX = (297 - TOP_MARGIN_MM - BOTTOM_MARGIN_MM) * MM_TO_PX;
      const topMarginPx = TOP_MARGIN_MM * MM_TO_PX;
      const bodyStyle = window.getComputedStyle(document.body);
      const paddingTop = parseFloat(bodyStyle.paddingTop || '0') || 0;
      const layoutOffset = topMarginPx + paddingTop;

      function getElementTop(element) {
        const rect = element.getBoundingClientRect();
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
        const elementTop = getElementTop(element);
        const currentPage = Math.floor(elementTop / PAGE_HEIGHT_PX);
        const pageBottom = (currentPage + 1) * PAGE_HEIGHT_PX;
        return pageBottom - elementTop;
      }

      function calculateConjuntoHeight(elements) {
        return elements.reduce((sum, el) => sum + getElementHeight(el), 0);
      }

      function fitsInCurrentPage(elements) {
        if (elements.length === 0) return true;
        const firstElement = elements[0];
        const availableSpace = getAvailableSpace(firstElement);
        const totalHeight = calculateConjuntoHeight(elements);
        return totalHeight <= availableSpace - 10; // margem de segurança
      }

      function pageOf(element) {
        return Math.floor(getElementTop(element) / PAGE_HEIGHT_PX);
      }

      // Implementa exatamente o pseudo-algoritmo fornecido
      function implementPseudoAlgorithm() {
        const requirements = Array.from(document.querySelectorAll('[data-requirement-id]'));
        
        // for requisitos
        for (const requirement of requirements) {
          const requirementTitle = requirement.querySelector('[data-role="requirement-title"]');
          const criterionSections = requirement.querySelectorAll('.criterion-section');
          
          if (criterionSections.length === 0) continue;
          
          // Elementos do conjunto 1: requisito + critério + análise + cabeçalhos + pelo menos um parâmetro
          const firstCriterion = criterionSections[0];
          const firstTable = firstCriterion.querySelector('table.criterion-table');
          const conjunto1Elements = [];
          
          if (requirementTitle) conjunto1Elements.push(requirementTitle);
          if (firstTable) {
            const thead = firstTable.tHead;
            if (thead) conjunto1Elements.push(thead);
            const tbody = firstTable.tBodies[0];
            if (tbody && tbody.rows[0]) conjunto1Elements.push(tbody.rows[0]);
          }
          
          // (analisar se cabe na página atual o conjunto 1)
          if (!fitsInCurrentPage(conjunto1Elements)) {
            // caso não caiba -> quebra de página
            if (requirementTitle) applyPageBreak(requirementTitle);
          }
          
          // for critérios
          for (let criterionIndex = 0; criterionIndex < criterionSections.length; criterionIndex++) {
            const criterionSection = criterionSections[criterionIndex];
            const tables = criterionSection.querySelectorAll('table.criterion-table');
            
            if (tables.length === 0) continue;
            
            // Primeira tabela do critério
            const firstAnalysisTable = tables[0];
            
            // Elementos do conjunto 2: critério + análise + cabeçalhos + pelo menos um parâmetro
            const conjunto2Elements = [];
            const thead = firstAnalysisTable.tHead;
            if (thead) conjunto2Elements.push(thead);
            const tbody = firstAnalysisTable.tBodies[0];
            if (tbody && tbody.rows[0]) conjunto2Elements.push(tbody.rows[0]);
            
            // (analisar se cabe na página atual o conjunto 2)
            if (criterionIndex > 0 && !fitsInCurrentPage(conjunto2Elements)) {
              // caso não caiba -> quebra de página + imprime o conjunto 2
              applyPageBreak(firstAnalysisTable);
            }
            
            // for análises
            for (let analysisIndex = 0; analysisIndex < tables.length; analysisIndex++) {
              const analysisTable = tables[analysisIndex];
              
              if (analysisIndex > 0) {
                // Elementos do conjunto 3: análise + cabeçalhos + pelo menos um parâmetro
                const conjunto3Elements = [];
                const thead = analysisTable.tHead;
                if (thead) conjunto3Elements.push(thead);
                const tbody = analysisTable.tBodies[0];
                if (tbody && tbody.rows[0]) conjunto3Elements.push(tbody.rows[0]);
                
                // (analisar se cabe na página atual o conjunto 3)
                if (!fitsInCurrentPage(conjunto3Elements)) {
                  // caso não caiba -> quebra de página + imprime o conjunto 2
                  applyPageBreak(analysisTable);
                }
              }
              
              // for parâmetros
              const tbody = analysisTable.querySelector('tbody');
              if (tbody) {
                const parameterRows = Array.from(tbody.children);
                
                for (let paramIndex = 0; paramIndex < parameterRows.length; paramIndex++) {
                  const parameterRow = parameterRows[paramIndex];
                  
                  // (analisar se cabe na página atual o parâmetro atual)
                  if (!fitsInCurrentPage([parameterRow])) {
                    // caso não caiba -> quebra de página + imprime o conjunto 2
                    if (paramIndex > 0) {
                      // Cria nova tabela para as linhas restantes
                      const newTable = analysisTable.cloneNode(false);
                      newTable.className = analysisTable.className;
                      
                      // Copia atributos de dados
                      if (analysisTable.dataset.criterionId) {
                        newTable.dataset.criterionId = analysisTable.dataset.criterionId;
                      }
                      if (analysisTable.dataset.analysisId) {
                        newTable.dataset.analysisId = analysisTable.dataset.analysisId;
                      }
                      
                      applyPageBreak(newTable);
                      
                      // Reimprime cabeçalhos (conjunto 2)
                      const originalThead = analysisTable.querySelector('thead');
                      if (originalThead) {
                        newTable.appendChild(originalThead.cloneNode(true));
                      }
                      
                      // Move parâmetros restantes
                      const newTbody = document.createElement('tbody');
                      newTable.appendChild(newTbody);
                      
                      for (let moveIndex = paramIndex; moveIndex < parameterRows.length; moveIndex++) {
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
        const tables = Array.from(document.querySelectorAll('table.criterion-table'));
        const criterionPages = new Map();
        
        for (const table of tables) {
          const criterionId = table.dataset && table.dataset.criterionId;
          const headerRow = table.querySelector('.criterion-header');
          
          if (!criterionId || !headerRow) continue;
          
          const tableTop = getElementTop(table);
          const tablePage = Math.floor(tableTop / PAGE_HEIGHT_PX);
          
          if (!criterionPages.has(criterionId)) {
            criterionPages.set(criterionId, new Set());
          }
          
          const pages = criterionPages.get(criterionId);
          
          if (pages.has(tablePage)) {
            // Já existe cabeçalho do critério nesta página - esconde
            headerRow.style.display = 'none';
          } else {
            // Primeira ocorrência do critério nesta página - mantém visível
            headerRow.style.display = '';
            pages.add(tablePage);
          }
        }
      }

      // Executa o algoritmo
      implementPseudoAlgorithm();
      hideDuplicateHeaders();
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