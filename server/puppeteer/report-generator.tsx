import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import puppeteer from 'puppeteer';
import { storage } from '../storage';
import type {
  Report,
  Building,
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
} from '@shared/schema';

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
      const parsed = Number(trimmed.replace(',', '.'));
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return formatNumericDisplay(parsed);
      }
    }

    if (
      trimmed.includes(',') &&
      trimmed.includes('.') &&
      trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
    ) {
      const normalized = trimmed.replace(/\./g, '').replace(',', '.');
      const parsed = Number(normalized);

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

export async function buildReportRenderData(reportId: number, userId: number) {
  const context = await loadReportContext(reportId, userId);
  const buildingInfoSections = buildBuildingInfoSections(context.building, context.report, {
    typologies: context.typologies,
    technicians: context.technicians,
    noiseClasses: context.noiseClasses,
    aggressivenessClasses: context.aggressivenessClasses,
    bioclimaticZones: context.bioclimaticZones,
    isopleths: context.isopleths
  });
  const contextWithInfo = { ...context, buildingInfoSections };
  const html = '<!DOCTYPE html>' + renderToStaticMarkup(<ReportHtml context={contextWithInfo} />);
  const filename = buildFilename(context.building, context.report);
  return { context: contextWithInfo, html, filename };
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

function buildReportJsonPayload(context: ReportRenderContext) {
  const buildingInfo = buildBuildingInfoSections(context.building, context.report, {
    typologies: context.typologies,
    technicians: context.technicians,
    noiseClasses: context.noiseClasses,
    aggressivenessClasses: context.aggressivenessClasses,
    bioclimaticZones: context.bioclimaticZones,
    isopleths: context.isopleths
  });

  const requisitos = context.sections.map((requirement) => ({
    id: requirement.id,
    codigo: requirement.code,
    titulo: normalizeText(requirement.label),
    tituloOriginal: requirement.label,
    criterios: requirement.criteria.map((criterion) => ({
      id: criterion.id,
      codigo: criterion.code,
      titulo: normalizeText(criterion.label),
      tituloOriginal: criterion.label,
      analises: criterion.analyses.map((analysis) => ({
        id: analysis.id,
        codigo: analysis.code,
        titulo: normalizeText(analysis.label),
        tituloOriginal: analysis.label,
        niveisSelecionados: analysis.selectedLevels,
        parametros: analysis.parameters.map((parameter) => {
          const observation = parameter.notes ?? (parameter as any).observation ?? null;
          const valores = analysis.selectedLevels.map((level) => ({
            nivel: level,
            titulo: levelLabels[level] || level,
            valor: resolveParameterLevelValue(parameter, level)
          }));

          return {
            id: parameter.id,
            codigo: (parameter as any).code ?? null,
            titulo: normalizeText(parameter.label),
            tituloOriginal: parameter.label,
            unidade: parameter.unit ?? null,
            observacao: observation ? normalizeText(observation) : null,
            observacaoOriginal: observation,
            valores
          };
        })
      }))
    }))
  }));

  return {
    relatorio: context.report,
    edificacao: context.building,
    informacoesDaEdificacao: buildingInfo,
    meta: {
      tipologias: context.typologies,
      classesDeRuido: context.noiseClasses,
      classesDeAgressividade: context.aggressivenessClasses,
      tecnicos: context.technicians,
      zonasBioclimaticas: context.bioclimaticZones,
      isolinhas: context.isopleths
    },
    requisitos
  };
}

type ReportJsonPayload = ReturnType<typeof buildReportJsonPayload>;

export async function generateReportJson(reportId: number, userId: number): Promise<{ filename: string; payload: ReportJsonPayload; json: string }> {
  const { context, filename } = await buildReportRenderData(reportId, userId);
  const payload = buildReportJsonPayload(context);
  const suggested = filename.replace(/\.pdf$/i, '.json');
  const finalFilename = /\.json$/i.test(suggested) ? suggested : `${suggested}.json`;
  const json = JSON.stringify(payload, null, 2);
  return { filename: finalFilename, payload, json };
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
        <title>Relatorio PDE</title>
        <style>{`
          * { box-sizing: border-box; }
          body {
            font-family: 'Times New Roman', 'Liberation Serif', serif;
            margin: 0;
            padding: 0;
            color: #1f2933;
            background: #eef1f6;
          }
          h1, h2, h3, h4, h5 { margin: 0; }

          .document {
            max-width: 100%;
            margin: 0 auto;
            background: #ffffff;
            padding: 28px 12px 48px;
          }

          .header {
            margin-bottom: 28px;
          }

          .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #1e2a44;
            letter-spacing: 0.4px;
          }

          .header-subtitle {
            font-size: 13px;
            color: #4b5563;
            margin-top: 6px;
          }

          .info-wrapper {
            display: grid;
            gap: 18px;
            margin-bottom: 36px;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            page-break-after: always;
            break-after: page;
          }

          .building-info-section {
            border: 1px solid #d7dce5;
            border-radius: 6px;
            background: #f7f8fb;
            padding: 16px 18px;
          }

          .building-info-title {
            font-size: 12px;
            font-weight: 700;
            color: #2f3b58;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 12px;
            border-bottom: 1px solid #d7dce5;
            padding-bottom: 6px;
          }

          .building-info-table {
            width: 100%;
            border-collapse: collapse;
          }

          .building-info-table tr:not(:last-child) td {
            border-bottom: 1px solid #e2e6ef;
          }

          .building-info-label {
            font-size: 10.5pt;
            font-weight: 600;
            color: #4b5563;
            text-align: left;
            padding: 6px 0;
            width: 48%;
          }

          .building-info-value {
            font-size: 10.5pt;
            color: #111827;
            padding: 6px 0;
            text-align: right;
            width: 52%;
          }

          .section {
            margin-bottom: 28px;
          }

          .section-title {
            font-size: 17pt;
            font-weight: 700;
            text-transform: uppercase;
            color: #1e2a44;
            border-bottom: 3px solid #1e3a8a;
            padding-bottom: 8px;
            margin-bottom: 18px;
            letter-spacing: 0.8px;
            page-break-after: avoid;
            break-after: avoid;
          }

          .criterion-section {
            margin-bottom: 16px;
            background: #ffffff;
            overflow: hidden;
          }

          .analysis-wrapper {
            padding: 10px 0 12px;
          }

          .analysis-wrapper + .analysis-wrapper {
            border-top: 1px solid #e8ecf2;
            padding-top: 12px;
          }

          .criterion-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            border: 1px solid #d5d9e2;
          }
          
          .criterion-table thead {
            display: table-header-group;
          }
          
          .criterion-table tbody {
            display: table-row-group;
          }

          .criterion-header th {
            background: #f2f4f8;
            color: #1f2d4f;
            font-weight: 700;
            font-size: 11.5pt;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            text-align: left;
            padding: 10px 12px;
            border: 1px solid #d5d9e2;
          }

          .analysis-heading-row {
            page-break-after: avoid;
            break-after: avoid;
          }
          
          .analysis-heading-row th {
            background: #e6ecf9;
            color: #1f3a8a;
            font-weight: 600;
            font-size: 11pt;
            text-transform: none;
            text-align: left;
            padding: 9px 12px;
            border: 1px solid #d5d9e2;
          }
          
          .analysis-columns {
            page-break-after: avoid;
            break-after: avoid;
          }

          .criterion-table thead th {
            background: #f1f4fb;
            color: #1f2d4f;
            font-weight: 700;
            font-size: 10.5pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 9px 10px;
            border: 1px solid #d5d9e2;
          }
          
          .criterion-table tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          .criterion-table thead th.param-col {
            text-align: left;
          }
          
          .criterion-table thead th.value-col {
            text-align: center;
          }

          .criterion-table tbody td {
            border: 1px solid #d5d9e2;
            padding: 9px 10px;
            font-size: 10.5pt;
            vertical-align: middle;
          }

          .criterion-table tbody tr:nth-child(even) {
            background: #f9fbff;
          }

          .criterion-table {
            width: 100%;
            table-layout: auto;
          }

          .param-col {
            width: auto;
            min-width: 200px;
            text-align: left;
            vertical-align: top;
          }

          .param-label {
            font-weight: 700;
            color: #1f2d4f;
            letter-spacing: 0.2px;
          }

          .param-observation {
            font-size: 9.5pt;
            color: #4b5563;
            margin-top: 6px;
            line-height: 1.45;
          }

          .value-col {
            width: 1%;
            white-space: nowrap;
            text-align: center;
            vertical-align: middle;
            font-weight: 600;
            color: #1f2d4f;
          }

          @page {
            margin: 18mm 16mm 20mm 16mm;
            @bottom-right {
              content: "Página " counter(page) " de " counter(pages);
              font-size: 9pt;
              color: #6b7280;
            }
          }
        `}</style>
      </head>

      <body>
        <div className="document">
          <div className="header">
            <h1>Perfil de Desempenho da Edificação - PDE</h1>
            <div className="header-subtitle">Relatório técnico detalhado da avaliação de desempenho</div>
          </div>

          {buildingInfoSections.length > 0 && (
            <div className="info-wrapper">
              {buildingInfoSections.map((section: BuildingInfoSection) => (
                <div key={section.title} className="building-info-section">
                  <h3 className="building-info-title">{section.title}</h3>
                  <table className="building-info-table">
                    <tbody>
                      {section.rows.map((row: BuildingInfoRow, index: number) => {
                        const displayValue = row.unit && row.unit.trim() !== ''
                          ? `${formatWithSeparators(row.value)} ${formatWithSeparators(row.unit)}`
                          : formatWithSeparators(row.value);
                        return (
                          <tr key={`${section.title}-${row.label}-${index}`}>
                            <td className="building-info-label">{formatWithSeparators(row.label)}</td>
                            <td className="building-info-value">{displayValue}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {sections.map((requirement) => (
            <div
              key={requirement.id}
              className="section"
              data-requirement-id={String(requirement.id)}
            >
              <h2 className="section-title" data-role="requirement-title">Requisito: {normalizeText(requirement.label)}</h2>

              {requirement.criteria.map((criterion, criterionIndex) => {
                const analysesWithData = criterion.analyses.filter((analysis) => analysis.parameters.length > 0);
                if (analysesWithData.length === 0) {
                  return null;
                }

                const criterionTitle = `Critério: ${normalizeText(criterion.label)}`;

                return (
                  <div key={criterion.id} className="criterion-section" data-criterion-id={String(criterion.id)}>
                    {analysesWithData.map((analysis) => {
                      const columns = ['Parâmetro', 'UN', ...analysis.selectedLevels.map((level) => levelLabels[level] || level)];

                      return (
                        <div key={analysis.id} className="analysis-wrapper">
                          <table
                            className="criterion-table"
                            data-criterion-id={String(criterion.id)}
                            data-analysis-id={String(analysis.id)}
                            data-conjunto="3"
                          >
                            <thead className="analysis-header-group">
                              <tr className="criterion-header">
                                <th colSpan={columns.length}>{criterionTitle}</th>
                              </tr>
                              <tr className="analysis-heading-row">
                                <th colSpan={columns.length}>Análise: {normalizeText(analysis.label)}</th>
                              </tr>
                              <tr className="analysis-columns">
                                {columns.map((column, index) => (
                                  <th key={`${analysis.id}-${column}-${index}`} className={index === 0 ? 'param-col' : 'value-col'}>
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="analysis-data-body">
                              {analysis.parameters.map((parameter) => {
                                const observation = parameter.notes ?? (parameter as any).observation;
                                return (
                                  <tr key={parameter.id}>
                                    <td className="param-col">
                                      <div className="param-label">{formatWithSeparators(parameter.label)}</div>
                                      {observation && (
                                        <div className="param-observation">{formatWithSeparators(observation)}</div>
                                      )}
                                    </td>
                                    <td className="value-col">{normalizeDisplayValue(parameter.unit)}</td>
                                    {analysis.selectedLevels.map((level) => {
                                      const directValue = (level === 'minimum' && parameter.minimumValue)
                                        || (level === 'intermediate' && parameter.intermediateValue)
                                        || (level === 'superior' && parameter.superiorValue);
                                      const nested = (parameter as any).values?.[level];
                                      const fallback = nested?.value;
                                      const value = directValue ?? fallback;

                                      return (
                                        <td key={level} className="value-col">{normalizeDisplayValue(value)}</td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
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
  const { html, filename } = await buildReportRenderData(reportId, userId);
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

    // Paginação inteligente: evita títulos órfãos e garante que tabelas não sejam cortadas
    await page.evaluate(`(function() {
      // Constantes de medida (A4: 297mm altura, margens: 18mm top, 15mm bottom)
      var MM_TO_PX = 96 / 25.4;
      var TOP_MARGIN_MM = 18;
      var BOTTOM_MARGIN_MM = 15;
      var PAGE_HEIGHT_MM = 297;
      var USABLE_HEIGHT_MM = PAGE_HEIGHT_MM - TOP_MARGIN_MM - BOTTOM_MARGIN_MM;
      var PAGE_HEIGHT_PX = USABLE_HEIGHT_MM * MM_TO_PX;
      var TOP_MARGIN_PX = TOP_MARGIN_MM * MM_TO_PX;

      var bodyStyle = window.getComputedStyle(document.body);
      var bodyPaddingTop = parseFloat(bodyStyle.paddingTop || '0') || 0;
      
      // Offset para começar a contar do início do conteúdo (após margens)
      var layoutOffset = TOP_MARGIN_PX + bodyPaddingTop;

      // Margem de segurança para prevenir cortes
      var SAFETY = 25;

      // Funções utilitárias para medições de layout
      function getTop(el) {
        var rect = el.getBoundingClientRect();
        var absoluteTop = rect.top + window.scrollY;
        
        // Normaliza a posição considerando o offset do layout
        // O offsetTop já considera a posição relativa ao documento
        return Math.max(0, absoluteTop - layoutOffset);
      }
      
      function getHeight(el) {
        // offsetHeight inclui padding e border, é mais preciso para cálculos de layout
        // Força o navegador a recalcular se necessário
        var height = el.offsetHeight;
        
        // Se offsetHeight retornar 0, usa getBoundingClientRect como fallback
        if (height === 0) {
          height = el.getBoundingClientRect().height;
        }
        
        return height;
      }
      
      // Calcula altura real de uma linha de tabela, considerando conteúdo multi-linha
      function getRealRowHeight(row) {
        if (!row) return 0;
        
        // Força layout da linha antes de medir
        row.offsetHeight;
        
        // Encontra a célula mais alta da linha (importante para linhas com param-observation)
        var cells = Array.from(row.querySelectorAll('td'));
        var maxCellHeight = 0;
        
        for (var i = 0; i < cells.length; i++) {
          var cell = cells[i];
          // Força cálculo do conteúdo interno
          cell.offsetHeight;
          
          // Verifica se tem param-label e param-observation
          var label = cell.querySelector('.param-label');
          var observation = cell.querySelector('.param-observation');
          
          if (label || observation) {
            // Recalcula altura considerando o conteúdo interno
            var labelHeight = label ? label.offsetHeight : 0;
            var observationHeight = observation ? observation.offsetHeight : 0;
            var cellPadding = parseFloat(window.getComputedStyle(cell).paddingTop || '0') +
                             parseFloat(window.getComputedStyle(cell).paddingBottom || '0');
            var totalCellHeight = labelHeight + observationHeight + cellPadding;
            
            if (totalCellHeight > maxCellHeight) {
              maxCellHeight = totalCellHeight;
            }
          } else {
            var cellHeight = cell.offsetHeight;
            if (cellHeight > maxCellHeight) {
              maxCellHeight = cellHeight;
            }
          }
        }
        
        // Retorna a maior altura encontrada ou o offsetHeight da linha
        var rowHeight = row.offsetHeight;
        return Math.max(maxCellHeight, rowHeight);
      }
      
      function pageOf(y) {
        return Math.floor(y / PAGE_HEIGHT_PX);
      }
      
      function spaceLeftOnPage(y) {
        var currentPage = pageOf(y);
        var pageBottom = (currentPage + 1) * PAGE_HEIGHT_PX;
        return pageBottom - y;
      }
      
      // Funções para controlar quebras de página
      function addPageBreakBefore(el) {
        el.style.pageBreakBefore = 'always';
        el.style.setProperty('break-before', 'page');
      }

      function preventBreakInside(el) {
        el.style.pageBreakInside = 'avoid';
        el.style.setProperty('break-inside', 'avoid');
      }
      
      function clearAllPageBreaks() {
        // Remove apenas page-breaks dinâmicos aplicados por JavaScript
        // Não remove as quebras definidas no CSS (.info-wrapper)
        var allElements = Array.from(document.querySelectorAll('.section-title, table.criterion-table'));
        for (var i = 0; i < allElements.length; i++) {
          allElements[i].style.removeProperty('page-break-before');
          allElements[i].style.removeProperty('break-before');
        }
      }

      // Evita que títulos de requisitos fiquem órfãos (sem conteúdo na mesma página)
      function avoidOrphanRequirementTitles() {
        var requirementSections = Array.from(document.querySelectorAll('[data-requirement-id]'));
        for (var i = 0; i < requirementSections.length; i++) {
          var section = requirementSections[i];
          var title = section.querySelector('.section-title');
          if (!title) continue;

          preventBreakInside(title);

          var nextTable = section.querySelector('table.criterion-table');
          if (!nextTable) continue;

          var titleTop = getTop(title);
          var currentPage = pageOf(titleTop);
          var titleHeight = getHeight(title);
          var tableHeader = nextTable.querySelector('thead');
          var firstRow = nextTable.querySelector('tbody tr');
          var secondRow = nextTable.querySelector('tbody tr:nth-child(2)');
          
          // MUITO RIGOROSO: Exige título + cabeçalho + DUAS primeiras linhas
          // Isso garante contexto suficiente e evita órfãos
          var neededHeight = titleHeight + 10; // +10 para margem do título
          
          if (tableHeader) {
            neededHeight += getHeight(tableHeader);
          }
          if (firstRow) {
            neededHeight += getRealRowHeight(firstRow);
          }
          if (secondRow) {
            neededHeight += getRealRowHeight(secondRow);
          }
          
          var spaceLeft = spaceLeftOnPage(titleTop);

          // Verifica se já está próximo do topo da página
          var distanceFromPageTop = titleTop - (currentPage * PAGE_HEIGHT_PX);
          var isNearPageTop = distanceFromPageTop < 30;

          // Força quebra se não couber
          if (!isNearPageTop && neededHeight > spaceLeft - (SAFETY * 2)) {
            addPageBreakBefore(title);
          }
        }
      }

      // Divide tabelas que não cabem e repete cabeçalhos
      function splitAndRepeatTableHeaders() {
        var tables = Array.from(document.querySelectorAll('table.criterion-table'));
        var newTables = [];

        for (var t = 0; t < tables.length; t++) {
          var table = tables[t];
          var thead = table.tHead || table.querySelector('thead');
          var tbody = table.tBodies[0];
          
          if (!tbody || !thead) continue;

          var rows = Array.from(tbody.querySelectorAll('tr'));
          if (rows.length === 0) continue;

          var tableTop = getTop(table);
          var currentPage = pageOf(tableTop);
          var headerHeight = getHeight(thead);
          var firstRowHeight = getRealRowHeight(rows[0]);
          var spaceLeft = spaceLeftOnPage(tableTop);

          // Verifica se já está próximo do topo
          var distanceFromPageTop = tableTop - (currentPage * PAGE_HEIGHT_PX);
          var isNearPageTop = distanceFromPageTop < 50;
          
          // Se não couber cabeçalho + primeira linha, move tabela inteira
          var minSpaceNeeded = headerHeight + firstRowHeight + SAFETY;
          
          if (!isNearPageTop && spaceLeft < minSpaceNeeded) {
            addPageBreakBefore(table);
            continue;
          }

          // Verifica se a tabela precisa ser dividida
          var currentY = tableTop + headerHeight;
          var rowsToSplit = [];
          var splitAtIndex = -1;
          
          for (var j = 0; j < rows.length; j++) {
            var row = rows[j];
            preventBreakInside(row);
            
            var rowHeight = getRealRowHeight(row);
            var rowSpaceLeft = spaceLeftOnPage(currentY);
            
            // Se a linha não cabe, marca para dividir
            if (rowHeight > rowSpaceLeft - SAFETY && j > 0) {
              splitAtIndex = j;
              break;
            }
            
            currentY += rowHeight;
          }

          // Se precisa dividir, cria nova tabela com cabeçalhos repetidos
          if (splitAtIndex > 0 && splitAtIndex < rows.length) {
            // Clona a estrutura da tabela
            var newTable = table.cloneNode(false);
            newTable.className = table.className;
            
            // Copia datasets
            if (table.dataset) {
              for (var key in table.dataset) {
                if (table.dataset.hasOwnProperty(key)) {
                  newTable.dataset[key] = table.dataset[key];
                }
              }
            }
            
            // Adiciona quebra de página antes da nova tabela
            addPageBreakBefore(newTable);
            
            // Clona o thead COMPLETO (com todas as linhas de cabeçalho)
            var newThead = thead.cloneNode(true);
            newTable.appendChild(newThead);
            
            // Cria novo tbody
            var newTbody = document.createElement('tbody');
            newTable.appendChild(newTbody);
            
            // Move as linhas restantes para a nova tabela
            for (var k = splitAtIndex; k < rows.length; k++) {
              newTbody.appendChild(rows[k]);
            }
            
            // Insere a nova tabela após a original
            if (table.parentNode) {
              table.parentNode.insertBefore(newTable, table.nextSibling);
              newTables.push(newTable);
            }
          }
        }
        
        // Retorna as novas tabelas criadas para processar recursivamente
        return newTables;
      }

      // Oculta cabeçalhos de critério duplicados na mesma página
      function hideDuplicateCriterionHeaders() {
        var tables = Array.from(document.querySelectorAll('table.criterion-table'));
        var seen = new Map();

        for (var i = 0; i < tables.length; i++) {
          var table = tables[i];
          var criterionId = (table.dataset && table.dataset.criterionId) || '';
          var headerRow = table.querySelector('.criterion-header');
          if (!criterionId || !headerRow) continue;

          var top = getTop(table);
          var p = pageOf(top);

          if (!seen.has(criterionId)) {
            seen.set(criterionId, new Set());
          }
          var pages = seen.get(criterionId);

          // Se já vimos este critério nesta página, oculta o cabeçalho
          if (pages.has(p)) {
            headerRow.style.display = 'none';
          } else {
            headerRow.style.display = '';
            pages.add(p);
          }
        }
      }

      // Força o layout para obter alturas reais dos elementos com texto multi-linha
      function forceLayout() {
        // Força o navegador a calcular todos os layouts pendentes
        document.body.offsetHeight;
        
        // Garante que todas as células de parâmetros tenham altura calculada corretamente
        var allCells = Array.from(document.querySelectorAll('.criterion-table tbody td'));
        for (var i = 0; i < allCells.length; i++) {
          // Acessa propriedades que forçam cálculo de layout
          allCells[i].offsetHeight;
        }
        
        // Força cálculo de todas as tabelas
        var allTables = Array.from(document.querySelectorAll('table.criterion-table'));
        for (var t = 0; t < allTables.length; t++) {
          allTables[t].offsetHeight;
        }
      }
      
      // Aplica estilos iniciais de quebra de página
      function applyInitialStyles() {
        var allTables = Array.from(document.querySelectorAll('table.criterion-table'));
        for (var i = 0; i < allTables.length; i++) {
          var table = allTables[i];
          table.style.pageBreakInside = 'auto';
          table.style.setProperty('break-inside', 'auto');
        }
        
        var allTitles = Array.from(document.querySelectorAll('.section-title'));
        for (var t = 0; t < allTitles.length; t++) {
          preventBreakInside(allTitles[t]);
        }
      }

      // Execução da paginação em ordem otimizada
      forceLayout();                        // 0. FORÇA cálculo de layout para obter alturas reais
      clearAllPageBreaks();                 // 1. Limpa estilos anteriores
      applyInitialStyles();                 // 2. Aplica estilos base
      
      // 3. Previne títulos órfãos (MUITO RIGOROSO: exige 2 linhas)
      avoidOrphanRequirementTitles();
      
      // 4. Divide tabelas e repete cabeçalhos (processa recursivamente)
      var newTables = splitAndRepeatTableHeaders();
      var attempts = 0;
      while (newTables.length > 0 && attempts < 10) {
        forceLayout();  // Recalcula após split
        newTables = splitAndRepeatTableHeaders();
        attempts++;
      }
      
      // 5. Remove cabeçalhos de critério duplicados na mesma página
      hideDuplicateCriterionHeaders();
    })();`);

    const footerTemplate = `
      <div style="font-size:10px;width:100%;text-align:right;color:#6b7280;padding-right:8mm;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>`;

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '18mm', right: '8mm', bottom: '15mm', left: '8mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      printBackground: true
    });

    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    return { filename, pdf: buffer };
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
    await browser.close();
  }
}
