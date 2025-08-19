import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import BuildingForm from "@/components/buildings/building-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Building2, Plus, MapPin, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Building, Technician } from "@shared/schema";

export default function BuildingList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editBuilding, setEditBuilding] = useState<Building | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

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

  const { data: buildings = [], isLoading, isFetching, error } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    enabled: isAuthenticated,
  });

  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ['/api/technicians'],
    enabled: isAuthenticated,
  });

  // Ensure master data is loaded before opening the form
  async function prefetchMasters() {
    try {
      await Promise.all([
        queryClient.ensureQueryData({ queryKey: ['/api/typologies'] }),
        queryClient.ensureQueryData({ queryKey: ['/api/noise-classes'] }),
        queryClient.ensureQueryData({ queryKey: ['/api/aggressiveness-classes'] }),
        queryClient.ensureQueryData({ queryKey: ['/api/technicians'] }),
      ]);
    } catch (_) {
      // ignore prefetch errors; form will fetch as usual
    }
  }

  const techNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const t of technicians || []) {
      if (t?.id != null) map[t.id] = t.fullName;
    }
    return map;
  }, [technicians]);

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

  // Delete mutation with optimistic update
  async function deleteBuildingRequest(id: number) {
    const res = await fetch(`/api/buildings/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (b: Building) => deleteBuildingRequest(b.id),
    onMutate: async (b) => {
      await queryClient.cancelQueries({ queryKey: ["/api/buildings"] });
      const prev = queryClient.getQueryData<Building[]>(["/api/buildings"]) || [];
      queryClient.setQueryData<Building[]>(["/api/buildings"], prev.filter(x => x.id !== b.id));
      return { prev };
    },
    onError: (err, _b, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/buildings"], ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSuccess: (_data, b) => {
      toast({ title: 'Edificação excluída', description: `${b.name} foi removida.` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buildings"], refetchType: 'inactive' });
    }
  });

  function askDelete(b: Building) { setSelectedBuilding(b); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedBuilding) return; deleteMutation.mutate(selectedBuilding); setConfirmOpen(false); setSelectedBuilding(null); }

  return (
    <div className="flex h-screen bg-slate-50" data-testid="building-list-container">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Edificações"
          description="Gerencie suas edificações cadastradas"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button data-testid="button-new-building" onClick={async () => { await prefetchMasters(); setEditBuilding(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Edificação
              </Button>
            </div>
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
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead className="w-[20%] whitespace-nowrap max-sm:whitespace-normal">Nome</TableHead>
                    <TableHead className="w-[20%] whitespace-nowrap max-sm:whitespace-normal">Localização</TableHead>
                    <TableHead className="w-[10%] text-right whitespace-nowrap">Área</TableHead>
                    <TableHead className="w-[8%] text-right whitespace-nowrap">Pav.</TableHead>
                    <TableHead className="w-[20%] whitespace-nowrap max-sm:whitespace-normal">Responsável</TableHead>
                    <TableHead className="w-[14%] whitespace-nowrap max-sm:whitespace-normal">Criado em</TableHead>
                    <TableHead className="w-[8%] text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildings.map((building) => (
                    <TableRow key={building.id} data-testid={`row-building-${building.id}`}>
                      <TableCell className="w-[24%] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal" data-testid={`text-building-name-${building.id}`}>
                        {building.name}
                      </TableCell>
                      <TableCell className="w-[20%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal" data-testid={`text-building-location-${building.id}`}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {building.bioclimaticZone} • {(building as any).typologyLabel || (building as any).typologyCode || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="w-[10%] text-right" data-testid={`text-building-area-${building.id}`}>
                        {building.totalArea}m²
                      </TableCell>
                      <TableCell className="w-[8%] text-right" data-testid={`text-building-floors-${building.id}`}>
                        {building.floors}
                      </TableCell>
                      <TableCell className="w-[20%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal" data-testid={`text-building-responsible-${building.id}`}>
                        {building.technicianId ? (techNameById[building.technicianId] ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="w-[10%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal">
                        <div className="flex items-center gap-2" data-testid={`text-building-date-${building.id}`}>
                          <span>{formatDate(building.createdAt!)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-[8%] text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${building.name}`}
                            title="Editar"
                            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            onClick={async () => { await prefetchMasters(); setEditBuilding(building); setFormKey(k => k + 1); setOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${building.name}`}
                            title="Excluir"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => askDelete(building)}
                            disabled={deleteMutation.isPending && selectedBuilding?.id === building.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>
  <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditBuilding(null); setOpen(v); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
    <BuildingForm key={formKey} building={editBuilding} onSuccess={() => { setEditBuilding(null); setOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/buildings"] }); }} onCancel={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir edificação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedBuilding ? (
                <strong>{` ${selectedBuilding.name} `}</strong>
              ) : (
                "esta edificação"
              )}
              ? Essa ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedBuilding(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
