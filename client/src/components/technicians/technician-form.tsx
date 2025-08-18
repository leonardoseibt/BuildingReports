import { useState, useCallback, useEffect } from "react";
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
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { IdCard, MapPin, Mail, Phone, Loader2, User2 } from "lucide-react";
import { UF_OPTIONS } from "@/lib/uf";
import type { Technician } from "@shared/schema";

const schema = z.object({
  fullName: z.string().min(1, 'Nome completo é obrigatório').min(3, 'Nome completo deve ter pelo menos 3 caracteres'),
  creaCau: z.string().min(1, 'CREA/CAU é obrigatório').min(3, 'CREA/CAU deve ter pelo menos 3 caracteres'),
  licenseState: z.string().length(2, 'UF do Registro é obrigatória'),
  cpfCnpj: z
    .string().min(1, 'CPF/CNPJ é obrigatório')
    .superRefine((v, ctx) => {
      const digits = (v || "").replace(/\D/g, "");
      if (digits.length !== 11 && digits.length !== 14) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe CPF (11) ou CNPJ (14) válido." });
      }
    }),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  company: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  cep: z.string().optional(),
  notes: z.string().optional(),
});

export type TechnicianFormData = z.infer<typeof schema>;

interface TechnicianFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialTech?: Partial<Pick<Technician,
    | "id"
    | "fullName"
    | "creaCau"
    | "licenseState"
    | "cpfCnpj"
    | "email"
    | "phone"
    | "company"
    | "address"
  | "addressNumber"
    | "city"
    | "state"
    | "cep"
    | "notes"
  >> | null;
}

