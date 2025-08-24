import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import FormHeader from '@/components/ui/form-header';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NotchedField } from '@/components/ui/notched-field';
import type { Parameter, Analysis, Criterion } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

const formSchema = z.object({
  analysisId: z.coerce.number().min(1, 'Análise é obrigatória'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Máx 255 caracteres'),
  minimumValue: z.union([z.string(), z.number()]).optional().transform(v => v === '' ? undefined : v),
  intermediateValue: z.union([z.string(), z.number()]).optional().transform(v => v === '' ? undefined : v),
  superiorValue: z.union([z.string(), z.number()]).optional().transform(v => v === '' ? undefined : v),
  unit: z.string().optional().nullable().transform(v => v || undefined),
  notes: z.string().optional().nullable().transform(v => v || undefined),
  isActive: z.boolean().optional().default(true),
});

export type ParameterFormData = z.infer<typeof formSchema>;

export default function ParameterForm({ onSuccess, onCancel, initialItem }: { onSuccess?: () => void; onCancel?: () => void; initialItem?: Parameter | null; }) {
  const { toast } = useToast();
  const isEdit = !!initialItem;
  const { data: analyses = [] } = useQuery<Analysis[]>({ queryKey: ['/api/analyses'] });
  const { data: criteria = [] } = useQuery<Criterion[]>({ queryKey: ['/api/criteria'] });

  const form = useForm<ParameterFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      analysisId: initialItem?.analysisId || (analyses[0]?.id ?? 0),
      label: initialItem?.label || '',
      minimumValue: (initialItem as any)?.minimumValue ?? '',
      intermediateValue: (initialItem as any)?.intermediateValue ?? '',
      superiorValue: (initialItem as any)?.superiorValue ?? '',
      unit: (initialItem as any)?.unit || '',
      notes: (initialItem as any)?.notes || '',
      isActive: initialItem?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(values: ParameterFormData) {
    try {
      setSubmitting(true);
      const payload = { ...values };
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/parameters/${initialItem!.id}` : '/api/parameters';
      await apiRequest(method as any, url as any, payload);
      toast({ title: 'Sucesso', description: isEdit ? 'Parâmetro atualizado.' : 'Parâmetro cadastrado.' });
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Erro', description: isEdit ? 'Falha ao atualizar.' : 'Falha ao cadastrar.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        <FormHeader
          title={isEdit ? 'Editar Parâmetro' : 'Novo Parâmetro'}
          subtitle={isEdit ? 'Atualize os dados do parâmetro.' : 'Cadastre um novo parâmetro para uma análise.'}
          initials={form.getValues('label')?.substring(0,2) || null}
        />
        <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
          <FormField name="analysisId" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Análise" requiredMark>
                  <select {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-9 text-sm">
                    <option value="">Selecione...</option>
                    {analyses.map(a => {
                      const crit = criteria.find(c => c.id === a.criterionId);
                      return <option key={a.id} value={a.id}>{crit ? `${crit.code} - ` : ''}{a.label}</option>;
                    })}
                  </select>
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input {...field} placeholder="Descrição" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="unit" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Unidade">
                  <Input {...field} placeholder="Ex: dB" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="minimumValue" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Mínimo">
                  <Input {...field} placeholder="Min" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="intermediateValue" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Intermediário">
                  <Input {...field} placeholder="Interm" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="superiorValue" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Superior">
                  <Input {...field} placeholder="Sup" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField name="notes" control={form.control} render={({ field }) => (
          <FormItem>
            <FormControl>
              <NotchedField label="Observações">
                <Input {...field} placeholder="Notas adicionais" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
