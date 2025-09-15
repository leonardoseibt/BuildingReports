import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X } from 'lucide-react';
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
      {/* Cabeçalho Compacto - Layout horizontal otimizado */}
      <div className="mb-4 print:mb-3">
        {/* Título principal */}
        <div className="border-b-2 border-slate-300 pb-2 mb-3">
          <h1 className="text-2xl font-bold text-slate-900 print:text-lg print:font-bold">
            Relatório de Desempenho - {building?.name || `Edificação ID ${item.buildingId}`}
          </h1>
        </div>
        
        {/* Informações em grid compacto */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-xs print:text-[10px] text-slate-600 mb-3">
          {item.buildingLocation && (
            <div><span className="font-semibold">Local:</span> {item.buildingLocation}</div>
          )}
          {item.buildingArea && (
            <div><span className="font-semibold">Área:</span> {item.buildingArea}m²</div>
          )}
          {item.buildingHeight && (
            <div><span className="font-semibold">Altura:</span> {item.buildingHeight}m</div>
          )}
          {item.buildingFloors && (
            <div><span className="font-semibold">Pavimentos:</span> {item.buildingFloors}</div>
          )}
          <div>
            <span className="font-semibold">Gerado:</span> {item.generatedAt ? new Date(item.generatedAt as any).toLocaleDateString('pt-BR') : ''}
          </div>
        </div>
        
        {/* Botões - ocultos na impressão */}
        <div className="flex gap-2 print:hidden">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Visualizar Impressão
          </Button>
          <Button onClick={handleDownloadPDF} variant="default" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Baixar PDF
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
          <>
            {/* Renderizar páginas calculadas */}
            {createPageBreaks(filteredData).map((pageData, pageIndex) => (
              <PageContent 
                key={`page-${pageIndex}`} 
                pageData={pageData} 
                pageIndex={pageIndex} 
              />
            ))}
          </>
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
          
          /* Quebra de página forçada */
          .force-page-break {
            page-break-before: always !important;
            break-before: page !important;
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