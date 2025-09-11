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

  const [levels, setLevels] = useState<Record<string, string[]>>(() => {
    const data: any = initialItem?.reportData;
    if (!data?.evaluations) return {};
    const map: Record<string, string[]> = {};
    for (const ev of data.evaluations || []) {
      const key = ev.criterionId ? `crit-${ev.criterionId}` : `req-${ev.requirementId}`;
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
      for (const req of definitions) {
        all[`req-${req.id}`] = ['minimum', 'intermediate', 'superior'];
        for (const c of req.criteria) {
          all[`crit-${c.id}`] = ['minimum', 'intermediate', 'superior'];
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

        <div className="space-y-4 max-h-72 overflow-y-auto pr-4">
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => handleSelectAll(true)}>Marcar todos</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => handleSelectAll(false)}>Limpar</Button>
          </div>
          {definitions.map(req => (
            <div key={req.id} className="space-y-2">
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-2">{req.code} - {req.label}</th>
                    <th className="text-center p-2">Mínimo</th>
                    <th className="text-center p-2">Intermediário</th>
                    <th className="text-center p-2">Superior</th>
                  </tr>
                </thead>
                <tbody>
                  <tr key={`req-${req.id}`} className="border-t">
                    <td className="p-2 font-medium">Requisito</td>
                    {['minimum','intermediate','superior'].map(level => (
                      <td key={level} className="text-center">
                        <Checkbox
                          checked={levels[`req-${req.id}`]?.includes(level) || false}
                          onCheckedChange={checked => handleLevelChange(`req-${req.id}`, level, checked === true)}
                        />
                      </td>
                    ))}
                  </tr>
                  {req.criteria.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2 pl-4">{c.code} - {c.label}</td>
                      {['minimum','intermediate','superior'].map(level => (
                        <td key={level} className="text-center">
                          <Checkbox
                            checked={levels[`crit-${c.id}`]?.includes(level) || false}
                            onCheckedChange={checked => handleLevelChange(`crit-${c.id}`, level, checked === true)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
