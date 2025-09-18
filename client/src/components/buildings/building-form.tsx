import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { insertBuildingSchema, type Technician, type Building, type BioclimaticZone, type Isopleth } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showSuccess, showError } from "@/lib/toast-messages";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { MapPin, Building2, User, Home, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { invalidateDashboard } from '../../lib/invalidateDashboard';

// Form schema (normalized address fields)
const buildingFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  technicianId: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === 'string' ? Number(v) : v
  ).refine((v) => !!v, 'Responsável técnico é obrigatório'),
  typologyId: z.union([z.string(), z.number()]).transform((v)=> typeof v==='string'? Number(v): v).optional(),
  cep: z.string()
    .min(8, "CEP deve ter 8 dígitos")
    .max(9, "CEP deve ter 8 dígitos")
    .regex(/^[0-9]{5}-?[0-9]{3}$/i, "CEP deve estar no formato 00000-000"),
  street: z.string().min(1, 'Logradouro é obrigatório'),
  addressNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2, 'UF deve ter 2 letras').optional(),
  bioclimaticZone: z.string().optional(),
  isoplethCode: z.string().optional(),
  totalArea: z.string()
    .min(1, "Área total é obrigatória")
    .transform((val) => parseFloat(val))
    .refine((val) => val > 0, "Área deve ser maior que zero"),
  buildingHeight: z.string().optional().transform((v) => v && v.trim() !== '' ? parseFloat(v) : undefined),
  floors: z.string()
    .min(1, "Número de pavimentos é obrigatório")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, "Número de pavimentos deve ser maior que zero"),
  units: z.union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 1; // default
      return typeof val === 'string' ? parseInt(val, 10) : val;
    })
    .refine((val) => typeof val === 'number' && !Number.isNaN(val) && val >= 1, 'Número de unidades deve ser >= 1'),
  noiseClassId: z.union([z.string(), z.number()]).transform((v)=> typeof v==='string'? Number(v): v).optional(),
  aggressivenessClassId: z.union([z.string(), z.number()]).transform((v)=> typeof v==='string'? Number(v): v).optional(),
});

type BuildingFormData = z.infer<typeof buildingFormSchema>;

interface BuildingFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  building?: Building | null;
}

