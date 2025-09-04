import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import FormHeader from "@/components/ui/form-header";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showSuccess } from "@/lib/toast-messages";
import { apiRequest } from "@/lib/queryClient";
import { handleCodeUniquenessError } from "@/lib/form-error-handlers";
import type { ConstructiveSystem } from "@shared/schema";

const schema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  label: z.string().min(1, 'Descrição é obrigatória'),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ConstructiveSystemForm({ initialItem, onSuccess, onCancel }: { initialItem: ConstructiveSystem | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialItem ? { code: initialItem.code, label: initialItem.label, isActive: (initialItem as any).isActive ?? true } : { code: '', label: '', isActive: true },
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const method = initialItem ? 'PUT' : 'POST';
      const url = initialItem ? `/api/constructive-systems/${initialItem.id}` : '/api/constructive-systems';
      const res = await apiRequest(method as any, url, data);
      return res.json();
    },
    onSuccess: () => {
      showSuccess(toast, `Sistema Construtivo ${initialItem ? 'atualizado' : 'cadastrado'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['/api/constructive-systems'] });
      onSuccess?.();
    },
  onError: (error: any) => { handleCodeUniquenessError(error, form as any, toast, 'Falha ao salvar sistema'); },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6" autoComplete="off">
        <FormHeader title={initialItem ? 'Editar Sistema Construtivo' : 'Novo Sistema Construtivo'} subtitle={initialItem ? 'Atualize os dados do sistema construtivo.' : 'Cadastre um novo sistema construtivo.'} initials={initialItem?.code ?? null} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <Input placeholder="alv_conv" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input placeholder="Alvenaria Convencional" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
