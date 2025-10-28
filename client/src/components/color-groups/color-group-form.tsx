import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { showSuccess, showError } from '@/lib/toast-messages';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import FormHeader from '@/components/ui/form-header';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { SmartInput, SmartTextarea } from '@/components/ui/smart-inputs';
import { NotchedField } from '@/components/ui/notched-field';
import type { ColorGroup } from '@shared/schema';

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(50, 'Máx 50 caracteres'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Máx 255 caracteres'),
  minAlpha: z.union([z.string(), z.number()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 && num <= 1;
    },
    { message: 'Deve estar entre 0 e 1' }
  ),
  maxAlpha: z.union([z.string(), z.number()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 && num <= 1;
    },
    { message: 'Deve estar entre 0 e 1' }
  ),
  description: z.string().optional().nullable().transform(v => v === null ? '' : (v ?? '')),
  isActive: z.boolean().optional().default(true),
}).refine((data) => {
  const min = Number(data.minAlpha);
  const max = Number(data.maxAlpha);
  return min <= max;
}, {
  message: 'Mín deve ser ≤ Máx',
  path: ['maxAlpha'],
});

export type ColorGroupFormData = z.infer<typeof formSchema>;

export default function ColorGroupForm({ onSuccess, onCancel, initialItem }: { onSuccess?: () => void; onCancel?: () => void; initialItem?: ColorGroup | null; }) {
  const { toast } = useToast();
  const isEdit = !!initialItem;
  const form = useForm<ColorGroupFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: initialItem?.code || '',
      label: initialItem?.label || '',
      minAlpha: (initialItem as any)?.minAlpha || '',
      maxAlpha: (initialItem as any)?.maxAlpha || '',
      description: (initialItem as any)?.description || '',
      isActive: initialItem?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(values: ColorGroupFormData) {
    // Validação adicional: min <= max
    const min = Number(values.minAlpha);
    const max = Number(values.maxAlpha);
    if (min > max) {
      form.setError('maxAlpha', { message: 'Máx deve ser >= Mín' });
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        code: values.code,
        label: values.label,
        minAlpha: Number(values.minAlpha),
        maxAlpha: Number(values.maxAlpha),
        description: values.description === '' ? null : values.description,
        isActive: values.isActive,
      };
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/color-groups/${initialItem!.id}` : '/api/color-groups';
      await apiRequest(method as any, url as any, payload);
      showSuccess(toast, isEdit ? 'Grupo atualizado.' : 'Grupo cadastrado.');
      onSuccess?.();
    } catch (e: any) {
      showError(toast, isEdit ? 'Falha ao atualizar.' : 'Falha ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
        <FormHeader
          title={isEdit ? 'Editar Grupo' : 'Novo Grupo'}
          subtitle={isEdit ? 'Atualize os dados do grupo de cores.' : 'Cadastre um novo grupo de absortância térmica.'}
          initials={form.getValues('code')?.substring(0,2) || null}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <SmartInput {...field} placeholder="Ex: CLARA" className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <SmartInput {...field} placeholder="Ex: Cores Claras" className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField name="minAlpha" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Absortância Mínima (α)" requiredMark>
                  <SmartInput 
                    {...field} 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder="Ex: 0.00"
                    className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" 
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="maxAlpha" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Absortância Máxima (α)" requiredMark>
                  <SmartInput 
                    {...field} 
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder="Ex: 0.60"
                    className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" 
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField name="description" control={form.control} render={({ field }) => (
          <FormItem>
            <FormControl>
              <NotchedField label="Observações">
                <SmartTextarea
                  {...field}
                  placeholder="Descrição adicional (opcional)"
                  rows={2}
                  className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-y min-h-[50px] text-sm w-full"
                />
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
