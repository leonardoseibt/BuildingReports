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
import { Building2, Plus, MapPin, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
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
import { PaginationSimple as Pagination } from "@/components/ui/pagination";
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "location" | "totalArea" | "floors" | "technician" | "createdAt" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 15;
  const [page, setPage] = useState(1);

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

  // Helpers for filtering/sorting
  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return buildings;
    return buildings.filter((b) => {
      const name = normText(b.name);
      const typology = normText((b as any).typologyLabel || (b as any).typologyCode || "");
      const zone = normText(b.bioclimaticZone || "");
      const responsible = normText(b.technicianId ? (techNameById[b.technicianId] ?? "") : "");
      const created = normText(b.createdAt as any);
      return (
        name.includes(q) ||
        typology.includes(q) ||
        zone.includes(q) ||
        responsible.includes(q) ||
        created.includes(q)
      );
    });
  }, [buildings, search, techNameById]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'createdAt') {
        const ad = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        cmp = ad - bd;
      } else if (sortBy === 'totalArea' || sortBy === 'floors') {
        cmp = Number((a as any)[sortBy] ?? 0) - Number((b as any)[sortBy] ?? 0);
      } else if (sortBy === 'technician') {
        const an = a.technicianId ? (techNameById[a.technicianId] ?? '') : '';
        const bn = b.technicianId ? (techNameById[b.technicianId] ?? '') : '';
        cmp = an.localeCompare(bn, 'pt-BR', { sensitivity: 'base' });
      } else if (sortBy === 'location') {
        const al = `${a.bioclimaticZone || ''} ${(a as any).typologyLabel || (a as any).typologyCode || ''}`;
        const bl = `${b.bioclimaticZone || ''} ${(b as any).typologyLabel || (b as any).typologyCode || ''}`;
        cmp = al.localeCompare(bl, 'pt-BR', { sensitivity: 'base' });
      } else {
        const av = (a as any)[sortBy];
        const bv = (b as any)[sortBy];
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir, techNameById]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedBuildings = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);

  const toggleSort = (col: typeof sortBy) => {
    if (col === null) return;
    if (sortBy !== col) {
      setSortBy(col);
      setSortDir('asc');
    } else {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
    setPage(1);
  };

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
          {/* Search Card */}
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-lg">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar edificações (nome, localização, responsável, data)"
                  className="w-full h-9 rounded-md border px-9 text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
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
                    <TableHead onClick={() => toggleSort('name')} aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[20%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">Nome {sortBy === 'name' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('location')} aria-sort={sortBy === 'location' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[20%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">Localização {sortBy === 'location' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('totalArea')} aria-sort={sortBy === 'totalArea' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[10%] text-right whitespace-nowrap cursor-pointer select-none">Área {sortBy === 'totalArea' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('floors')} aria-sort={sortBy === 'floors' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[8%] text-right whitespace-nowrap cursor-pointer select-none">Pav. {sortBy === 'floors' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('technician')} aria-sort={sortBy === 'technician' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[20%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">Responsável {sortBy === 'technician' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead className="w-[14%] text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBuildings.map((building) => (
                    <TableRow key={building.id} data-testid={`row-building-${building.id}`}>
                      <TableCell className="w-[24%] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal" data-testid={`text-building-name-${building.id}`}>
                        {building.name}
                      </TableCell>
                      <TableCell className="w-[20%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal" data-testid={`text-building-location-${building.id}`}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {(() => {
                            const zone = building.bioclimaticZone || '—';
                            const typology = (building as any).typologyLabel || (building as any).typologyCode || '';
                            const city = (building as any).city || '';
                            const state = (building as any).state || '';
                            const cityState = [city, state].filter(Boolean).join('/');
                            const pieces: string[] = [];
                            if (zone) pieces.push(zone);
                            if (typology) pieces.push(typology);
                            if (cityState) pieces.push(cityState);
                            return pieces.join(' • ');
                          })()}
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
                      <TableCell className="w-[14%] text-right">
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
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-slate-600">
                <p>
                  Mostrando <span className="font-semibold">{pagedBuildings.length}</span> de {" "}
                  <span className="font-semibold">{filtered.length}</span> edificações
                </p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
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
