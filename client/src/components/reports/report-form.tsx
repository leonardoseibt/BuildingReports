import { useState } from 'react';
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
import { CheckCheck, X } from 'lucide-react';
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

  const [levels, setLevels] = useState<Record<string, string[]>>(() => {
    const data: any = initialItem?.reportData;
    if (!data?.evaluations) return {};
    const map: Record<string, string[]> = {};
    for (const ev of data.evaluations || []) {
      let key: string;
      if (ev.analysisId) {
        key = `analysis-${ev.analysisId}`;
      } else if (ev.criterionId) {
        key = `crit-${ev.criterionId}`;
      } else {
        key = `req-${ev.requirementId}`;
      }
      if (!map[key]) map[key] = [];
      if (!map[key].includes(ev.level)) map[key].push(ev.level);
    }
    return map;
  });

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
        for (const crit of req.criteria) {
          for (const analysis of crit.analyses) {
            all[`analysis-${analysis.id}`] = ['minimum', 'intermediate', 'superior'];
          }
        }
      }
      setLevels(all);
    } else {
      setLevels({});
    }
  }

  function handleSelectByCriterionLevel(requirementId: number, criterionId: number, level: 'minimum' | 'intermediate' | 'superior') {
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
      const evaluations = Object.entries(levels).flatMap(([key, arr]) => {
        return arr.map(level => {
          if (key.startsWith('analysis-')) {
            const analysisId = Number(key.slice(9));
            // Encontrar o requisito e critério da análise
            const analysis = analyses.find(a => a.id === analysisId);
            return { 
              analysisId,
              requirementId: (analysis as any)?.requirementId,
              criterionId: analysis?.criterionId,
              level 
            };
          }
          if (key.startsWith('req-')) {
            return { requirementId: Number(key.slice(4)), level };
          }
          const criterionId = Number(key.slice(5));
          let requirementId: number | undefined;
          for (const req of groupedData) {
            if (req.criteria.some(c => c.id === criterionId)) {
              requirementId = req.id;
              break;
            }
          }
          return { requirementId, criterionId, level };
        });
      });
      const payload = { buildingId: values.buildingId, reportData: { evaluations } };
      const method = initialItem ? 'PUT' : 'POST';
      const url = initialItem ? `/api/reports/${initialItem.id}` : '/api/reports';
      const res = await apiRequest(method as any, url, payload);
      return res.json();
    },
    onSuccess: () => {
      showSuccess(toast, `Relatório ${initialItem ? 'atualizado' : 'criado'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      onSuccess?.();
    },
    onError: () => {
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
                    onClick={() => handleSelectAll(true)}
                    className="h-8 px-3 hover:bg-slate-200"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Marcar todas as análises (todos os níveis)</p>
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
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  sideOffset={8} 
                  collisionPadding={10}
                  avoidCollisions={true}
                  className="z-[60]"
                >
                  <p>Limpar todas as seleções</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="max-h-[41vh] overflow-y-auto">
            <div className="p-4 space-y-6">
              {groupedData.map((req, reqIndex) => (
                <div key={req.id} className="space-y-4">
                  {/* Cabeçalho do Requisito */}
                  <div className="border-l-4 border-l-blue-500 pl-4 py-2 bg-blue-50/50">
                    <h4 className="font-semibold text-lg text-slate-900">
                      {req.code} - {req.label}
                    </h4>
                  </div>
                
                  {/* Critérios do Requisito */}
                  <div className="ml-6 space-y-4">
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
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
    </TooltipProvider>
  );
}
