import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AggressivenessClass } from "@shared/schema";

const schema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  label: z.string().min(1, 'Descrição é obrigatória'),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function AggressivenessClassForm({ initialItem, onSuccess, onCancel }: { initialItem: AggressivenessClass | null; onSuccess?: () => void; onCancel?: () => void; }) {
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
      const url = initialItem ? `/api/aggressiveness-classes/${initialItem.id}` : '/api/aggressiveness-classes';
      const res = await apiRequest(method as any, url, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: `Classe ${initialItem ? 'atualizada' : 'cadastrada'} com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ['/api/aggressiveness-classes'] });
      onSuccess?.();
    },
    onError: () => { toast({ title: 'Erro', description: 'Falha ao salvar classe', variant: 'destructive' }); },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6" autoComplete="off">
        <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{initialItem ? 'Editar Classe de Agressividade' : 'Nova Classe de Agressividade'}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <Input placeholder="caa1" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input placeholder="CAA 1" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
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
