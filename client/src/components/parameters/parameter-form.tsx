import { useState, useEffect } from 'react';
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
import type { Parameter, Analysis, Criterion, Requirement } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

// Observação: precisamos enviar strings vazias / null nos updates para que o backend sobrescreva valores antigos.
// Novos campos minLimit / maxLimit (limites de avaliação condicionada à edificação) são opcionais.
const formSchema = z.object({
  analysisId: z.coerce.number().min(1, 'Análise é obrigatória'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Máx 255 caracteres'),
  minLimit: z.union([z.string(), z.number()]).optional(),
  maxLimit: z.union([z.string(), z.number()]).optional(),
  minimumValue: z.union([z.string(), z.number()]).optional(),
  intermediateValue: z.union([z.string(), z.number()]).optional(),
  superiorValue: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional().nullable().transform(v => v === null ? '' : (v ?? '')),
  notes: z.string().optional().nullable().transform(v => v === null ? '' : (v ?? '')),
  isActive: z.boolean().optional().default(true),
});

export type ParameterFormData = z.infer<typeof formSchema>;

export default function ParameterForm({ onSuccess, onCancel, initialItem }: { onSuccess?: () => void; onCancel?: () => void; initialItem?: Parameter | null; }) {
  const { toast } = useToast();
  const isEdit = !!initialItem;
  const { data: requirements = [] } = useQuery<Requirement[]>({ queryKey: ['/api/requirements'] });
  const [selectedRequirement, setSelectedRequirement] = useState<number | ''>('');
  const { data: criteria = [] } = useQuery<Criterion[]>({
    queryKey: ['/api/criteria'],
  });
  const { data: analyses = [] } = useQuery<Analysis[]>({ queryKey: ['/api/analyses'] });

  const form = useForm<ParameterFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      analysisId: initialItem?.analysisId || (analyses[0]?.id ?? 0),
      label: initialItem?.label || '',
  minLimit: (initialItem as any)?.minLimit ?? '',
  maxLimit: (initialItem as any)?.maxLimit ?? '',
  minimumValue: (initialItem as any)?.minimumValue ?? '',
  intermediateValue: (initialItem as any)?.intermediateValue ?? '',
  superiorValue: (initialItem as any)?.superiorValue ?? '',
      unit: (initialItem as any)?.unit || '',
      notes: (initialItem as any)?.notes || '',
      isActive: initialItem?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [criterionId, setCriterionId] = useState<number | ''>('');
  const [requirementId, setRequirementId] = useState<number | ''>('');

  // When editing: analyses may arrive after first render; set criterionId then
  useEffect(() => {
    if (initialItem && analyses.length && (criterionId === '' || requirementId === '')) {
      const analysis = analyses.find(a => a.id === initialItem.analysisId);
      if (analysis) {
        setCriterionId(analysis.criterionId);
        setRequirementId((analysis as any).requirementId);
      }
    }
  }, [initialItem, analyses, criterionId, requirementId]);

  // Filter analyses only when both requirement & criterion selected
  const filteredAnalyses = requirementId && criterionId
    ? analyses.filter(a => a.criterionId === criterionId && (a as any).requirementId === requirementId)
    : [];

  // Keep analysis consistent with criterion selection
  if (criterionId && form.getValues('analysisId')) {
    const currentAnalysis = analyses.find(a => a.id === form.getValues('analysisId'));
    if (currentAnalysis && currentAnalysis.criterionId !== criterionId) {
      form.setValue('analysisId', 0 as any);
    }
  }

  async function onSubmit(values: ParameterFormData) {
    try {
      setSubmitting(true);
      // Para limpar no banco: enviar null para os campos de valores quando string vazia
      const clean = (v: any) => (v === '' ? null : v);
      const payload: any = {
        analysisId: values.analysisId,
        label: values.label,
        minLimit: clean(values.minLimit),
        maxLimit: clean(values.maxLimit),
        minimumValue: clean(values.minimumValue),
        intermediateValue: clean(values.intermediateValue),
        superiorValue: clean(values.superiorValue),
        unit: values.unit === '' ? null : values.unit,
        notes: values.notes === '' ? null : values.notes,
        isActive: values.isActive,
      };
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

  // Converte operadores digitados para símbolos matemáticos ("<=" -> "≤", ">=" -> "≥")
  function normalizeIneq(value: any) {
    if (typeof value !== 'string') return value;
    return value.replace(/<=/g, '≤').replace(/>=/g, '≥');
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        <FormHeader
          title={isEdit ? 'Editar Parâmetro' : 'Novo Parâmetro'}
          subtitle={isEdit ? 'Atualize os dados do parâmetro.' : 'Cadastre um novo parâmetro para uma análise.'}
          initials={form.getValues('label')?.substring(0,2) || null}
        />
        {/* Linha 1: Requisito & Critério */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <NotchedField label="Requisito" requiredMark>
              <select
                value={requirementId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setRequirementId(val as any);
                  form.setValue('analysisId', 0 as any);
                }}
                className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-9 text-sm"
              >
                <option value="">Selecione...</option>
                {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.label}</option>)}
              </select>
            </NotchedField>
          </div>
          <div>
            <NotchedField label="Critério" requiredMark>
              <select
                value={criterionId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setCriterionId(val as any);
                  form.setValue('analysisId', 0 as any);
                }}
                className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-9 text-sm"
              >
                <option value="">Selecione...</option>
                {criteria.map(c => <option key={c.id} value={c.id}>{c.code} - {c.label}</option>)}
              </select>
            </NotchedField>
          </div>
        </div>
        {/* Linha 2: Análise (50%), Limite Mínimo (25%), Limite Máximo (25%) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField name="analysisId" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Análise" requiredMark>
                  <select
                    {...field}
                    disabled={!(requirementId && criterionId) || filteredAnalyses.length === 0}
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full h-9 text-sm disabled:opacity-50"
                  >
                    <option value="">{requirementId && criterionId ? (filteredAnalyses.length ? 'Selecione...' : 'Sem análises') : 'Selecione Requisito e Critério'}</option>
                    {filteredAnalyses.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="minLimit" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Limite Mínimo">
                  <Input {...field} value={field.value ?? ''}
                    onChange={(e)=> field.onChange(e.target.value)}
                    onBlur={(e)=> {
                      const v = e.target.value.trim();
                      if(v === '') return; const num = Number(v.replace(',', '.'));
                      if(!isNaN(num)) field.onChange(num.toFixed(2));
                    }}
                    placeholder="Ex: 0" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="maxLimit" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Limite Máximo">
                  <Input {...field} value={field.value ?? ''}
                    onChange={(e)=> field.onChange(e.target.value)}
                    onBlur={(e)=> {
                      const v = e.target.value.trim();
                      if(v === '') return; const num = Number(v.replace(',', '.'));
                      if(!isNaN(num)) field.onChange(num.toFixed(2));
                    }}
                    placeholder="Ex: 100" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {/* Linha 3: Descrição & Unidade */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-5">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input {...field} placeholder="Descrição" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="unit" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Unidade">
                  <Input {...field} placeholder="Ex: dB" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {/* Linha 4: Mínimo, Intermediário, Superior */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField name="minimumValue" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Mínimo">
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(normalizeIneq(e.target.value))}
                    placeholder="Min"
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="intermediateValue" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Intermediário">
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(normalizeIneq(e.target.value))}
                    placeholder="Interm"
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="superiorValue" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Superior">
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(normalizeIneq(e.target.value))}
                    placeholder="Sup"
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
  {/* Linha 5: Observações */}
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
