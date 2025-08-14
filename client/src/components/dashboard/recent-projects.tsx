import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Building } from "@shared/schema";

export default function RecentProjects() {
  const { data: buildings, isLoading } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

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
    if (daysSinceCreated < 7) return "Completo";
    if (daysSinceCreated < 30) return "Em análise";
    return "Cadastro";
  };

  const getRelativeTime = (createdAt: string | Date) => {
    const ts = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
    const daysSinceCreated = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated === 0) return "Hoje";
    if (daysSinceCreated === 1) return "Ontem";
    if (daysSinceCreated < 7) return `${daysSinceCreated} dias atrás`;
    if (daysSinceCreated < 30) return `${Math.floor(daysSinceCreated / 7)} semanas atrás`;
    return `${Math.floor(daysSinceCreated / 30)} meses atrás`;
  };

  const recentBuildings = buildings?.slice(0, 3) || [];

  return (
    <Card className="shadow-sm border-slate-200" data-testid="card-recent-projects">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Projetos Recentes</CardTitle>
          <Link href="/buildings">
            <Button variant="ghost" size="sm" data-testid="link-view-all-projects">
              Ver todos
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>
        ) : recentBuildings.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">Nenhum projeto encontrado</p>
            <Link href="/buildings/new">
              <Button size="sm" data-testid="button-create-first-project">
                Criar Primeiro Projeto
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentBuildings.map((building) => (
              <div 
                key={building.id} 
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                data-testid={`project-item-${building.id}`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900" data-testid={`text-project-name-${building.id}`}>
                      {building.name}
                    </h4>
                    <p className="text-sm text-slate-500" data-testid={`text-project-location-${building.id}`}>
                      {building.bioclimaticZone} • {building.typology}
                    </p>
                    <p className="text-xs text-slate-400" data-testid={`text-project-time-${building.id}`}>
                      Atualizado {getRelativeTime(building.createdAt!)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge 
                    variant="secondary" 
                    className={getStatusColor(building.createdAt!)}
                    data-testid={`badge-project-status-${building.id}`}
                  >
                    {getStatusText(building.createdAt!)}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600" data-testid={`button-project-menu-${building.id}`}>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
