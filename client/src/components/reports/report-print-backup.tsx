import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
    // Calcular quantos níveis de desempenho únicos estão selecionados no total
    const allSelectedLevels = new Set<string>();
    selectedEvaluations.forEach(levels => {
      levels.forEach(level => allSelectedLevels.add(level));
    });
    const totalSelectedLevels = allSelectedLevels.size;

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
                  line-height: 1.3;
                  color: #334155;
                  background: white;
                  margin: 0;
                  padding: 15px;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                  font-size: 11px;
                }
                
                h1 { font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 12px; line-height: 1.2; }
                h2 { font-size: 14px; font-weight: 600; color: #1e293b; margin: 12px 0 8px 0; line-height: 1.2; }
                h3 { font-size: 12px; font-weight: 500; color: #475569; margin: 8px 0 6px 0; line-height: 1.2; }
                h4 { font-size: 10px; font-weight: 500; color: #64748b; margin: 6px 0 4px 0; line-height: 1.2; }
                
                .header-info { font-size: 10px; color: #64748b; margin-bottom: 16px; }
                .header-info p { margin: 2px 0; }
                
                .requirement-header {
                  border-left: 4px solid #3b82f6;
                  padding: 6px 12px;
                  background: #f1f5f9;
                  margin: 12px 0 8px 0;
                }
                
                .criterion-header {
                  border-left: 2px solid #94a3b8;
                  padding: 4px 8px;
                  background: #f8fafc;
                  margin: 8px 0 6px 0;
                }
                
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 8px 0;
                  table-layout: fixed;
                  font-size: 9px;
                }
                
                th, td {
                  border: 1px solid #d1d5db;
                  padding: 3px 6px;
                  font-size: 9px;
                  text-align: left;
                  vertical-align: top;
                  line-height: 1.2;
                }
                
                th {
                  background: #f9fafb;
                  font-weight: 600;
                  text-align: center;
                  padding: 2px 4px;
                  font-size: 8px;
                }
                
                .text-center { text-align: center; }
                .align-middle { vertical-align: middle; }
                .font-medium { font-weight: 500; }
                .italic { font-style: italic; }
                
                .w-16 { width: 4rem; min-width: 4rem; max-width: 4rem; }
                .w-20 { width: 5rem; min-width: 5rem; max-width: 5rem; }
                .w-24 { width: 6rem; min-width: 6rem; max-width: 6rem; }
                .w-32 { width: 8rem; min-width: 8rem; max-width: 8rem; }
                
                /* Layout específico para impressão compacta */
                .print-compact { line-height: 1.1; }
                
                /* Controle simples e efetivo de quebras de página */
                .requirement-block { 
                  break-inside: avoid;
                  page-break-inside: avoid;
                }
                
                .criterion-block { 
                  break-inside: avoid;
                  page-break-inside: avoid;
                }
                
                .analysis-block { 
                  break-inside: avoid;
                  page-break-inside: avoid;
                }
                
                /* Permitir quebra apenas entre blocos principais */
                .allow-break-after {
                  break-after: auto;
                  page-break-after: auto;
                }
                
                /* Larguras condicionais para impressão baseadas no número de níveis */
                ${totalSelectedLevels === 3 ? `
                  .print-unit-width { width: 3rem; min-width: 3rem; max-width: 3rem; }
                  .print-level-width { width: 4rem; min-width: 4rem; max-width: 4rem; }
                ` : `
                  .print-unit-width { width: 4rem; min-width: 4rem; max-width: 4rem; }
                  .print-level-width { width: 5rem; min-width: 5rem; max-width: 5rem; }
                `}
                
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

  const handleDownloadPDF = async () => {
    try {
      // Buscar o elemento que contém o relatório
      const reportElement = document.querySelector('.print-content') as HTMLElement;
      if (!reportElement) {
        console.error('Elemento do relatório não encontrado');
        return;
      }

      // Criar um clone do elemento para manipulação
      const clonedElement = reportElement.cloneNode(true) as HTMLElement;
      
      // Remover botões e elementos que não devem aparecer no PDF
      const elementsToRemove = clonedElement.querySelectorAll('button, .print\\:hidden, [class*="print:hidden"]');
      elementsToRemove.forEach(el => el.remove());

      // Criar um container temporário para o clone
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm'; // Largura A4
      tempContainer.style.background = 'white';
      tempContainer.style.padding = '20px';
      tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      tempContainer.appendChild(clonedElement);
      document.body.appendChild(tempContainer);

      // Aplicar estilos específicos para PDF no elemento clonado
      const styleElement = document.createElement('style');
      styleElement.innerHTML = `
        .print-content h1 { font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 12px; line-height: 1.2; }
        .print-content h2 { font-size: 14px; font-weight: 600; color: #1e293b; margin: 12px 0 8px 0; line-height: 1.2; }
        .print-content h3 { font-size: 12px; font-weight: 500; color: #475569; margin: 8px 0 6px 0; line-height: 1.2; }
        .print-content h4 { font-size: 10px; font-weight: 500; color: #64748b; margin: 6px 0 4px 0; line-height: 1.2; }
        .print-content table { width: 100%; border-collapse: collapse; margin: 8px 0; table-layout: fixed; font-size: 9px; }
        .print-content th, .print-content td { border: 1px solid #d1d5db; padding: 3px 6px; font-size: 9px; text-align: left; vertical-align: top; line-height: 1.2; }
        .print-content th { background: #f9fafb; font-weight: 600; text-align: center; padding: 2px 4px; font-size: 8px; }
        .print-content .text-center { text-align: center; }
        .print-content .align-middle { vertical-align: middle; }
        .print-content .font-medium { font-weight: 500; }
        .print-content .italic { font-style: italic; }
        .print-content { line-height: 1.3; font-size: 11px; }
        
        /* Controle básico de quebras para PDF */
        .print-content .requirement-block { break-inside: avoid; page-break-inside: avoid; }
        .print-content .criterion-block { break-inside: avoid; page-break-inside: avoid; }
        .print-content .analysis-block { break-inside: avoid; page-break-inside: avoid; }
      `;
      document.head.appendChild(styleElement);

      // Capturar o elemento como canvas
      const canvas = await html2canvas(clonedElement, {
        scale: 2, // Alta qualidade
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: clonedElement.offsetWidth,
        height: clonedElement.offsetHeight
      });

      // Limpar elementos temporários
      document.body.removeChild(tempContainer);
      document.head.removeChild(styleElement);

      // Criar PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // Margem de 10mm de cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10; // Margem superior

      // Adicionar primeira página
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20); // Descontar margens

      // Adicionar páginas adicionais se necessário
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }

      // Nome do arquivo baseado no prédio
      const filename = building?.name 
        ? `relatorio-${building.name.toLowerCase().replace(/\s+/g, '-')}.pdf`
        : `relatorio-edificio-${item.buildingId}.pdf`;

      // Salvar o PDF
      pdf.save(filename);

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
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

  // Calculadora de linhas por página A4
  const A4_HEIGHT_MM = 297; // Altura A4 em mm
  const MARGIN_MM = 30; // Margens (15mm top + 15mm bottom)
  const USABLE_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM;
  
  // Alturas estimadas em mm para cada tipo de conteúdo
  const HEIGHTS = {
    header: 25, // Cabeçalho do relatório
    requirementHeader: 8, // Cabeçalho de requisito
    criterionHeader: 6, // Cabeçalho de critério  
    analysisHeader: 5, // Cabeçalho de análise
    tableHeader: 6, // Cabeçalho de tabela
    tableRow: 12, // Linha de tabela (incluindo observações)
    sectionSpacing: 4 // Espaçamento entre seções
  };

  // Função para calcular se o conteúdo cabe na página atual
  const calculateContentHeight = (
    requirementCount: number,
    criterionCount: number, 
    analysisCount: number,
    tableRowCount: number
  ) => {
    return HEIGHTS.header +
           (requirementCount * (HEIGHTS.requirementHeader + HEIGHTS.sectionSpacing)) +
           (criterionCount * (HEIGHTS.criterionHeader + HEIGHTS.sectionSpacing)) +
           (analysisCount * (HEIGHTS.analysisHeader + HEIGHTS.tableHeader + HEIGHTS.sectionSpacing)) +
           (tableRowCount * HEIGHTS.tableRow);
  };

  // Função para dividir conteúdo em páginas
  const createPageBreaks = (filteredData: any[]) => {
    const pages: any[] = [];
    let currentPage: any[] = [];
    let currentPageHeight = HEIGHTS.header; // Começar com altura do cabeçalho

    filteredData.forEach((req, reqIndex) => {
      req.criteria.forEach((criterion: any) => {
        criterion.analyses.forEach((analysis: any) => {
          const analysisKey = `analysis-${analysis.id}`;
          const selectedLevels = selectedEvaluations.get(analysisKey) || [];
          
          if (selectedLevels.length === 0) return;

          // Calcular parâmetros para esta análise
          const allLevelsSelected = selectedLevels.includes('minimum') && 
                                   selectedLevels.includes('intermediate') && 
                                   selectedLevels.includes('superior');

          const filteredParameters = analysis.parameters.filter((parameter: any) => {
            const hasMinimum = selectedLevels.includes('minimum') && parameter.minimumValue && parameter.minimumValue.trim() !== '';
            const hasIntermediate = selectedLevels.includes('intermediate') && parameter.intermediateValue && parameter.intermediateValue.trim() !== '';
            const hasSuperior = selectedLevels.includes('superior') && parameter.superiorValue && parameter.superiorValue.trim() !== '';
            return hasMinimum || hasIntermediate || hasSuperior;
          });

          if (filteredParameters.length === 0) return;

          // Calcular altura necessária para esta análise
          const analysisHeight = HEIGHTS.analysisHeader + 
                                HEIGHTS.tableHeader + 
                                (filteredParameters.length * HEIGHTS.tableRow) + 
                                HEIGHTS.sectionSpacing;

          // Se não couber na página atual, começar nova página
          if (currentPageHeight + analysisHeight > USABLE_HEIGHT_MM && currentPage.length > 0) {
            pages.push([...currentPage]);
            currentPage = [];
            currentPageHeight = HEIGHTS.header; // Reset para nova página
          }

          // Adicionar análise à página atual
          currentPage.push({
            type: 'analysis',
            requirement: req,
            criterion: criterion,
            analysis: analysis,
            parameters: filteredParameters,
            selectedLevels: selectedLevels,
            needsPageBreak: currentPage.length === 0 && pages.length > 0
          });

          currentPageHeight += analysisHeight;
        });
      });
    });

    // Adicionar última página se não estiver vazia
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  };

  // Componente para renderizar uma página
  const PageContent = ({ pageData, pageIndex }: { pageData: any[], pageIndex: number }) => (
    <div className={`page-content ${pageIndex > 0 ? 'force-page-break' : ''}`}>
      {pageData.map((item, itemIndex) => {
        const { requirement, criterion, analysis, parameters, selectedLevels } = item;
        
        return (
          <div key={`page-${pageIndex}-item-${itemIndex}`} className="analysis-block mb-3 print:mb-2">
            {/* Cabeçalho contextual para páginas subsequentes */}
            {item.needsPageBreak && (
              <div className="mb-2 print:mb-1 text-xs text-slate-600 print:text-[10px]">
                <div className="border-b border-slate-200 pb-1 mb-2">
                  <strong>{requirement.code}</strong> - {requirement.label} → <strong>{criterion.code}</strong> - {criterion.label}
                </div>
              </div>
            )}
            
            <div className="mb-1.5 print:mb-1">
              <h4 className="font-medium text-xs text-slate-800 print:text-[10px] print:font-semibold">
                {analysis.code} - {analysis.label}
              </h4>
            </div>
            
            <Table className="border table-fixed w-full text-xs print:text-[10px]">
              <TableHeader>
                <TableRow className="bg-slate-50 print:bg-gray-100 h-8 print:h-6">
                  <TableHead className="border print:text-[9px] font-semibold py-1 px-2">Parâmetro</TableHead>
                  <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-16 print-unit-width">Un.</TableHead>
                  {selectedLevels.includes('minimum') && (
                    <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-20 print-level-width">Mín.</TableHead>
                  )}
                  {selectedLevels.includes('intermediate') && (
                    <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-20 print-level-width">Int.</TableHead>
                  )}
                  {selectedLevels.includes('superior') && (
                    <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-20 print-level-width">Sup.</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parameters.map((parameter: any, paramIndex: number) => (
                  <TableRow key={`param-${paramIndex}`} className="min-h-0">
                    <TableCell className="border print:text-[9px] align-top py-1.5 px-2 leading-tight">
                      <div className="space-y-1">
                        <div className="font-medium">{renderTextWithLineBreaks(parameter.label)}</div>
                        {parameter.notes && parameter.notes.trim() !== '' && (
                          <div className="text-[10px] text-slate-600 print:text-[8px]">
                            <div className="flex items-start gap-1">
                              <span className="font-medium text-slate-700 text-[9px] print:text-[8px]">
                                <span className="print:hidden">💬 </span>
                                Obs: 
                              </span>
                              <span className="italic leading-tight">{renderTextWithLineBreaks(parameter.notes)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-16 print-unit-width">
                      {parameter.unit || '—'}
                    </TableCell>
                    {selectedLevels.includes('minimum') && (
                      <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-20 print-level-width">
                        {parameter.minimumValue || '—'}
                      </TableCell>
                    )}
                    {selectedLevels.includes('intermediate') && (
                      <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-20 print-level-width">
                        {parameter.intermediateValue || '—'}
                      </TableCell>
                    )}
                    {selectedLevels.includes('superior') && (
                      <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-20 print-level-width">
                        {parameter.superiorValue || '—'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );

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
              {/* Cabeçalho do Requisito */}
              <div className="border-l-4 border-l-blue-500 pl-3 py-1.5 bg-blue-50/80 print:bg-gray-100 mb-3 print:mb-2">
                <h2 className="font-semibold text-base text-slate-900 print:text-sm print:font-bold">
                  {req.code} - {req.label}
                </h2>
              </div>
            
              {/* Critérios do Requisito */}
              <div className="ml-3 space-y-3 print:ml-2 print:space-y-2">
                {req.criteria.map((criterion) => (
                  <div key={`${req.id}-${criterion.id}`} className="criterion-block">
                    {/* Cabeçalho do Critério */}
                    <div className="border-l-2 border-l-slate-400 pl-2 py-1 bg-slate-50/80 print:bg-gray-50 mb-2 print:mb-1">
                      <h3 className="font-medium text-sm text-slate-700 print:text-xs print:font-semibold">
                        {criterion.code} - {criterion.label}
                      </h3>
                    </div>
                    
                    {/* Análises do Critério */}
                    <div className="ml-2 print:ml-1">
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
                          <div key={analysis.id} className="analysis-block mb-3 print:mb-2">
                            <div className="mb-1.5 print:mb-1">
                              <h4 className="font-medium text-xs text-slate-800 print:text-[10px] print:font-semibold">
                                {analysis.code} - {analysis.label}
                              </h4>
                            </div>
                            
                            {/* Tabela Simples de Parâmetros */}
                            {parametersToRender.length > 0 && (
                              <Table className="border table-fixed w-full text-xs print:text-[10px]">
                                <TableHeader>
                                  <TableRow className="bg-slate-50 print:bg-gray-100 h-8 print:h-6">
                                    <TableHead className="border print:text-[9px] font-semibold py-1 px-2">Parâmetro</TableHead>
                                    <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-16 print-unit-width">Un.</TableHead>
                                    {selectedLevels.includes('minimum') && (
                                      <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-20 print-level-width">Mín.</TableHead>
                                    )}
                                    {selectedLevels.includes('intermediate') && (
                                      <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-20 print-level-width">Int.</TableHead>
                                    )}
                                    {selectedLevels.includes('superior') && (
                                      <TableHead className="text-center border print:text-[9px] font-semibold py-1 px-1 w-20 print-level-width">Sup.</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {parametersToRender.map((row, index) => (
                                    <TableRow key={`${row.parameter.id}-${index}`} className="min-h-0">
                                      <TableCell className="border print:text-[9px] align-top py-1.5 px-2 leading-tight">
                                        <div className="space-y-1">
                                          <div className="font-medium">{renderTextWithLineBreaks(row.parameter.label)}</div>
                                          {row.parameter.notes && row.parameter.notes.trim() !== '' && (
                                            <div className="text-[10px] text-slate-600 print:text-[8px]">
                                              <div className="flex items-start gap-1">
                                                <span className="font-medium text-slate-700 text-[9px] print:text-[8px]">
                                                  <span className="print:hidden">💬 </span>
                                                  Obs: 
                                                </span>
                                                <span className="italic leading-tight">{renderTextWithLineBreaks(row.parameter.notes)}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-16 print-unit-width">
                                        {row.parameter.unit || '—'}
                                      </TableCell>
                                      {selectedLevels.includes('minimum') && (
                                        <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-20 print-level-width">
                                          {row.isMultiValue || row.specificLevel === 'minimum' ? 
                                            (row.parameter.minimumValue || '—') : '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('intermediate') && (
                                        <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-20 print-level-width">
                                          {row.isMultiValue || row.specificLevel === 'intermediate' ? 
                                            (row.parameter.intermediateValue || '—') : '—'}
                                        </TableCell>
                                      )}
                                      {selectedLevels.includes('superior') && (
                                        <TableCell className="text-center border print:text-[9px] align-middle py-1 px-1 w-20 print-level-width">
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