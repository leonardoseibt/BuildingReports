import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  fullName: z.string().min(3),
  creaCau: z.string().min(3),
  registrationType: z.string().optional(),
  licenseState: z.string().length(2).optional(),
  cpfCnpj: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  cep: z.string().optional(),
  notes: z.string().optional(),
});

export type TechnicianFormData = z.infer<typeof schema>;

interface TechnicianFormProps {
  onSuccess?: () => void;
}

export default function TechnicianForm({ onSuccess }: TechnicianFormProps = {}) {
  const { toast } = useToast();
  const form = useForm<TechnicianFormData>({
    resolver: zodResolver(schema),
    defaultValues: {} as any,
  });

  const onSubmit = async (data: TechnicianFormData) => {
    try {
      const res = await apiRequest("POST", "/api/technicians", data);
      await res.json();
      toast({ title: "Sucesso", description: "Responsável técnico cadastrado." });
      onSuccess?.();
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="fullName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do profissional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="creaCau"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CREA/CAU *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Número do registro" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="registrationType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo do Registro</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="CREA ou CAU" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="licenseState"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UF do Registro</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="UF" maxLength={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="cpfCnpj"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF/CNPJ</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} placeholder="email@exemplo.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="phone"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="(00) 00000-0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="company"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="address"
              control={form.control}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Rua, número, bairro" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="city"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="state"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UF</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="cep"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="00000-000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="notes"
              control={form.control}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Notas adicionais" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