export default function BuildingForm({ onSuccess, onCancel, building }: BuildingFormProps = {}) {
  const [, navigate] = useLocation();
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [zoneLocked, setZoneLocked] = useState(false);
  const [isoplethLocked, setIsoplethLocked] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: technicians } = useQuery<Technician[]>({ queryKey: ['/api/technicians'] });
  const { data: typologies } = useQuery<any[]>({ queryKey: ['/api/typologies'] });
  const { data: noiseClasses } = useQuery<any[]>({ queryKey: ['/api/noise-classes'] });
  const { data: aggressiveness } = useQuery<any[]>({ queryKey: ['/api/aggressiveness-classes'] });
  const { data: zones = [] } = useQuery<BioclimaticZone[]>({ queryKey: ['/api/bioclimatic-zones'] });
  const { data: isopleths = [] } = useQuery<Isopleth[]>({ queryKey: ['/api/isopleths'] });
  const { data: states = [], isLoading: loadingStates } = useQuery<{ id:number; code:string; name:string; region?: string; createdAt?: string; }[]>({
    queryKey: ['/api/states'],
    queryFn: async () => { const r = await fetch('/api/states'); if (!r.ok) throw new Error('Falha ao carregar estados'); return r.json(); },
    staleTime: 1000 * 60 * 60,
  });
  const [openTech, setOpenTech] = useState(false);
  const [openZone, setOpenZone] = useState(false);

  // Helpers
  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const formatCep = (v: string) => {
    const d = onlyDigits(v).slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  };

  const form = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: {
      name: '',
      technicianId: undefined as any,
      typologyId: undefined as any,
      cep: '',
      street: '',
      addressNumber: '',
      neighborhood: '',
      city: '',
      state: undefined,
      bioclimaticZone: undefined as any,
  isoplethCode: undefined as any,
      totalArea: 0 as any,
      buildingHeight: undefined as any,
      floors: 0 as any,
      units: 1 as any,
      noiseClassId: undefined as any,
      aggressivenessClassId: undefined as any,
    },
    mode: "onSubmit",
  });

  // Prefill when editing
  useEffect(() => {
    if (!building) {
      form.reset({
        name: '', technicianId: undefined as any, typologyId: undefined as any,
        cep: '', street: '', addressNumber: '', neighborhood: '', city: '', state: undefined,
        bioclimaticZone: undefined as any,
  isoplethCode: undefined as any,
        totalArea: 0 as any, buildingHeight: undefined as any, floors: 0 as any, units: 1 as any,
        noiseClassId: undefined as any, aggressivenessClassId: undefined as any,
      });
      return;
    }
    form.reset({
      name: building.name || '',
      technicianId: (building as any).technicianId as any,
      typologyId: (building as any).typologyId ?? undefined,
      cep: building.cep || '',
  street: (building as any).street || '',
      addressNumber: (building as any).addressNumber || '',
      neighborhood: (building as any).neighborhood || '',
      city: (building as any).city || '',
      state: (building as any).state || undefined,
      bioclimaticZone: (building.bioclimaticZone as any) || undefined,
  isoplethCode: (building as any).isoplethCode || undefined,
      totalArea: String(building.totalArea) as any,
      buildingHeight: (building as any).buildingHeight != null ? String((building as any).buildingHeight) as any : undefined,
      floors: String(building.floors) as any,
      units: String(building.units ?? 1) as any,
      noiseClassId: (building as any).noiseClassId ?? undefined,
      aggressivenessClassId: (building as any).aggressivenessClassId ?? undefined,
    });
    const preCep = building.cep || '';
    const d = onlyDigits(preCep);
    if (d.length >= 8) {
      handleCepLookup(preCep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building]);

  // On first open, if CEP is already filled
  const didInitialCepCheck = useRef(false);
  useEffect(() => {
    if (didInitialCepCheck.current) return;
    didInitialCepCheck.current = true;
    const pre = form.getValues('cep');
    const d = onlyDigits(pre || '');
    if (d.length >= 8) {
      handleCepLookup(pre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBuildingMutation = useMutation({
    mutationFn: async (data: BuildingFormData) => {
      const response = await apiRequest('POST', '/api/buildings', data);
      return response.json();
    },
    onSuccess: () => {
      showSuccess(toast, 'Edificação cadastrada com sucesso!');
  queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
  invalidateDashboard(queryClient);
      onSuccess?.();
      navigate('/buildings');
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: 'Sessão finalizada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 400);
        return;
      }
        showError(toast, 'Erro ao cadastrar edificação. Tente novamente.');
    },
  });

  const handleCepLookup = async (cep: string) => {
    if (!cep || cep.length < 8) return;

    setIsLookingUpCep(true);
    try {
      const cleanCep = onlyDigits(cep);
      const response = await fetch(`/api/cep/${cleanCep}`);

      if (response.ok) {
        const data = await response.json();
        if (data.address) form.setValue('street', data.address);
        if (data.neighborhood) form.setValue('neighborhood', data.neighborhood);
        if (data.city) form.setValue('city', data.city);
        if (data.state) form.setValue('state', data.state);
        form.setValue('bioclimaticZone', data.bioclimaticZone);
        setZoneLocked(true);
        if (data.isoplethCode) {
          form.setValue('isoplethCode', data.isoplethCode);
          setIsoplethLocked(true);
        } else {
          setIsoplethLocked(false);
        }
        toast({
          title: "CEP encontrado",
          description: `Zona: ${data.bioclimaticZone}${data.isoplethCode ? ' • Isopleta: '+data.isoplethCode : ''}`,
        });
      } else {
  setZoneLocked(false);
  setIsoplethLocked(false);
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setZoneLocked(false);
      showError(toast, "Erro ao buscar informações do CEP.");
    } finally {
      setIsLookingUpCep(false);
    }
  };

  const updateBuildingMutation = useMutation({
    mutationFn: async (data: BuildingFormData) => {
      if (!building) throw new Error('No building to update');
      const response = await apiRequest('PUT', `/api/buildings/${building.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      showSuccess(toast, 'Edificação atualizada com sucesso!');
  queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
  invalidateDashboard(queryClient);
      onSuccess?.();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: 'Sessão finalizada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/login'; }, 400);
        return;
      }
      showError(toast, 'Erro ao atualizar edificação. Tente novamente.');
    },
  });

  const onSubmit = (data: BuildingFormData) => {
    if (building) updateBuildingMutation.mutate(data);
    else createBuildingMutation.mutate(data);
  };

  // Header initials
  const watchName = form.watch('name');
  const initials = useMemo(() => {
    const parts = (watchName || '').trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    const i = (first + last).toUpperCase();
    return i || 'ED';
  }, [watchName]);

  return (
    <div className="max-w-4xl mx-auto" data-testid="building-form-container">
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
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{building ? 'Editar Edificação' : 'Nova Edificação'}</h2>
                <p className="text-sm text-slate-500">Informe os dados gerais, localização e características.</p>
              </div>
            </div>
          </div>

          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NotchedField label="Nome do Empreendimento" requiredMark>
                      <Input
                        placeholder="Ex: Residencial Vista Verde"
                        {...field}
                        data-testid="input-building-name"
                        className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="typologyId"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NotchedField label="Tipo de Uso Habitacional" requiredMark>
                      <Combobox
                        options={(typologies || [])
                          .filter((t: any) => t.isActive !== false)
                          .slice()
                          .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }))
                          .map((t: any) => ({ value: String(t.id), label: t.label }))}
                        value={field.value ? String(field.value) : undefined}
                        onChange={field.onChange}
                        placeholder="Selecione o tipo de uso"
                        triggerTestId="select-typology"
                        className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 h-8 px-2"
                      />
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormControl>
                    <NotchedField label="Responsável Técnico" requiredMark>
                      <Popover open={openTech} onOpenChange={setOpenTech}>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between border-0 bg-transparent shadow-none h-8 px-2"
                            data-testid="input-technical-responsible"
                          >
                            {field.value
                              ? technicians?.find((t) => t.id === Number(field.value))?.fullName
                              : "Selecione o responsável"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Procurar..." />
                            <CommandList>
                              <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                              <CommandGroup>
                                {technicians?.map((tech) => (
                                  <CommandItem
                                    key={tech.id}
                                    value={tech.fullName}
                                    onSelect={() => {
                                      form.setValue('technicianId', tech.id as any);
                                      setOpenTech(false);
                                    }}
                                  >
                                    {tech.fullName}
                                    <Check
                                      className={cn(
                                        'ml-auto h-4 w-4',
                                        Number(field.value) === tech.id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Localização */}
          <div className="space-y-4">
            {/* Linha 1: CEP (2) + Zona Bioclimática (5) + Isopleta (5) => total 12 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormControl>
                      <NotchedField label="CEP" requiredMark>
                        <Input
                          placeholder="00000-000"
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          inputMode="numeric"
                          maxLength={9}
                          onChange={(e) => {
                            const formatted = formatCep(e.target.value);
                            field.onChange(formatted);
                            const only = formatted.replace(/\D/g, "");
                            if (only.length < 8) setZoneLocked(false);
                          }}
                          onBlur={(e) => { field.onBlur(); handleCepLookup(e.target.value); }}
                          data-testid="input-cep"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bioclimaticZone"
                render={({ field }) => (
                  <FormItem className="md:col-span-5">
                    <FormControl>
                      <NotchedField label="Zona Bioclimática">
                        <Popover open={openZone} onOpenChange={(v) => { if (!zoneLocked) setOpenZone(v); }}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between border-0 bg-transparent shadow-none h-8 px-2 text-left font-normal"
                              data-testid="input-bioclimatic-zone"
                              disabled={zoneLocked}
                            >
                              {(() => {
                                const code = form.watch('bioclimaticZone') as string | undefined;
                                const z = zones.find((zz) => zz.code === code);
                                return z ? `${z.code} - ${z.label}` : (code || 'Selecione ou busque…');
                              })()}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar zona…" />
                              <CommandList className="max-h-64 overflow-y-auto overflow-x-hidden" onWheel={(e) => e.stopPropagation()}>
                                <CommandEmpty>Nenhuma zona encontrada.</CommandEmpty>
                                <CommandGroup>
                                  {zones.map((z) => (
                                    <CommandItem
                                      key={z.id}
                                      value={`${z.code} - ${z.label}`}
                                      onSelect={() => { form.setValue('bioclimaticZone', z.code as any, { shouldDirty: true }); setOpenZone(false); }}
                                    >
                                      {z.code} - {z.label}
                                      <Check className={cn('ml-auto h-4 w-4', (form.getValues('bioclimaticZone') || '') === z.code ? 'opacity-100' : 'opacity-0')} />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                    {isLookingUpCep && <p className="text-xs text-slate-500 mt-1">Buscando informações...</p>}
                    {(!isLookingUpCep && zoneLocked) && <p className="text-xs text-slate-500 mt-1">Determinada pelo CEP.</p>}
                    {(!isLookingUpCep && !zoneLocked) && <p className="text-xs text-slate-500 mt-1">Selecione manualmente se necessário.</p>}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isoplethCode"
                render={({ field }) => (
                  <FormItem className="md:col-span-5">
                    <FormControl>
                    <NotchedField label="Isopleta">
                      <Combobox
                        options={(isopleths || [])
                          .slice()
                          .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true }))
                          .map((i: any) => {
                            const min = i.windMinMS != null ? parseFloat(i.windMinMS as any) : null;
                            const max = i.windMaxMS != null ? parseFloat(i.windMaxMS as any) : null;
                            const fmt = (v: number | null) => (v == null || Number.isNaN(v) ? null : v.toFixed(2).replace(/\.00$/, ''));
                            const range = (() => {
                              const fmin = fmt(min);
                              const fmax = fmt(max);
                              if (fmin && fmax) return ` (${fmin}–${fmax} m/s)`;
                              if (fmin) return ` (>= ${fmin} m/s)`;
                              if (fmax) return ` (<= ${fmax} m/s)`;
                              return '';
                            })();
                            return { value: i.code, label: `${i.code} - ${i.label}${range}` };
                          })}
                        value={field.value ? String(field.value) : undefined}
                        onChange={field.onChange}
                        placeholder="Selecione a isopleta"
                        triggerTestId="select-isopleth"
                        className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 h-8 px-2"
                        disabled={isoplethLocked}
                      />
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                  {isoplethLocked && <p className="text-xs text-slate-500 mt-1">Determinada pelo CEP.</p>}
                </FormItem>
              )}
              />
            </div>
            {/* Linha 2: Logradouro + Número */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem className="md:col-span-8">
                    <FormControl>
                      <NotchedField label="Logradouro" requiredMark>
                        <Input
                          placeholder="Rua / Avenida"
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressNumber"
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormControl>
                      <NotchedField label="Número">
                        <Input
                          placeholder="Número"
                          {...field}
                          inputMode="numeric"
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Linha: Bairro, Cidade, UF */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem className="md:col-span-5">
                    <FormControl>
                      <NotchedField label="Bairro">
                        <Input
                          placeholder="Bairro"
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="md:col-span-5">
                    <FormControl>
                      <NotchedField label="Cidade">
                        <Input
                          placeholder="Cidade"
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormControl>
                      <NotchedField label="UF">
                        <Combobox
                          options={states
                            .slice()
                            .sort((a, b) => a.code.localeCompare(b.code))
                            .map((st) => ({ value: st.code, label: st.code }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={loadingStates ? 'Carregando...' : 'UF'}
                          className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 h-8 px-2"
                        />
                      </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
          </div>

          {/* Características Físicas */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="totalArea"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Área Total Construída (m²)" requiredMark>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="1" 
                          placeholder="0.00" 
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          data-testid="input-total-area"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buildingHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Altura da Edificação (m)">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="0.00" 
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="floors"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Número de Pavimentos" requiredMark>
                        <Input 
                          type="number" 
                          min="1" 
                          max="50" 
                          placeholder="1" 
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          data-testid="input-floors"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormControl>
                      <NotchedField label="Número de Unidades">
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="1" 
                          {...field}
                          className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          data-testid="input-units"
                        />
                      </NotchedField>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Caracterização do Entorno */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="noiseClassId"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NotchedField label="Classe de Ruído" requiredMark className="w-full">
                      <Combobox
                        options={(noiseClasses || [])
                          .filter((t: any) => t.isActive !== false)
                          .slice()
                          .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true }))
                          .map((t: any) => ({ value: String(t.id), label: `${t.code} - ${t.label}` }))}
                        value={field.value ? String(field.value) : undefined}
                        onChange={field.onChange}
                        placeholder="Selecione a classe"
                        triggerTestId="select-noise-class"
                        className="w-full border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 px-2 min-h-14 items-start whitespace-normal"
                        labelClassName="line-clamp-2"
                      />
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aggressivenessClassId"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NotchedField label="Classe de Agressividade Ambiental" requiredMark className="w-full">
                      <Combobox
                        options={(aggressiveness || [])
                          .filter((t: any) => t.isActive !== false)
                          .slice()
                          .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true }))
                          .map((t: any) => ({
                            value: String(t.id),
                            label: `${t.code} - ${t.label}${t.risk ? ' (' + t.risk + ')' : ''}`,
                          }))}
                        value={field.value ? String(field.value) : undefined}
                        onChange={field.onChange}
                        placeholder="Selecione a classe"
                        triggerTestId="select-aggressiveness-class"
                        className="w-full border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 px-2 min-h-14 items-start whitespace-normal"
                        labelClassName="line-clamp-2"
                      />
                    </NotchedField>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* AÇÕES */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel ?? (() => navigate('/buildings'))} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={createBuildingMutation.isPending || updateBuildingMutation.isPending} className="min-w-32 rounded-xl" data-testid="button-save-building">
              {createBuildingMutation.isPending || updateBuildingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
