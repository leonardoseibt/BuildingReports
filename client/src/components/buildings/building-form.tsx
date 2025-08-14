import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { insertBuildingSchema, type InsertBuilding } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MapPin, Building2, User, Home } from "lucide-react";
import { z } from "zod";

const buildingFormSchema = insertBuildingSchema.omit({ userId: true }).extend({
  cep: z.string()
    .min(8, "CEP deve ter 8 dígitos")
    .max(9, "CEP deve ter 8 dígitos")
    .regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato 00000-000"),
  totalArea: z.string()
    .min(1, "Área total é obrigatória")
    .transform((val) => parseFloat(val))
    .refine((val) => val > 0, "Área deve ser maior que zero"),
  floors: z.string()
    .min(1, "Número de pavimentos é obrigatório")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, "Número de pavimentos deve ser maior que zero"),
  units: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1),
});

type BuildingFormData = z.infer<typeof buildingFormSchema>;

export default function BuildingForm() {
  const [, navigate] = useLocation();
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: {
      name: '',
      technicalResponsible: '',
      creaCau: '',
      typology: undefined,
      cep: '',
      address: '',
      bioclimaticZone: undefined,
  totalArea: 0,
  floors: 0,
  units: 1,
      noiseClass: undefined,
      aggressivenessClass: undefined,
    },
  });

  const createBuildingMutation = useMutation({
    mutationFn: async (data: BuildingFormData) => {
      const response = await apiRequest('POST', '/api/buildings', data);
      return response.json();
    },
    onSuccess: (building) => {
      toast({
        title: "Sucesso",
        description: "Edificação cadastrada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      navigate(`/buildings`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Não autorizado",
          description: "Você foi desconectado. Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Erro",
        description: "Erro ao cadastrar edificação. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleCepLookup = async (cep: string) => {
    if (!cep || cep.length < 8) return;
    
    setIsLookingUpCep(true);
    try {
      const cleanCep = cep.replace(/\D/g, '');
      const response = await fetch(`/api/cep/${cleanCep}`);
      
      if (response.ok) {
        const data = await response.json();
        form.setValue('address', data.address);
        form.setValue('bioclimaticZone', data.bioclimaticZone);
        toast({
          title: "CEP encontrado",
          description: `Zona bioclimática: ${data.bioclimaticZone}`,
        });
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

  const onSubmit = (data: BuildingFormData) => {
    createBuildingMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto" data-testid="building-form-container">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Basic Information Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle>Informações Básicas</CardTitle>
              </div>
              <CardDescription>
                Dados gerais da edificação e responsável técnico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome do Empreendimento (unchanged position 1) */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Empreendimento *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Residencial Vista Verde"
                          {...field}
                          data-testid="input-building-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipologia Habitacional moves to position 2 */}
                <FormField
                  control={form.control}
                  name="typology"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipologia Habitacional *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-typology">
                            <SelectValue placeholder="Selecione a tipologia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unifamiliar">Unifamiliar</SelectItem>
                          <SelectItem value="multifamiliar">Multifamiliar</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                          <SelectItem value="institucional">Institucional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Responsável Técnico moves to position 3 */}
                <FormField
                  control={form.control}
                  name="technicalResponsible"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável Técnico *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome do engenheiro responsável"
                          {...field}
                          data-testid="input-technical-responsible"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* CREA/CAU moves to position 4 */}
                <FormField
                  control={form.control}
                  name="creaCau"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CREA/CAU *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Número do registro profissional"
                          {...field}
                          data-testid="input-crea-cau"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Location Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-primary" />
                <CardTitle>Localização</CardTitle>
              </div>
              <CardDescription>
                Localização e características ambientais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="00000-000" 
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            handleCepLookup(e.target.value);
                          }}
                          data-testid="input-cep"
                        />
                      </FormControl>
                      <FormDescription>
                        {isLookingUpCep ? "Buscando informações..." : "A zona bioclimática será determinada automaticamente"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="bioclimaticZone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona Bioclimática</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Determinada automaticamente" 
                          {...field}
                          readOnly
                          className="bg-slate-100"
                          data-testid="input-bioclimatic-zone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço Completo *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Rua, número, bairro, cidade, estado" 
                        {...field}
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Physical Characteristics */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Home className="w-5 h-5 text-primary" />
                <CardTitle>Características Físicas</CardTitle>
              </div>
              <CardDescription>
                Dimensões e características construtivas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="totalArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área Total Construída (m²) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="1" 
                          placeholder="0.00" 
                          {...field}
                          data-testid="input-total-area"
                        />
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
                      <FormLabel>Número de Pavimentos *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="50" 
                          placeholder="1" 
                          {...field}
                          data-testid="input-floors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Unidades</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="1" 
                          {...field}
                          data-testid="input-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Environmental Context */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>Caracterização do Entorno</CardTitle>
              </div>
              <CardDescription>
                Condições ambientais e de exposição
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="noiseClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe de Ruído do Entorno *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-noise-class">
                            <SelectValue placeholder="Selecione a classe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="classe1">Classe I - Áreas de sítios e fazendas</SelectItem>
                          <SelectItem value="classe2">Classe II - Área estritamente residencial</SelectItem>
                          <SelectItem value="classe3">Classe III - Área mista com vocação comercial</SelectItem>
                          <SelectItem value="classe4">Classe IV - Área mista com vocação recreacional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="aggressivenessClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe de Agressividade Ambiental *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-aggressiveness-class">
                            <SelectValue placeholder="Selecione a classe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="caa1">CAA I - Ambiente rural/urbano</SelectItem>
                          <SelectItem value="caa2">CAA II - Ambiente urbano</SelectItem>
                          <SelectItem value="caa3">CAA III - Ambiente marinho/industrial</SelectItem>
                          <SelectItem value="caa4">CAA IV - Ambiente industrial/marinho</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/buildings')}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createBuildingMutation.isPending}
              data-testid="button-save-building"
            >
              {createBuildingMutation.isPending ? "Salvando..." : "Salvar e Continuar"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
