import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensurePdfFonts } from '@/lib/pdf-font-loader';
import type { Building, Requirement, Criterion, Analysis, Parameter } from '@shared/schema';
import '../../styles/pdf-print.css';

// Declaração de tipos para jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

interface ReportItem {
  id: number;
  buildingId: number;
  reportData: any;
  version: number | null;
  isActive: boolean | null;
  generatedAt: Date | null;
  buildingName?: string;
  buildingLocation?: string;
  buildingArea?: string;
  buildingHeight?: string;
  buildingFloors?: number;
}

interface RequirementWithCriteria extends Requirement {
  criteria: (Criterion & { analyses: (Analysis & { parameters: Parameter[] })[] })[];
}

interface ReportPrintProps {
  item: ReportItem;
  onClose: () => void;
}

interface ParameterCellContent {
  type: 'parameterCell';
  description: string;
  observation: string;
  _descriptionLines?: string[];
  _observationLines?: string[];
  _baseLineHeight?: number;
  _observationLineHeight?: number;
}

const isParameterCellContent = (value: unknown): value is ParameterCellContent => {
  return !!value && typeof value === 'object' && (value as ParameterCellContent).type === 'parameterCell';
};

const WINDOWS_1252_EXTENDED_MAP: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f
};

const COMMON_ENCODING_REPLACEMENTS: Record<string, string> = {
  'â€¢': '•',
  'â€“': '–',
  'â€”': '—',
  'â€˜': '‘',
  'â€™': '’',
  'â€œ': '“',
  'â€¦': '…',
  'â„¢': '™',
  'âˆ’': '−',
  'âˆ†': '∆',
  'âˆƒ': '∃',
  'âˆ…': '∅',
  'âˆ‡': '∇',
  'âˆˆ': '∈'
  // Removido: 'â‰¤': '≤' e 'â‰¥': '≥'
};

const COMMON_ENCODING_REGEXES = Object.entries(COMMON_ENCODING_REPLACEMENTS).map(([encoded, decoded]) => ({
  pattern: new RegExp(encoded, 'g'),
  decoded
}));

const applyCommonEncodingFixes = (text: string): string => {
  let fixedText = text;
  for (const { pattern, decoded } of COMMON_ENCODING_REGEXES) {
    fixedText = fixedText.replace(pattern, decoded);
  }
  return fixedText;
};

/**
 * Decodifica entidades HTML mais comuns e referências numéricas/hex (ex.: &le;, &ge;, &lt;=, &#8804;, &#x2265;)
 */
const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';

  let s = text;

  // Mapeamento básico de entidades nomeadas usadas aqui
  const named: Record<string, string> = {
    '&nbsp;': '\u00A0',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&ne;': '≠'
    // Removido: '&le;': '≤', '&ge;': '≥', '&leq;': '≤', '&geq;': '≥'
  };

  Object.entries(named).forEach(([k, v]) => {
    s = s.replace(new RegExp(k, 'gi'), v);
  });

  // Referências numéricas decimais: &#NNNN;
  s = s.replace(/&#(\d+);/g, (_m, dec) => {
    try {
      return String.fromCodePoint(parseInt(dec, 10));
    } catch {
      return _m;
    }
  });

  // Referências numéricas hexadecimais: &#xHHHH;
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return _m;
    }
  });

  // Combinações típicas escritas com entidades: &lt;= e &gt;=
  // Removido: conversões de <= para ≤ e >= para ≥
  s = s.replace(/<\s*>\s*/g, '≠');

  return s;
};

/**
 * Converte apenas os padrões de comparação em seus símbolos (sem alterar < e > isolados).
 * Mantém < e > quando usados como caracteres normais.
 * ATUALIZADO: Removidas as conversões <= para ≤ e >= para ≥
 */
const sanitizeComparisonCharacters = (text: string): string => {
  if (!text) return '';
  return text
    // apenas conversão de <> para ≠
    .replace(/<\s*>\s*/g, '≠')
    .replace(/<>/g, '≠');
  // Removido: todas as conversões de <= e >= para símbolos especiais
};

