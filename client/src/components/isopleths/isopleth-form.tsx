import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import FormHeader from '@/components/ui/form-header';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NotchedField } from '@/components/ui/notched-field';
import type { Isopleth } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

const decimal = z.union([z.string(), z.number()])
  .refine(v => String(v).trim() === '' || !isNaN(Number(v)), 'Valor inválido')
  .transform(v => {
    const s = String(v).trim();
    if (s === '') return undefined;
    return s.replace(',', '.');
  });

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(16, 'Máx 16 caracteres'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Máx 255 caracteres'),
  windMinMS: decimal.optional(),
  windMaxMS: decimal.optional(),
  isActive: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.windMinMS && data.windMaxMS) {
    const a = Number(data.windMinMS); const b = Number(data.windMaxMS);
    if (!isNaN(a) && !isNaN(b) && a > b) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['windMaxMS'], message: 'Máx deve ser >= Mín' });
    }
  }
});

export type IsoplethFormData = z.infer<typeof formSchema>;

export default function IsoplethForm({ initialItem, onSuccess, onCancel }: { initialItem?: Isopleth | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const isEdit = !!initialItem;
  const form = useForm<IsoplethFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: initialItem?.code || '',
      label: initialItem?.label || '',
      windMinMS: (initialItem as any)?.windMinMS ?? '',
      windMaxMS: (initialItem as any)?.windMaxMS ?? '',
      isActive: (initialItem as any)?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);
  // Load existing isopleths for overlap validation
  const { data: allIsopleths = [] } = useQuery<Isopleth[]>({ queryKey: ['/api/isopleths'] });
  const watchMin = form.watch('windMinMS');
  const watchMax = form.watch('windMaxMS');
  // Parse helpers
  function parse(v: any, fallback: number) { if (v === undefined || v === null || v === '') return fallback; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? fallback : n; }
  const currentMin = parse(watchMin, -Infinity);
  const currentMax = parse(watchMax, +Infinity);
  const overlaps = allIsopleths
    .filter(i => i.id !== (initialItem as any)?.id)
    .filter(i => {
      const imin = parse((i as any).windMinMS, -Infinity);
      const imax = parse((i as any).windMaxMS, +Infinity);
  // Considera sobreposição real se houver interseção com cardinalidade > 0
  // Igualdade de fronteira (currentMax === imin ou imax === currentMin) não conta.
  return currentMin < imax && imin < currentMax;
    })
    .filter(i => currentMin !== -Infinity || currentMax !== Infinity || ( (i as any).windMinMS !== null && (i as any).windMaxMS !== null));

  async function onSubmit(values: IsoplethFormData) {
    try {
      setSubmitting(true);
      const payload: any = {
        ...values,
        code: values.code.trim(),
        label: values.label.trim(),
        windMinMS: values.windMinMS === undefined ? undefined : values.windMinMS,
        windMaxMS: values.windMaxMS === undefined ? undefined : values.windMaxMS,
      };
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/isopleths/${initialItem!.id}` : '/api/isopleths';
      await apiRequest(method as any, url as any, payload);
      toast({ title: 'Sucesso', description: isEdit ? 'Isopleta atualizada.' : 'Isopleta cadastrada.' });
      onSuccess?.();
    } catch (e: any) {
      if (String(e.message).includes('409')) {
        toast({ title: 'Duplicado', description: 'Código já cadastrado.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro', description: isEdit ? 'Falha ao atualizar.' : 'Falha ao cadastrar.', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        <FormHeader
          title={isEdit ? 'Editar Isopleta' : 'Nova Isopleta'}
          subtitle={isEdit ? 'Atualize os dados da isopleta.' : 'Cadastre uma nova isopleta (faixa de velocidade)'}
          initials={form.getValues('code') || null}
        />
  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <Input {...field} placeholder="Ex: V1" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-4">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input {...field} placeholder="Descrição da faixa" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
      <FormField name="windMinMS" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
        <NotchedField label="Vento Mín (m/s)">
                  <Input {...field} placeholder="Min" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="windMaxMS" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
  <NotchedField label="Vento Máx (m/s)">
                  <Input {...field} placeholder="Máx" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
    { (watchMin !== '' || watchMax !== '') && overlaps.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
      <p className="font-medium mb-1">Faixa sobreposta</p>
  <p>Os valores informados intersectam {overlaps.length === 1 ? 'a seguinte isopleta' : 'as seguintes isopletas'} (limites tocando não são considerados):</p>
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                {overlaps.map(o => {
                  const omin = (o as any).windMinMS ?? '−∞';
                  const omax = (o as any).windMaxMS ?? '+∞';
                  return <li key={o.id}><strong>{o.code}</strong> ({omin} – {omax} m/s)</li>;
                })}
              </ul>
              <p className="mt-2 text-xs text-amber-700">Ajuste os limites para evitar sobreposição ou confirme se a sobreposição é intencional.</p>
            </div>
          </div>
        ) }
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
