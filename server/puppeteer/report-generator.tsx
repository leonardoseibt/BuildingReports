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
            font-family: 'Helvetica', Arial, sans-serif;
            margin: 0;
            padding: 24px 0 24px 4mm;
            color: #1f2937;
          }
          h1, h2, h3, h4, h5 { margin: 0; }

          .header { margin-bottom: 24px; }
          .header h1 { font-size: 24px; font-weight: 700; color: #111827; }

          .card { background: #fff; border: 1px solid #d1d5db; padding: 20px; border-radius: 12px; margin-bottom: 24px; }

          .grid { display: grid; gap: 12px; }
          .grid-cols-3 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
          .grid-cols-4 { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }

          .info-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; }
          .info-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; }
          .info-value { font-size: 14px; font-weight: 600; color: #111827; }

          .building-info-section { margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; }
          .building-info-title { font-size: 13px; font-weight: 700; color: #4b5563; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }

          .building-info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .building-info-label { text-align: left !important; width: 28%; background: #e0ecff; color: #1f3a8a; font-weight: 600; padding: 6px 10px; }
          .building-info-value { text-align: left !important; width: 72%; font-weight: bold; padding: 6px 10px; }
          .building-info-value.full { width: 72%; }
          .building-info-unit { text-align: center !important; width: 18%; white-space: nowrap; }

          .section { margin-bottom: 32px; }

          .section-title { font-size: 18px; font-weight: 700; color: #1f2937; border-bottom: 2px solid #4b5563; padding-bottom: 8px; margin-bottom: 16px; text-transform: uppercase; page-break-after: avoid; break-after: avoid; }

          /* Espaço padronizado entre critérios (não força quebra de página) */
          .criterion-section { margin-bottom: 32px; page-break-inside: avoid; break-inside: avoid; }
          .criterion-section--spaced { margin-top: 24px; }

          .criterion-header { page-break-after: avoid; break-after: avoid; }
          .criterion-header th { font-size: 15px; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; padding: 6px 10px; text-transform: uppercase; text-align: left; background: #ffffff; }

          .criterion-header--hidden { display: none !important; }

          .analysis-header { page-break-after: avoid; break-after: avoid; }
          .analysis-header--spaced th { padding-top: 16px; }

          .analysis-header th { background: #e0ecff; color: #1f3a8a; padding: 6px 10px; font-weight: 600; border-radius: 6px 6px 0 0; text-align: left; }

          .analysis-columns { page-break-after: avoid; break-after: avoid; }

          .criterion-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; page-break-inside: auto; break-inside: auto; table-layout: auto; }
          .criterion-table + .criterion-table { margin-top: 24px; }

          /* Cabeçalhos se repetem a cada quebra de página */
          thead { display: table-header-group !important; page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
          thead tr { background: #f3f4f6; }

          .analysis-header-group { display: table-header-group !important; page-break-after: avoid !important; break-after: avoid; page-break-inside: avoid !important; break-inside: avoid; }

          .analysis-data-body { display: table-row-group !important; page-break-before: avoid !important; break-before: avoid; page-break-inside: auto; break-inside: auto; }

          tbody { page-break-inside: auto; break-inside: auto; }
          tbody tr { page-break-inside: avoid; break-inside: avoid; }

          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
          th { text-align: center; font-weight: 600; color: #1f2937; }
          th.value-col, td.value-col { white-space: nowrap; text-align: center; vertical-align: middle; }

          .param-col { width: auto; }
          td { vertical-align: top; }

          .param-label { font-weight: 600; color: #111827; }
          .param-observation { font-size: 11px; color: #4b5563; margin-top: 6px; background: #f9fafb; padding: 6px; border-left: 2px solid #9ca3af; }

          @page {
            margin: 20mm;
            @bottom-right {
              content: "Página " counter(page) " de " counter(pages);
              font-size: 10px;
              color: #6b7280;
            }
          }
        `}</style>
      </head>

      <body>
        <div className="header">
          <h1>Perfil de Desempenho da Edificação - PDE</h1>
        </div>

        <div className="card">
          {buildingInfoSections.length > 0 && (
            <div className="section" style={{ marginBottom: '0' }}>
              {buildingInfoSections.map((section: BuildingInfoSection) => {
                return (
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
                              <td className="building-info-value full">{displayValue}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Página nova apenas para iniciar os requisitos */}
        <div style={{ pageBreakBefore: 'always' }}></div>

        {sections.map((requirement) => (
          <div
            key={requirement.id}
            className="section"
            data-requirement-id={String(requirement.id)}
          >
            <h2 className="section-title" data-role="requirement-title">Requisito: {normalizeText(requirement.label)}</h2>

            {requirement.criteria.map((criterion, criterionIndex) => {
              const criterionHasParameters = criterion.analyses.some((analysis) => analysis.parameters.length > 0);

              const previousCriteriaWithParams = requirement.criteria
                .slice(0, criterionIndex)
                .some((c) => c.analyses.some((a) => a.parameters.length > 0));
              const criterionClassName = `criterion-section${criterionHasParameters && previousCriteriaWithParams ? ' criterion-section--spaced' : ''}`;

              const criterionTitle = `Critério: ${normalizeText(criterion.label)}`;

              return (
                <React.Fragment key={criterion.id}>
                  <div className={criterionClassName}>
                    {criterion.analyses.map((analysis, analysisIndex) => {
                      const columns = ['Parâmetro', 'UN', ...analysis.selectedLevels.map((level) => levelLabels[level] || level)];
                      const headerClass = `analysis-header${analysisIndex > 0 ? ' analysis-header--spaced' : ''}`;

                      return (
                        <table
                          key={analysis.id}
                          className="criterion-table"
                          data-criterion-id={criterion.id}
                          data-analysis-id={analysis.id}
                        >
                          <thead className="analysis-header-group">
                            <tr className="criterion-header">
                              <th colSpan={columns.length}>{criterionTitle}</th>
                            </tr>

                            <tr className={headerClass}>
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
                                    {observation && (<div className="param-observation">{formatWithSeparators(observation)}</div>)}
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
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
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
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    await page.evaluate(() => {
      const MM_TO_PX = 96 / 25.4;
      const TOP_MARGIN_MM = 18;
      const BOTTOM_MARGIN_MM = 15;
      const PAGE_HEIGHT_MM = 297 - TOP_MARGIN_MM - BOTTOM_MARGIN_MM;
      const PAGE_HEIGHT_PX = PAGE_HEIGHT_MM * MM_TO_PX;
      const topMarginPx = TOP_MARGIN_MM * MM_TO_PX;
      const bodyStyle = window.getComputedStyle(document.body);
      const paddingTop = parseFloat(bodyStyle.paddingTop || '0') || 0;
      const layoutOffset = topMarginPx + paddingTop;

      const toRelativeTop = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY - layoutOffset;
      };

      const getPageIndex = (element: Element) => {
        let top = toRelativeTop(element);
        if (top < 0) top = 0;
        return Math.floor(top / PAGE_HEIGHT_PX);
      };

      const applyPageBreakBefore = (element: HTMLElement) => {
        element.style.pageBreakBefore = 'always';
        element.style.setProperty('break-before', 'page');
      };

      const rowOverflows = (row: HTMLTableRowElement) => {
        const rect = row.getBoundingClientRect();
        const rowHeight = rect.height;
        if (rowHeight >= PAGE_HEIGHT_PX - 4) {
          return false;
        }
        let top = rect.top + window.scrollY - layoutOffset;
        if (top < 0) top = 0;
        const bottom = top + rowHeight;
        const pageIndex = Math.floor(top / PAGE_HEIGHT_PX);
        const pageBottom = (pageIndex + 1) * PAGE_HEIGHT_PX;
        return bottom > pageBottom - 0.5;
      };

      const ensureTableStartsWithContent = () => {
        const tables = Array.from(document.querySelectorAll('table.criterion-table')) as HTMLTableElement[];
        for (const table of tables) {
          const tbody = table.tBodies[0];
          if (!tbody) continue;
          const firstRow = tbody.rows[0];
          if (!firstRow) continue;
          if (rowOverflows(firstRow)) {
            applyPageBreakBefore(table);
          }
        }
      };

      const splitTables = () => {
        let safety = 0;
        while (safety < 40) {
          safety += 1;
          let splitOccurred = false;
          const tables = Array.from(document.querySelectorAll('table.criterion-table')) as HTMLTableElement[];
          for (const table of tables) {
            const tbody = table.tBodies[0];
            if (!tbody) continue;
            const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
            for (let index = 0; index < rows.length; index += 1) {
              const row = rows[index];
              if (!rowOverflows(row)) {
                continue;
              }

              const rowHeight = row.getBoundingClientRect().height;
              if (rowHeight >= PAGE_HEIGHT_PX - 4) {
                continue;
              }

              const newTable = table.cloneNode(false) as HTMLTableElement;
              newTable.className = table.className;
              if (table.dataset.criterionId) newTable.dataset.criterionId = table.dataset.criterionId;
              if (table.dataset.analysisId) newTable.dataset.analysisId = table.dataset.analysisId;
              applyPageBreakBefore(newTable);

              if (table.tHead) {
                newTable.appendChild(table.tHead.cloneNode(true));
              }

              const newBody = document.createElement('tbody');
              newTable.appendChild(newBody);

              const rowsToMove = Array.from(tbody.rows).slice(index);
              rowsToMove.forEach((moveRow) => {
                newBody.appendChild(moveRow);
              });

              table.parentNode?.insertBefore(newTable, table.nextSibling);
              splitOccurred = true;
              break;
            }
            if (splitOccurred) break;
          }
          if (!splitOccurred) break;
        }
      };

      const keepRequirementTitleWithContent = () => {
        const sections = Array.from(document.querySelectorAll('[data-requirement-id]')) as HTMLElement[];
        for (const section of sections) {
          const title = section.querySelector('[data-role="requirement-title"]') as HTMLElement | null;
          if (!title) continue;
          const firstTable = section.querySelector('table.criterion-table') as HTMLElement | null;
          if (!firstTable) continue;
          if (getPageIndex(firstTable) > getPageIndex(title)) {
            applyPageBreakBefore(title);
          }
        }
      };

      const hideDuplicateCriterionHeaders = () => {
        const tables = Array.from(document.querySelectorAll('table.criterion-table')) as HTMLTableElement[];
        const lastPageByCriterion = new Map<string, number>();
        for (const table of tables) {
          const criterionId = table.dataset.criterionId;
          const headerRow = table.querySelector('tr.criterion-header') as HTMLTableRowElement | null;
          if (!criterionId || !headerRow) continue;
          headerRow.classList.remove('criterion-header--hidden');
          const pageIndex = getPageIndex(table);
          const lastPage = lastPageByCriterion.get(criterionId);
          if (lastPage !== undefined && lastPage === pageIndex) {
            headerRow.classList.add('criterion-header--hidden');
          } else {
            headerRow.classList.remove('criterion-header--hidden');
            lastPageByCriterion.set(criterionId, pageIndex);
          }
        }
      };

      ensureTableStartsWithContent();
      splitTables();
      ensureTableStartsWithContent();
      splitTables();
      keepRequirementTitleWithContent();
      ensureTableStartsWithContent();
      splitTables();
      hideDuplicateCriterionHeaders();
    });

    const footerTemplate = `
      <div style="font-size:10px;width:100%;text-align:right;color:#6b7280;padding-right:20mm;">
        P\u00E1gina <span class="pageNumber"></span> de <span class="totalPages"></span>
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
      try {
        await page.close();
      } catch (closeError) {
        console.warn('Failed to close Puppeteer page:', closeError);
      }
    }
    await browser.close();
  }
}
