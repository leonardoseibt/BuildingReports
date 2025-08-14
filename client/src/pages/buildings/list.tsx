import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import BuildingForm from "@/components/buildings/building-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Calendar, MapPin, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Building } from "@shared/schema";

export default function BuildingList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);

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

  const getStatusColor = (createdAt: string | Date) => {
    const ts = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
    const daysSinceCreated = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated < 7) return "bg-green-100 text-green-700";
    if (daysSinceCreated < 30) return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
  };

  const getStatusText = (createdAt: string | Date) => {
    const ts = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
    const daysSinceCreated = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated < 7) return "Recente";
    if (daysSinceCreated < 30) return "Em andamento";
    return "Cadastrado";
  };

  const formatDate = (dateStr: string | Date) => {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex h-screen bg-slate-50" data-testid="building-list-container">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Edificações"
          description="Gerencie suas edificações cadastradas"
          action={
            <Button data-testid="button-new-building" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Edificação
            </Button>
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
              <Button
                size="lg"
                data-testid="button-create-first-building"
                onClick={() => setOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Edificação
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Área</TableHead>
                    <TableHead className="text-right">Pav.</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildings.map((building) => (
                    <TableRow key={building.id} data-testid={`row-building-${building.id}`}>
                      <TableCell className="font-medium" data-testid={`text-building-name-${building.id}`}>
                        {building.name}
                      </TableCell>
                      <TableCell className="flex items-center gap-1" data-testid={`text-building-location-${building.id}`}>
                        <MapPin className="w-3 h-3" />
                        {building.bioclimaticZone} • {building.typology}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-building-area-${building.id}`}>
                        {building.totalArea}m²
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-building-floors-${building.id}`}>
                        {building.floors}
                      </TableCell>
                      <TableCell className="truncate" data-testid={`text-building-responsible-${building.id}`}>
                        {building.technicalResponsible}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" data-testid={`text-building-date-${building.id}`}>
                          <Calendar className="w-3 h-3" /> {formatDate(building.createdAt!)}
                          <Badge
                            variant="secondary"
                            className={getStatusColor(building.createdAt!)}
                            data-testid={`badge-building-status-${building.id}`}
                          >
                            {getStatusText(building.createdAt!)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-menu-${building.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Gerar Relatório</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-2 px-6">
            <DialogHeader className="mb-4">
              <DialogTitle>Nova Edificação</DialogTitle>
            </DialogHeader>
            <BuildingForm onSuccess={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
