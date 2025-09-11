import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import FormHeader from '@/components/ui/form-header';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Building, Requirement, Criterion, Report } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { showSuccess, showError } from '@/lib/toast-messages';

const schema = z.object({
  buildingId: z.coerce.number().int().min(1, 'Edificação é obrigatória'),
});

type FormData = z.infer<typeof schema>;

interface Definition extends Requirement {
  criteria: Criterion[];
}

export default function ReportForm({ initialItem, onSuccess, onCancel }: { initialItem?: Report | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { buildingId: initialItem?.buildingId ?? undefined },
  });

  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['/api/buildings'] });
  const { data: definitions = [] } = useQuery<Definition[]>({
    queryKey: ['/api/reports/definitions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/reports/definitions');
      return res.json();
    }
  });

  const [levels, setLevels] = useState<Record<string, string>>(() => {
    const data: any = initialItem?.reportData;
    if (!data?.evaluations) return {};
    const map: Record<string, string> = {};
    for (const ev of data.evaluations || []) {
      const key = ev.criterionId ? `crit-${ev.criterionId}` : `req-${ev.requirementId}`;
      map[key] = ev.level;
    }
    return map;
  });

  function handleLevelChange(id: string, level: string) {
    setLevels(prev => {
      const next = { ...prev };
      if (level) next[id] = level; else delete next[id];
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const evaluations = Object.entries(levels).map(([key, level]) => {
        if (key.startsWith('req-')) {
          return { requirementId: Number(key.slice(4)), level };
        }
        const criterionId = Number(key.slice(5));
        let requirementId: number | undefined;
        for (const def of definitions) {
          if (def.criteria.some(c => c.id === criterionId)) {
            requirementId = def.id;
            break;
          }
        }
        return { requirementId, criterionId, level };
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
              <Select onValueChange={value => field.onChange(Number(value))} value={field.value ? String(field.value) : undefined}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a edificação" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="space-y-4 max-h-72 overflow-y-auto pr-4">
          {definitions.map(req => (
            <div key={req.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm flex-1">{req.code} - {req.label}</h4>
                <ToggleGroup type="single" size="sm" value={levels[`req-${req.id}`] || ''} onValueChange={v => handleLevelChange(`req-${req.id}`, v)}>
                  <ToggleGroupItem value="minimum" aria-label="Mínimo">Min</ToggleGroupItem>
                  <ToggleGroupItem value="intermediate" aria-label="Intermediário">Int</ToggleGroupItem>
                  <ToggleGroupItem value="superior" aria-label="Superior">Sup</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {req.criteria.map(c => (
                <div key={c.id} className="flex items-center gap-2 pl-4">
                  <span className="flex-1 text-sm">{c.code} - {c.label}</span>
                  <ToggleGroup type="single" size="sm" value={levels[`crit-${c.id}`] || ''} onValueChange={v => handleLevelChange(`crit-${c.id}`, v)}>
                    <ToggleGroupItem value="minimum" aria-label="Mínimo">Min</ToggleGroupItem>
                    <ToggleGroupItem value="intermediate" aria-label="Intermediário">Int</ToggleGroupItem>
                    <ToggleGroupItem value="superior" aria-label="Superior">Sup</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
