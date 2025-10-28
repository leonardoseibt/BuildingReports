import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import FormHeader from "@/components/ui/form-header";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showSuccess } from "@/lib/toast-messages";
import { apiRequest } from "@/lib/queryClient";
import { handleCodeUniquenessError } from "@/lib/form-error-handlers";
import type { PredominantColor, ColorGroup } from "@shared/schema";

const schema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  label: z.string().min(1, 'Descrição é obrigatória').max(50, 'Descrição deve ter no máximo 50 caracteres'),
  colorGroupId: z.coerce.number().int().min(1, 'Grupo de cores é obrigatório'),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function PredominantColorForm({ initialItem, onSuccess, onCancel }: { initialItem: PredominantColor | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: colorGroups = [] } = useQuery<ColorGroup[]>({ queryKey: ["/api/color-groups"] });
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialItem
      ? {
          code: initialItem.code,
          label: initialItem.label,
          colorGroupId: (initialItem as any).colorGroupId ?? null as any,
          isActive: (initialItem as any).isActive ?? true,
        }
      : { code: '', label: '', colorGroupId: null as any, isActive: true },
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
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4" autoComplete="off">
        <FormHeader title={initialItem ? 'Editar Cor' : 'Nova Cor'} subtitle={initialItem ? 'Atualize os dados da cor.' : 'Cadastre uma nova cor.'} initials={initialItem?.code ?? null} />

        {/* Linha 1: Código & Descrição */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <Input placeholder="BR" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input
                    placeholder="Branca"
                    {...field}
                    maxLength={50}
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Linha 2: Grupo de Cores */}
        <FormField
          name="colorGroupId"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <NotchedField label="Grupo de Absortância" requiredMark>
                  <select
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 w-full h-9 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {colorGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label} ({Number((g as any).minAlpha).toFixed(2)} – {Number((g as any).maxAlpha).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
