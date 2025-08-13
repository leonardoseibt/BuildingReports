import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Calendar, MapPin, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Building } from "@shared/schema";

export default function BuildingList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você não está logado. Fazendo login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: buildings, isLoading, error } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Não autorizado",
        description: "Você foi desconectado. Fazendo login novamente...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getStatusColor = (createdAt: string) => {
    const daysSinceCreated = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated < 7) return "bg-green-100 text-green-700";
    if (daysSinceCreated < 30) return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
  };

  const getStatusText = (createdAt: string) => {
    const daysSinceCreated = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated < 7) return "Recente";
    if (daysSinceCreated < 30) return "Em andamento";
    return "Cadastrado";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex h-screen bg-slate-50" data-testid="building-list-container">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Edificações"
          description="Gerencie suas edificações cadastradas"
          action={
            <Link href="/buildings/new">
              <Button data-testid="button-new-building">
                <Plus className="w-4 h-4 mr-2" />
                Nova Edificação
              </Button>
            </Link>
          }
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-slate-600">Carregando edificações...</p>
              </div>
            </div>
          ) : !buildings || buildings.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2" data-testid="text-no-buildings">
                Nenhuma edificação cadastrada
              </h3>
              <p className="text-slate-500 mb-6">
                Comece cadastrando sua primeira edificação para gerar relatórios de desempenho.
              </p>
              <Link href="/buildings/new">
                <Button size="lg" data-testid="button-create-first-building">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Edificação
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {buildings.map((building) => (
                <Card key={building.id} className="hover:shadow-lg transition-shadow" data-testid={`card-building-${building.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-menu-${building.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Gerar Relatório</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-lg" data-testid={`text-building-name-${building.id}`}>
                      {building.name}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <MapPin className="w-3 h-3" />
                      <span data-testid={`text-building-location-${building.id}`}>
                        {building.bioclimaticZone} • {building.typology}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Área Total:</span>
                      <span className="font-medium" data-testid={`text-building-area-${building.id}`}>
                        {building.totalArea}m²
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Pavimentos:</span>
                      <span className="font-medium" data-testid={`text-building-floors-${building.id}`}>
                        {building.floors}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Responsável:</span>
                      <span className="font-medium truncate ml-2" data-testid={`text-building-responsible-${building.id}`}>
                        {building.technicalResponsible}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center text-xs text-slate-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span data-testid={`text-building-date-${building.id}`}>
                          {formatDate(building.createdAt!)}
                        </span>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(building.createdAt!)}
                        data-testid={`badge-building-status-${building.id}`}
                      >
                        {getStatusText(building.createdAt!)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
