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
    window.print();
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
    <div className="print:p-0 p-6">
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
                        
                        return (
                          <div key={analysis.id} className="mb-4 print:mb-3">
                            <div className="mb-2">
                              <h4 className="font-medium text-sm text-slate-800 print:text-xs">
                                {analysis.code} - {analysis.label}
                              </h4>
                              <p className="text-xs text-slate-600 print:text-xs">
                                Níveis selecionados: {selectedLevels.map(level => {
                                  switch(level) {
                                    case 'minimum': return 'Mínimo';
                                    case 'intermediate': return 'Intermediário';
                                    case 'superior': return 'Superior';
                                    default: return level;
                                  }
                                }).join(', ')}
                              </p>
                            </div>
                            
                            {/* Tabela de Parâmetros */}
                            {filteredParameters.length > 0 && (
                              <Table className="border table-fixed w-full">
                                <TableHeader>
                                  <TableRow className="bg-slate-50 print:bg-gray-100">
                                    <TableHead className="border print:text-xs">Parâmetro</TableHead>
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
                                  {filteredParameters.map(parameter => (
                                    <TableRow key={parameter.id}>
                                      <TableCell className="border font-medium print:text-xs">
                                        <div>
                                          <div className="font-medium">{renderTextWithLineBreaks(parameter.label)}</div>
                                          {parameter.unit && <span className="text-slate-500 text-xs">({parameter.unit})</span>}
                                        </div>
                                      </TableCell>
                                      {selectedLevels.includes('minimum') && (
                                        <TableCell className="text-center border print:text-xs w-32">
                                          {parameter.minimumValue || '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('intermediate') && (
                                        <TableCell className="text-center border print:text-xs w-32">
                                          {parameter.intermediateValue || '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('superior') && (
                                        <TableCell className="text-center border print:text-xs w-32">
                                          {parameter.superiorValue || '—'}
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
          
          /* Larguras fixas para colunas de níveis */
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