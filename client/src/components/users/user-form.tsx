import * as React from "react";
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

import { Mail, Phone, User2, Image as ImageIcon, Loader2 } from "lucide-react";
import { insertUserSchema, type InsertUser } from "@shared/schema";

interface UserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Componente de formulário de "Novo Usuário"
 * - Visual repaginado, com header, avatar/preview e grid responsivo
 * - Mantém compatibilidade com o schema e a API já existentes
 */
export default function UserForm({ onSuccess, onCancel }: UserFormProps = {}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      profileImageUrl: "",
      phone: "",
    },
    mode: "onBlur",
  });

  const watchFirst = form.watch("firstName");
  const watchLast = form.watch("lastName");
  const watchImage = form.watch("profileImageUrl");

  const initials = React.useMemo(() => {
    const f = (watchFirst || "").trim();
    const l = (watchLast || "").trim();
    return (f.slice(0, 1) + l.slice(0, 1)).toUpperCase() || "U";
  }, [watchFirst, watchLast]);

  const onSubmit = async (data: InsertUser) => {
    try {
      setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* HEADER */}
        <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Avatar / Preview */}
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 ring-1 ring-slate-200 flex items-center justify-center overflow-hidden">
                {watchImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={watchImage}
                    alt="Pré-visualização"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // oculta imagem quebrada e volta para iniciais
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <span className="font-semibold text-slate-700">{initials}</span>
                )}
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Novo Usuário
              </h2>
              <p className="text-sm text-slate-500">
                Cadastre um novo usuário com nome e e-mail para acesso ao
                sistema.
              </p>
            </div>
          </div>
        </div>

        {/* CAMPOS */}
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-5 md:p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              name="firstName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        {...field}
                        placeholder="Nome"
                        className="pl-9 bg-slate-50 focus:bg-white transition-colors"
                      />
                    </div>
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
                    <Input
                      {...field}
                      placeholder="Sobrenome"
                      className="bg-slate-50 focus:bg-white transition-colors"
                    />
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
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        {...field}
                        inputMode="tel"
                        placeholder="(00) 00000-0000"
                        className="pl-9 bg-slate-50 focus:bg-white transition-colors"
                      />
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
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="email"
                        {...field}
                        placeholder="nome@exemplo.com"
                        className="pl-9 bg-slate-50 focus:bg-white transition-colors"
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
                    <div className="relative">
                      <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        {...field}
                        placeholder="https://exemplo.com/foto.jpg"
                        className="pl-9 bg-slate-50 focus:bg-white transition-colors"
                      />
                    </div>
                  </FormControl>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dica: cole a URL de uma imagem pública para pré-visualizar o
                    avatar acima.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator className="opacity-70" />

        {/* AÇÕES */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-xl"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            className="min-w-32 rounded-xl"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
