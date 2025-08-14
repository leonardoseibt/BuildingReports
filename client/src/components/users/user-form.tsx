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
import { User } from "lucide-react";

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
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>Dados do Usuário</CardTitle>
              </div>
              <CardDescription>Informações básicas do usuário</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                name="firstName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome" />
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
                      <Input {...field} placeholder="Sobrenome" />
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
                      <Input type="email" {...field} placeholder="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
