import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Building, Requirement, Criterion, Analysis, Parameter } from '@shared/schema';

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

  // Função para formatar texto com quebras de linha
  const formatTextWithSeparators = (text: string | null | undefined): string => {
    if (!text) return '';
    // Substitui quebras de linha por separador visual
    return text.replace(/\n/g, ' • ');
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
  evaluations.forEach((ev: any) => {
    const key = ev.analysisId ? `analysis-${ev.analysisId}` : ev.criterionId ? `crit-${ev.criterionId}` : `req-${ev.requirementId}`;
    if (!selectedEvaluations.has(key)) {
      selectedEvaluations.set(key, []);
    }
    // Fix: usando 'level' ao invés de 'performanceLevel' conforme o schema original
    if (ev.level && !selectedEvaluations.get(key)!.includes(ev.level)) {
      selectedEvaluations.get(key)!.push(ev.level);
    }
  });

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

  return (
    <div className="p-6">
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
        <div className="bg-white border border-gray-300 rounded-b-lg p-6 shadow-sm">
          
          {/* Seção: Identificação */}
          <div className="mb-6">
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
        {sortedData.map((requirement) => (
          <div key={requirement.id} className="mb-8">
            {/* Seção: Requisito */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide mb-4 pb-3 border-b-2 border-gray-600">
                Requisito: {requirement.label}
              </h3>

              {requirement.criteria.map((criterion) => (
                <div key={criterion.id} className="mb-6">
                  {/* Título do Critério */}
                  <h4 className="text-base font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
                    Critério: {criterion.label}
                  </h4>

                  {criterion.analyses.map((analysis) => {
                    const analysisKey = `analysis-${analysis.id}`;
                    const selectedLevels = selectedEvaluations.get(analysisKey) || [];

                    return (
                      <div key={analysis.id} className="mb-4 ml-4">
                        {/* Card da Análise */}
                        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                          <h5 className="text-sm font-medium text-gray-600 mb-3">
                            Análise: {analysis.label}
                          </h5>

                          {/* Tabela de Parâmetros */}
                          {analysis.parameters.length > 0 && (
                            <div className="bg-white rounded border border-gray-300 overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-100 border-b border-gray-300">
                                    <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-3">
                                      Parâmetro
                                    </TableHead>
                                    <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-3 w-20">
                                      Unidade
                                    </TableHead>
                                    {selectedLevels.includes('minimum') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-3 w-20">
                                        Mínimo
                                      </TableHead>
                                    )}
                                    {selectedLevels.includes('intermediate') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-3 w-20">
                                        Intermediário
                                      </TableHead>
                                    )}
                                    {selectedLevels.includes('superior') && (
                                      <TableHead className="border-r border-gray-300 font-semibold text-gray-800 text-center align-middle py-3 px-3 w-20">
                                        Superior
                                      </TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {analysis.parameters.map((parameter) => (
                                    <TableRow key={parameter.id} className="hover:bg-gray-50 border-b border-gray-200">
                                      <TableCell className="border-r border-gray-300 align-middle py-3 px-3 font-medium">
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
                                      <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-3 w-20">
                                        {parameter.unit || '—'}
                                      </TableCell>
                                      {selectedLevels.includes('minimum') && (
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-3 w-20">
                                          {parameter.minimumValue || '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('intermediate') && (
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-3 w-20">
                                          {parameter.intermediateValue || '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('superior') && (
                                        <TableCell className="text-center border-r border-gray-300 align-middle py-3 px-3 w-20">
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
  );
}