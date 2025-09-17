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
   * 
   * Este sistema funciona automaticamente com qualquer tabela do banco de dados:
   * 
   * 1. FUNCIONAMENTO AUTOMÁTICO:
   *    - Lê o campo `sourceTable` do atributo
   *    - Carrega dados da tabela automaticamente via `/api/${tableName}`
   *    - Encontra registro relacionado usando estratégias inteligentes
   *    - Extrai valor da coluna especificada em `sourceColumn`
   * 
   * 2. ESTRATÉGIAS DE RELAÇÃO:
   *    - Campo ID direto: typologies -> building.typologyId
   *    - Campo snake_case: noise_classes -> building.noise_class_id  
   *    - Campo direto: bioclimatic_zones -> building.bioclimatic_zone
   *    - Fallback: primeiro registro da tabela
   * 
   * 3. EXEMPLO DE USO:
   *    Atributo: { sourceTable: "noise_classes", sourceColumn: "max_level" }
   *    Sistema automaticamente:
   *    - Carrega dados de `/api/noise_classes`
   *    - Encontra registro onde id = building.noiseClassId
   *    - Retorna valor da coluna `max_level`
   * 
   * 4. PARA ADICIONAR NOVA TABELA:
   *    Nenhuma implementação necessária! O sistema funciona automaticamente.
   *    Apenas certifique-se de que existe endpoint `/api/nome_da_tabela`
   */

  // Função para obter dados de uma tabela específica de forma genérica
  const getTableDataForAttribute = (attribute: any): any[] => {
    const tableName = attribute.sourceTable;
    
    // Para buildings, usar dados já carregados
    if (tableName === 'buildings') {
      return buildings;
    }
    
    // Para outras tabelas, tentar buscar do cache se já foi carregado
    if (tableDataCache.has(tableName)) {
      return tableDataCache.get(tableName)!;
    }
    
    // Se não está no cache, retornar array vazio e será carregado assincronamente se necessário
    return [];
  };

  // Função para encontrar o registro correto baseado na relação com building
  const findRelatedRecord = (tableData: any[], attribute: any, building: any): any => {
    if (!building || !tableData.length) return null;
    
    // Estratégias para encontrar o registro relacionado
    const strategies = [
      // 1. Campo de ID direto no building (ex: typologyId, noiseClassId)
      () => {
        const camelCaseId = attribute.sourceTable.replace(/s$/, '') + 'Id'; // typologies -> typologyId
        const snakeCaseId = attribute.sourceTable.slice(0, -1) + '_id'; // typologies -> typology_id
        
        const buildingValue = building[camelCaseId] || building[snakeCaseId];
        if (buildingValue) {
          return tableData.find(record => record.id === buildingValue);
        }
        return null;
      },
      
      // 2. Campo direto correspondente à sourceColumn (ex: bioclimatic_zone)
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
      
      // 3. Se nenhuma estratégia funcionou, usar primeiro registro (fallback)
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
    
    // Formatar faixa de velocidade
    const min = isopleth.windMinMS != null ? parseFloat(isopleth.windMinMS as any) : null;
    const max = isopleth.windMaxMS != null ? parseFloat(isopleth.windMaxMS as any) : null;
    const fmt = (v: number | null) => (v == null || Number.isNaN(v) ? null : v.toFixed(1).replace(/\.0$/, ''));
    
    let range = '';
    if (min !== null && max !== null) {
      range = ` (${fmt(min)} - ${fmt(max)} m/s)`;
    } else if (min !== null) {
      range = ` (≥ ${fmt(min)} m/s)`;
    } else if (max !== null) {
      range = ` (≤ ${fmt(max)} m/s)`;
    }
    
    return `${isopleth.code} - ${isopleth.label}${range}`;
  };

  // Função para formatar endereço brasileiro
  const getFormattedAddress = () => {
    if (!building) return null;
    
    const parts = [];
    
    // Logradouro e número
    if (building.street) {
      let streetPart = building.street;
      if (building.addressNumber) {
        streetPart += `, ${building.addressNumber}`;
      }
      parts.push(streetPart);
    }
    
    // Bairro
    if (building.neighborhood) {
      parts.push(building.neighborhood);
    }
    
    // Cidade e Estado
    if (building.city || building.state) {
      let cityState = '';
      if (building.city) cityState += building.city;
      if (building.state) {
        cityState += cityState ? ` - ${building.state}` : building.state;
      }
      if (cityState) parts.push(cityState);
    }
    
    // CEP
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
          .filter(attr => attr.sourceTable !== 'buildings') // buildings já está carregado
          .map(attr => attr.sourceTable)
      );
      
      // Carregar todas as tabelas referenciadas de forma assíncrona
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

    const misencodedPattern = /[ÃÂ][\u0080-\u00BF]/;
    if (!misencodedPattern.test(text)) {
      return text;
    }

    try {
      const bytes = new Uint8Array(Array.from(text, char => char.charCodeAt(0)));
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(bytes);
    } catch (error) {
      console.warn('Não foi possível corrigir codificação do texto:', error);
      return text;
    }
  };

  const normalizePdfText = (text: string): string => {
    const baseText = decodeMisencodedText(text);

    return baseText
      .replace(/\u00a0/g, ' ')
      .replace(/\t/g, ' ')
      .normalize('NFKC');
  };

  const compactPdfText = (text: string): string => {
    return normalizePdfText(text).replace(/\s+/g, ' ').trim();
  };

  // Função para formatar texto com quebras de linha
  const formatTextWithSeparators = (text: string | null | undefined): string => {
    if (!text) return '';
    const normalized = normalizePdfText(text);
    return compactPdfText(normalized.replace(/\r?\n/g, ' • '));
  };

  // Função para verificar se um parâmetro tem valores nos níveis selecionados
  const hasValuesForSelectedLevels = (parameter: any, selectedLevels: string[]): boolean => {
    if (!selectedLevels || selectedLevels.length === 0) {
      return true; // Se nenhum nível selecionado, mostrar todos
    }

    // Verificar se pelo menos um nível selecionado tem valor não-vazio
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
   * Função completamente genérica para verificar se um parâmetro deve ser exibido
   * Funciona automaticamente com qualquer tabela do banco de dados
   */
  const shouldShowParameter = (parameter: any): boolean => {
    // Se não tem atributo definido, sempre mostra
    if (!parameter.attributeId) {
      return true;
    }

    // Buscar definição do atributo
    const attribute = attributes.find((attr: any) => attr.id === parameter.attributeId);
    if (!attribute) {
      return true; // Se atributo não encontrado, mostra por segurança
    }

    // Obter dados da tabela de forma genérica
    let sourceData = null;
    
    if (attribute.sourceTable === 'buildings') {
      sourceData = building;
    } else {
      // Para qualquer outra tabela, buscar de forma genérica
      const tableData = getTableDataForAttribute(attribute);
      sourceData = findRelatedRecord(tableData, attribute, building);
    }
    
    if (!sourceData) {
      return true; // Se não encontrou fonte de dados, mostrar parâmetro
    }

    const attributeValue = getAttributeValue(sourceData, attribute);
    
    // Se não conseguiu obter valor da edificação, não mostra
    if (attributeValue === null || attributeValue === undefined) {
      return false;
    }

    // Verificar valor específico do atributo (attributeValueId)
    if (parameter.attributeValueId !== null && parameter.attributeValueId !== undefined) {
      // Comparar valores convertidos para string
      const paramValue = String(parameter.attributeValueId);
      const attributeValueStr = String(attributeValue);
      
      if (paramValue !== attributeValueStr) {
        return false;
      }
    }

    // Verificar limites numéricos (minLimit/maxLimit)
    const numericValue = parseFloat(String(attributeValue));
    if (!isNaN(numericValue)) {
      if (parameter.minLimit !== null && parameter.minLimit !== undefined) {
        const minLimit = parseFloat(String(parameter.minLimit));
        if (!isNaN(minLimit) && numericValue < minLimit) {
          return false;
        }
      }
      
      if (parameter.maxLimit !== null && parameter.maxLimit !== undefined) {
        const maxLimit = parseFloat(String(parameter.maxLimit));
        if (!isNaN(maxLimit) && numericValue > maxLimit) {
          return false;
        }
      }
    }

    return true;
  };

  /**
   * Função completamente genérica para obter valor de atributo
   * Funciona automaticamente com qualquer tabela do banco de dados
   */
  const getAttributeValue = (sourceData: any, attribute: any): any => {
    if (!sourceData || !attribute) {
      return null;
    }

    // Primeiro: tentar acesso direto pela coluna (funciona para a maioria dos casos)
    if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
      return sourceData[attribute.sourceColumn];
    }

    // Segundo: para buildings, tentar mapeamento de colunas snake_case para camelCase
    // (mantido apenas para compatibilidade com implementação atual)
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
   * Função dinâmica para ordenação de parâmetros
   * Esta função garante que a ordenação seja consistente e funcione para:
   * - Dados atuais e futuros
   * - Qualquer combinação de valores nas colunas (Mínimo, Intermediário, Superior)
   * - Valores numéricos ou texto
   * 
   * Lógica de ordenação:
   * 1. Primeiro: Ordenação alfabética por descrição (label)
   * 2. Segundo: Para parâmetros com mesmo label, ordenar por menor valor numérico encontrado
   * 3. Terceiro: Se valores iguais, ordenar por precedência de coluna (Mínimo → Intermediário → Superior)
   */
  const sortParameters = (params: any[]) => {
    return params.sort((a, b) => {
      // Critério 1: Ordenação alfabética por label (descrição do parâmetro)
      const labelCompare = a.label.localeCompare(b.label, 'pt-BR', { 
        numeric: true, 
        sensitivity: 'base' 
      });
      
      if (labelCompare !== 0) {
        return labelCompare;
      }

      // Critério 2: Para parâmetros com mesmo label, ordenar por valores numéricos
      const getParameterSortData = (param: any) => {
        const values = [
          { value: param.minimumValue, column: 'minimum', priority: 1 },
          { value: param.intermediateValue, column: 'intermediate', priority: 2 },
          { value: param.superiorValue, column: 'superior', priority: 3 }
        ];

        // Filtrar apenas valores válidos (não vazios e não nulos)
        const validValues = values.filter(v => 
          v.value !== null && 
          v.value !== undefined && 
          String(v.value).trim() !== ''
        );

        if (validValues.length === 0) {
          return { numericValue: Number.MAX_SAFE_INTEGER, columnPriority: 999 };
        }

        // Encontrar o menor valor numérico válido
        let minNumericValue = Number.MAX_SAFE_INTEGER;
        let columnPriorityForMinValue = 999;

        validValues.forEach(v => {
          const numericValue = parseFloat(String(v.value));
          if (!isNaN(numericValue)) {
            if (numericValue < minNumericValue) {
              minNumericValue = numericValue;
              columnPriorityForMinValue = v.priority;
            } else if (numericValue === minNumericValue && v.priority < columnPriorityForMinValue) {
              // Se valores iguais, priorizar coluna à esquerda
              columnPriorityForMinValue = v.priority;
            }
          }
        });

        // Se não há valores numéricos válidos, usar primeiro valor não-numérico encontrado
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

      // Critério 2.1: Comparar valores numéricos
      if (sortDataA.numericValue !== sortDataB.numericValue) {
        return sortDataA.numericValue - sortDataB.numericValue;
      }

      // Critério 2.2: Se valores numéricos iguais, usar precedência de coluna
      if (sortDataA.columnPriority !== sortDataB.columnPriority) {
        return sortDataA.columnPriority - sortDataB.columnPriority;
      }

      // Critério 2.3: Se não há valores numéricos, comparar texto
      if (sortDataA.textValue && sortDataB.textValue) {
        return sortDataA.textValue.localeCompare(sortDataB.textValue, 'pt-BR');
      }

      // Critério final: Se tudo igual, manter ordem original
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
        // Fix: usando 'level' ao invés de 'performanceLevel' conforme o schema original
        if (ev.level && !selectedEvaluations.get(key)!.includes(ev.level)) {
          selectedEvaluations.get(key)!.push(ev.level);
        }
      });
      
      console.log('Final selectedEvaluations map:', selectedEvaluations);  // Agrupar dados por Requisito -> Critério -> Análises com Parâmetros
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
          // Filtrar análises que não têm parâmetros visíveis
          .filter(analysis => analysis.parameters.length > 0)
      }))
      // Filtrar critérios que não têm análises com parâmetros
      .filter(crit => crit.analyses.length > 0)
  }))
  // Filtrar requisitos que não têm critérios com análises
  .filter(req => req.criteria.length > 0);

  // Filtrar apenas análises que têm avaliações selecionadas e aplicar filtro de níveis
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
      })
      // Filtrar análises que não têm parâmetros após filtro de níveis
      .filter(analysis => analysis.parameters.length > 0)
    }))
    // Aplicar novamente o filtro de critérios após filtrar por avaliações
    .filter(crit => crit.analyses.length > 0)
  }))
  // Aplicar novamente o filtro de requisitos após filtrar por avaliações
  .filter(req => req.criteria.length > 0);

  // Aplicar ordenação nos dados filtrados
  const sortedData = filteredData
    .sort((a, b) => a.code.localeCompare(b.code)) // Ordenar requisitos por código
    .map(req => ({
      ...req,
      criteria: req.criteria
        .sort((a, b) => a.code.localeCompare(b.code)) // Ordenar critérios por código
        .map(crit => ({
          ...crit,
          analyses: crit.analyses
            .sort((a, b) => a.code.localeCompare(b.code)) // Ordenar análises por código
            .map(analysis => ({
              ...analysis,
              parameters: sortParameters(analysis.parameters) // Usar nova lógica de ordenação
            }))
        }))
    }));

  // Função para gerar PDF
  // Função para formatar texto com separadores ao invés de quebras de linha
  const formatTextWithLineBreaks = (text: string): string => {
    if (!text) return '';

    const normalized = normalizePdfText(text);

    return compactPdfText(
      normalized
        .replace(/\r\n/g, ' • ')
        .replace(/\n/g, ' • ')
        .replace(/\r/g, ' • ')
    );
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
      
      // Criar novo documento PDF com encoding UTF-8
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

      // Função para verificar espaço para seções
      const checkSectionBreak = (sectionType: 'requirement' | 'criterion' | 'analysis', estimatedHeight: number) => {
        const minSpaceRequired = sectionType === 'requirement' ? 50 :
                                 sectionType === 'criterion' ? 35 : 25;

        const requiredSpace = Math.max(estimatedHeight, minSpaceRequired);

        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      const estimateObservationHeight = (text: string, columnWidths: number[]) => {
        if (!text) return 8;
        const totalWidth = columnWidths.reduce((acc, width) => acc + width, 0);
        const approxCharsPerLine = Math.max(1, Math.floor(totalWidth / 2.4));
        const lines = Math.max(1, Math.ceil(text.length / approxCharsPerLine));
        return lines * 6 + 4;
      };

      const estimateStandardRowHeight = (row: string[], columnWidths: number[]) => {
        let maxLines = 1;

        row.forEach((cell, index) => {
          const textValue = (cell ?? '').toString().normalize('NFC');
          if (!textValue) return;

          const approxCharsPerLine = Math.max(1, Math.floor(columnWidths[index] / 2.4));
          const lines = Math.max(1, Math.ceil(textValue.length / approxCharsPerLine));
          maxLines = Math.max(maxLines, lines);
        });

        return maxLines * 6 + 2;
      };

      const estimateTableHeight = (rows: any[], columnWidths: number[]) => {
        const headerHeight = 10;

        return rows.reduce((height, row) => {
          if (Array.isArray(row) && row.length > 0 && typeof row[0] === 'object' && 'colSpan' in row[0]) {
            const textValue = (row[0] as { content?: string }).content ?? '';
            return height + estimateObservationHeight(textValue, columnWidths);
          }

          const normalizedRow = (row as string[]).map(cell => (cell ?? '').toString());
          return height + estimateStandardRowHeight(normalizedRow, columnWidths);
        }, headerHeight);
      };

      // Título do relatório
      doc.setFontSize(20);
      doc.setFont('DejaVuSans', 'bold');
      doc.text('Relatório de Desempenho da Edificação (PDE)', margin, yPosition);
      yPosition += 15;

      // Informações do edifício
      if (building) {
        const ensureSpaceFor = (height: number) => {
          if (yPosition + height > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
        };

        const formatNumericValue = (value: unknown, unit?: string) => {
          if (value === null || value === undefined) {
            return null;
          }

          const rawValue = typeof value === 'string' ? value.trim() : String(value);
          if (rawValue === '') {
            return null;
          }

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

        doc.setFontSize(13);
        doc.setFont('DejaVuSans', 'bold');
        doc.text('Informações da Edificação', margin, yPosition);
        yPosition += 9;

        const availableWidth = pageWidth - margin * 2 - 6;

        const addInfoSection = (sectionTitle: string, sectionItems: { label: string; value: string | null }[]) => {
          const validItems = sectionItems
            .map(item => ({
              label: compactPdfText(item.label),
              value: item.value ? compactPdfText(item.value) : null
            }))
            .filter(item => item.value && item.value.trim() !== '');

          if (validItems.length === 0) {
            return;
          }

          const estimatedHeight = validItems.reduce((acc, item) => {
            const line = `${item.label}: ${item.value}`;
            const lines = doc.splitTextToSize(line, availableWidth).length;
            return acc + lines * 5 + 2;
          }, 12);

          ensureSpaceFor(estimatedHeight);

          doc.setFontSize(11);
          doc.setFont('DejaVuSans', 'bold');
          doc.text(sectionTitle, margin, yPosition);
          yPosition += 6;

          doc.setFontSize(9);
          doc.setFont('DejaVuSans', 'normal');

          validItems.forEach((item, index) => {
            const fullText = `${item.label}: ${item.value}`;
            const lines = doc.splitTextToSize(fullText, availableWidth);
            lines.forEach((lineText: string) => {
              doc.text(lineText, margin + 4, yPosition);
              yPosition += 5;
            });

            if (index < validItems.length - 1) {
              yPosition += 2;
            }
          });

          yPosition += 6;
        };

        buildingInfoSections.forEach(section => {
          addInfoSection(section.title, section.items);
        });

        yPosition += 4;
      }

      // Processar cada requisito
      for (const requirement of sortedData) {
        const hasCriteria = requirement.criteria.length > 0;
        const requirementEstimatedHeight = 10 + (hasCriteria ? 16 : 0);
        checkSectionBreak('requirement', requirementEstimatedHeight);

        doc.setFontSize(14);
        doc.setFont('DejaVuSans', 'bold');
        doc.text(`Requisito: ${requirement.label}`, margin, yPosition);
        yPosition += 10;

        for (const criterion of requirement.criteria) {
          const hasAnalyses = criterion.analyses.some(analysis => analysis.parameters?.length);
          const criterionEstimatedHeight = 8 + (hasAnalyses ? 14 : 0);
          checkSectionBreak('criterion', criterionEstimatedHeight);

          doc.setFontSize(12);
          doc.setFont('DejaVuSans', 'bold');
          doc.text(`Critério: ${criterion.label}`, margin + 5, yPosition);
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
            const unitColumnWidth = 20;
            const levelColumnWidth = 20;
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
                fontStyle: 'normal'
              };
            });

            const tableData: any[] = [];

            const formatParameterValue = (value: unknown): string => {
              if (value === null || value === undefined) {
                return '—';
              }

              const textValue = compactPdfText(String(value));
              return textValue === '' ? '—' : textValue;
            };

            analysis.parameters.forEach(parameter => {
              const row: string[] = [];

              const parameterName = formatTextWithLineBreaks(parameter.label || 'Parâmetro');
              row.push(parameterName);

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

              const observationText = formatTextWithSeparators(parameter.notes ?? parameter.observation);
              if (observationText && observationText.trim()) {
                const cleanText = formatTextWithLineBreaks(observationText);

                tableData.push([
                  {
                    content: cleanText,
                    colSpan: tableHeaders.length,
                    styles: {
                      halign: 'left',
                      valign: 'top',
                      fontStyle: 'italic',
                      fontSize: 8,
                      textColor: [100, 100, 100],
                      fillColor: [245, 245, 245],
                      cellPadding: { top: 4, right: 8, bottom: 4, left: 12 },
                      overflow: 'linebreak',
                      cellWidth: 'auto',
                      font: 'DejaVuSans',
                      lineHeight: 1.2
                    }
                  }
                ]);
              }
            });

            const estimatedTableHeight = estimateTableHeight(tableData, columnWidths);
            const analysisHeadingHeight = 7;
            const analysisSpacing = 9;
            const totalAnalysisHeight = analysisHeadingHeight + estimatedTableHeight + analysisSpacing;

            checkSectionBreak('analysis', totalAnalysisHeight);

            doc.setFontSize(10);
            doc.setFont('DejaVuSans', 'bold');
            doc.text(`Análise: ${analysis.label}`, margin + 10, yPosition);
            yPosition += analysisHeadingHeight;

            autoTable(doc, {
              head: [tableHeaders],
              body: tableData,
              startY: yPosition,
              margin: { left: margin + 6, right: margin + 6 },
              tableWidth: 'auto',
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

                if (typeof data.cell.raw === 'object' && data.cell.raw?.colSpan === tableHeaders.length) {
                  data.cell.styles.halign = 'left';
                  data.cell.styles.valign = 'top';
                  data.cell.styles.overflow = 'linebreak';
                  data.cell.styles.cellWidth = 'auto';
                  data.cell.styles.font = 'DejaVuSans';
                  data.cell.styles.fontStyle = 'italic';
                  data.cell.styles.fontSize = 8;
                  data.cell.styles.lineHeight = 1.2;

                  if (data.cell.raw.content && typeof data.cell.raw.content === 'string') {
                    const processedText = formatTextWithLineBreaks(data.cell.raw.content);
                    data.cell.text = [processedText];
                  }

                  return;
                }

                if (data.section === 'body') {
                  data.cell.styles.font = 'DejaVuSans';

                  if (data.column.index === 0) {
                    data.cell.styles.halign = 'left';
                    data.cell.styles.valign = 'top';
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.lineHeight = 1.2;
                  } else if (data.column.index === 1) {
                    data.cell.styles.halign = 'center';
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.lineHeight = 1.15;
                  }
                }

                if (data.section === 'body' && data.cell.raw && typeof data.cell.raw === 'string') {
                  if (data.cell.text && data.cell.text.length > 0) {
                    data.cell.text = data.cell.text.map((text: string) =>
                      formatTextWithLineBreaks(text)
                    );
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
          className="bg-blue-600 hover:bg-blue-700 text-white"
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
                  PDE - Perfil de Desempenho da Edificação
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
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
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
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
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
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
              Condições Ambientais e Classificações
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card Zona Bioclimática */}
              {getBioclimaticZoneInfo() && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">Zona Bioclimática</div>
                  <div className="text-sm font-medium text-gray-900">{getBioclimaticZoneInfo()}</div>
                </div>
              )}

              {/* Card Isopleta */}
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

      {/* Conteúdo do Relatório */}
      <div className="print-content">
        {sortedData.map((requirement, reqIndex) => (
          <div key={requirement.id} className={`mb-8 ${reqIndex === 0 ? '' : 'page-break-before'}`}>
            {/* Seção: Requisito */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide mb-4 pb-3 border-b-2 border-gray-600">
                Requisito: {requirement.label}
              </h3>

              {requirement.criteria.map((criterion) => (
                <div key={criterion.id} className="mb-6">
                  {/* Título do Critério */}
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
                    Critério: {criterion.label}
                  </h4>

                  {criterion.analyses.map((analysis) => {
                    const analysisKey = `analysis-${analysis.id}`;
                    const selectedLevels = selectedEvaluations.get(analysisKey) || [];

                    return (
                      <div key={analysis.id} className="mb-4 ml-4">
                        {/* Card da Análise */}
                        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                          <h5 className="text-xs font-medium text-gray-600 mb-3">
                            Análise: {analysis.label}
                          </h5>

                          {/* Tabela de Parâmetros */}
                          {analysis.parameters.length > 0 && (
                            <div className="bg-white rounded border border-gray-300 overflow-hidden">
                              <Table>
                                <TableHeader>
                                  {/* Cabeçalho principal da tabela */}
                                  <TableRow className="bg-gray-100 border-b border-gray-300">
                                    <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 pl-4 pr-5 min-w-[18rem]">
                                      Parâmetro
                                    </TableHead>
                                    <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-4 w-24">
                                      UN
                                    </TableHead>
                                    {selectedLevels.includes('minimum') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-4 w-24">
                                        Min
                                      </TableHead>
                                    )}
                                    {selectedLevels.includes('intermediate') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-4 w-24">
                                        Int
                                      </TableHead>
                                    )}
                                    {selectedLevels.includes('superior') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-4 w-24">
                                        Sup
                                      </TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {analysis.parameters.map((parameter) => (
                                    <TableRow key={parameter.id} className="hover:bg-gray-50 border-b border-gray-200">
                                      <TableCell className="border-r border-gray-300 align-middle py-3 pl-4 pr-5 font-medium min-w-[18rem]">
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            {formatTextWithSeparators(parameter.label)}
                                          </div>
                                          {parameter.notes && (
                                            <div className="text-xs text-gray-600 mt-2 italic bg-gray-100 p-2 rounded border-l-2 border-gray-400">
                                              <span className="font-semibold text-gray-800">Observação:</span> {formatTextWithSeparators(parameter.notes)}
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-4 w-24">
                                        {parameter.unit || '—'}
                                      </TableCell>
                                      {selectedLevels.includes('minimum') && (
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-4 w-24">
                                          {parameter.minimumValue || '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('intermediate') && (
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-4 w-24">
                                          {parameter.intermediateValue || '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('superior') && (
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-4 w-24">
                                          {parameter.superiorValue || '—'}
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
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
    </div>
  );
}