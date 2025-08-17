import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Typology } from "@shared/schema";

const schema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  label: z.string().min(1, 'Descrição é obrigatória'),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function TypologyForm({ initialItem, onSuccess, onCancel }: { initialItem: Typology | null; onSuccess?: () => void; onCancel?: () => void; }) {
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
      const url = initialItem ? `/api/typologies/${initialItem.id}` : '/api/typologies';
      const res = await apiRequest(method as any, url, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: `Tipologia ${initialItem ? 'atualizada' : 'cadastrada'} com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ['/api/typologies'] });
      onSuccess?.();
    },
    onError: () => { toast({ title: 'Erro', description: 'Falha ao salvar tipologia', variant: 'destructive' }); },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6" autoComplete="off">
        <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{initialItem ? 'Editar Tipologia' : 'Nova Tipologia'}</h2>
        </div>
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-5 md:p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField name="code" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Código *</FormLabel>
                <FormControl><Input placeholder="unifamiliar" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="label" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição *</FormLabel>
                <FormControl><Input placeholder="Unifamiliar" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
