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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, User } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

export type UserFormData = z.infer<typeof schema>;

interface UserFormProps {
  onSuccess?: () => void;
}

export default function UserForm({ onSuccess }: UserFormProps = {}) {
  const { toast } = useToast();
  const form = useForm<UserFormData>({
    resolver: zodResolver(schema),
    defaultValues: {} as any,
  });

  const onSubmit = async (data: UserFormData) => {
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
    <div className="max-w-3xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>Dados do Usuário</CardTitle>
              </div>
              <CardDescription>Informe nome e e-mail do usuário que terá acesso ao sistema.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                name="email"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input type="email" {...field} placeholder="nome@exemplo.com" className="pl-9 bg-slate-50 focus:bg-white" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <div className="flex items-center justify-end gap-3">
            <Button type="submit" className="min-w-28">Salvar</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
