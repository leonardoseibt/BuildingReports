import { useQuery } from '@tanstack/react-query';
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
  
  // Buscar dados para filtros de atributos
  const { data: attributes = [] } = useQuery<any[]>({ 
    queryKey: ['/api/attributes'],
    queryFn: async () => {
      const r = await fetch('/api/attributes', { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const building = buildings.find(b => b.id === item.buildingId);
  const evaluations = item.reportData?.evaluations || [];

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
   * Função para verificar se um parâmetro deve ser exibido baseado em seus atributos condicionais
   * 
   * Lógica:
   * 1. Se o parâmetro não tem attributeId, sempre exibe
   * 2. Se tem attributeId, busca a definição do atributo
   * 3. Se tem attributeValueId, verifica se o valor da edificação corresponde
   * 4. Se tem minLimit/maxLimit, verifica se o valor está dentro dos limites
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

    // Obter valor da edificação para este atributo
    const buildingValue = getBuildingAttributeValue(building, attribute);
    
    // Se não conseguiu obter valor da edificação, não mostra
    if (buildingValue === null || buildingValue === undefined) {
      return false;
    }

    // Verificar valor específico do atributo (attributeValueId)
    if (parameter.attributeValueId !== null && parameter.attributeValueId !== undefined) {
      // Comparar valores convertidos para string
      const paramValue = String(parameter.attributeValueId);
      const buildingValueStr = String(buildingValue);
      
      if (paramValue !== buildingValueStr) {
        return false;
      }
    }

    // Verificar limites numéricos (minLimit/maxLimit)
    const numericValue = parseFloat(String(buildingValue));
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
   * Função para obter valor do atributo da edificação baseado na definição do atributo
   */
  const getBuildingAttributeValue = (building: any, attribute: any): any => {
    if (!building || !attribute) {
      return null;
    }

    // Mapeamento direto das colunas para propriedades da edificação
    const columnToProperty: Record<string, string> = {
      'typology_id': 'typologyId',
      'noise_class_id': 'noiseClassId',
      'aggressiveness_class_id': 'aggressivenessClassId',
      'bioclimatic_zone': 'bioclimaticZone',
      'isopleth_code': 'isoplethCode',
      'total_area': 'totalArea',
      'building_height': 'buildingHeight',
      'floors': 'floors',
      'units': 'units',
    };

    // Buscar propriedade correspondente
    const propertyName = columnToProperty[attribute.sourceColumn];
    
    if (propertyName && building[propertyName] !== undefined && building[propertyName] !== null) {
      return building[propertyName];
    }

    // Fallback: tentar acesso direto
    if (building[attribute.sourceColumn] !== undefined && building[attribute.sourceColumn] !== null) {
      return building[attribute.sourceColumn];
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
      {/* Cabeçalho */}
      <div className="mb-4">
        <div className="border-b-2 border-slate-300 pb-2 mb-3">
          <h1 className="text-2xl font-bold text-slate-900">
            PDE - Perfil de Desempenho da Edificação: {building?.name || `Edificação ID ${item.buildingId}`}
          </h1>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-xs text-slate-600 mb-3">
          {item.buildingLocation && (
            <div><span className="font-semibold">Local:</span> {item.buildingLocation}</div>
          )}
          {item.buildingArea && (
            <div><span className="font-semibold">Área:</span> {item.buildingArea}</div>
          )}
          {item.buildingHeight && (
            <div><span className="font-semibold">Altura:</span> {item.buildingHeight}</div>
          )}
          {item.buildingFloors && (
            <div><span className="font-semibold">Pavimentos:</span> {item.buildingFloors}</div>
          )}
          {building?.technicianId && (
            <div><span className="font-semibold">Responsável:</span> ID {building.technicianId}</div>
          )}
          {building?.bioclimaticZone && (
            <div><span className="font-semibold">Zona Bioclimática:</span> {building.bioclimaticZone}</div>
          )}
          {item.generatedAt && (
            <div><span className="font-semibold">Gerado em:</span> {new Date(item.generatedAt).toLocaleDateString('pt-BR')}</div>
          )}
          <div><span className="font-semibold">Versão:</span> {item.version || 1}</div>
        </div>
      </div>

      {/* Conteúdo do Relatório */}
      <div className="print-content">
        {sortedData.map((requirement) => (
          <div key={requirement.id} className="mb-8">
            {/* Título do Requisito */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <h2 className="text-xl font-bold text-blue-900">
                Requisito: {requirement.label}
              </h2>
            </div>

            {requirement.criteria.map((criterion) => (
              <div key={criterion.id} className="ml-4 mb-6">
                {/* Título do Critério */}
                <div className="bg-green-50 border-l-4 border-green-500 p-3 mb-3">
                  <h3 className="text-lg font-semibold text-green-900">
                    Critério: {criterion.label}
                  </h3>
                </div>

                {criterion.analyses.map((analysis) => {
                  const analysisKey = `analysis-${analysis.id}`;
                  const selectedLevels = selectedEvaluations.get(analysisKey) || [];

                  return (
                    <div key={analysis.id} className="ml-4 mb-4">
                      {/* Título da Análise */}
                      <div className="bg-orange-50 border-l-4 border-orange-500 p-3 mb-3">
                        <h4 className="text-base font-semibold text-orange-900">
                          Análise: {analysis.label}
                        </h4>
                      </div>

                      {/* Tabela de Parâmetros */}
                      {analysis.parameters.length > 0 && (
                        <div className="ml-4">
                          <Table className="border">
                            <TableHeader>
                              <TableRow className="bg-slate-100">
                                <TableHead className="border font-semibold text-slate-900 text-center align-middle py-2 px-2">
                                  Parâmetro
                                </TableHead>
                                <TableHead className="border font-semibold text-slate-900 text-center align-middle py-2 px-2 w-16">
                                  Unidade
                                </TableHead>
                                {selectedLevels.includes('minimum') && (
                                  <TableHead className="border font-semibold text-slate-900 text-center align-middle py-2 px-2 w-20">
                                    Mínimo
                                  </TableHead>
                                )}
                                {selectedLevels.includes('intermediate') && (
                                  <TableHead className="border font-semibold text-slate-900 text-center align-middle py-2 px-2 w-20">
                                    Intermediário
                                  </TableHead>
                                )}
                                {selectedLevels.includes('superior') && (
                                  <TableHead className="border font-semibold text-slate-900 text-center align-middle py-2 px-2 w-20">
                                    Superior
                                  </TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analysis.parameters.map((parameter) => (
                                <TableRow key={parameter.id} className="hover:bg-slate-50">
                                  <TableCell className="border align-middle py-1 px-2 font-medium">
                                    <div>
                                      <div className="font-medium text-slate-900">
                                        {formatTextWithSeparators(parameter.label)}
                                      </div>
                                      {parameter.notes && (
                                        <div className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded border-l-2 border-blue-300">
                                          <span className="font-semibold text-blue-700">Observação:</span> {formatTextWithSeparators(parameter.notes)}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center border align-middle py-1 px-1 w-16">
                                    {parameter.unit || '—'}
                                  </TableCell>
                                  {selectedLevels.includes('minimum') && (
                                    <TableCell className="text-center border align-middle py-1 px-1 w-20">
                                      {parameter.minimumValue || '—'}
                                    </TableCell>
                                  )}
                                  {selectedLevels.includes('intermediate') && (
                                    <TableCell className="text-center border align-middle py-1 px-1 w-20">
                                      {parameter.intermediateValue || '—'}
                                    </TableCell>
                                  )}
                                  {selectedLevels.includes('superior') && (
                                    <TableCell className="text-center border align-middle py-1 px-1 w-20">
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
                  );
                })}
              </div>
            ))}
          </div>
        ))}

        {sortedData.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p>Nenhum dado encontrado para este relatório.</p>
            <p className="text-sm mt-2">Verifique se há avaliações de desempenho selecionadas.</p>
          </div>
        )}
      </div>
    </div>
  );
}