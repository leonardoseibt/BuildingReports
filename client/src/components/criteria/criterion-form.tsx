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
import type { Criterion } from '@shared/schema';

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(16, 'Máx 16 caracteres'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Máx 255 caracteres'),
  isActive: z.boolean().optional().default(true),
});

export type CriterionFormData = z.infer<typeof formSchema>;

export default function CriterionForm({ onSuccess, onCancel, initialItem }: { onSuccess?: () => void; onCancel?: () => void; initialItem?: Criterion | null; }) {
  const { toast } = useToast();
  const isEdit = !!initialItem;
  const form = useForm<CriterionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: initialItem?.code || '',
      label: initialItem?.label || '',
      isActive: initialItem?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(values: CriterionFormData) {
    try {
      setSubmitting(true);
      const payload = { ...values, code: values.code.trim(), label: values.label.trim() };
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/criteria/${initialItem!.id}` : '/api/criteria';
      await apiRequest(method as any, url as any, payload);
      toast({ title: 'Sucesso', description: isEdit ? 'Critério atualizado.' : 'Critério cadastrado.' });
      onSuccess?.();
    } catch (e: any) {
      if (e.status === 409) {
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
          title={isEdit ? 'Editar Critério' : 'Novo Critério'}
          subtitle={isEdit ? 'Atualize os dados do critério.' : 'Cadastre um novo critério de desempenho.'}
          initials={form.getValues('code') || null}
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <FormField
            name="code"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormControl>
                  <NotchedField label="Código" requiredMark>
                    <Input {...field} placeholder="Ex: 1" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </NotchedField>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="label"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormControl>
                  <NotchedField label="Descrição" requiredMark>
                    <Input {...field} placeholder="Descrição do critério" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </NotchedField>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