export default function TechnicianForm({ onSuccess, onCancel, initialTech }: TechnicianFormProps = {}) {
  const { toast } = useToast();
  const isEdit = !!initialTech?.id;
  const form = useForm<TechnicianFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initialTech?.fullName || "",
      creaCau: initialTech?.creaCau || "",
  licenseState: initialTech?.licenseState || "",
      cpfCnpj: initialTech?.cpfCnpj || "",
  email: initialTech?.email || "",
  phone: initialTech?.phone || "",
      company: initialTech?.company || "",
  address: initialTech?.address || "",
  addressNumber: initialTech?.addressNumber || "",
      city: initialTech?.city || "",
      state: initialTech?.state || undefined,
      cep: initialTech?.cep || "",
      notes: initialTech?.notes || "",
    },
    mode: "onSubmit",
  });

  const [submitting, setSubmitting] = useState(false);

  // UF options centralized in @/lib/uf

  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  // Helpers
  const onlyDigits = useCallback((v: string) => v.replace(/\D/g, ""), []);
  const formatPhoneBR = useCallback((v: string) => {
    let d = onlyDigits(v);
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : "";
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }, [onlyDigits]);

  // When Número loses focus, insert/replace it right after the street in the address
  const mergeAddressWithNumber = useCallback((addressRaw: string, numRaw: string) => {
    const address = (addressRaw || "").trim();
    const num = (numRaw || "").trim();
    if (!address && !num) return address;

    // If number is empty: remove any existing number immediately after the street
    if (!num) {
      if (!address) return address;
      const firstCommaIdx = address.indexOf(",");
      if (firstCommaIdx >= 0) {
        const street = address.slice(0, firstCommaIdx).trim();
        let rest = address.slice(firstCommaIdx + 1).trim();
        const match = rest.match(/^([0-9A-Za-z\/\-]+)(?:\s*,\s*|\s+)(.*)$/);
        if (match) {
          const tail = match[2];
          return tail ? `${street}, ${tail}` : `${street}`;
        }
        return address; // no leading number to remove in rest
      }
      // No comma: remove a trailing number-like token, if present
      const withoutNum = address.replace(/(?:,\s*)?[0-9A-Za-z\/\-]+\s*$/, "").trim();
      return withoutNum;
    }

    // Split address into street and the remaining (often neighborhood/city)
    const firstCommaIdx = address.indexOf(",");
    if (firstCommaIdx >= 0) {
      const street = address.slice(0, firstCommaIdx).trim();
      let rest = address.slice(firstCommaIdx + 1).trim();

      // If rest already starts with a number-like token, replace it
      // Token: letters/numbers with optional - or / (e.g., 123, 123A, 12-3, 10/Bloco B)
      const match = rest.match(/^([0-9A-Za-z\/\-]+)(?:\s*,\s*|\s+)(.*)$/);
      if (match) {
        const _existingNum = match[1];
        const tail = match[2];
        return tail ? `${street}, ${num}, ${tail}` : `${street}, ${num}`;
      }
      // Otherwise, insert number between street and rest
      return rest ? `${street}, ${num}, ${rest}` : `${street}, ${num}`;
    }

    // No comma in address: ensure we don't duplicate a trailing number-ish piece
    const streetOnly = address.replace(/,?\s*[0-9A-Za-z\/\-]+\s*$/, "").trim();
    return `${streetOnly}, ${num}`;
  }, []);
  const formatCpfCnpj = useCallback((v: string) => {
    let d = onlyDigits(v).slice(0, 14);
    if (d.length <= 11) {
      // CPF: 000.000.000-00
      d = d.replace(/(\d{3})(\d)/, "$1.$2");
      d = d.replace(/(\d{3})(\d)/, "$1.$2");
      d = d.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      return d;
    }
    // CNPJ: 00.000.000/0000-00
    d = d.replace(/(\d{2})(\d)/, "$1.$2");
    d = d.replace(/(\d{3})(\d)/, "$1.$2");
    d = d.replace(/(\d{3})(\d)/, "$1/$2");
    d = d.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    return d;
  }, [onlyDigits]);
  const formatCep = useCallback((v: string) => {
    const d = onlyDigits(v).slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  }, [onlyDigits]);

  const handleCepLookup = async (cep: string) => {
    if (!cep || cep.length < 8) return;

    setIsLookingUpCep(true);
    try {
  const cleanCep = onlyDigits(cep);
      const response = await fetch(`/api/cep/${cleanCep}`);

      if (response.ok) {
        const data = await response.json();
        // Keep addressNumber intact; only update street/city/state
        form.setValue("address", data.address);
        form.setValue("city", data.city);
        form.setValue("state", data.state);
        toast({ title: "CEP encontrado", description: `${data.city}/${data.state}` });
      } else {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao buscar informações do CEP.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUpCep(false);
    }
  };

  const onSubmit = async (data: TechnicianFormData) => {
    try {
      setSubmitting(true);
      const addressCombined = (() => {
        const base = (data.address || "").trim();
        const num = (data.addressNumber || "").trim();
        if (!base && !num) return undefined;
        if (!num) return base;
        if (!base) return num;
        return `${base}, ${num}`;
      })();

      const payload = {
        fullName: (data.fullName || "").trim(),
        creaCau: (data.creaCau || "").trim(),
  licenseState: data.licenseState ? data.licenseState.trim().toUpperCase() : undefined,
        cpfCnpj: data.cpfCnpj ? onlyDigits(data.cpfCnpj) : undefined,
        email: data.email ? data.email.trim().toLowerCase() : undefined,
  phone: data.phone ? onlyDigits(data.phone) : undefined,
        company: data.company ? data.company.trim() : undefined,
        address: addressCombined,
  addressNumber: data.addressNumber ? data.addressNumber.trim() : undefined,
        city: data.city ? data.city.trim() : undefined,
        state: data.state ? data.state.trim().toUpperCase() : undefined,
        cep: data.cep ? onlyDigits(data.cep) : undefined,
        notes: data.notes ? data.notes.trim() : undefined,
      } as TechnicianFormData & Record<string, any>;

      await (isEdit
        ? apiRequest("PUT", `/api/technicians/${initialTech!.id}` as const, payload)
        : apiRequest("POST", "/api/technicians", payload));
      toast({ title: "Sucesso", description: isEdit ? "Responsável técnico atualizado." : "Responsável técnico cadastrado." });
      onSuccess?.();
    } catch (e) {
      toast({
        title: "Erro",
        description: isEdit ? "Não foi possível atualizar." : "Não foi possível cadastrar.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Format initial values on edit so masks appear immediately
  useEffect(() => {
    if (!isEdit) return;
    if (initialTech?.phone) form.setValue("phone", formatPhoneBR(initialTech.phone));
    if (initialTech?.cpfCnpj) form.setValue("cpfCnpj", formatCpfCnpj(initialTech.cpfCnpj));
    if (initialTech?.cep) form.setValue("cep", formatCep(initialTech.cep));
  }, [isEdit, initialTech, form, formatPhoneBR, formatCpfCnpj, formatCep]);

  // Header initials from full name
  const watchName = form.watch("fullName");
  const initials = (() => {
    const parts = (watchName || "").trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const i = (first + last).toUpperCase();
    return i || "RT"; // Responsável Técnico
  })();

  return (
    <div className="max-w-4xl mx-auto">
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
                  {isEdit ? 'Editar Responsável Técnico' : 'Novo Responsável Técnico'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isEdit ? 'Atualize os dados do responsável técnico selecionado.' : 'Informe os dados do profissional e de contato.'}
                </p>
              </div>
            </div>
          </div>

          {/* CAMPOS - DADOS PROFISSIONAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="fullName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Nome completo" requiredMark>
                        <div className="relative">
                          <User2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <Input {...field} placeholder="Nome do profissional" autoComplete="off" className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                        </div>
                      </NotchedField>
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
                    <FormControl>
                      <NotchedField label="CPF/CNPJ" requiredMark>
                        <Input
                          {...field}
                          placeholder="Informe CPF ou CNPJ"
                          inputMode="numeric"
                          onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </NotchedField>
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
                    <FormControl>
                      <NotchedField label="CREA/CAU" requiredMark>
                        <div className="relative">
                          <IdCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <Input {...field} placeholder="Número do registro" autoComplete="off" className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                        </div>
                      </NotchedField>
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
        <FormControl>
          <NotchedField label="UF do Registro" requiredMark>
      <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
        <SelectTrigger className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </NotchedField>
        </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="company"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormControl>
                      <NotchedField label="Empresa">
                        <Input {...field} placeholder="Opcional" autoComplete="organization" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>

          {/* CAMPOS - CONTATO E ENDEREÇO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="email"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Email" requiredMark>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <Input type="email" {...field} placeholder="email@exemplo.com" className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" autoComplete="off" />
                        </div>
                      </NotchedField>
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
        <FormControl>
          <NotchedField label="Telefone" requiredMark>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                {...field}
                placeholder="(00) 00000-0000"
                className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                inputMode="tel"
                maxLength={15}
                onChange={(e) => field.onChange(formatPhoneBR(e.target.value))}
              />
            </div>
          </NotchedField>
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
                    <FormControl>
                      <NotchedField label="CEP">
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <Input
                            {...field}
                            placeholder="00000-000"
                            className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            inputMode="numeric"
                            maxLength={9}
                            onChange={(e) => field.onChange(formatCep(e.target.value))}
                            onBlur={(e) => {
                              field.onBlur();
                              handleCepLookup(e.target.value);
                            }}
                          />
                        </div>
                      </NotchedField>
                    </FormControl>
                    <FormDescription>
                      {isLookingUpCep
                        ? "Buscando CEP..."
                        : "Digite o CEP para preencher automaticamente"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="address"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormControl>
                      <NotchedField label="Endereço">
                        <Input
                          {...field}
                          placeholder="Rua, bairro"
                          autoComplete="street-address"
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onBlur={(e) => {
                            field.onBlur();
                            const num = form.getValues("addressNumber") || "";
                            const merged = mergeAddressWithNumber(e.currentTarget.value, num);
                            if (merged !== e.currentTarget.value) {
                              form.setValue("address", merged, { shouldDirty: true });
                            }
                          }}
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Número, Cidade e UF na mesma linha */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-12 gap-4">
                <FormField
                  name="addressNumber"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormControl>
                        <NotchedField label="Número">
                          <Input
                            {...field}
                            placeholder="Número"
                            inputMode="numeric"
                            className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            onChange={(e) => {
                              field.onChange(e);
                              const currentNum = e.currentTarget.value;
                              const currentAddress = form.getValues("address") || "";
                              const merged = mergeAddressWithNumber(currentAddress, currentNum);
                              if (merged !== currentAddress) {
                                form.setValue("address", merged, { shouldDirty: true });
                              }
                            }}
                            onBlur={(e) => {
                              field.onBlur();
                              const currentNum = e.currentTarget.value;
                              const currentAddress = form.getValues("address") || "";
                              const merged = mergeAddressWithNumber(currentAddress, currentNum);
                              if (merged !== currentAddress) {
                                form.setValue("address", merged, { shouldDirty: true });
                              }
                            }}
                          />
                        </NotchedField>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="city"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="md:col-span-8">
                      <FormControl>
                        <NotchedField label="Cidade">
                          <Input {...field} autoComplete="address-level2" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                        </NotchedField>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="state"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormControl>
                        <NotchedField label="UF">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {UF_OPTIONS.map((uf) => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </NotchedField>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                name="notes"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormControl>
                      <NotchedField label="Observações">
                        <Input {...field} placeholder="Notas adicionais" autoComplete="off" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-32 rounded-xl">
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
    </div>
  );
}