export default function ReportPrint({ item, onClose }: ReportPrintProps) {
  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['/api/buildings'] });
  const { data: requirements = [] } = useQuery<Requirement[]>({ queryKey: ['/api/requirements'] });
  const { data: criteria = [] } = useQuery<Criterion[]>({ queryKey: ['/api/criteria'] });
  const { data: analyses = [] } = useQuery<Analysis[]>({ queryKey: ['/api/analyses'] });
  const { data: parameters = [] } = useQuery<Parameter[]>({ queryKey: ['/api/parameters'] });
  
  // Buscar dados das tabelas relacionadas para o cabeçalho
  const { data: typologies = [] } = useQuery<any[]>({ queryKey: ['/api/typologies'] });
  const { data: noiseClasses = [] } = useQuery<any[]>({ queryKey: ['/api/noise-classes'] });
  const { data: aggressivenessClasses = [] } = useQuery<any[]>({ queryKey: ['/api/aggressiveness-classes'] });
  const { data: technicians = [] } = useQuery<any[]>({ queryKey: ['/api/technicians'] });
  const { data: bioclimaticZones = [] } = useQuery<any[]>({ queryKey: ['/api/bioclimatic-zones'] });
  const { data: isopleths = [] } = useQuery<any[]>({ queryKey: ['/api/isopleths'] });
  
  // Buscar dados para filtros de atributos
  const { data: attributes = [] } = useQuery<any[]>({ 
    queryKey: ['/api/attributes'],
    queryFn: async () => {
      const r = await fetch('/api/attributes', { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    }
  });

  // Cache para dados de tabelas dinâmicas
  const tableDataCache = new Map<string, any[]>();

  // Função para carregar dados de qualquer tabela dinamicamente
  const getTableData = async (tableName: string): Promise<any[]> => {
    if (tableDataCache.has(tableName)) {
      return tableDataCache.get(tableName)!;
    }

    try {
      const response = await fetch(`/api/${tableName}`, { credentials: 'include' });
      if (!response.ok) {
        console.warn(`Falha ao carregar dados da tabela: ${tableName}`);
        return [];
      }
      const data = await response.json();
      tableDataCache.set(tableName, data);
      return data;
    } catch (error) {
      console.error(`Erro ao carregar tabela ${tableName}:`, error);
      return [];
    }
  };

  /*
   * SISTEMA COMPLETAMENTE GENÉRICO DE ATRIBUTOS
   * (comentários originais mantidos)
   */

  // Função para obter dados de uma tabela específica de forma genérica
  const getTableDataForAttribute = (attribute: any): any[] => {
    const tableName = attribute.sourceTable;
    if (tableName === 'buildings') {
      return buildings;
    }
    if (tableDataCache.has(tableName)) {
      return tableDataCache.get(tableName)!;
    }
    return [];
  };

  // Função para encontrar o registro correto baseado na relação com building
  const findRelatedRecord = (tableData: any[], attribute: any, building: any): any => {
    if (!building || !tableData.length) return null;
    const strategies = [
      () => {
        const camelCaseId = attribute.sourceTable.replace(/s$/, '') + 'Id';
        const snakeCaseId = attribute.sourceTable.slice(0, -1) + '_id';
        const buildingValue = building[camelCaseId] || building[snakeCaseId];
        if (buildingValue) {
          return tableData.find(record => record.id === buildingValue);
        }
        return null;
      },
      () => {
        const buildingValue = building[attribute.sourceColumn];
        if (buildingValue !== undefined && buildingValue !== null) {
          return tableData.find(record => 
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
  };

  const building = buildings.find(b => b.id === item.buildingId);
  const evaluations = item.reportData?.evaluations || [];

  // Funções auxiliares para buscar dados relacionados com código e descrição
  const getTypologyInfo = () => {
    if (!building?.typologyId) return null;
    const typology = typologies.find(t => t.id === building.typologyId);
    return typology ? `${typology.code} - ${typology.label}` : null;
  };

  const getNoiseClassInfo = () => {
    if (!building?.noiseClassId) return null;
    const noiseClass = noiseClasses.find(nc => nc.id === building.noiseClassId);
    return noiseClass ? `${noiseClass.code} - ${noiseClass.label}` : null;
  };

  const getAggressivenessClassInfo = () => {
    if (!building?.aggressivenessClassId) return null;
    const aggressivenessClass = aggressivenessClasses.find(ac => ac.id === building.aggressivenessClassId);
    return aggressivenessClass ? `${aggressivenessClass.code} - ${aggressivenessClass.label}` : null;
  };

  const getTechnicianInfo = () => {
    if (!building?.technicianId) return null;
    const technician = technicians.find(t => t.id === building.technicianId);
    return technician ? `${technician.fullName} (${technician.creaCau})` : `ID ${building.technicianId}`;
  };

  const getBioclimaticZoneInfo = () => {
    if (!building?.bioclimaticZone) return null;
    const zone = bioclimaticZones.find(bz => bz.code === building.bioclimaticZone);
    return zone ? `${zone.code} - ${zone.label}` : building.bioclimaticZone;
  };

  const getIsoplethInfo = () => {
    if (!building?.isoplethCode) return null;
    const isopleth = isopleths.find(i => i.code === building.isoplethCode);
    if (!isopleth) return building.isoplethCode;
    const min = isopleth.windMinMS != null ? parseFloat(isopleth.windMinMS as any) : null;
    const max = isopleth.windMaxMS != null ? parseFloat(isopleth.windMaxMS as any) : null;
    const fmt = (v: number | null) => (v == null || Number.isNaN(v) ? null : v.toFixed(1).replace(/\.0$/, ''));
    let range = '';
    if (min !== null && max !== null) {
      range = ` (${fmt(min)} - ${fmt(max)} m/s)`;
    } else if (min !== null) {
      range = ` (>= ${fmt(min)} m/s)`;
    } else if (max !== null) {
      range = ` (<= ${fmt(max)} m/s)`;
    }
    return `${isopleth.code} - ${isopleth.label}${range}`;
  };

  // Função para formatar endereço brasileiro
  const getFormattedAddress = () => {
    if (!building) return null;
    const parts = [];
    if (building.street) {
      let streetPart = building.street;
      if (building.addressNumber) {
        streetPart += `, ${building.addressNumber}`;
      }
      parts.push(streetPart);
    }
    if (building.neighborhood) {
      parts.push(building.neighborhood);
    }
    if (building.city || building.state) {
      let cityState = '';
      if (building.city) cityState += building.city;
      if (building.state) {
        cityState += cityState ? ` - ${building.state}` : building.state;
      }
      if (cityState) parts.push(cityState);
    }
    if (building.cep) {
      parts.push(`CEP: ${building.cep}`);
    }
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Pré-carregar tabelas comuns baseadas nos atributos existentes
  useEffect(() => {
    const preloadTables = async () => {
      const uniqueTables = new Set(
        attributes
          .filter(attr => attr.sourceTable !== 'buildings')
          .map(attr => attr.sourceTable)
      );
      Array.from(uniqueTables).forEach(tableName => {
        getTableData(tableName).catch(error => {
          console.warn(`Não foi possível pré-carregar tabela ${tableName}:`, error);
        });
      });
    };
    if (attributes.length > 0) {
      preloadTables();
    }
  }, [attributes]);

  const decodeMisencodedText = (text: string): string => {
    if (!text) return '';

    // Primeiro, decodifica entidades HTML (novo passo — cobre &le;, &ge;, &lt;=, &#8804; etc.)
    const withEntitiesDecoded = decodeHtmlEntities(text);

    // Teste de "cara de texto mal-encodado"
    const suspiciousPattern = /(Ã[\u0080-\u00FF]|Â[\u0080-\u00FF]|â[\u0080-\u00FF]|â[\u2000-\u20FF])/;
    if (!suspiciousPattern.test(withEntitiesDecoded)) {
      return applyCommonEncodingFixes(withEntitiesDecoded);
    }

    const byteValues: number[] = [];
    let hasUnmappedChar = false;

    for (const char of withEntitiesDecoded) {
      const code = char.charCodeAt(0);
      if (code <= 0xff) {
        byteValues.push(code);
        continue;
      }
      if (WINDOWS_1252_EXTENDED_MAP[char] !== undefined) {
        byteValues.push(WINDOWS_1252_EXTENDED_MAP[char]);
        continue;
      }
      hasUnmappedChar = true;
      break;
    }

    if (hasUnmappedChar) {
      return applyCommonEncodingFixes(withEntitiesDecoded);
    }

    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const decoded = decoder.decode(new Uint8Array(byteValues));
      return applyCommonEncodingFixes(decoded);
    } catch (error) {
      console.warn('Não foi possível corrigir codificação do texto:', error);
      return applyCommonEncodingFixes(withEntitiesDecoded);
    }
  };

  const normalizePdfText = (text: string): string => {
    // Ordem: decodifica -> corrige comparações -> corrige re-encodes -> limpeza final
    const baseText = sanitizeComparisonCharacters(decodeMisencodedText(text));
    return baseText
      .replace(/\u00a0/g, ' ')
      .replace(/\t/g, ' ')
      .normalize('NFKC');
  };

  const compactPdfText = (text: string): string => {
    return normalizePdfText(text).replace(/\s+/g, ' ').trim();
  };

  // Função para formatar texto com quebras de linha substituídas por separadores
  const formatTextWithSeparators = (text: string | null | undefined): string => {
    if (!text) return '';
    const normalized = normalizePdfText(text);
    return compactPdfText(normalized.replace(/\r?\n/g, ' • '));
  };

  const normalizeDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '—';
    }
    const rawText = typeof value === 'string' ? value : String(value);
    const normalized = normalizePdfText(rawText).trim();
    return normalized === '' ? '—' : normalized;
  };

  // Função para verificar se um parâmetro tem valores nos níveis selecionados
  const hasValuesForSelectedLevels = (parameter: any, selectedLevels: string[]): boolean => {
    if (!selectedLevels || selectedLevels.length === 0) return true;
    const hasMinimum = selectedLevels.includes('minimum') &&
      parameter.minimumValue !== null &&
      parameter.minimumValue !== undefined &&
      String(parameter.minimumValue).trim() !== '';
    const hasIntermediate = selectedLevels.includes('intermediate') &&
      parameter.intermediateValue !== null &&
      parameter.intermediateValue !== undefined &&
      String(parameter.intermediateValue).trim() !== '';
    const hasSuperior = selectedLevels.includes('superior') &&
      parameter.superiorValue !== null &&
      parameter.superiorValue !== undefined &&
      String(parameter.superiorValue).trim() !== '';
    return hasMinimum || hasIntermediate || hasSuperior;
  };

  /**
   * Lógica genérica para exibição de parâmetros (mantida)
   */
  const shouldShowParameter = (parameter: any): boolean => {
    if (!parameter.attributeId) return true;
    const attribute = attributes.find((attr: any) => attr.id === parameter.attributeId);
    if (!attribute) return true;

    let sourceData = null;
    if (attribute.sourceTable === 'buildings') {
      sourceData = building;
    } else {
      const tableData = getTableDataForAttribute(attribute);
      sourceData = findRelatedRecord(tableData, attribute, building);
    }
    if (!sourceData) return true;

    const attributeValue = getAttributeValue(sourceData, attribute);
    if (attributeValue === null || attributeValue === undefined) return false;

    if (parameter.attributeValueId !== null && parameter.attributeValueId !== undefined) {
      const paramValue = String(parameter.attributeValueId);
      const attributeValueStr = String(attributeValue);
      if (paramValue !== attributeValueStr) return false;
    }

    const numericValue = parseFloat(String(attributeValue));
    if (!isNaN(numericValue)) {
      if (parameter.minLimit !== null && parameter.minLimit !== undefined) {
        const minLimit = parseFloat(String(parameter.minLimit));
        if (!isNaN(minLimit) && numericValue < minLimit) return false;
      }
      if (parameter.maxLimit !== null && parameter.maxLimit !== undefined) {
        const maxLimit = parseFloat(String(parameter.maxLimit));
        if (!isNaN(maxLimit) && numericValue > maxLimit) return false;
      }
    }
    return true;
  };

  /**
   * Obtenção genérica de valor de atributo (mantida)
   */
  const getAttributeValue = (sourceData: any, attribute: any): any => {
    if (!sourceData || !attribute) return null;
    if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
      return sourceData[attribute.sourceColumn];
    }
    if (attribute.sourceTable === 'buildings') {
      const snakeToCamelMap: Record<string, string> = {
        'typology_id': 'typologyId',
        'noise_class_id': 'noiseClassId',
        'aggressiveness_class_id': 'aggressivenessClassId',
        'bioclimatic_zone': 'bioclimaticZone',
        'isopleth_code': 'isoplethCode',
        'total_area': 'totalArea',
        'building_height': 'buildingHeight',
      };
      const camelCaseProperty = snakeToCamelMap[attribute.sourceColumn];
      if (camelCaseProperty && sourceData[camelCaseProperty] !== undefined && sourceData[camelCaseProperty] !== null) {
        return sourceData[camelCaseProperty];
      }
    }
    return null;
  };

  /**
   * Ordenação dinâmica de parâmetros (mantida)
   */
  const sortParameters = (params: any[]) => {
    return params.sort((a, b) => {
      const labelCompare = a.label.localeCompare(b.label, 'pt-BR', { 
        numeric: true, 
        sensitivity: 'base' 
      });
      if (labelCompare !== 0) return labelCompare;

      const getParameterSortData = (param: any) => {
        const values = [
          { value: param.minimumValue, column: 'minimum', priority: 1 },
          { value: param.intermediateValue, column: 'intermediate', priority: 2 },
          { value: param.superiorValue, column: 'superior', priority: 3 }
        ];
        const validValues = values.filter(v => 
          v.value !== null && 
          v.value !== undefined && 
          String(v.value).trim() !== ''
        );
        if (validValues.length === 0) {
          return { numericValue: Number.MAX_SAFE_INTEGER, columnPriority: 999 };
        }
        let minNumericValue = Number.MAX_SAFE_INTEGER;
        let columnPriorityForMinValue = 999;
        validValues.forEach(v => {
          const numericValue = parseFloat(String(v.value));
          if (!isNaN(numericValue)) {
            if (numericValue < minNumericValue) {
              minNumericValue = numericValue;
              columnPriorityForMinValue = v.priority;
            } else if (numericValue === minNumericValue && v.priority < columnPriorityForMinValue) {
              columnPriorityForMinValue = v.priority;
            }
          }
        });
        if (minNumericValue === Number.MAX_SAFE_INTEGER) {
          const firstValidValue = validValues[0];
          return { 
            numericValue: Number.MAX_SAFE_INTEGER, 
            columnPriority: firstValidValue.priority,
            textValue: String(firstValidValue.value).toLowerCase()
          };
        }
        return { numericValue: minNumericValue, columnPriority: columnPriorityForMinValue };
      };

      const sortDataA = getParameterSortData(a);
      const sortDataB = getParameterSortData(b);

      if (sortDataA.numericValue !== sortDataB.numericValue) {
        return sortDataA.numericValue - sortDataB.numericValue;
      }
      if (sortDataA.columnPriority !== sortDataB.columnPriority) {
        return sortDataA.columnPriority - sortDataB.columnPriority;
      }
      if (sortDataA.textValue && sortDataB.textValue) {
        return sortDataA.textValue.localeCompare(sortDataB.textValue, 'pt-BR');
      }
      return 0;
    });
  };

  // Criar um mapa de avaliações selecionadas
  const selectedEvaluations = new Map<string, string[]>();
  console.log('Processing evaluations:', evaluations);
  evaluations.forEach((ev: any) => {
    console.log('Evaluation item:', ev);
    const key = ev.analysisId ? `analysis-${ev.analysisId}` : ev.criterionId ? `crit-${ev.criterionId}` : `req-${ev.requirementId}`;
    if (!selectedEvaluations.has(key)) {
      selectedEvaluations.set(key, []);
    }
    if (ev.level && !selectedEvaluations.get(key)!.includes(ev.level)) {
      selectedEvaluations.get(key)!.push(ev.level);
    }
  });
  console.log('Final selectedEvaluations map:', selectedEvaluations);

  // Agrupar dados por Requisito -> Critério -> Análises com Parâmetros
  const groupedData: RequirementWithCriteria[] = requirements.map(req => ({
    ...req,
    criteria: criteria
      .filter(crit => {
        return analyses.some(analysis => 
          (analysis as any).requirementId === req.id && analysis.criterionId === crit.id
        );
      })
      .map(crit => ({
        ...crit,
        analyses: analyses
          .filter(analysis => 
            (analysis as any).requirementId === req.id && analysis.criterionId === crit.id
          )
          .map(analysis => ({
            ...analysis,
            parameters: parameters
              .filter(param => param.analysisId === analysis.id)
              .filter(param => shouldShowParameter(param))
          }))
          .filter(analysis => analysis.parameters.length > 0)
      }))
      .filter(crit => crit.analyses.length > 0)
  }))
  .filter(req => req.criteria.length > 0);

  // Filtrar apenas análises com avaliações selecionadas e aplicar filtro de níveis
  const filteredData = groupedData.map(req => ({
    ...req,
    criteria: req.criteria.map(crit => ({
      ...crit,
      analyses: crit.analyses.filter(analysis => {
        const key = `analysis-${analysis.id}`;
        return selectedEvaluations.has(key) && selectedEvaluations.get(key)!.length > 0;
      }).map(analysis => {
        const analysisKey = `analysis-${analysis.id}`;
        const selectedLevels = selectedEvaluations.get(analysisKey) || [];
        return {
          ...analysis,
          parameters: analysis.parameters.filter(param => 
            hasValuesForSelectedLevels(param, selectedLevels)
          )
        };
      }).filter(analysis => analysis.parameters.length > 0)
    })).filter(crit => crit.analyses.length > 0)
  })).filter(req => req.criteria.length > 0);

  // Ordenação
  const sortedData = filteredData
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(req => ({
      ...req,
      criteria: req.criteria
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(crit => ({
          ...crit,
          analyses: crit.analyses
            .sort((a, b) => a.code.localeCompare(b.code))
            .map(analysis => ({
              ...analysis,
              parameters: sortParameters(analysis.parameters)
            }))
        }))
    }));

  // Função para formatar texto com separadores ao invés de quebras de linha
  const formatTextWithLineBreaks = (text: string): string => {
    if (!text) return '';
    const normalized = normalizePdfText(text);
    const normalizedLineBreaks = normalized
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    const lines = normalizedLineBreaks.split('\n').map(line => {
      return line.replace(/\s+/g, ' ').trim();
    });

    const sanitized = lines.join('\n');
    return sanitized.trim();
  };

  const splitPdfTextIntoLines = (docInstance: jsPDF, text: string, maxWidth: number): string[] => {
    if (!text) return [];

    const segments = text.split('\n');
    const result: string[] = [];

    segments.forEach(segment => {
      if (segment === '') {
        result.push('');
        return;
      }

      const split = docInstance.splitTextToSize(segment, maxWidth);
      if (Array.isArray(split)) {
        result.push(...split);
      } else if (typeof split === 'string') {
        result.push(split);
      }
    });

    return result;
  };

  const generatePDF = async (buildingName?: string) => {
    if (!sortedData || !building) {
      alert('Dados do relatório não carregados.');
      return;
    }

    // Mostrar feedback de loading
    const originalButton = document.querySelector('.pdf-button') as HTMLButtonElement;
    if (originalButton) {
      originalButton.disabled = true;
      originalButton.textContent = 'Gerando PDF...';
    }

    try {
      console.log('=== DEBUG PDF GENERATION ===');
      console.log('Evaluations:', evaluations);
      console.log('Item reportData:', item.reportData);
      console.log('Iniciando geração do PDF com jsPDF...');
      
      // Criar novo documento PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: false
      });

      await ensurePdfFonts(doc);
      doc.setFont('DejaVuSans', 'normal');
      doc.setCharSpace(0);

      // Configurações de página
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      
      let yPosition = margin;

      // Verificar espaço para seções
      const checkSectionBreak = (sectionType: 'requirement' | 'criterion' | 'analysis', estimatedHeight: number) => {
        const adjustedHeight = sectionType === 'requirement' ? estimatedHeight + 10 :
                              sectionType === 'criterion' ? estimatedHeight + 8 : 
                              estimatedHeight + 5;
        if (yPosition + adjustedHeight > pageHeight - margin - 20) {
          doc.addPage();
          yPosition = margin + 20;
          return true;
        }
        return false;
      };

      const normalizeCellValue = (cell: unknown): string => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'string') return cell;
        if (typeof cell === 'number') return cell.toString();
        if (isParameterCellContent(cell)) {
          return cell.description ?? '';
        }
        if (typeof cell === 'object' && 'content' in (cell as Record<string, unknown>)) {
          const rawContent = (cell as { content?: unknown }).content;
          return typeof rawContent === 'string' ? rawContent : '';
        }
        return '';
      };

      const estimateParameterCellHeight = (cell: ParameterCellContent, columnWidth: number) => {
        const descriptionText = cell.description ?? '';
        const observationText = cell.observation ?? '';
        const descriptionCharsPerLine = Math.max(1, Math.floor(columnWidth / 2.4));
        const observationCharsPerLine = Math.max(1, Math.floor(columnWidth / 2.6));

        const countLines = (value: string, charsPerLine: number) => {
          if (!value) return 0;
          return value.split('\n').reduce((total, segment) => {
            if (segment.length === 0) {
              return total + 1;
            }
            return total + Math.max(1, Math.ceil(segment.length / charsPerLine));
          }, 0);
        };

        const descriptionLines = Math.max(1, countLines(descriptionText, descriptionCharsPerLine));
        let estimatedHeight = descriptionLines * 6 + 2;

        const observationLines = countLines(observationText, observationCharsPerLine);
        if (observationLines > 0) {
          estimatedHeight += observationLines * 5 + 3;
        }

        return estimatedHeight;
      };

      const estimateStandardRowHeight = (row: any[], columnWidths: number[]) => {
        let maxLines = 1;
        row.forEach((cell, index) => {
          const textValue = normalizeCellValue(cell).normalize('NFC');
          if (!textValue) return;
          const approxCharsPerLine = Math.max(1, Math.floor((columnWidths[index] ?? columnWidths[columnWidths.length - 1]) / 2.4));
          const segments = textValue.split('\n');
          const totalLines = segments.reduce((count, segment) => {
            if (segment.length === 0) {
              return count + 1;
            }
            return count + Math.max(1, Math.ceil(segment.length / approxCharsPerLine));
          }, 0);
          maxLines = Math.max(maxLines, totalLines);
        });
        return maxLines * 6 + 2;
      };

      const estimateRowHeight = (row: any[], columnWidths: number[]) => {
        const baseHeight = estimateStandardRowHeight(row, columnWidths);
        const firstCell = row?.[0];
        if (isParameterCellContent(firstCell)) {
          const parameterHeight = estimateParameterCellHeight(firstCell, columnWidths[0]);
          return Math.max(baseHeight, parameterHeight);
        }
        return baseHeight;
      };

      const estimateTableHeight = (rows: any[], columnWidths: number[]) => {
        const headerHeight = 10;
        return rows.reduce((height, row) => height + estimateRowHeight(row, columnWidths), headerHeight);
      };

      // ==== Cabeçalho simples ==== //
      doc.setTextColor(0, 0, 0);
      doc.setFont('DejaVuSans', 'bold');
      doc.setFontSize(14);
      doc.text('Perfil de Desempenho da Edificação', pageWidth / 2, margin + 6, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('DejaVuSans', 'normal');
      doc.text('Relatório Técnico (PDE)', pageWidth / 2, margin + 12, { align: 'center' });
      yPosition = margin + 20;

      // Informações do edifício
      if (building) {
        const formatNumericValue = (value: unknown, unit?: string) => {
          if (value === null || value === undefined) return null;
          const rawValue = typeof value === 'string' ? value.trim() : String(value);
          if (rawValue === '') return null;
          const numeric = Number(value);
          if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
            const hasDecimal = Math.abs(numeric % 1) > 1e-6;
            const formatted = numeric.toLocaleString('pt-BR', {
              minimumFractionDigits: hasDecimal ? 2 : 0,
              maximumFractionDigits: hasDecimal ? 2 : 0
            });
            return unit ? `${formatted} ${unit}` : formatted;
          }
          return compactPdfText(rawValue);
        };

        const buildingInfoSections: { title: string; items: { label: string; value: string | null }[] }[] = [
          {
            title: 'Identificação',
            items: [
              { label: 'Nome da Edificação', value: building.name || '—' },
              { label: 'Tipologia', value: getTypologyInfo() || null },
              { label: 'Responsável Técnico', value: getTechnicianInfo() || null }
            ]
          },
          {
            title: 'Localização',
            items: [
              { label: 'Endereço Completo', value: getFormattedAddress() || null }
            ]
          },
          {
            title: 'Características Técnicas',
            items: [
              { label: 'Área Total', value: formatNumericValue(building.totalArea, 'm²') },
              { label: 'Altura', value: formatNumericValue(building.buildingHeight, 'm') },
              { label: 'Pavimentos', value: formatNumericValue(building.floors) },
              { label: 'Unidades', value: formatNumericValue(building.units) }
            ]
          },
          {
            title: 'Condições Ambientais e Classificações',
            items: [
              { label: 'Zona Bioclimática', value: getBioclimaticZoneInfo() || null },
              { label: 'Isopleta', value: getIsoplethInfo() || null },
              { label: 'Classe de Ruído', value: getNoiseClassInfo() || null },
              { label: 'Classe de Agressividade', value: getAggressivenessClassInfo() || null }
            ]
          }
        ];

        const detailRows: any[] = [];
        let hasDetailContent = false;

        const labelBaseStyles = {
          fillColor: [248, 250, 252],
          textColor: [79, 70, 229],
          fontStyle: 'bold' as const,
          fontSize: 9,
          halign: 'left' as const,
          cellPadding: { top: 4, right: 4, bottom: 4, left: 8 },
          lineHeight: 1.2
        };

        const valueBaseStyles = {
          textColor: [31, 41, 55],
          fontStyle: 'normal' as const,
          fontSize: 9,
          halign: 'left' as const,
          cellPadding: { top: 4, right: 8, bottom: 4, left: 6 },
          lineHeight: 1.2
        };

        buildingInfoSections.forEach(section => {
          const validItems = section.items
            .map(item => ({
              label: compactPdfText(item.label),
              value: item.value ? compactPdfText(item.value) : null
            }))
            .filter(item => item.value && item.value.trim() !== '');

          if (validItems.length === 0) return;

          if (!hasDetailContent) {
            detailRows.push([
              {
                content: 'Informações da Edificação',
                colSpan: 4,
                styles: {
                  fillColor: [30, 64, 175],
                  textColor: [255, 255, 255],
                  fontSize: 11,
                  fontStyle: 'bold',
                  halign: 'left',
                  cellPadding: { top: 6, right: 8, bottom: 6, left: 10 }
                }
              }
            ]);
            hasDetailContent = true;
          }

          detailRows.push([
            {
              content: section.title,
              colSpan: 4,
              styles: {
                fillColor: [243, 244, 246],
                textColor: [55, 65, 81],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'left',
                cellPadding: { top: 5, right: 8, bottom: 4, left: 10 }
              }
            }
          ]);

          for (let index = 0; index < validItems.length; index += 2) {
            const leftItem = validItems[index];
            const rightItem = validItems[index + 1];

            detailRows.push([
              {
                content: leftItem.label,
                styles: { ...labelBaseStyles }
              },
              {
                content: leftItem.value ?? '—',
                styles: { ...valueBaseStyles }
              },
              rightItem
                ? {
                    content: rightItem.label,
                    styles: { ...labelBaseStyles }
                  }
                : {
                    content: '',
                    styles: { ...labelBaseStyles, fillColor: [255, 255, 255], textColor: [148, 163, 184] }
                  },
              rightItem
                ? {
                    content: rightItem.value ?? '—',
                    styles: { ...valueBaseStyles }
                  }
                : {
                    content: '',
                    styles: { ...valueBaseStyles }
                  }
            ]);
          }
        });

        if (hasDetailContent) {
          const detailTableWidth = pageWidth - margin * 2;
          const labelColumnWidth = 34;
          const valueColumnWidth = detailTableWidth / 2 - labelColumnWidth;

          autoTable(doc, {
            startY: yPosition,
            margin: { left: margin, right: margin },
            body: detailRows,
            tableWidth: detailTableWidth,
            styles: {
              font: 'DejaVuSans',
              fontSize: 9,
              textColor: [31, 41, 55],
              lineColor: [226, 232, 240],
              lineWidth: 0.1,
              cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
              overflow: 'linebreak',
              cellWidth: 'wrap',
              minCellHeight: 8
            },
            theme: 'grid',
            columnStyles: {
              0: {
                cellWidth: labelColumnWidth,
                fillColor: labelBaseStyles.fillColor,
                textColor: labelBaseStyles.textColor,
                fontStyle: labelBaseStyles.fontStyle,
                fontSize: labelBaseStyles.fontSize,
                halign: labelBaseStyles.halign,
                cellPadding: { ...labelBaseStyles.cellPadding },
                lineHeight: labelBaseStyles.lineHeight
              },
              1: {
                cellWidth: valueColumnWidth,
                textColor: valueBaseStyles.textColor,
                fontStyle: valueBaseStyles.fontStyle,
                fontSize: valueBaseStyles.fontSize,
                halign: valueBaseStyles.halign,
                cellPadding: { ...valueBaseStyles.cellPadding },
                lineHeight: valueBaseStyles.lineHeight
              },
              2: {
                cellWidth: labelColumnWidth,
                fillColor: labelBaseStyles.fillColor,
                textColor: labelBaseStyles.textColor,
                fontStyle: labelBaseStyles.fontStyle,
                fontSize: labelBaseStyles.fontSize,
                halign: labelBaseStyles.halign,
                cellPadding: { ...labelBaseStyles.cellPadding },
                lineHeight: labelBaseStyles.lineHeight
              },
              3: {
                cellWidth: valueColumnWidth,
                textColor: valueBaseStyles.textColor,
                fontStyle: valueBaseStyles.fontStyle,
                fontSize: valueBaseStyles.fontSize,
                halign: valueBaseStyles.halign,
                cellPadding: { ...valueBaseStyles.cellPadding },
                lineHeight: valueBaseStyles.lineHeight
              }
            },
            rowPageBreak: 'avoid',
            didParseCell: (data: any) => {
              if (data.cell.raw && typeof data.cell.raw === 'object' && 'colSpan' in data.cell.raw && data.cell.raw.colSpan === 4) {
                const isTitleRow = data.row.index === 0;
                data.cell.styles.halign = 'left';
                data.cell.styles.font = 'DejaVuSans';
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = isTitleRow ? 11 : 10;
                data.cell.styles.textColor = isTitleRow ? [255, 255, 255] : [55, 65, 81];
                data.cell.styles.fillColor = isTitleRow ? [30, 64, 175] : [243, 244, 246];
                data.cell.styles.cellPadding = isTitleRow
                  ? { top: 6, right: 8, bottom: 6, left: 10 }
                  : { top: 5, right: 8, bottom: 4, left: 10 };
              }
            }
          });

          const headerTableInfo = (doc as any).lastAutoTable;
          const finalY = headerTableInfo?.finalY ?? yPosition;
          yPosition = finalY + 12;
        }
      }

      // Processar cada requisito
      for (const requirement of sortedData) {
        const hasCriteria = requirement.criteria.length > 0;
        const requirementEstimatedHeight = 10 + (hasCriteria ? 16 : 0);
        checkSectionBreak('requirement', requirementEstimatedHeight);

        doc.setFontSize(14);
        doc.setFont('DejaVuSans', 'bold');
        doc.text(`Requisito: ${normalizePdfText(requirement.label)}`, margin, yPosition);
        yPosition += 10;

        for (const criterion of requirement.criteria) {
          const hasAnalyses = criterion.analyses.some(analysis => analysis.parameters?.length);
          const criterionEstimatedHeight = 8 + (hasAnalyses ? 14 : 0);
          checkSectionBreak('criterion', criterionEstimatedHeight);

          doc.setFontSize(12);
          doc.setFont('DejaVuSans', 'bold');
          doc.text(`Critério: ${normalizePdfText(criterion.label)}`, margin + 5, yPosition);
          yPosition += 8;

          for (const analysis of criterion.analyses) {
            if (!analysis.parameters?.length) continue;

            const analysisKey = `${requirement.id}-${criterion.id}-${analysis.id}`;
            let selectedLevels = selectedEvaluations.get(analysisKey) || [];
            if (selectedLevels.length === 0) {
              selectedLevels = ['minimum', 'intermediate', 'superior'];
            }

            const levelLabels: { [key: string]: string } = {
              minimum: 'Min',
              intermediate: 'Int',
              superior: 'Sup'
            };

            const tableHeaders = ['Parâmetro', 'UN'];
            selectedLevels.forEach(levelId => {
              tableHeaders.push(levelLabels[levelId] || levelId);
            });

            const parameterColumnWidth = 104;
            const unitColumnWidth = 18;
            const levelColumnWidth = 18;
            const narrowLevelIds = new Set(['minimum', 'intermediate', 'superior']);

            const columnWidths = [parameterColumnWidth, unitColumnWidth];
            const columnStyles: Record<number, any> = {
              0: {
                cellWidth: parameterColumnWidth,
                halign: 'left',
                valign: 'top',
                overflow: 'linebreak',
                font: 'DejaVuSans',
                fontStyle: 'normal',
                fontSize: 8,
                lineHeight: 1.2
              },
              1: {
                cellWidth: unitColumnWidth,
                halign: 'center',
                valign: 'middle',
                font: 'DejaVuSans',
                fontStyle: 'normal',
                fontSize: 8,
                lineHeight: 1.15
              }
            };

            selectedLevels.forEach((levelId, index) => {
              const width = narrowLevelIds.has(levelId) ? levelColumnWidth : levelColumnWidth + 6;
              columnWidths.push(width);
              columnStyles[index + 2] = {
                cellWidth: width,
                halign: 'center',
                valign: 'middle',
                font: 'DejaVuSans',
                fontStyle: 'normal',
                fontSize: 8,
                lineHeight: 1.15
              };
            });

            const tableData: any[] = [];

            const formatParameterValue = (value: unknown): string => {
              if (value === null || value === undefined) return '—';
              const textValue = compactPdfText(String(value));
              return textValue === '' ? '—' : textValue;
            };

            analysis.parameters.forEach(parameter => {
              const row: any[] = [];

              const parameterName = formatTextWithLineBreaks(parameter.label || 'Parâmetro');
              const observationRaw = parameter.notes ?? parameter.observation;
              const observationContent = observationRaw ? formatTextWithLineBreaks(observationRaw) : '';

              const parameterCell: ParameterCellContent = {
                type: 'parameterCell',
                description: parameterName,
                observation: observationContent
              };
              row.push(parameterCell);

              const rawUnit = parameter.unit ? String(parameter.unit) : '—';
              const unitText = compactPdfText(rawUnit) || '—';
              row.push(unitText);

              const directValueMap: Record<string, unknown> = {
                minimum: parameter.minimumValue,
                intermediate: parameter.intermediateValue,
                superior: parameter.superiorValue
              };

              selectedLevels.forEach(levelId => {
                let resolvedValue = directValueMap[levelId];
                if (resolvedValue === undefined || resolvedValue === null) {
                  const nestedValue = parameter.values?.[levelId];
                  resolvedValue = nestedValue?.value ?? null;
                }
                row.push(formatParameterValue(resolvedValue));
              });

              tableData.push(row);
            });

            const estimatedTableHeight = estimateTableHeight(tableData, columnWidths);
            const analysisHeadingHeight = 7;
            const analysisSpacing = 9;
            const totalAnalysisHeight = analysisHeadingHeight + estimatedTableHeight + analysisSpacing;

            if (yPosition + analysisHeadingHeight + 15 > pageHeight - margin) {
              doc.addPage();
              yPosition = margin + 20;
            }

            doc.setFontSize(10);
            doc.setFont('DejaVuSans', 'bold');
            doc.text(`Análise: ${normalizePdfText(analysis.label)}`, margin + 10, yPosition);
            yPosition += analysisHeadingHeight;

            autoTable(doc, {
              head: [tableHeaders],
              body: tableData,
              startY: yPosition,
              margin: { top: margin + 20, left: margin + 6, right: margin + 6, bottom: margin },
              tableWidth: 'auto',
              pageBreak: 'auto',
              showHead: 'everyPage',
              styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak',
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                valign: 'top',
                cellWidth: 'wrap',
                font: 'DejaVuSans',
                fontStyle: 'normal',
                lineHeight: 1.2
              },
              headStyles: {
                fillColor: [240, 240, 240],
                textColor: [50, 50, 50],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'center',
                valign: 'middle',
                font: 'DejaVuSans'
              },
              bodyStyles: {
                textColor: [60, 60, 60],
                overflow: 'linebreak',
                cellWidth: 'wrap',
                font: 'DejaVuSans',
                fontStyle: 'normal'
              },
              alternateRowStyles: {
                fillColor: [250, 250, 250]
              },
              columnStyles,
              didParseCell: (data: any) => {
                if (data.section === 'head') {
                  data.cell.styles.halign = 'center';
                  data.cell.styles.valign = 'middle';
                  data.cell.styles.font = 'DejaVuSans';
                  data.cell.styles.fontStyle = 'bold';
                  data.cell.styles.fontSize = 10;
                }

                if (data.section === 'body') {
                  data.cell.styles.font = 'DejaVuSans';
                  if (data.column.index === 0) {
                    data.cell.styles.halign = 'left';
                    data.cell.styles.valign = 'top';
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.lineHeight = 1.2;

                    const rawCell = data.cell.raw;
                    if (isParameterCellContent(rawCell)) {
                      const paddingLeft = data.cell.padding('left');
                      const paddingRight = data.cell.padding('right');
                      const parameterColumnWidth = columnWidths[0] ?? data.cell.width;
                      const availableWidth = Math.max(
                        12,
                        parameterColumnWidth - paddingLeft - paddingRight
                      );

                      data.cell.styles.cellWidth = parameterColumnWidth;

                      const descriptionText = rawCell.description ?? '';
                      const observationText = rawCell.observation ?? '';

                      const descriptionLines = splitPdfTextIntoLines(doc, descriptionText, availableWidth);
                      rawCell._descriptionLines = descriptionLines;

                      data.cell.text = [''];

                      const baseFontSize = data.cell.styles.fontSize || 8;
                      const baseLineHeightFactor = data.cell.styles.lineHeight || 1.2;
                      const baseLineHeight = (baseFontSize * baseLineHeightFactor) / doc.internal.scaleFactor;
                      rawCell._baseLineHeight = baseLineHeight;

                      let requiredInnerHeight = descriptionLines.length * baseLineHeight;

                      if (observationText) {
                        const observationLines = splitPdfTextIntoLines(doc, observationText, availableWidth);
                        rawCell._observationLines = observationLines;

                        const observationFontSize = 8;
                        const observationLineHeightFactor = 1.15;
                        const observationLineHeight = (observationFontSize * observationLineHeightFactor) / doc.internal.scaleFactor;
                        rawCell._observationLineHeight = observationLineHeight;

                        requiredInnerHeight += 0.6 + observationLines.length * observationLineHeight;
                      } else {
                        rawCell._observationLines = [];
                        rawCell._observationLineHeight = 0;
                      }

                      const paddingTop = data.cell.padding('top');
                      const paddingBottom = data.cell.padding('bottom');
                      const requiredHeight = requiredInnerHeight + paddingTop + paddingBottom;

                      if (!data.cell.styles.minCellHeight || data.cell.styles.minCellHeight < requiredHeight) {
                        data.cell.styles.minCellHeight = requiredHeight;
                      }
                      data.row.height = Math.max(data.row.height, data.cell.styles.minCellHeight);
                    } else if (data.cell.text && data.cell.text.length > 0) {
                      data.cell.text = data.cell.text.map((text: string) => formatTextWithLineBreaks(text));
                    }
                  } else if (data.column.index === 1) {
                    data.cell.styles.halign = 'center';
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.lineHeight = 1.15;
                  }
                }

                if (data.section === 'body' && data.column.index !== 0 && data.cell.raw && typeof data.cell.raw === 'string') {
                  if (data.cell.text && data.cell.text.length > 0) {
                    data.cell.text = data.cell.text.map((text: string) =>
                      formatTextWithLineBreaks(text)
                    );
                  }
                }
              },
              didDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 0) {
                  const rawCell = data.cell.raw;
                  if (isParameterCellContent(rawCell)) {
                    const paddingLeft = data.cell.padding('left');
                    const paddingTop = data.cell.padding('top');
                    const startX = data.cell.x + paddingLeft;

                    const baseFontSize = data.cell.styles.fontSize || 8;
                    const baseLineHeight =
                      rawCell._baseLineHeight ??
                      (baseFontSize * (data.cell.styles.lineHeight || 1.2)) / doc.internal.scaleFactor;

                    let currentY = data.cell.y + paddingTop;

                    const descriptionLines = rawCell._descriptionLines ?? [];
                    if (descriptionLines.length > 0) {
                      doc.setFont('DejaVuSans', 'normal');
                      doc.setFontSize(baseFontSize);
                      doc.setTextColor(60, 60, 60);

                      descriptionLines.forEach((line: string) => {
                        doc.text(line, startX, currentY, { baseline: 'top' } as any);
                        currentY += baseLineHeight;
                      });
                    }

                    const observationLines = rawCell._observationLines ?? [];
                    if (observationLines.length > 0) {
                      currentY += 0.6;
                      doc.setFont('DejaVuSans', 'italic');
                      doc.setFontSize(8);
                      doc.setTextColor(100, 100, 100);

                      const observationLineHeight =
                        rawCell._observationLineHeight ?? (8 * 1.15) / doc.internal.scaleFactor;

                      observationLines.forEach((line: string) => {
                        doc.text(line, startX, currentY, { baseline: 'top' } as any);
                        currentY += observationLineHeight;
                      });

                      doc.setFont('DejaVuSans', 'normal');
                      doc.setFontSize(baseFontSize);
                      doc.setTextColor(60, 60, 60);
                    }
                  }
                }
              }
            });

            const tableInfo = (doc as any).lastAutoTable;
            const finalY = tableInfo?.finalY ?? yPosition;
            yPosition = finalY + analysisSpacing;
          }

          yPosition += 5;
        }

        yPosition += 10;
      }

      // Salvar o PDF
      const filename = `PDE_${buildingName || 'Relatorio'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(filename);
      
      console.log('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      // Restaurar botão
      const originalButton = document.querySelector('.pdf-button') as HTMLButtonElement;
      if (originalButton) {
        originalButton.disabled = false;
        originalButton.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>Gerar PDF';
      }
    }
  };

  return (
    <div className="p-6">
      {/* Botão de Gerar PDF */}
      <div className="mb-6 no-print">
        <Button 
          onClick={() => generatePDF(building?.name)}
          className="bg-blue-600 hover:bg-blue-700 text-white pdf-button"
          size="sm"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Gerar PDF
        </Button>
      </div>

      {/* Conteúdo do relatório para PDF */}
      <div id="report-content" className="pdf-optimized print-content">
        {/* Cabeçalho Profissional e Discreto */}
        <div className="mb-8">
          {/* Header Principal */}
          <div className="bg-gray-800 text-white rounded-t-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white mb-1">
                  Perfil de Desempenho da Edificação - PDE
                </h1>
                <p className="text-lg text-gray-200">
                  {building?.name || `Edificação ID ${item.buildingId}`}
                </p>
              </div>
              <div className="text-right text-gray-300 text-sm">
                <div>Relatório Técnico</div>
                <div className="font-medium">
                  {item.generatedAt ? new Date(item.generatedAt).toLocaleDateString('pt-BR') : 'Hoje'}
                </div>
                <div>Versão {item.version || 1}</div>
              </div>
            </div>
          </div>
          
          {/* Informações da Edificação */}
          <div className="bg-white border border-gray-300 rounded-b-lg p-6 shadow-sm no-page-break">
            {/* Seção: Identificação */}
            <div className="mb-6 no-page-break">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
                Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">Nome da Edificação</div>
                  <div className="text-sm font-medium text-gray-900">{building?.name || '—'}</div>
                </div>

                {getTypologyInfo() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Tipologia</div>
                    <div className="text-sm font-medium text-gray-900">{getTypologyInfo()}</div>
                  </div>
                )}

                {getTechnicianInfo() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Responsável Técnico</div>
                    <div className="text-sm font-medium text-gray-900">{getTechnicianInfo()}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Seção: Localização */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-gray-200 border-b">
                Localização
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {getFormattedAddress() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Endereço Completo</div>
                    <div className="text-sm font-medium text-gray-900">{getFormattedAddress()}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Seção: Características Técnicas */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-gray-200 border-b">
                Características Técnicas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {building?.totalArea && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Área Total</div>
                    <div className="text-sm font-medium text-gray-900">{building.totalArea} m²</div>
                  </div>
                )}
                {building?.buildingHeight && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Altura</div>
                    <div className="text-sm font-medium text-gray-900">{building.buildingHeight} m</div>
                  </div>
                )}
                {building?.floors && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Pavimentos</div>
                    <div className="text-sm font-medium text-gray-900">{building.floors}</div>
                  </div>
                )}
                {building?.units && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Unidades</div>
                    <div className="text-sm font-medium text-gray-900">{building.units}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Seção: Condições Ambientais */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-gray-200 border-b">
                Condições Ambientais e Classificações
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {getBioclimaticZoneInfo() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Zona Bioclimática</div>
                    <div className="text-sm font-medium text-gray-900">{getBioclimaticZoneInfo()}</div>
                  </div>
                )}
                {getIsoplethInfo() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Isopleta</div>
                    <div className="text-sm font-medium text-gray-900">{getIsoplethInfo()}</div>
                  </div>
                )}
                {getNoiseClassInfo() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Classe de Ruído</div>
                    <div className="text-sm font-medium text-gray-900">{getNoiseClassInfo()}</div>
                  </div>
                )}
                {getAggressivenessClassInfo() && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Classe de Agressividade</div>
                    <div className="text-sm font-medium text-gray-900">{getAggressivenessClassInfo()}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo do Relatório */}
      <div className="print-content">
        {sortedData.map((requirement, reqIndex) => (
          <div key={requirement.id} className={`mb-8 ${reqIndex === 0 ? '' : 'page-break-before'}`}>
            {/* Seção: Requisito */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide mb-4 pb-3 border-b-2 border-gray-600">
                Requisito: {normalizePdfText(requirement.label)}
              </h3>

              {requirement.criteria.map((criterion) => (
                <div key={criterion.id} className="mb-6">
                  {/* Título do Critério */}
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
                    Critério: {normalizePdfText(criterion.label)}
                  </h4>

                  {criterion.analyses.map((analysis) => {
                    const analysisKey = `analysis-${analysis.id}`;
                    const selectedLevels = selectedEvaluations.get(analysisKey) || [];

                    return (
                      <div key={analysis.id} className="mb-4 ml-4">
                        {/* Card da Análise */}
                        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                          <h5 className="text-xs font-medium text-gray-600 mb-3">
                            Análise: {normalizePdfText(analysis.label)}
                          </h5>

                          {/* Tabela de Parâmetros */}
                          {analysis.parameters.length > 0 && (
                            <div className="bg-white rounded border border-gray-300 overflow-hidden">
                              <Table>
                                <TableHeader>
                                  {/* Cabeçalho principal da tabela */}
                                  <TableRow className="bg-gray-100 border-b border-gray-300">
                                    <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 pl-4 pr-5 min-w-[17rem]">
                                      Parâmetro
                                    </TableHead>
                                    <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-2.5 w-16">
                                      UN
                                    </TableHead>
                                    {selectedLevels.includes('minimum') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-2.5 w-16">
                                        Min
                                      </TableHead>
                                    )}
                                    {selectedLevels.includes('intermediate') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-2.5 w-16">
                                        Int
                                      </TableHead>
                                    )}
                                    {selectedLevels.includes('superior') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-2.5 w-16">
                                        Sup
                                      </TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {analysis.parameters.map((parameter) => {
                                    const observationText = parameter.notes ?? parameter.observation;

                                    return (
                                      <TableRow key={parameter.id} className="hover:bg-gray-50 border-b border-gray-200">
                                        <TableCell className="border-r border-gray-300 align-middle py-3 pl-4 pr-5 font-medium min-w-[17rem]">
                                          <div>
                                            <div className="font-medium text-gray-900">
                                              {formatTextWithSeparators(parameter.label)}
                                            </div>
                                            {observationText && (
                                              <div className="text-xs text-gray-600 mt-2 italic bg-gray-100 p-2 rounded border-l-2 border-gray-400">
                                                <span className="font-semibold text-gray-800">Observação:</span> {formatTextWithSeparators(observationText)}
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-2.5 w-16">
                                          {normalizeDisplayValue(parameter.unit)}
                                        </TableCell>
                                        {selectedLevels.includes('minimum') && (
                                          <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-2.5 w-16">
                                            {normalizeDisplayValue(parameter.minimumValue)}
                                          </TableCell>
                                        )}
                                        {selectedLevels.includes('intermediate') && (
                                          <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-2.5 w-16">
                                            {normalizeDisplayValue(parameter.intermediateValue)}
                                          </TableCell>
                                        )}
                                        {selectedLevels.includes('superior') && (
                                          <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-2.5 w-16">
                                            {normalizeDisplayValue(parameter.superiorValue)}
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}

        {sortedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum dado encontrado para este relatório.</p>
            <p className="text-sm mt-2">Verifique se há avaliações de desempenho selecionadas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
