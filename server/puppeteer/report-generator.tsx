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
  const html = '<!DOCTYPE html>' + renderToStaticMarkup(<ReportHtml context={context} />);
  const filename = buildFilename(context.building, context.report);
  return { context, html, filename };
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
            padding: 32px 40px 48px;
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
          }

          .building-info-section {
            border: 1px solid #d7dce5;
            border-radius: 6px;
            background: #f7f8fb;
            padding: 16px 18px;
            page-break-inside: avoid;
            break-inside: avoid;
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
            margin-bottom: 40px;
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
            border: 1px solid #d5d9e2;
            border-radius: 8px;
            margin-bottom: 28px;
            background: #ffffff;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .criterion-section--spaced {
            margin-top: 36px;
          }

          .analysis-wrapper {
            padding: 18px 18px 22px;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .analysis-wrapper + .analysis-wrapper {
            border-top: 1px solid #d5d9e2;
          }

          .criterion-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
          }

          .criterion-header th {
            background: #f2f4f8;
            color: #1f2d4f;
            font-weight: 700;
            font-size: 11.5pt;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            text-align: left;
            padding: 12px 16px;
            border: 1px solid #d5d9e2;
          }

          .analysis-heading-row th {
            background: #e6ecf9;
            color: #1f3a8a;
            font-weight: 600;
            font-size: 11pt;
            text-transform: none;
            text-align: left;
            padding: 10px 16px;
            border: 1px solid #d5d9e2;
          }

          .criterion-table thead th {
            background: #f1f4fb;
            color: #1f2d4f;
            font-weight: 700;
            font-size: 10.5pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 10px 8px;
            border: 1px solid #d5d9e2;
          }

          .criterion-table tbody td {
            border: 1px solid #d5d9e2;
            padding: 10px 8px;
            font-size: 10.5pt;
            vertical-align: top;
          }

          .criterion-table tbody tr:nth-child(even) {
            background: #f9fbff;
          }

          .param-col {
            width: 55%;
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
            white-space: nowrap;
            text-align: center;
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

                const previousCriteriaWithParams = requirement.criteria
                  .slice(0, criterionIndex)
                  .some((c) => c.analyses.some((a) => a.parameters.length > 0));
                const criterionClassName = `criterion-section${previousCriteriaWithParams ? ' criterion-section--spaced' : ''}`;
                const criterionTitle = `Critério: ${normalizeText(criterion.label)}`;

                return (
                  <div key={criterion.id} className={criterionClassName} data-criterion-id={String(criterion.id)}>
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

    // Paginação com prevenção de títulos órfãos e cabeçalhos de critério por página
    await page.evaluate(() => {
      const MM_TO_PX = 96 / 25.4;
      // Altura útil: A4 (297mm) - margens top/bottom do PDF (18mm e 15mm)
      const PAGE_HEIGHT_PX = (297 - 18 - 15) * MM_TO_PX;
      const TOP_MARGIN_PX = 18 * MM_TO_PX;

      const bodyStyle = window.getComputedStyle(document.body);
      const paddingTop = parseFloat(bodyStyle.paddingTop || '0') || 0;
      const layoutOffset = TOP_MARGIN_PX + paddingTop;

      const SAFETY = 10; // px

      function getTop(el: Element): number {
        const r = el.getBoundingClientRect();
        return Math.max(0, r.top + window.scrollY - layoutOffset);
      }
      function getHeight(el: Element): number {
        return el.getBoundingClientRect().height;
      }
      function pageOf(y: number): number {
        return Math.floor(y / PAGE_HEIGHT_PX);
      }
      function overflows(el: Element): boolean {
        const top = getTop(el);
        const h = getHeight(el);
        const bottom = (pageOf(top) + 1) * PAGE_HEIGHT_PX;
        return top + h > bottom - SAFETY;
      }
      function addPageBreakBefore(el: HTMLElement) {
        el.style.pageBreakBefore = 'always';
        el.style.setProperty('break-before', 'page');
      }

      function clearPageBreakBefore(el: HTMLElement) {
        el.style.removeProperty('page-break-before');
        el.style.removeProperty('break-before');
      }

      // 1) Evitar títulos órfãos de REQUISITO (h2.section-title)
      function avoidOrphanRequirementTitles() {
        const requirementSections = Array.from(document.querySelectorAll('[data-requirement-id]')) as HTMLElement[];
        for (const section of requirementSections) {
          const title = section.querySelector('.section-title') as HTMLElement | null;
          if (!title) continue;

          // Próximo bloco relevante (primeira .criterion-table dentro da seção)
          const nextTable = section.querySelector('table.criterion-table') as HTMLElement | null;
          if (!nextTable) continue;

          const titleTop = getTop(title);
          const titleHeight = getHeight(title);
          const nextTableHeader = nextTable.querySelector('thead') as HTMLElement | null;
          const requiredBlock = nextTableHeader ?? nextTable;

          const needed = titleHeight + (requiredBlock ? getHeight(requiredBlock) : 0);
          const currentBottom = (pageOf(titleTop) + 1) * PAGE_HEIGHT_PX;

          // Se o título + cabeçalho da próxima tabela não couberem, quebra antes do título
          const shouldBreak = titleTop + needed > currentBottom - SAFETY;
          if (shouldBreak) {
            addPageBreakBefore(title);
          } else {
            clearPageBreakBefore(title);
          }
        }
      }

      // 2) Paginar tabelas de critérios (divisão por linhas), garantindo:
      //    - Se nenhuma linha de dados cabe após os cabeçalhos, move a tabela inteira
      //    - Ao dividir, replica THEAD
      function paginateCriterionTables() {
        const tables = Array.from(document.querySelectorAll('table.criterion-table')) as HTMLTableElement[];

        for (let t = 0; t < tables.length; t++) {
          const table = tables[t];
          const thead = table.tHead as HTMLTableSectionElement | null;
          const tbody = table.tBodies[0] as HTMLTableSectionElement | null;
          if (!tbody) continue;

          const rows = Array.from(tbody.querySelectorAll('tr')) as HTMLTableRowElement[];
          if (rows.length === 0) continue;

          // Verificar se cabe ao menos 1 linha depois do cabeçalho; se não, quebra antes da tabela
          const headerBlock = thead ?? table.querySelector('thead') as HTMLElement | null;
          const headerHeight = headerBlock ? getHeight(headerBlock) : 0;
          const tableTop = getTop(table);
          const currentBottom = (pageOf(tableTop) + 1) * PAGE_HEIGHT_PX;

          // Altura da primeira linha
          const firstRowH = getHeight(rows[0]);

          if (tableTop + headerHeight + firstRowH > currentBottom - SAFETY) {
            // Move tabela inteira para a próxima página (evita cabeçalho órfão)
            addPageBreakBefore(table);
          }

          // Recalcular após possível quebra
          const rowsAfter = Array.from((table.tBodies[0] || tbody).querySelectorAll('tr')) as HTMLTableRowElement[];

          // Percorrer e fatiar quando estourar
          for (let j = 0; j < rowsAfter.length; j++) {
            const row = rowsAfter[j];

            if (overflows(row)) {
              if (j === 0) {
                // Primeira linha estoura (deveria ter sido pego pelo guard acima, mas por segurança)
                addPageBreakBefore(table);
                break;
              } else {
                // Criar nova tabela para as linhas restantes
                const newTable = table.cloneNode(false) as HTMLTableElement;
                newTable.className = table.className;

                // Copiar data-attributes
                (newTable as any).dataset = { ...(table as any).dataset };

                // Quebra antes da nova tabela
                addPageBreakBefore(newTable);

                // Copiar cabeçalho
                if (thead) {
                  newTable.appendChild(thead.cloneNode(true));
                } else {
                  const originalThead = table.querySelector('thead');
                  if (originalThead) newTable.appendChild(originalThead.cloneNode(true));
                }

                // Criar novo tbody e mover as linhas remanescentes
                const newTbody = document.createElement('tbody');
                newTable.appendChild(newTbody);

                for (let k = j; k < rowsAfter.length; k++) {
                  newTbody.appendChild(rowsAfter[k]);
                }

                // Inserir a nova tabela após a atual
                if (table.parentNode) {
                  table.parentNode.insertBefore(newTable, table.nextSibling);
                }
                break;
              }
            }
          }
        }
      }

      // 3) Exibir cabeçalho de CRITÉRIO apenas uma vez por página, mas repetir quando mudar de página.
      function resolveCriterionHeadersPerPage() {
        const tables = Array.from(document.querySelectorAll('table.criterion-table')) as HTMLTableElement[];
        const seen = new Map<string, Set<number>>();

        for (const table of tables) {
          const criterionId = (table as any).dataset?.criterionId || '';
          const headerRow = table.querySelector('.criterion-header') as HTMLElement | null;
          if (!criterionId || !headerRow) continue;

          const top = getTop(table);
          const p = pageOf(top);

          if (!seen.has(criterionId)) {
            seen.set(criterionId, new Set<number>());
          }
          const pages = seen.get(criterionId)!;

          // Se já houve um cabeçalho desse critério nesta página, esconder; senão, mostrar
          if (pages.has(p)) {
            headerRow.style.display = 'none';
          } else {
            headerRow.style.display = '';
            pages.add(p);
          }
        }
      }

      // 4) Evitar órfãos do cabeçalho de ANÁLISE (garantir pelo menos 1 linha de dados após thead)
      function avoidOrphanAnalysisHeaders() {
        const tables = Array.from(document.querySelectorAll('table.criterion-table')) as HTMLTableElement[];

        for (const table of tables) {
          const thead = table.tHead as HTMLTableSectionElement | null;
          const tbody = table.tBodies[0] as HTMLTableSectionElement | null;
          if (!thead || !tbody) continue;

          const firstRow = tbody.querySelector('tr') as HTMLTableRowElement | null;
          if (!firstRow) continue;

          const headerTop = getTop(thead);
          const headerH = getHeight(thead);
          const rowH = getHeight(firstRow);
          const bottom = (pageOf(headerTop) + 1) * PAGE_HEIGHT_PX;

          if (headerTop + headerH + rowH > bottom - SAFETY) {
            // Move a tabela inteira para a próxima página para não deixar análise órfã
            addPageBreakBefore(table);
          }
        }
      }

      // Executar em ordem para minimizar reflows inconsistentes
      function applyTableLayoutAdjustments() {
        paginateCriterionTables();
        avoidOrphanAnalysisHeaders();
        paginateCriterionTables();
        resolveCriterionHeadersPerPage();
      }

      applyTableLayoutAdjustments();
      avoidOrphanRequirementTitles();
      applyTableLayoutAdjustments();
      avoidOrphanRequirementTitles();
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

    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    return { filename, pdf: buffer };
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
    await browser.close();
  }
}
