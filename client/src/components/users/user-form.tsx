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
// removed unused Separator import

import { Mail, Phone, User2, Lock, Loader2 } from "lucide-react";
import { insertUserSchema, updateUserSchema } from "@shared/schema";

interface UserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialUser?: { id: number; fullName: string; email: string; phone?: string | null } | null;
}

/**
 * Componente de formulário de "Novo Usuário"
 * - Visual repaginado, com header, avatar/preview e grid responsivo
 * - Mantém compatibilidade com o schema e a API já existentes
 */
type FormValues = {
  fullName: string;
  email: string;
  password?: string;
  phone?: string;
};

export default function UserForm({ onSuccess, onCancel, initialUser }: UserFormProps = {}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  // Helpers for BR phone formatting and sanitization
  const onlyDigits = React.useCallback((v: string) => v.replace(/\D/g, ""), []);
  const formatPhoneBR = React.useCallback((v: string) => {
    let digits = onlyDigits(v);
    // If value starts with country code 55, strip it
    if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
    digits = digits.slice(0, 11); // cap to 11 digits
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (rest.length <= 8) {
      // landline pattern: (00) 0000-0000
      return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    // mobile pattern: (00) 00000-0000
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }, [onlyDigits]);

  const isEdit = !!initialUser?.id;
  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? updateUserSchema : insertUserSchema),
    defaultValues: {
      fullName: initialUser?.fullName ?? "",
      email: initialUser?.email ?? "",
      password: "",
      phone: initialUser?.phone ?? "",
    },
  mode: "onSubmit",
  });

  // Format initial phone on mount/open
  React.useEffect(() => {
    if (initialUser?.phone) {
      form.setValue("phone", formatPhoneBR(initialUser.phone));
    }
  }, [initialUser?.phone, form, formatPhoneBR]);
  const watchName = form.watch("fullName");
  const initials = React.useMemo(() => {
    const parts = (watchName || "").trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const i = (first + last).toUpperCase();
    return i || "U";
  }, [watchName]);

  const onSubmit = async (data: FormValues) => {
    try {
      setSubmitting(true);
      const payload: any = {
        fullName: data.fullName.trim(),
        email: data.email.trim(),
        phone: (() => {
          const raw = data.phone?.trim() || "";
          const digits = onlyDigits(raw);
          return digits ? digits : undefined;
        })(),
      };
      if (!isEdit) {
        payload.password = (data.password || "").trim();
      } else if (data.password && data.password.trim().length > 0) {
        payload.password = data.password.trim();
      }
      const res = isEdit
        ? await apiRequest("PUT", `/api/users/${initialUser!.id}` as const, payload)
        : await apiRequest("POST", "/api/users", payload);
      await res.json();
      toast({ title: "Sucesso", description: isEdit ? "Usuário atualizado." : "Usuário cadastrado." });
      onSuccess?.();
    } catch (e) {
      let description = isEdit ? "Não foi possível atualizar." : "Não foi possível cadastrar.";
      if (e instanceof Error && e.message.startsWith("409")) {
        // Conflito de e-mail (já cadastrado)
        description = "E-mail já cadastrado.";
        form.setError("email", { message: description });
        if (form.setFocus) form.setFocus("email");
      }
      toast({ title: "Erro", description, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        {/* HEADER */}
        <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Avatar / Preview */}
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 ring-1 ring-slate-200 flex items-center justify-center overflow-hidden">
                <span className="font-semibold text-slate-700">{initials}</span>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <p className="text-sm text-slate-500">
                {isEdit ? 'Atualize os dados do usuário selecionado.' : 'Cadastre um novo usuário com nome e e-mail para acesso ao sistema.'}
              </p>
            </div>
          </div>
        </div>

        {/* CAMPOS */}
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-5 md:p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              name="fullName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        {...field}
                        placeholder="Nome completo"
                        className="pl-9 bg-slate-50 focus:bg-white transition-colors"
                        autoComplete="off"
                      />
                    </div>
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
                        maxLength={15}
                        onChange={(e) => {
                          const formatted = formatPhoneBR(e.target.value);
                          field.onChange(formatted);
                        }}
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
                        autoComplete="off"
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
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                        placeholder="••••••••"
                        className="pl-9 bg-slate-50 focus:bg-white transition-colors"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

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
