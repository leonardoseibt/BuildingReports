import { useState, useEffect, useMemo } from 'react';
import { useSmartReplace } from '@/hooks/use-smart-replace';
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
  attributeId: z.union([z.string(), z.number()]).optional().nullable(),
  attributeValueId: z.union([z.string(), z.number()]).optional().nullable(),
  attribute2Id: z.union([z.string(), z.number()]).optional().nullable(),
  attributeValue2Id: z.union([z.string(), z.number()]).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type ParameterFormData = z.infer<typeof formSchema>;

export default function ParameterForm({ onSuccess, onCancel, initialItem }: { onSuccess?: () => void; onCancel?: () => void; initialItem?: Parameter | null; }) {
  const smartReplace = useSmartReplace();
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
      analysisId: initialItem?.analysisId || undefined as any,
      label: initialItem?.label || '',
  minLimit: (initialItem as any)?.minLimit ?? '',
  maxLimit: (initialItem as any)?.maxLimit ?? '',
  minimumValue: (initialItem as any)?.minimumValue ?? '',
  intermediateValue: (initialItem as any)?.intermediateValue ?? '',
  superiorValue: (initialItem as any)?.superiorValue ?? '',
      unit: (initialItem as any)?.unit || '',
      notes: (initialItem as any)?.notes || '',
  attributeId: (initialItem as any)?.attributeId ?? '',
  attributeValueId: (initialItem as any)?.attributeValueId ?? '',
  attribute2Id: (initialItem as any)?.attribute2Id ?? '',
  attributeValue2Id: (initialItem as any)?.attributeValue2Id ?? '',
      isActive: initialItem?.isActive ?? true,
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [criterionId, setCriterionId] = useState<number | ''>('');
  const [requirementId, setRequirementId] = useState<number | ''>('');

  // Carregar atributos dinâmicos
  const { data: attributes = [] } = useQuery<any[]>({
    queryKey: ['/api/attributes'],
    queryFn: async () => {
      const r = await fetch('/api/attributes', { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    }
  });

  // Persist selection when editing
  useEffect(()=> {
    if (initialItem && (initialItem as any).attributeId) {
      form.setValue('attributeId', String((initialItem as any).attributeId) as any);
      if ((initialItem as any).attributeValueId != null) form.setValue('attributeValueId', String((initialItem as any).attributeValueId) as any);
    }
    if (initialItem && (initialItem as any).attribute2Id) {
      form.setValue('attribute2Id', String((initialItem as any).attribute2Id) as any);
      if ((initialItem as any).attributeValue2Id != null) form.setValue('attributeValue2Id', String((initialItem as any).attributeValue2Id) as any);
    }
  }, [initialItem]);

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

  // Keep analysis consistent with criterion selection/react to changes safely
  useEffect(() => {
    const current = form.getValues('analysisId') as any;
    if (!current) return;
    const currentAnalysis = analyses.find(a => a.id === current);
    if (criterionId && currentAnalysis && currentAnalysis.criterionId !== criterionId) {
      form.setValue('analysisId', '' as any);
    }
  }, [criterionId, analyses]);

  const selectedAttribute = useMemo(()=> {
    const id = form.watch('attributeId');
    if (!id) return null;
    return attributes.find(a => String(a.id) === String(id)) || null;
  }, [attributes, form.watch('attributeId')]);

  const selectedAttribute2 = useMemo(()=> {
    const id = form.watch('attribute2Id');
    if (!id) return null;
    return attributes.find(a => String(a.id) === String(id)) || null;
  }, [attributes, form.watch('attribute2Id')]);

  // Pré-carrega dados das fontes de referência
  const { data: attributeValues = [], isLoading: loadingAttributeValues } = useQuery({
    queryKey: ['attribute-values', form.watch('attributeId')],
    enabled: !!selectedAttribute && selectedAttribute.dataKind === 'reference',
    queryFn: async () => {
      const id = form.watch('attributeId');
      if (!id) return [];
      const r = await fetch(`/api/attributes/${id}/values`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const { data: attributeValues2 = [], isLoading: loadingAttributeValues2 } = useQuery({
    queryKey: ['attribute-values-2', form.watch('attribute2Id')],
    enabled: !!selectedAttribute2 && selectedAttribute2.dataKind === 'reference',
    queryFn: async () => {
      const id = form.watch('attribute2Id');
      if (!id) return [];
      const r = await fetch(`/api/attributes/${id}/values`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    }
  });

  function getAttributeSourceRows(): any[] { return attributeValues; }
  function getAttributeSourceRows2(): any[] { return attributeValues2; }

  async function onSubmit(values: ParameterFormData) {
    // Basic validation: ensure numeric ordering if both provided
    if(values.minLimit && values.maxLimit) {
      const a = Number(values.minLimit)
      const b = Number(values.maxLimit)
      if(!isNaN(a) && !isNaN(b) && a > b) {
        form.setError('maxLimit', { message: 'Máx deve ser >= Mín' })
        return;
      }
    }
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
        // Converte para número apenas se não for string vazia/null/undefined
        attributeId: (values.attributeId !== '' && values.attributeId != null) ? Number(values.attributeId) : null,
        attributeValueId: (values.attributeValueId !== '' && values.attributeValueId != null) ? Number(values.attributeValueId) : null,
        attribute2Id: (values.attribute2Id !== '' && values.attribute2Id != null) ? Number(values.attribute2Id) : null,
        attributeValue2Id: (values.attributeValue2Id !== '' && values.attributeValue2Id != null) ? Number(values.attributeValue2Id) : null,
        isActive: values.isActive,
      };
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/parameters/${initialItem!.id}` : '/api/parameters';
      await apiRequest(method as any, url as any, payload);
      showSuccess(toast, isEdit ? 'Parâmetro atualizado.' : 'Parâmetro cadastrado.');
      onSuccess?.();
    } catch (e: any) {
      showError(toast, isEdit ? 'Falha ao atualizar.' : 'Falha ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  }

  // Função removida: não converte mais operadores para símbolos especiais
  function normalizeIneq(value: any) {
    if (typeof value !== 'string') return value;
    return value; // Sem substituições
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" autoComplete="off">
        <FormHeader
          title={isEdit ? 'Editar Parâmetro' : 'Novo Parâmetro'}
          subtitle={isEdit ? 'Atualize os dados do parâmetro.' : 'Cadastre um novo parâmetro para uma análise.'}
          initials={form.getValues('label')?.substring(0,2) || null}
        />
        {/* Linha 1: Requisito & Critério */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <NotchedField label="Requisito" requiredMark>
              <select
                value={requirementId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setRequirementId(val as any);
                  form.setValue('analysisId', 0 as any);
                }}
                className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
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
                className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
              >
                <option value="">Selecione...</option>
                {criteria.map(c => <option key={c.id} value={c.id}>{c.code} - {c.label}</option>)}
              </select>
            </NotchedField>
          </div>
        </div>
        {/* Linha 2: Análise (linha isolada) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField name="analysisId" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Análise" requiredMark>
                  <select
                    {...field}
                    disabled={!(requirementId && criterionId) || filteredAnalyses.length === 0}
                    className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm disabled:opacity-50"
                  >
                    <option value="">{requirementId && criterionId ? (filteredAnalyses.length ? 'Selecione...' : 'Sem análises') : 'Selecione Requisito e Critério'}</option>
                    {filteredAnalyses.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {/* Linha 3 nova: Atributo + dependentes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
          <div className="md:col-span-2">
            <NotchedField label="Atributo">
              <select
                value={form.watch('attributeId') || ''}
                onChange={(e)=> {
                  const id = e.target.value;
                  form.setValue('attributeId', id as any);
                  form.setValue('attributeValueId', '' as any);
                  form.setValue('minLimit','' as any);
                  form.setValue('maxLimit','' as any);
                }}
                className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
              >
                <option value="">Selecione...</option>
                {attributes.slice().sort((a:any,b:any)=> a.friendlyName.localeCompare(b.friendlyName,'pt-BR')).map(a => (
                  <option key={a.id} value={a.id}>{a.friendlyName} ({a.dataKind})</option>
                ))}
              </select>
            </NotchedField>
            {selectedAttribute && (
              <p className="text-[11px] text-slate-500 mt-1">
                Origem: {selectedAttribute.sourceTable}.{selectedAttribute.sourceColumn}{selectedAttribute.valueSource ? ` • Fonte Valor: ${selectedAttribute.valueSource}` : ''}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            {selectedAttribute && selectedAttribute.dataKind === 'reference' && (
              <FormField name="attributeValueId" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NotchedField label="Valor do Atributo">
                      <select
                        {...field}
                        value={field.value || ''}
                        onChange={(e)=> field.onChange(e.target.value)}
                        className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
                      >
                        <option value="">Selecione...</option>
                        {loadingAttributeValues && <option value="" disabled>Carregando...</option>}
                        {getAttributeSourceRows().map((row: any) => {
                          const idField = selectedAttribute.valueIdField || 'id';
                          const labelField = selectedAttribute.valueLabelField || 'label';
                          const optionId = row[idField];
                          const code = row.code ?? optionId;
                          const description = row.label ?? row[labelField] ?? row.description ?? row.name ?? '';
                          const combined = description ? `${code} - ${description}` : String(code);
                          const truncated = combined.length > 55 ? combined.slice(0, 55) + '…' : combined;
                          return (
                            <option key={optionId} value={optionId} title={combined}>
                              {truncated}
                            </option>
                          );
                        })}
                      </select>
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            {selectedAttribute && selectedAttribute.dataKind === 'numeric' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField name="minLimit" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Limite Mínimo">
                        <SmartInput {...field} value={field.value ?? ''}
                          onChange={(e)=> field.onChange(e.target.value)}
                          onBlur={(e)=> { const v = e.target.value.trim(); if(v===''){return;} const num = Number(v.replace(',', '.')); if(!isNaN(num)) field.onChange(num.toFixed(2)); }}
                          placeholder="Ex: 0" className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="maxLimit" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Limite Máximo">
                        <SmartInput {...field} value={field.value ?? ''}
                          onChange={(e)=> field.onChange(e.target.value)}
                          onBlur={(e)=> { const v = e.target.value.trim(); if(v===''){return;} const num = Number(v.replace(',', '.')); if(!isNaN(num)) field.onChange(num.toFixed(2)); }}
                          placeholder="Ex: 100" className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}
          </div>
        </div>
        {/* Linha 4 nova: Segundo Atributo (condicional) */}
        {form.watch('attributeId') && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start border-t pt-3">
            <div className="md:col-span-2">
              <NotchedField label="Atributo 2 (opcional)">
                <select
                  value={form.watch('attribute2Id') || ''}
                  onChange={(e)=> {
                    const id = e.target.value;
                    form.setValue('attribute2Id', id as any);
                    form.setValue('attributeValue2Id', '' as any);
                  }}
                  className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
                >
                  <option value="">Selecione...</option>
                  {attributes.slice().sort((a:any,b:any)=> a.friendlyName.localeCompare(b.friendlyName,'pt-BR')).map(a => (
                    <option key={a.id} value={a.id}>{a.friendlyName} ({a.dataKind})</option>
                  ))}
                </select>
              </NotchedField>
              {selectedAttribute2 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Origem: {selectedAttribute2.sourceTable}.{selectedAttribute2.sourceColumn}{selectedAttribute2.valueSource ? ` • Fonte Valor: ${selectedAttribute2.valueSource}` : ''}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              {selectedAttribute2 && selectedAttribute2.dataKind === 'reference' && (
                <FormField name="attributeValue2Id" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Valor do Atributo 2">
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e)=> field.onChange(e.target.value)}
                          className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {loadingAttributeValues2 && <option value="" disabled>Carregando...</option>}
                          {getAttributeSourceRows2().map((row: any) => {
                            const idField = selectedAttribute2.valueIdField || 'id';
                            const labelField = selectedAttribute2.valueLabelField || 'label';
                            const optionId = row[idField];
                            const code = row.code ?? optionId;
                            const description = row.label ?? row[labelField] ?? row.description ?? row.name ?? '';
                            const combined = description ? `${code} - ${description}` : String(code);
                            const truncated = combined.length > 55 ? combined.slice(0, 55) + '…' : combined;
                            return (
                              <option key={optionId} value={optionId} title={combined}>
                                {truncated}
                              </option>
                            );
                          })}
                        </select>
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {selectedAttribute2 && selectedAttribute2.dataKind === 'numeric' && (
                <p className="text-sm text-slate-500 mt-2">
                  Atributos numéricos como segundo atributo usam os mesmos limites do primeiro atributo.
                </p>
              )}
            </div>
          </div>
        )}
        {/* Linha 5: Descrição & Unidade */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-5">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <SmartTextarea
                    {...field}
                    placeholder="Descrição"
                    rows={2}
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-y min-h-[60px] text-sm w-full"
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="unit" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Unidade">
                  <SmartInput {...field} placeholder="Ex: dB" className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {/* Linha 4: Mínimo, Intermediário, Superior */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField name="minimumValue" control={form.control} render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Mínimo">
                  <SmartInput
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(normalizeIneq(e.target.value))}
                    placeholder="Min"
                    className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                  <SmartInput
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(normalizeIneq(e.target.value))}
                    placeholder="Interm"
                    className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                  <SmartInput
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(normalizeIneq(e.target.value))}
                    placeholder="Sup"
                    className="w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                <SmartTextarea
                  {...field}
                  placeholder="Notas adicionais"
                  rows={2}
                  className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-y min-h-[50px] text-sm w-full"
                  onChange={e => field.onChange(smartReplace(e.target.value))}
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
