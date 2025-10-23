import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import FormHeader from '@/components/ui/form-header';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NotchedField } from '@/components/ui/notched-field';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCheck, X, Loader2, MinusCircle, CircleDot, PlusCircle, Eraser } from 'lucide-react';
import type { Building, Requirement, Criterion, Analysis, Report } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { showSuccess, showError } from '@/lib/toast-messages';

const schema = z.object({
  buildingId: z.coerce.number().int().min(1, 'Edificação é obrigatória'),
});

type FormData = z.infer<typeof schema>;

interface RequirementWithCriteria extends Requirement {
  criteria: (Criterion & { analyses: Analysis[] })[];
}

export default function ReportForm({ initialItem, onSuccess, onCancel }: { initialItem?: Report | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { buildingId: initialItem?.buildingId ?? undefined },
  });

  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['/api/buildings'] });
  
  // Carregar requisitos
  const { data: requirements = [] } = useQuery<Requirement[]>({ 
    queryKey: ['/api/requirements'],
    enabled: true 
  });
  
  // Carregar critérios
  const { data: criteria = [] } = useQuery<Criterion[]>({ 
    queryKey: ['/api/criteria'],
    enabled: true 
  });
  
  // Carregar análises
  const { data: analyses = [] } = useQuery<Analysis[]>({ 
    queryKey: ['/api/analyses'],
    enabled: true 
  });

  // Carregar estrutura relacional do relatório (se estiver editando)
  const { data: reportStructure } = useQuery({
    queryKey: ['/api/reports', initialItem?.id, 'structure'],
    queryFn: async () => {
      if (!initialItem?.id) return null;
      const res = await apiRequest('GET', `/api/reports/${initialItem.id}/structure`);
      return res.json();
    },
    enabled: !!initialItem?.id,
  });

  // Agrupar dados por Requisito -> Critério -> Análises
  const groupedData: RequirementWithCriteria[] = requirements.map(req => ({
    ...req,
    criteria: criteria
      .filter(crit => {
        // Verificar se existe alguma análise que conecta este requisito e critério
        return analyses.some(analysis => 
          (analysis as any).requirementId === req.id && analysis.criterionId === crit.id
        );
      })
      .map(crit => ({
        ...crit,
        analyses: analyses.filter(analysis => 
          (analysis as any).requirementId === req.id && analysis.criterionId === crit.id
        )
      }))
  })).filter(req => req.criteria.length > 0); // Apenas requisitos que têm critérios com análises

  const [levels, setLevels] = useState<Record<string, string[]>>({});
  const [levelsInitialized, setLevelsInitialized] = useState(false);

  // Effect para carregar níveis da estrutura relacional (apenas uma vez)
  useEffect(() => {
    if (levelsInitialized) return; // Já foi inicializado
    
    if (reportStructure === undefined && initialItem?.id) {
      return; // Aguardar carregamento da estrutura relacional
    }
    
    // Usar estrutura relacional
    const map: Record<string, string[]> = {};
    if (reportStructure?.analyses) {
      for (const analysis of reportStructure.analyses) {
        if (analysis.id && analysis.levels) {
          const key = `analysis-${analysis.id}`;
          map[key] = analysis.levels;
        }
      }
    }
    setLevels(map);
    setLevelsInitialized(true);
  }, [reportStructure, initialItem, levelsInitialized]);

  // Estado para controlar quais requisitos estão habilitados para geração de relatório
  const [enabledRequirements, setEnabledRequirements] = useState<Record<number, boolean>>({});
  const [requirementsInitialized, setRequirementsInitialized] = useState(false);

  // Effect para carregar requirements habilitados da estrutura relacional (apenas uma vez)
  useEffect(() => {
    if (requirementsInitialized) return; // Já foi inicializado
    if (groupedData.length === 0) return; // Aguardar carregamento dos dados
    
    if (reportStructure === undefined && initialItem?.id) {
      return; // Aguardar carregamento da estrutura relacional
    }
    
    // Usar estrutura relacional
    const enabled: Record<number, boolean> = {};
    if (reportStructure?.requirements) {
      // Criar mapa de requisitos com seus valores isEnabled
      const requirementMap = new Map<number, boolean>(
        reportStructure.requirements.map((r: any) => [r.id, r.isEnabled ?? true])
      );
      
      groupedData.forEach(req => {
        // Se o requisito está na estrutura, usar seu isEnabled. Senão, false.
        const isEnabled = requirementMap.get(req.id);
        enabled[req.id] = isEnabled !== undefined ? isEnabled : false;
      });
    } else {
      // Novo relatório - todos habilitados por padrão
      groupedData.forEach(req => {
        enabled[req.id] = true;
      });
    }
    setEnabledRequirements(enabled);
    setRequirementsInitialized(true);
  }, [reportStructure, initialItem, groupedData, requirementsInitialized]);

  function handleRequirementToggle(requirementId: number, enabled: boolean) {
    setEnabledRequirements(prev => ({
      ...prev,
      [requirementId]: enabled
    }));
  }

  function handleLevelChange(id: string, level: string, checked: boolean) {
    setLevels(prev => {
      const current = prev[id] ? [...prev[id]] : [];
      const exists = current.includes(level);
      let nextLevels = current;
      if (checked && !exists) nextLevels = [...current, level];
      if (!checked && exists) nextLevels = current.filter(l => l !== level);
      const next = { ...prev };
      if (nextLevels.length) next[id] = nextLevels; else delete next[id];
      return next;
    });
  }

  function handleSelectAll(select: boolean) {
    if (select) {
      const all: Record<string, string[]> = {};
      for (const req of groupedData) {
        // Apenas incluir se o requisito estiver habilitado
        if (enabledRequirements[req.id]) {
          for (const crit of req.criteria) {
            for (const analysis of crit.analyses) {
              all[`analysis-${analysis.id}`] = ['minimum', 'intermediate', 'superior'];
            }
          }
        }
      }
      setLevels(all);
    } else {
      setLevels({});
    }
  }

  function handleSelectAllByLevel(level: 'minimum' | 'intermediate' | 'superior') {
    const updated: Record<string, string[]> = { ...levels };
    
    // Verificar se todos os requisitos habilitados já têm esse nível marcado
    const allAnalyses: number[] = [];
    for (const req of groupedData) {
      if (enabledRequirements[req.id]) {
        for (const crit of req.criteria) {
          allAnalyses.push(...crit.analyses.map(a => a.id));
        }
      }
    }
    
    const allSelected = allAnalyses.every(analysisId => {
      const key = `analysis-${analysisId}`;
      return updated[key]?.includes(level) || false;
    });
    
    // Se todos estão marcados, desmarcar. Caso contrário, marcar
    for (const analysisId of allAnalyses) {
      const key = `analysis-${analysisId}`;
      const currentLevels = updated[key] || [];
      
      if (allSelected) {
        // Desmarcar: remover o nível
        const newLevels = currentLevels.filter(l => l !== level);
        if (newLevels.length > 0) {
          updated[key] = newLevels;
        } else {
          delete updated[key];
        }
      } else {
        // Marcar: adicionar o nível se não estiver presente
        if (!currentLevels.includes(level)) {
          updated[key] = [...currentLevels, level];
        }
      }
    }
    
    setLevels(updated);
  }

  function handleSelectByCriterionLevel(requirementId: number, criterionId: number, level: 'minimum' | 'intermediate' | 'superior') {
    // Não permitir alteração se o requisito não estiver habilitado
    if (!enabledRequirements[requirementId]) {
      return;
    }
    
    const updated: Record<string, string[]> = { ...levels };
    
    // Encontrar todas as análises do critério específico dentro do requisito específico
    const targetAnalyses: number[] = [];
    for (const req of groupedData) {
      if (req.id === requirementId) {
        for (const crit of req.criteria) {
          if (crit.id === criterionId) {
            targetAnalyses.push(...crit.analyses.map(a => a.id));
            break;
          }
        }
        break;
      }
    }
    
    // Verificar se todas as análises deste critério já estão marcadas neste nível
    const allSelected = targetAnalyses.every(analysisId => {
      const key = `analysis-${analysisId}`;
      return updated[key]?.includes(level) || false;
    });
    
    // Se todas estão marcadas, desmarcar todas. Caso contrário, marcar todas
    for (const analysisId of targetAnalyses) {
      const key = `analysis-${analysisId}`;
      const currentLevels = updated[key] || [];
      
      if (allSelected) {
        // Desmarcar: remover o nível
        const newLevels = currentLevels.filter(l => l !== level);
        if (newLevels.length > 0) {
          updated[key] = newLevels;
        } else {
          delete updated[key];
        }
      } else {
        // Marcar: adicionar o nível se não estiver presente
        if (!currentLevels.includes(level)) {
          updated[key] = [...currentLevels, level];
        }
      }
    }
    
    setLevels(updated);
  }

  // Função auxiliar para verificar se todos os itens de uma coluna estão selecionados
  function isColumnFullySelected(requirementId: number, criterionId: number, level: 'minimum' | 'intermediate' | 'superior'): boolean {
    // Encontrar todas as análises do critério específico dentro do requisito específico
    const targetAnalyses: number[] = [];
    for (const req of groupedData) {
      if (req.id === requirementId) {
        for (const crit of req.criteria) {
          if (crit.id === criterionId) {
            targetAnalyses.push(...crit.analyses.map(a => a.id));
            break;
          }
        }
        break;
      }
    }
    
    // Verificar se todas as análises estão marcadas neste nível
    return targetAnalyses.length > 0 && targetAnalyses.every(analysisId => {
      const key = `analysis-${analysisId}`;
      return levels[key]?.includes(level) || false;
    });
  }

  // Função para gerar iniciais do nome da edificação
  function getBuildingInitials(): string | null {
    const selectedBuildingId = form.watch('buildingId');
    if (!selectedBuildingId) return null;
    
    const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
    if (!selectedBuilding || !selectedBuilding.name) return null;
    
    return selectedBuilding.name
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 2) // Máximo 2 palavras
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      // Preparar estrutura relacional (otimizado)
      // Coletar TODOS os requisitos que têm análises selecionadas, com flag isEnabled
      const requirementsWithData: Array<{ id: number; position: number; isEnabled: boolean }> = [];
      const enabledCriteriaIds = new Set<number>();
      const analysesWithLevels: Array<{ id: number; position: number; levels: string[] }> = [];
      
      let requirementPosition = 0;
      let analysisPosition = 0;
      
      // Iterar por TODOS os requisitos na ordem do groupedData
      for (const req of groupedData) {
        let hasRequirementAnalyses = false;
        
        for (const crit of req.criteria) {
          let hasCriterionAnalyses = false;
          
          for (const analysis of crit.analyses) {
            const key = `analysis-${analysis.id}`;
            const selectedLevels = levels[key];
            
            if (selectedLevels && selectedLevels.length > 0) {
              analysesWithLevels.push({
                id: analysis.id,
                position: analysisPosition++,
                levels: selectedLevels
              });
              hasCriterionAnalyses = true;
              hasRequirementAnalyses = true;
            }
          }
          
          // Adicionar critério apenas se tiver análises selecionadas
          if (hasCriterionAnalyses) {
            enabledCriteriaIds.add(crit.id);
          }
        }
        
        // Adicionar requisito se tiver análises, com status de habilitação
        if (hasRequirementAnalyses) {
          requirementsWithData.push({
            id: req.id,
            position: requirementPosition++,
            isEnabled: enabledRequirements[req.id] ?? true
          });
        }
      }
      
      // Estrutura para API
      const structure = {
        requirements: requirementsWithData,
        criteria: Array.from(enabledCriteriaIds).map((id, index) => ({ id, position: index })),
        analyses: analysesWithLevels
      };
      
      // Usar endpoint otimizado que salva tudo de uma vez
      const method = initialItem ? 'PUT' : 'POST';
      const url = initialItem 
        ? `/api/reports/${initialItem.id}/with-structure` 
        : '/api/reports/with-structure';
      
      const payload = {
        buildingId: values.buildingId,
        structure
      };
      
      const reportRes = await apiRequest(method as any, url, payload);
      return reportRes.json();
    },
    onSuccess: () => {
      showSuccess(toast, `Relatório ${initialItem ? 'atualizado' : 'criado'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao salvar relatório:', error);
      showError(toast, 'Falha ao salvar relatório');
    }
  });

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(data => mutation.mutate(data))} className="space-y-6" autoComplete="off">
        <FormHeader title={initialItem ? 'Editar Relatório' : 'Novo Relatório'} subtitle={initialItem ? 'Atualize os dados do relatório.' : 'Cadastre um novo relatório.'} initials={getBuildingInitials()} />

        <FormField name="buildingId" control={form.control} render={({ field }) => (
          <FormItem>
            <FormControl>
              <NotchedField label="Edificação" requiredMark>
                <Combobox
                  options={buildings.map(b => ({ value: String(b.id), label: b.name }))}
                  value={field.value ? String(field.value) : undefined}
                  onChange={val => field.onChange(Number(val))}
                  placeholder="Selecione a edificação"
                  className="w-full border-0 bg-transparent focus:ring-0"
                />
              </NotchedField>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="rounded-lg border bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-medium text-slate-900">Análises por Requisito e Critério</h3>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      // Habilitar todos os requisitos
                      const allEnabled: Record<number, boolean> = {};
                      groupedData.forEach(req => {
                        allEnabled[req.id] = true;
                      });
                      setEnabledRequirements(allEnabled);
                    }}
                    className="h-8 px-3 hover:bg-slate-200 text-xs gap-1.5"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Todos Req.
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Habilitar todos os requisitos para relatório</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      // Desabilitar todos os requisitos
                      const allDisabled: Record<number, boolean> = {};
                      groupedData.forEach(req => {
                        allDisabled[req.id] = false;
                      });
                      setEnabledRequirements(allDisabled);
                    }}
                    className="h-8 px-3 hover:bg-slate-200 text-xs gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Nenhum Req.
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Desabilitar todos os requisitos para relatório</p>
                </TooltipContent>
              </Tooltip>

              <div className="border-l border-slate-200 mx-2"></div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleSelectAllByLevel('minimum')}
                    className="h-8 px-3 hover:bg-green-50 hover:text-green-700 text-xs gap-1.5"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    Todos Mín.
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Selecionar todos os níveis mínimos dos requisitos habilitados</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleSelectAllByLevel('intermediate')}
                    className="h-8 px-3 hover:bg-blue-50 hover:text-blue-700 text-xs gap-1.5"
                  >
                    <CircleDot className="w-3.5 h-3.5" />
                    Todos Int.
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Selecionar todos os níveis intermediários dos requisitos habilitados</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleSelectAllByLevel('superior')}
                    className="h-8 px-3 hover:bg-amber-50 hover:text-amber-700 text-xs gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Todos Sup.
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Selecionar todos os níveis superiores dos requisitos habilitados</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleSelectAll(false)}
                    className="h-8 px-3 hover:bg-red-50 hover:text-red-700 gap-1.5"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span className="text-xs">Limpar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Limpar todas as seleções de níveis</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="max-h-[45vh] overflow-y-auto border-t">
            {/* Resumo dos Requisitos */}
            <div className="px-4 py-3 bg-blue-50/30 border-b border-blue-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  <strong>{Object.values(enabledRequirements).filter(Boolean).length}</strong> de <strong>{groupedData.length}</strong> requisitos habilitados para relatório
                </span>
                <span className="text-slate-500 text-xs">
                  {Object.values(enabledRequirements).filter(Boolean).length === 0 
                    ? 'Nenhum requisito será incluído no relatório'
                    : Object.values(enabledRequirements).filter(Boolean).length === groupedData.length
                    ? 'Todos os requisitos serão incluídos'
                    : 'Alguns requisitos serão incluídos'
                  }
                </span>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {groupedData.map((req, reqIndex) => (
                <div key={req.id} className="space-y-4">
                  {/* Cabeçalho do Requisito */}
                  <div className="border-l-4 border-l-blue-500 pl-4 py-2 bg-blue-50/50">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={enabledRequirements[req.id] || false}
                        onCheckedChange={(checked) => handleRequirementToggle(req.id, checked === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <h4 className={`font-semibold text-lg ${enabledRequirements[req.id] ? 'text-slate-900' : 'text-slate-400'}`}>
                          {req.code} - {req.label}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {enabledRequirements[req.id] ? 'Incluir no relatório' : 'Não incluir no relatório'}
                        </p>
                      </div>
                    </div>
                  </div>
                
                  {/* Critérios do Requisito */}
                  <div className={`ml-6 space-y-4 ${enabledRequirements[req.id] ? '' : 'opacity-50 pointer-events-none'}`}>
                    {req.criteria.map((criterion, critIndex) => (
                      <div key={`${req.id}-${criterion.id}`} className="space-y-3">
                        {/* Cabeçalho do Critério */}
                        <div className="border-l-2 border-l-slate-300 pl-3 py-2 bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            {/* Título do critério alinhado à esquerda */}
                            <h5 className="font-medium text-slate-700">
                              {criterion.code} - {criterion.label}
                            </h5>
                            
                            {/* Botões alinhados com as colunas de checkboxes */}
                            <div className="flex">
                              {/* Espaço para coluna Código */}
                              <div className="w-24"></div>
                              {/* Espaço para coluna Análise */}
                              <div className="flex-1"></div>
                              {/* Botões alinhados com as colunas de checkboxes */}
                              <div className="w-28 flex justify-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSelectByCriterionLevel(req.id, criterion.id, 'minimum')}
                                      disabled={!enabledRequirements[req.id]}
                                      className={`h-6 w-6 p-0 ${
                                        isColumnFullySelected(req.id, criterion.id, 'minimum')
                                          ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                          : 'hover:bg-slate-100'
                                      }`}
                                    >
                                      <CheckCheck className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-[60]">
                                    <p>Selecionar coluna Mínimo para este critério</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              
                              <div className="w-28 flex justify-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSelectByCriterionLevel(req.id, criterion.id, 'intermediate')}
                                      disabled={!enabledRequirements[req.id]}
                                      className={`h-6 w-6 p-0 ${
                                        isColumnFullySelected(req.id, criterion.id, 'intermediate')
                                          ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                          : 'hover:bg-slate-100'
                                      }`}
                                    >
                                      <CheckCheck className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-[60]">
                                    <p>Selecionar coluna Intermediário para este critério</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              
                              <div className="w-28 flex justify-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSelectByCriterionLevel(req.id, criterion.id, 'superior')}
                                      disabled={!enabledRequirements[req.id]}
                                      className={`h-6 w-6 p-0 ${
                                        isColumnFullySelected(req.id, criterion.id, 'superior')
                                          ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                          : 'hover:bg-slate-100'
                                      }`}
                                    >
                                      <CheckCheck className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-[60]">
                                    <p>Selecionar coluna Superior para este critério</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Tabela de Análises do Critério */}
                        <div className="ml-4">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50 border-b">
                                <TableHead className="w-24">Código</TableHead>
                                <TableHead>Análise</TableHead>
                                <TableHead className="text-center w-28 font-semibold">Mínimo</TableHead>
                                <TableHead className="text-center w-28 font-semibold">Intermediário</TableHead>
                                <TableHead className="text-center w-28 font-semibold">Superior</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {criterion.analyses.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                                    Nenhuma análise cadastrada para este critério
                                  </TableCell>
                                </TableRow>
                              ) : (
                                criterion.analyses.map(analysis => (
                                  <TableRow key={analysis.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono text-sm text-slate-600 py-3">
                                      {analysis.code}
                                    </TableCell>
                                    <TableCell className="font-medium py-3">
                                      {analysis.label}
                                    </TableCell>
                                    {['minimum', 'intermediate', 'superior'].map(level => (
                                      <TableCell key={level} className="text-center py-3">
                                        <Checkbox
                                          checked={levels[`analysis-${analysis.id}`]?.includes(level) || false}
                                          onCheckedChange={checked => 
                                            handleLevelChange(`analysis-${analysis.id}`, level, checked === true)
                                          }
                                          disabled={!enabledRequirements[req.id]}
                                        />
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Separador entre requisitos (exceto o último) */}
                  {reqIndex !== groupedData.length - 1 && (
                    <hr className="border-slate-200 my-6" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {groupedData.length === 0 && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Análises por Requisito e Critério</h3>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => handleSelectAll(true)}
                      className="h-8 px-3"
                      disabled
                    >
                      <CheckCheck className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    sideOffset={8} 
                    collisionPadding={10}
                    avoidCollisions={true}
                  >
                    <p>Marcar todas as análises</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleSelectAll(false)}
                      className="h-8 px-3 hover:bg-slate-200"
                      disabled
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    sideOffset={8} 
                    collisionPadding={10}
                    avoidCollisions={true}
                  >
                    <p>Limpar todas as seleções</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="p-4 text-center py-12">
              <p className="text-slate-500">Nenhuma análise encontrada</p>
              <p className="text-sm text-slate-400 mt-2">
                Verifique se existem requisitos, critérios e análises cadastrados no sistema.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mutation.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Form>
    </TooltipProvider>
  );
}
