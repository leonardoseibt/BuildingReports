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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => mutation.mutate(data))} className="space-y-6" autoComplete="off">
        <FormHeader title={initialItem ? 'Editar Relatório' : 'Novo Relatório'} subtitle={initialItem ? 'Atualize os dados do relatório.' : 'Cadastre um novo relatório.'} initials={null} />

        <FormField name="buildingId" control={form.control} render={({ field }) => (
          <FormItem>
            <FormControl>
              <Combobox
                options={buildings.map(b => ({ value: String(b.id), label: b.name }))}
                value={field.value ? String(field.value) : undefined}
                onChange={val => field.onChange(Number(val))}
                placeholder="Selecione a edificação"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="space-y-6 max-h-96 overflow-y-auto pr-4">
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => handleSelectAll(true)}>Marcar todos</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => handleSelectAll(false)}>Limpar</Button>
          </div>
          
          {groupedData.map(req => (
            <div key={req.id} className="space-y-4">
              {req.criteria.map(criterion => (
                <div key={`${req.id}-${criterion.id}`} className="rounded-lg border bg-white shadow-sm">
                  <div className="bg-slate-50 px-4 py-3 border-b">
                    <h3 className="font-medium text-slate-900">
                      {req.code} - {req.label} → {criterion.code} - {criterion.label}
                    </h3>
                  </div>
                  
                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Análise</TableHead>
                          <TableHead className="text-center">Mínimo</TableHead>
                          <TableHead className="text-center">Intermediário</TableHead>
                          <TableHead className="text-center">Superior</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {criterion.analyses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-slate-500 py-6">
                              Nenhuma análise cadastrada para este critério
                            </TableCell>
                          </TableRow>
                        ) : (
                          criterion.analyses.map(analysis => (
                            <TableRow key={analysis.id}>
                              <TableCell className="font-mono text-sm">{analysis.code}</TableCell>
                              <TableCell className="font-medium">{analysis.label}</TableCell>
                              {['minimum', 'intermediate', 'superior'].map(level => (
                                <TableCell key={level} className="text-center">
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
          ))}
          
          {groupedData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">Nenhuma análise encontrada</p>
              <p className="text-sm text-slate-400 mt-2">
                Verifique se existem requisitos, critérios e análises cadastrados no sistema.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
