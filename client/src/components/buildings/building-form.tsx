import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { insertBuildingSchema, type Technician, type Building, type BioclimaticZone } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, User, Home, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { z } from "zod";

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
  totalArea: z.string()
    .min(1, "Área total é obrigatória")
    .transform((val) => parseFloat(val))
    .refine((val) => val > 0, "Área deve ser maior que zero"),
  buildingHeight: z.string().optional().transform((v) => v && v.trim() !== '' ? parseFloat(v) : undefined),
  floors: z.string()
    .min(1, "Número de pavimentos é obrigatório")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, "Número de pavimentos deve ser maior que zero"),
  units: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1),
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: technicians } = useQuery<Technician[]>({ queryKey: ['/api/technicians'] });
  const { data: typologies } = useQuery<any[]>({ queryKey: ['/api/typologies'] });
  const { data: noiseClasses } = useQuery<any[]>({ queryKey: ['/api/noise-classes'] });
  const { data: aggressiveness } = useQuery<any[]>({ queryKey: ['/api/aggressiveness-classes'] });
  const { data: zones = [] } = useQuery<BioclimaticZone[]>({ queryKey: ['/api/bioclimatic-zones'] });
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
      street: (building as any).street || (building as any).address || '',
      addressNumber: (building as any).addressNumber || '',
      neighborhood: (building as any).neighborhood || '',
      city: (building as any).city || '',
      state: (building as any).state || undefined,
      bioclimaticZone: (building.bioclimaticZone as any) || undefined,
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
      toast({ title: 'Sucesso', description: 'Edificação cadastrada com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onSuccess?.();
      navigate('/buildings');
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: 'Não autorizado', description: 'Você foi desconectado. Fazendo login novamente...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/api/login'; }, 500);
        return;
      }
      toast({ title: 'Erro', description: 'Erro ao cadastrar edificação. Tente novamente.', variant: 'destructive' });
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
        toast({
          title: "CEP encontrado",
          description: `Zona bioclimática: ${data.bioclimaticZone}`,
        });
      } else {
        setZoneLocked(false);
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setZoneLocked(false);
      toast({
        title: "Erro",
        description: "Erro ao buscar informações do CEP.",
        variant: "destructive",
      });
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
      toast({ title: 'Sucesso', description: 'Edificação atualizada com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onSuccess?.();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: 'Não autorizado', description: 'Você foi desconectado. Fazendo login novamente...', variant: 'destructive' });
        setTimeout(() => { window.location.href = '/api/login'; }, 500);
        return;
      }
      toast({ title: 'Erro', description: 'Erro ao atualizar edificação. Tente novamente.', variant: 'destructive' });
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
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-typology" className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Selecione o tipo de uso">
                              {(() => {
                                const sel = (typologies || []).find((t:any) => String(t.id) === String(field.value));
                                return sel ? sel.label : undefined;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(typologies || []).filter((t:any)=>t.isActive!==false).map((t:any)=> (
                            <SelectItem key={t.id} value={String(t.id)}>{t.label}</SelectItem>
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
                            className="w-full justify-between border-0 bg-transparent shadow-none"
                            data-testid="input-technical-responsible"
                          >
                            {field.value
                              ? technicians?.find((t) => t.id === Number(field.value))?.fullName
                              : "Selecione o responsável"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Procurar..." />
                            <CommandList>
                              <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                              <CommandGroup>
                                {technicians?.map((tech) => (
                                  <CommandItem
                                    key={tech.id}
                                    value={String(tech.id)}
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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
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
                            if (only.length < 8) {
                              setZoneLocked(false);
                            }
                          }}
                          onBlur={(e) => {
                            field.onBlur();
                            handleCepLookup(e.target.value);
                          }}
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
                name="street"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
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
                  <FormItem className="md:col-span-1">
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

              <FormField
                control={form.control}
                name="bioclimaticZone"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormControl>
                      <NotchedField label="Zona Bioclimática">
                        <Popover open={openZone} onOpenChange={(v) => { if (!zoneLocked) setOpenZone(v); }}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between border-0 bg-transparent shadow-none"
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
                                      onSelect={() => {
                                        form.setValue('bioclimaticZone', z.code as any, { shouldDirty: true });
                                        setOpenZone(false);
                                      }}
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
                    <FormDescription>
                      {isLookingUpCep
                        ? "Buscando informações..."
                        : zoneLocked
                          ? "Determinada automaticamente pelo CEP (bloqueada)."
                          : "CEP não encontrado — selecione manualmente."}
                    </FormDescription>
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
                        <Input
                          placeholder="UF"
                          maxLength={2}
                          {...field}
                          className="uppercase bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="noiseClassId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Classe de Ruído do Entorno" requiredMark>
                        <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-noise-class" className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                              <SelectValue placeholder="Selecione a classe">
                                {(() => {
                                  const sel = (noiseClasses || []).find((t:any) => String(t.id) === String(field.value));
                                  return sel ? `${sel.code} - ${sel.label}` : undefined;
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(noiseClasses || []).filter((t:any)=>t.isActive!==false).map((t:any)=> (
                              <SelectItem key={t.id} value={String(t.id)}>{`${t.code} - ${t.label}`}</SelectItem>
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
                control={form.control}
                name="aggressivenessClassId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NotchedField label="Classe de Agressividade Ambiental" requiredMark>
                        <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-aggressiveness-class" className="border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                              <SelectValue placeholder="Selecione a classe">
                                {(() => {
                                  const sel = (aggressiveness || []).find((t:any) => String(t.id) === String(field.value));
                                  return sel ? `${sel.code} - ${sel.label}` : undefined;
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(aggressiveness || []).filter((t:any)=>t.isActive!==false).map((t:any)=> (
                              <SelectItem key={t.id} value={String(t.id)}>{`${t.code} - ${t.label}`}</SelectItem>
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
