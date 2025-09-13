import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer } from 'lucide-react';
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

  const building = buildings.find(b => b.id === item.buildingId);
  const evaluations = item.reportData?.evaluations || [];

  // Criar um mapa de avaliações selecionadas
  const selectedEvaluations = new Map<string, string[]>();
  evaluations.forEach((ev: any) => {
    const key = ev.analysisId ? `analysis-${ev.analysisId}` : ev.criterionId ? `crit-${ev.criterionId}` : `req-${ev.requirementId}`;
    if (!selectedEvaluations.has(key)) {
      selectedEvaluations.set(key, []);
    }
    selectedEvaluations.get(key)!.push(ev.level);
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
            parameters: parameters.filter(param => param.analysisId === analysis.id)
          }))
      }))
  })).filter(req => req.criteria.length > 0);

  // Filtrar apenas análises que têm avaliações selecionadas
  const filteredData = groupedData.map(req => ({
    ...req,
    criteria: req.criteria.map(crit => ({
      ...crit,
      analyses: crit.analyses.filter(analysis => {
        const key = `analysis-${analysis.id}`;
        return selectedEvaluations.has(key) && selectedEvaluations.get(key)!.length > 0;
      })
    })).filter(crit => crit.analyses.length > 0)
  })).filter(req => req.criteria.length > 0);

  const handlePrint = () => {
    // Criar uma nova janela para impressão apenas do conteúdo do relatório
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (printWindow) {
      // Obter o conteúdo HTML do relatório
      const reportContent = document.querySelector('.print-content');
      
      if (reportContent) {
        // Clonar o conteúdo para não afetar o original
        const clonedContent = reportContent.cloneNode(true) as HTMLElement;
        
        // Remover todos os botões e elementos com classe print:hidden
        const buttonsToRemove = clonedContent.querySelectorAll('button, .print\\:hidden');
        buttonsToRemove.forEach(element => element.remove());
        
        // Remover divs que contenham botões
        const buttonContainers = clonedContent.querySelectorAll('.print\\:hidden, [class*="print:hidden"]');
        buttonContainers.forEach(element => element.remove());
        
        // Criar o HTML completo para a janela de impressão
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Relatório de Desempenho - ${building?.name || `ID ${item.buildingId}`}</title>
              <meta charset="utf-8">
              <style>
                @page {
                  margin: 1.5cm;
                  size: A4;
                }
                
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  line-height: 1.5;
                  color: #334155;
                  background: white;
                  margin: 0;
                  padding: 20px;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                
                h1 { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 16px; }
                h2 { font-size: 18px; font-weight: 600; color: #1e293b; margin: 16px 0 12px 0; }
                h3 { font-size: 16px; font-weight: 500; color: #475569; margin: 12px 0 8px 0; }
                h4 { font-size: 14px; font-weight: 500; color: #64748b; margin: 8px 0 6px 0; }
                
                .header-info { font-size: 12px; color: #64748b; margin-bottom: 24px; }
                .header-info p { margin: 4px 0; }
                
                .requirement-header {
                  border-left: 4px solid #3b82f6;
                  padding: 8px 16px;
                  background: #f1f5f9;
                  margin: 16px 0 12px 0;
                }
                
                .criterion-header {
                  border-left: 2px solid #94a3b8;
                  padding: 6px 12px;
                  background: #f8fafc;
                  margin: 12px 0 8px 0;
                }
                
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 12px 0;
                  table-layout: fixed;
                }
                
                th, td {
                  border: 1px solid #d1d5db;
                  padding: 8px;
                  font-size: 12px;
                  text-align: left;
                  vertical-align: top;
                }
                
                th {
                  background: #f9fafb;
                  font-weight: 600;
                  text-align: center;
                }
                
                .text-center { text-align: center; }
                .align-middle { vertical-align: middle; }
                .font-medium { font-weight: 500; }
                .italic { font-style: italic; }
                
                .w-20 { width: 5rem; min-width: 5rem; max-width: 5rem; }
                .w-24 { width: 6rem; min-width: 6rem; max-width: 6rem; }
                
                .observations {
                  font-size: 11px;
                  color: #64748b;
                  margin-top: 6px;
                }
                
                .observations-label {
                  font-weight: 600;
                  color: #475569;
                }
                
                hr { border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0; }
                
                /* Ocultar elementos que não devem aparecer na impressão */
                button, .print\\:hidden, [class*="print:hidden"] {
                  display: none !important;
                }
              </style>
            </head>
            <body>
              ${clonedContent.innerHTML}
            </body>
          </html>
        `);
        
        printWindow.document.close();
        
        // Aguardar o carregamento e iniciar a impressão
        printWindow.onload = function() {
          printWindow.print();
          printWindow.close();
        };
      }
    }
  };

  // Função helper para quebrar linhas no texto
  const renderTextWithLineBreaks = (text: string | null) => {
    if (!text) return '';
    return text.split('\n').map((line, index, array) => (
      <span key={index}>
        {line}
        {index < array.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="print:p-0 p-6 print-content">
      {/* Cabeçalho - visível na tela e impressão */}
      <div className="flex justify-between items-start mb-6 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 print:text-xl">
            Relatório de Desempenho
          </h1>
          <div className="text-sm text-slate-600 mt-2 print:text-xs">
            <p><strong>Edificação:</strong> {building?.name || `ID ${item.buildingId}`}</p>
            {item.buildingLocation && <p><strong>Localização:</strong> {item.buildingLocation}</p>}
            {item.buildingArea && <p><strong>Área:</strong> {item.buildingArea}m²</p>}
            {item.buildingHeight && <p><strong>Altura:</strong> {item.buildingHeight}m</p>}
            {item.buildingFloors && <p><strong>Pavimentos:</strong> {item.buildingFloors}</p>}
            <p><strong>Gerado em:</strong> {item.generatedAt ? new Date(item.generatedAt as any).toLocaleDateString('pt-BR') : ''}</p>
          </div>
        </div>
        
        {/* Botões - ocultos na impressão */}
        <div className="flex gap-2 print:hidden">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Conteúdo do relatório */}
      <div className="space-y-6 print:space-y-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>Nenhuma avaliação encontrada para este relatório.</p>
          </div>
        ) : (
          filteredData.map((req, reqIndex) => (
            <div key={req.id} className="space-y-4 print:space-y-3">
              {/* Cabeçalho do Requisito */}
              <div className="border-l-4 border-l-blue-500 pl-4 py-2 bg-blue-50/50 print:bg-gray-100">
                <h2 className="font-semibold text-lg text-slate-900 print:text-base">
                  {req.code} - {req.label}
                </h2>
              </div>
            
              {/* Critérios do Requisito */}
              <div className="ml-6 space-y-4 print:ml-4 print:space-y-3">
                {req.criteria.map((criterion) => (
                  <div key={`${req.id}-${criterion.id}`} className="space-y-3 print:space-y-2">
                    {/* Cabeçalho do Critério */}
                    <div className="border-l-2 border-l-slate-300 pl-3 py-2 bg-slate-50/50 print:bg-gray-50">
                      <h3 className="font-medium text-slate-700 print:text-sm">
                        {criterion.code} - {criterion.label}
                      </h3>
                    </div>
                    
                    {/* Análises do Critério */}
                    <div className="ml-4 print:ml-2">
                      {criterion.analyses.map(analysis => {
                        const analysisKey = `analysis-${analysis.id}`;
                        const selectedLevels = selectedEvaluations.get(analysisKey) || [];
                        
                        // Verificar se todos os 3 níveis foram selecionados
                        const allLevelsSelected = selectedLevels.includes('minimum') && 
                                                 selectedLevels.includes('intermediate') && 
                                                 selectedLevels.includes('superior');
                        
                        // Filtrar parâmetros baseado na regra
                        const filteredParameters = analysis.parameters.filter(parameter => {
                          if (allLevelsSelected) {
                            // Se todos os 3 níveis foram selecionados, mostrar todos os parâmetros
                            return true;
                          } else {
                            // Se nem todos os níveis foram selecionados, mostrar apenas parâmetros com valores nos níveis selecionados
                            const hasMinimum = selectedLevels.includes('minimum') && parameter.minimumValue && parameter.minimumValue.trim() !== '';
                            const hasIntermediate = selectedLevels.includes('intermediate') && parameter.intermediateValue && parameter.intermediateValue.trim() !== '';
                            const hasSuperior = selectedLevels.includes('superior') && parameter.superiorValue && parameter.superiorValue.trim() !== '';
                            
                            // Retornar true se pelo menos um dos níveis selecionados tem valor
                            return hasMinimum || hasIntermediate || hasSuperior;
                          }
                        });

                        // Separar parâmetros com múltiplos valores dos com valores únicos
                        const multiValueParameters: typeof filteredParameters = [];
                        const singleValueCombinations: Array<{
                          parameter: typeof analysis.parameters[0];
                          level: 'minimum' | 'intermediate' | 'superior';
                          value: string;
                          numericValue: number;
                        }> = [];

                        filteredParameters.forEach(parameter => {
                          // Contar quantos níveis selecionados têm valores
                          const levelsWithValues = selectedLevels.filter(levelStr => {
                            const level = levelStr as 'minimum' | 'intermediate' | 'superior';
                            switch(level) {
                              case 'minimum':
                                return parameter.minimumValue && parameter.minimumValue.trim() !== '';
                              case 'intermediate':
                                return parameter.intermediateValue && parameter.intermediateValue.trim() !== '';
                              case 'superior':
                                return parameter.superiorValue && parameter.superiorValue.trim() !== '';
                              default:
                                return false;
                            }
                          });

                          if (levelsWithValues.length >= 2) {
                            // Parâmetro com 2 ou mais valores - será mostrado em uma linha
                            multiValueParameters.push(parameter);
                          } else {
                            // Parâmetro com apenas 1 valor - criar combinações individuais
                            selectedLevels.forEach(levelStr => {
                              const level = levelStr as 'minimum' | 'intermediate' | 'superior';
                              let value = '';
                              switch(level) {
                                case 'minimum':
                                  value = parameter.minimumValue || '';
                                  break;
                                case 'intermediate':
                                  value = parameter.intermediateValue || '';
                                  break;
                                case 'superior':
                                  value = parameter.superiorValue || '';
                                  break;
                              }
                              
                              if (value && value.trim() !== '') {
                                const numericValue = parseFloat(value.replace(',', '.')) || 0;
                                singleValueCombinations.push({
                                  parameter,
                                  level,
                                  value,
                                  numericValue
                                });
                              }
                            });
                          }
                        });

                        // Criar uma única lista unificada com todos os parâmetros para ordenação correta
                        const allParameterEntries: Array<{
                          parameter: typeof analysis.parameters[0];
                          isMultiValue: boolean;
                          specificLevel?: 'minimum' | 'intermediate' | 'superior';
                          sortValue: number;
                          levelPriority: number;
                        }> = [];

                        // Adicionar parâmetros com múltiplos valores
                        multiValueParameters.forEach(parameter => {
                          const getMinValue = () => {
                            const values = [];
                            if (selectedLevels.includes('minimum') && parameter.minimumValue && parameter.minimumValue.trim() !== '') {
                              values.push(parseFloat(parameter.minimumValue.replace(',', '.')) || 0);
                            }
                            if (selectedLevels.includes('intermediate') && parameter.intermediateValue && parameter.intermediateValue.trim() !== '') {
                              values.push(parseFloat(parameter.intermediateValue.replace(',', '.')) || 0);
                            }
                            if (selectedLevels.includes('superior') && parameter.superiorValue && parameter.superiorValue.trim() !== '') {
                              values.push(parseFloat(parameter.superiorValue.replace(',', '.')) || 0);
                            }
                            return values.length > 0 ? Math.min(...values) : 0;
                          };

                          const getLevelPriority = () => {
                            if (selectedLevels.includes('minimum') && parameter.minimumValue && parameter.minimumValue.trim() !== '') {
                              return 1; // Mínimo tem prioridade
                            }
                            if (selectedLevels.includes('intermediate') && parameter.intermediateValue && parameter.intermediateValue.trim() !== '') {
                              return 2; // Intermediário
                            }
                            if (selectedLevels.includes('superior') && parameter.superiorValue && parameter.superiorValue.trim() !== '') {
                              return 3; // Superior
                            }
                            return 4;
                          };

                          allParameterEntries.push({
                            parameter,
                            isMultiValue: true,
                            sortValue: getMinValue(),
                            levelPriority: getLevelPriority()
                          });
                        });

                        // Adicionar parâmetros com valor único
                        singleValueCombinations.forEach(combo => {
                          const levelOrder = { 'minimum': 1, 'intermediate': 2, 'superior': 3 };
                          
                          allParameterEntries.push({
                            parameter: combo.parameter,
                            isMultiValue: false,
                            specificLevel: combo.level,
                            sortValue: combo.numericValue,
                            levelPriority: levelOrder[combo.level]
                          });
                        });

                        // Ordenar a lista unificada
                        allParameterEntries.sort((a, b) => {
                          // Primeiro critério: ordenação alfabética por descrição
                          const labelComparison = a.parameter.label.localeCompare(b.parameter.label, 'pt-BR');
                          if (labelComparison !== 0) {
                            return labelComparison;
                          }
                          
                          // Segundo critério: por valor numérico
                          if (a.sortValue !== b.sortValue) {
                            return a.sortValue - b.sortValue;
                          }
                          
                          // Terceiro critério: por prioridade de nível
                          return a.levelPriority - b.levelPriority;
                        });

                        // Criar array final para renderização
                        const parametersToRender = allParameterEntries.map(entry => ({
                          parameter: entry.parameter,
                          isMultiValue: entry.isMultiValue,
                          specificLevel: entry.specificLevel
                        }));
                        
                        return (
                          <div key={analysis.id} className="mb-4 print:mb-3">
                            <div className="mb-2">
                              <h4 className="font-medium text-sm text-slate-800 print:text-xs">
                                {analysis.code} - {analysis.label}
                              </h4>
                            </div>
                            
                            {/* Tabela de Parâmetros */}
                            {parametersToRender.length > 0 && (
                              <Table className="border table-fixed w-full">
                                <TableHeader>
                                  <TableRow className="bg-slate-50 print:bg-gray-100">
                                    <TableHead className="border print:text-xs">Parâmetro</TableHead>
                                    <TableHead className="text-center border print:text-xs w-24">Unidade</TableHead>
                                    {selectedLevels.includes('minimum') && (
                                      <TableHead className="text-center border print:text-xs w-32">Mínimo</TableHead>
                                    )}
                                    {selectedLevels.includes('intermediate') && (
                                      <TableHead className="text-center border print:text-xs w-32">Intermediário</TableHead>
                                    )}
                                    {selectedLevels.includes('superior') && (
                                      <TableHead className="text-center border print:text-xs w-32">Superior</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {parametersToRender.map((row, index) => (
                                    <TableRow key={`${row.parameter.id}-${index}`}>
                                      <TableCell className="border font-medium print:text-xs align-top">
                                        <div className="space-y-2">
                                          <div className="font-medium">{renderTextWithLineBreaks(row.parameter.label)}</div>
                                          {row.parameter.notes && row.parameter.notes.trim() !== '' && (
                                            <div className="text-xs text-slate-600 print:text-xs">
                                              <div className="flex items-start gap-1">
                                                <span className="font-semibold text-slate-700 min-w-fit">
                                                  <span className="print:hidden">💬 </span>
                                                  Observações: 
                                                </span>
                                                <span className="italic leading-relaxed">{renderTextWithLineBreaks(row.parameter.notes)}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center border print:text-xs w-24 align-middle">
                                        {row.parameter.unit || '—'}
                                      </TableCell>
                                      {selectedLevels.includes('minimum') && (
                                        <TableCell className="text-center border print:text-xs w-32 align-middle">
                                          {row.isMultiValue || row.specificLevel === 'minimum' ? 
                                            (row.parameter.minimumValue || '—') : '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('intermediate') && (
                                        <TableCell className="text-center border print:text-xs w-32 align-middle">
                                          {row.isMultiValue || row.specificLevel === 'intermediate' ? 
                                            (row.parameter.intermediateValue || '—') : '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('superior') && (
                                        <TableCell className="text-center border print:text-xs w-32 align-middle">
                                          {row.isMultiValue || row.specificLevel === 'superior' ? 
                                            (row.parameter.superiorValue || '—') : '—'}
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Separador entre requisitos (exceto o último) */}
              {reqIndex !== filteredData.length - 1 && (
                <hr className="border-slate-200 my-6 print:my-4" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Estilos de impressão através de classes CSS personalizadas */}
      <style>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Larguras fixas para colunas */
          .w-24 {
            width: 6rem !important;
            min-width: 6rem !important;
            max-width: 6rem !important;
          }
          
          .w-32 {
            width: 8rem !important;
            min-width: 8rem !important;
            max-width: 8rem !important;
          }
          
          /* Garantir que a tabela mantenha layout fixo */
          table {
            table-layout: fixed !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}