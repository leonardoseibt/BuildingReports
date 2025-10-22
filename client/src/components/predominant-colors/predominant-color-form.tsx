import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import FormHeader from "@/components/ui/form-header";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showSuccess } from "@/lib/toast-messages";
import { apiRequest } from "@/lib/queryClient";
import { handleCodeUniquenessError } from "@/lib/form-error-handlers";
import type { PredominantColor } from "@shared/schema";

const schema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  label: z.string().min(1, 'Descrição é obrigatória').max(255, 'Descrição deve ter no máximo 255 caracteres'),
  absorptanceMin: z
    .union([z.literal(''), z.null(), z.coerce.number().min(0).max(1)])
    .optional()
    .transform((v) => (v === '' ? null : (v as any))),
  absorptanceMax: z
    .union([z.literal(''), z.null(), z.coerce.number().min(0).max(1)])
    .optional()
    .transform((v) => (v === '' ? null : (v as any))),
  isActive: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.absorptanceMin != null && data.absorptanceMax != null && data.absorptanceMax < data.absorptanceMin) {
    ctx.addIssue({ code: 'custom', message: 'Máx deve ser >= Mín', path: ['absorptanceMax'] });
  }
});

type FormData = z.infer<typeof schema>;

export default function PredominantColorForm({ initialItem, onSuccess, onCancel }: { initialItem: PredominantColor | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialItem
      ? {
          code: initialItem.code,
          label: initialItem.label,
          absorptanceMin: (initialItem as any).absorptanceMin ?? null,
          absorptanceMax: (initialItem as any).absorptanceMax ?? null,
          isActive: (initialItem as any).isActive ?? true,
        }
      : { code: '', label: '', absorptanceMin: null, absorptanceMax: null, isActive: true },
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const method = initialItem ? 'PUT' : 'POST';
      const url = initialItem ? `/api/predominant-colors/${initialItem.id}` : '/api/predominant-colors';
      const res = await apiRequest(method as any, url, data);
      return res.json();
    },
    onSuccess: () => {
      showSuccess(toast, `Cor ${initialItem ? 'atualizada' : 'cadastrada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['/api/predominant-colors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/extended-stats'] });
      onSuccess?.();
    },
    onError: (error: any) => { handleCodeUniquenessError(error, form as any, toast, 'Falha ao salvar cor'); },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6" autoComplete="off">
        <FormHeader title={initialItem ? 'Editar Cor Predominante' : 'Nova Cor Predominante'} subtitle={initialItem ? 'Atualize os dados da cor predominante.' : 'Cadastre uma nova cor predominante.'} initials={initialItem?.code ?? null} />

        {/* Linha 1: Código & Descrição */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <Input placeholder="BRANCA" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Textarea
                    placeholder="Branca ou clara"
                    {...field}
                    rows={3}
                    maxLength={255}
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-0"
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Linha 2: Faixa de Absortância */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            name="absorptanceMin"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormControl>
                  <NotchedField label="Absortância Mínima">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.001}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0.000"
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </NotchedField>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="absorptanceMax"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormControl>
                  <NotchedField label="Absortância Máxima">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.001}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="1.000"
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </NotchedField>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
