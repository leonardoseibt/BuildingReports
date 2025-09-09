import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { showSuccess, showError } from '@/lib/toast-messages';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import FormHeader from '@/components/ui/form-header';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NotchedField } from '@/components/ui/notched-field';
import type { Analysis, Criterion, Requirement } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

const formSchema = z.object({
  requirementId: z.coerce.number().min(1, 'Requisito é obrigatório'),
  criterionId: z.coerce.number().min(1, 'Critério é obrigatório'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Máx 255 caracteres'),
  isActive: z.boolean().optional().default(true),
});

export type AnalysisFormData = z.infer<typeof formSchema>;

export default function AnalysisForm({ onSuccess, onCancel, initialItem }: { onSuccess?: () => void; onCancel?: () => void; initialItem?: Analysis | null; }) {
  const { toast } = useToast();
  const isEdit = !!initialItem;
  const { data: requirements = [] } = useQuery<Requirement[]>({ queryKey: ['/api/requirements'] });
  // Load all criteria independent of requirement
  const { data: criteria = [] } = useQuery<Criterion[]>({ queryKey: ['/api/criteria'], queryFn: async () => { const r = await fetch('/api/criteria'); if (!r.ok) throw new Error('Erro'); return r.json(); } });

  const form = useForm<AnalysisFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requirementId: initialItem ? (initialItem as any).requirementId : 0,
      criterionId: initialItem?.criterionId || 0,
      label: initialItem?.label || '',
      isActive: initialItem?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState(initialItem?.code ?? '');
  const requirementId = form.watch('requirementId');
  const criterionId = form.watch('criterionId');

  useEffect(() => {
    if (requirementId && criterionId) {
      // If editing and requirement/criterion unchanged, keep original code
      if (
        isEdit &&
        requirementId === initialItem?.requirementId &&
        criterionId === initialItem?.criterionId
      ) {
        setCode(initialItem!.code);
        return;
      }
      (async () => {
        try {
          const res = await fetch(`/api/analyses/next-code?requirementId=${requirementId}&criterionId=${criterionId}`);
          if (res.ok) {
            const data = await res.json();
            setCode(data.code);
          } else {
            setCode('');
          }
        } catch {
          setCode('');
        }
      })();
    } else {
      setCode('');
    }
  }, [requirementId, criterionId, isEdit, initialItem]);

  async function onSubmit(values: AnalysisFormData) {
    try {
      setSubmitting(true);
      const payload = { ...values, label: values.label.trim() };
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/analyses/${initialItem!.id}` : '/api/analyses';
      await apiRequest(method as any, url as any, payload);
      showSuccess(toast, isEdit ? 'Análise atualizada.' : 'Análise cadastrada.');
      onSuccess?.();
    } catch (e: any) {
      if (String(e.message).includes('409')) {
        showError(toast, 'Código já cadastrado dentro deste critério.');
      } else {
        showError(toast, isEdit ? 'Falha ao atualizar.' : 'Falha ao cadastrar.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        <FormHeader
          title={isEdit ? 'Editar Análise' : 'Nova Análise'}
          subtitle={isEdit ? 'Atualize os dados da análise.' : 'Cadastre uma nova análise para um critério.'}
          initials={code || null}
        />
        <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
          <FormField
            name="requirementId"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormControl>
                  <NotchedField label="Requisito" requiredMark>
                    <select
                      {...field}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        field.onChange(val);
                      }}
                      disabled={isEdit}
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-9 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.label}</option>)}
                    </select>
                  </NotchedField>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="criterionId"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormControl>
                  <NotchedField label="Critério" requiredMark>
                    <select {...field} disabled={isEdit} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-9 text-sm">
                      <option value="">Selecione...</option>
                      {criteria.map(c => <option key={c.id} value={c.id}>{c.code} - {c.label}</option>)}
                    </select>
                  </NotchedField>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="md:col-span-2">
            <NotchedField label="Código">
              <Input
                value={code}
                readOnly
                tabIndex={-1}
                onFocus={(e) => e.target.blur()}
                className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </NotchedField>
          </div>
          <FormField
            name="label"
            control={form.control}
            render={({ field }) => (
              <FormItem className={isEdit ? 'md:col-span-6' : 'md:col-span-8'}>
                <FormControl>
                  <NotchedField label="Descrição" requiredMark>
                    <Input {...field} placeholder="Descrição da análise" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
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
