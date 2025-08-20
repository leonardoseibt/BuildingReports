import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import FormHeader from "@/components/ui/form-header";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BioclimaticZone } from "@shared/schema";

const schema = z.object({
  code: z.string().min(1, 'Código é obrigatório').regex(/^ZB[1-8]$/, 'Formato esperado: ZB1..ZB8'),
  label: z.string().min(1, 'Descrição é obrigatória'),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ZoneForm({ initialItem, onSuccess, onCancel }: { initialItem: BioclimaticZone | null; onSuccess?: () => void; onCancel?: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialItem
      ? { code: initialItem.code, label: initialItem.label, isActive: (initialItem as any).isActive ?? true }
      : { code: '', label: '', isActive: true },
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
  const payload: any = { code: data.code, label: data.label, isActive: data.isActive ?? true };
      const method = initialItem ? 'PUT' : 'POST';
      const url = initialItem ? `/api/bioclimatic-zones/${initialItem.id}` : '/api/bioclimatic-zones';
      const res = await apiRequest(method as any, url, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: `Zona ${initialItem ? 'atualizada' : 'cadastrada'} com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ['/api/bioclimatic-zones'] });
      onSuccess?.();
    },
    onError: () => { toast({ title: 'Erro', description: 'Falha ao salvar zona', variant: 'destructive' }); },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6" autoComplete="off">
  <FormHeader title={initialItem ? 'Editar Zona' : 'Nova Zona'} subtitle={initialItem ? 'Atualize os dados da zona bioclimática.' : 'Cadastre uma nova zona bioclimática.'} initials={initialItem?.code ?? null} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField name="code" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-1">
              <FormControl>
                <NotchedField label="Código" requiredMark>
                  <Input placeholder="ZB1" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 uppercase" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="label" control={form.control} render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormControl>
                <NotchedField label="Descrição" requiredMark>
                  <Input placeholder="Zona Bioclimática 1 - Clima Frio" {...field} className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

  {/* Campos mínimos */}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Form>
  );
}
