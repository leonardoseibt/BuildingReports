import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Mail, Phone, User2, Lock, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
import { z } from "zod";

const MODULE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'reports', label: 'Relatórios' },
  { key: 'buildings', label: 'Edificações' },
  { key: 'technicians', label: 'Responsáveis Técnicos' },
  { key: 'states', label: 'Estados' },
  { key: 'cities', label: 'Municípios' },
  { key: 'bioclimatic-zones', label: 'Zonas Bioclimáticas' },
  { key: 'isopleths', label: 'Isopletas' },
  { key: 'typologies', label: 'Tipos de Uso' },
  { key: 'noise-classes', label: 'Classes de Ruído' },
  { key: 'aggressiveness-classes', label: 'Classes de Agressividade' },
  { key: 'constructive-systems', label: 'Sistemas Construtivos' },
  { key: 'requirements', label: 'Requisitos' },
  { key: 'criteria', label: 'Critérios' },
  { key: 'analyses', label: 'Análises' },
  { key: 'attributes', label: 'Atributos' },
  { key: 'parameters', label: 'Parâmetros' },
  { key: 'users', label: 'Usuários' },
  { key: 'settings', label: 'Configurações' },
];

interface UserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialUser?: { id: number; fullName: string; email: string; phone?: string | null; isAdmin?: boolean; allowedModules?: string[] } | null;
}

type FormValues = {
  fullName: string;
  email: string;
  password?: string;
  phone?: string;
  isAdmin: boolean;
  allowedModules: string[];
};

export default function UserForm({ onSuccess, onCancel, initialUser }: UserFormProps = {}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const onlyDigits = React.useCallback((v: string) => v.replace(/\D/g, ""), []);
  const formatPhoneBR = React.useCallback((v: string) => {
    let digits = onlyDigits(v);
    if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }, [onlyDigits]);

  const isEdit = !!initialUser?.id;
  const userSchemaClient = React.useMemo(() => {
    const base = isEdit ? updateUserSchema : insertUserSchema;
    const withPerms = base.extend({
      isAdmin: z.boolean().optional(),
      allowedModules: z.array(z.string()).optional(),
    });
    return withPerms.superRefine((data, ctx) => {
      if (!data.fullName || String(data.fullName).trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nome é obrigatório', path: ['fullName'] });
      }
      if (!data.email || String(data.email).trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email é obrigatório', path: ['email'] });
      }
      if (!isEdit) {
        const pwd = (data as any).password as string | undefined;
        if (!pwd || pwd.trim().length < 6) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Senha deve ter pelo menos 6 caracteres', path: ['password'] });
        }
      }
    });
  }, [isEdit]);

  const form = useForm<FormValues>({
    resolver: zodResolver(userSchemaClient),
    defaultValues: {
      fullName: initialUser?.fullName ?? "",
      email: initialUser?.email ?? "",
      password: "",
      phone: initialUser?.phone ?? "",
      isAdmin: !!initialUser?.isAdmin,
      allowedModules: initialUser?.allowedModules ?? [],
    },
    mode: "onSubmit",
  });

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
        isAdmin: !!data.isAdmin,
        allowedModules: data.isAdmin ? [] : Array.from(new Set(data.allowedModules || [])).filter(Boolean),
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

        {/* CAMPOS: cada campo com borda e rótulo embutido (notched) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            name="fullName"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Nome completo</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute -top-2 left-3 px-1 text-xs font-medium text-slate-600 bg-white">Nome completo *</span>
        <div className="rounded-xl border border-slate-300 focus-within:border-slate-400 bg-white px-2 py-1.5 transition-colors">
                      <div className="relative">
                        <User2 className="w-4 h-4 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          {...field}
                          placeholder="Nome completo"
          className="pl-6 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          autoComplete="off"
                        />
                      </div>
                    </div>
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
                <FormLabel className="sr-only">Telefone</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute -top-2 left-3 px-1 text-xs font-medium text-slate-600 bg-white">Telefone</span>
        <div className="rounded-xl border border-slate-300 focus-within:border-slate-400 bg-white px-2 py-1.5 transition-colors">
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          {...field}
                          inputMode="tel"
                          placeholder="(00) 00000-0000"
          className="pl-6 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          maxLength={15}
                          onChange={(e) => {
                            const formatted = formatPhoneBR(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </div>
                    </div>
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
                <FormLabel className="sr-only">Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute -top-2 left-3 px-1 text-xs font-medium text-slate-600 bg-white">Email *</span>
                    <div className="rounded-xl border border-slate-300 focus-within:border-slate-400 bg-white px-2 py-1.5 transition-colors">
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="email"
                          autoComplete="off"
                          {...field}
                          placeholder="nome@exemplo.com"
                          className="pl-6 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
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
                <FormLabel className="sr-only">Senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute -top-2 left-3 px-1 text-xs font-medium text-slate-600 bg-white">{isEdit ? 'Senha (opcional)' : 'Senha *'}</span>
        <div className="rounded-xl border border-slate-300 focus-within:border-slate-400 bg-white px-2 py-1.5 transition-colors">
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="password"
                          autoComplete="new-password"
                          {...field}
                          placeholder="••••••••"
          className="pl-6 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
                {isEdit && (
                  <p className="mt-1 text-xs text-slate-500">Deixe em branco para manter a senha atual.</p>
                )}
              </FormItem>
            )}
          />
        </div>

        {/* PERMISSÕES */}
        <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Permissões de Acesso</h3>
            <p className="text-xs text-slate-500">Defina se o usuário é administrador ou selecione os módulos permitidos.</p>
          </div>
          <div className="space-y-3">
            <FormField
              name="isAdmin"
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v:any)=> field.onChange(!!v)} />
                  </FormControl>
                  <FormLabel className="font-medium">Administrador</FormLabel>
                </FormItem>
              )}
            />

            {!form.watch('isAdmin') && (
              <div>
                <div className="text-xs text-slate-600 mb-2">Módulos permitidos:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {MODULE_OPTIONS.map(opt => (
                    <label key={opt.key} className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.watch('allowedModules')?.includes(opt.key) || false}
                        onCheckedChange={(checked:any) => {
                          const curr = new Set(form.getValues('allowedModules') || []);
                          if (checked) curr.add(opt.key); else curr.delete(opt.key);
                          form.setValue('allowedModules', Array.from(curr));
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AÇÕES */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
            Cancelar
          </Button>
          <Button type="submit" className="min-w-32 rounded-xl" disabled={submitting}>
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
