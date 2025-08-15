import { useForm } from "react-hook-form";
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
import { Separator } from "@/components/ui/separator";
import { Mail, Phone } from "lucide-react";
import { insertUserSchema, type InsertUser } from "@shared/schema";

interface UserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function UserForm({ onSuccess, onCancel }: UserFormProps = {}) {
  const { toast } = useToast();
  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      profileImageUrl: "",
      phone: "",
    },
  });

  const onSubmit = async (data: InsertUser) => {
    try {
      const res = await apiRequest("POST", "/api/users", data);
      await res.json();
      toast({ title: "Sucesso", description: "Usuário cadastrado." });
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="firstName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome" className="bg-slate-50 focus:bg-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="lastName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sobrenome *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Sobrenome" className="bg-slate-50 focus:bg-white" />
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
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input {...field} placeholder="(00) 00000-0000" className="pl-9 bg-slate-50 focus:bg-white" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="email"
                        {...field}
                        placeholder="nome@exemplo.com"
                        className="pl-9 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="profileImageUrl"
              control={form.control}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>URL da Imagem</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://exemplo.com/foto.jpg" className="bg-slate-50 focus:bg-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <Separator />
        <div className="flex items-center justify-end gap-3 pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="min-w-28">
            Salvar
          </Button>
        </div>
      </form>
    </Form>
  );
}
