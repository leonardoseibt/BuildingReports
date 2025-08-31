import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Globe2, Plus, Loader2, Pencil, Trash2, MapPin, X, Search, ArrowUp, ArrowDown } from "lucide-react";
import { ActiveToggleButton } from "@/components/common/active-toggle-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NotchedField } from "@/components/ui/notched-field";
import { PaginationSimple as Pagination } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { BioclimaticZone } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { ZoneForm } from "@/components/bioclimatic-zones";

export default function BioclimaticZonesList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<BioclimaticZone | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BioclimaticZone | null>(null);
  const [coveragesFor, setCoveragesFor] = useState<BioclimaticZone | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "label" | "isActive" | "createdAt" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 15;
  const [page, setPage] = useState(1);

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString('pt-BR');
  };

  useAuthRedirect();

  const { data: zones = [], isFetching, isLoading: isLoadingItems } = useQuery<BioclimaticZone[]>({ queryKey: ["/api/bioclimatic-zones"], enabled: isAuthenticated });
  // Search by city name: query backend for zones that cover a given city
  const searchTrim = search.trim();
  const enableCitySearch = isAuthenticated && searchTrim.length >= 2;
  const { data: zonesByCity = [], isError: isCitySearchError, error: citySearchError } = useQuery<Array<{ id: number; code: string; label: string }>>({
    queryKey: ["/api/bioclimatic-zones/search-by-city", searchTrim],
    enabled: enableCitySearch,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/bioclimatic-zones/search-by-city?q=${encodeURIComponent(searchTrim)}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  });
  useEffect(() => {
    if (isCitySearchError && citySearchError) {
      toast({ title: "Busca por município indisponível", description: String((citySearchError as any)?.message || citySearchError), variant: "destructive" });
    }
  }, [isCitySearchError, citySearchError, toast]);
  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    // If city search returned results, strictly filter zones to those covering the city
    if ((zonesByCity?.length || 0) > 0) {
      const ids = new Set(zonesByCity.map((z) => z.id));
      return zones.filter((z) => ids.has(z.id));
    }
    // Fallback: local text filter across zone fields
    if (!q) return zones;
    return zones.filter((z) =>
      normText(z.code).includes(q) ||
      normText(z.label).includes(q) ||
      normText((z as any).isActive ? 'sim' : 'nao').includes(q) ||
      normText((z as any).createdAt).includes(q)
    );
  }, [zones, search, zonesByCity]);
  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as any)[sortBy];
      const bv = (b as any)[sortBy];
      let cmp = 0;
      if (sortBy === 'createdAt') {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        cmp = ad - bd;
      } else if (sortBy === 'isActive') {
        cmp = Number((a as any).isActive) - Number((b as any).isActive);
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { usage: 'sort', sensitivity: 'accent', numeric: true, ignorePunctuation: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedZones = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);
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

  // Delete zone (uses apiRequest to ensure CSRF header on unsafe method)
  const deleteMutation = useMutation({
    mutationFn: async (z: BioclimaticZone) => apiRequest('DELETE', `/api/bioclimatic-zones/${z.id}`),
    onMutate: async (z) => {
      await queryClient.cancelQueries({ queryKey: ["/api/bioclimatic-zones"] });
      const prev = queryClient.getQueryData<BioclimaticZone[]>(["/api/bioclimatic-zones"]) || [];
      queryClient.setQueryData<BioclimaticZone[]>(["/api/bioclimatic-zones"], prev.filter(x => x.id !== z.id));
      return { prev };
    },
    onError: (err, _z, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/bioclimatic-zones"], ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSuccess: (_data, z) => { toast({ title: 'Zona excluída', description: `${z.code} - ${z.label} foi removida.` }); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones"], refetchType: 'inactive' }); }
  });

  function askDelete(z: BioclimaticZone) { setSelectedItem(z); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Zonas Bioclimáticas"
          description="Gerencie as zonas e suas abrangências (UF/Cidade)"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Nova Zona
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
                  placeholder="Buscar zonas (código, descrição, status, data ou Município)"
                  className="w-full h-9 rounded-md border px-9 text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
          {isLoadingItems ? (
            <div className="text-center py-12"><Globe2 className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Carregando...</p></div>
          ) : zones.length === 0 ? (
            <div className="text-center py-12">
              <Globe2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma zona cadastrada</h3>
              <p className="text-slate-500 mb-6">Cadastre as zonas bioclimáticas e suas abrangências.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Zona
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead onClick={() => toggleSort('code')} aria-sort={sortBy === 'code' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[10%] cursor-pointer select-none">Código {sortBy === 'code' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('label')} aria-sort={sortBy === 'label' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[55%] cursor-pointer select-none">Descrição {sortBy === 'label' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('isActive')} aria-sort={sortBy === 'isActive' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[7%] cursor-pointer select-none text-center">Ativa {sortBy === 'isActive' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead className="w-[28%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedZones.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="font-medium">{z.code}</TableCell>
                      <TableCell>{z.label}</TableCell>
                      <TableCell className="text-center">{(z as any).isActive ? 'Sim' : 'Não'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => { setCoveragesFor(z); }}>
                            <MapPin className="h-4 w-4 mr-1" /> Abrangências
                          </Button>
                          <ActiveToggleButton id={z.id} resource="bioclimatic-zones" isActive={(z as any).isActive} queryKey={["/api/bioclimatic-zones"]} entityLabel="Zona" />
                          <Button variant="ghost" size="icon" onClick={() => { setEditItem(z); setFormKey(k => k + 1); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(z)} disabled={deleteMutation.isPending && selectedItem?.id === z.id}>
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
                  Mostrando <span className="font-semibold">{pagedZones.length}</span> de {" "}
                  <span className="font-semibold">{filtered.length}</span> zonas
                </p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <ZoneForm key={formKey} initialItem={editItem} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones"] }); if (editItem) { setEditItem(null); setOpen(false); } }} onCancel={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Coverages side panel */}
      {coveragesFor && <CoveragesPanel zone={coveragesFor} onClose={() => setCoveragesFor(null)} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir zona</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.code} - ${selectedItem.label} `}</strong>) : ("esta zona")}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CoveragesPanel({ zone, onClose }: { zone: BioclimaticZone; onClose: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  type CoverageRow = { id: number; zoneId: number; cityId: number; stateId: number; state: string; city: string };
  const { data: coverages = [], isLoading } = useQuery<CoverageRow[]>({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"], queryFn: async () => {
    const res = await fetch(`/api/bioclimatic-zones/${zone.id}/coverages`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }});

  // Load states and cities
  type State = { id: number; code: string; name: string };
  type City = { id: number; stateId: number; name: string };
  const { data: states = [] } = useQuery<State[]>({ queryKey: ["/api/states"], queryFn: async () => { const r = await fetch('/api/states'); if (!r.ok) throw new Error(await r.text()); return r.json(); } });
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ["/api/states", selectedStateId, "cities"],
    enabled: !!selectedStateId,
    queryFn: async () => {
      const r = await fetch(`/api/states/${selectedStateId}/cities`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (payload: { cityId: number }) => {
      return apiRequest('POST', `/api/bioclimatic-zones/${zone.id}/coverages`, payload);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] });
      const prev = queryClient.getQueryData<any[]>(["/api/bioclimatic-zones", zone.id, "coverages"]) || [];
      // Optimistic placeholder (state/city names filled after refetch)
      const optimistic = { id: Math.random() * -1, zoneId: zone.id, cityId: payload.cityId, stateId: selectedStateId!, state: states.find(s=>s.id===selectedStateId)?.code ?? '', city: cities.find(c=>c.id===payload.cityId)?.name ?? '' };
      queryClient.setQueryData(["/api/bioclimatic-zones", zone.id, "coverages"], [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/bioclimatic-zones", zone.id, "coverages"], ctx.prev);
      toast({ title: 'Erro', description: 'Falha ao adicionar abrangência', variant: 'destructive' });
    },
    onSuccess: () => { toast({ title: 'Abrangência adicionada' }); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] }); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { cityId?: number } }) => {
      return apiRequest('PUT', `/api/bioclimatic-zones/coverages/${id}`, payload);
    },
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] });
      const prev = queryClient.getQueryData<any[]>(["/api/bioclimatic-zones", zone.id, "coverages"]) || [];
      const next = prev.map(c => c.id === id ? { ...c, cityId: payload.cityId ?? c.cityId, city: (cities.find(x=>x.id===payload.cityId!)?.name) ?? c.city } : c);
      queryClient.setQueryData(["/api/bioclimatic-zones", zone.id, "coverages"], next);
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/bioclimatic-zones", zone.id, "coverages"], ctx.prev);
      toast({ title: 'Erro', description: 'Falha ao atualizar abrangência', variant: 'destructive' });
    },
    onSuccess: () => { toast({ title: 'Abrangência atualizada' }); setEditingId(null); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] }); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (coverageId: number) => {
      return apiRequest('DELETE', `/api/bioclimatic-zones/coverages/${coverageId}`);
    },
    onMutate: async (coverageId: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] });
      const prev = queryClient.getQueryData<any[]>(["/api/bioclimatic-zones", zone.id, "coverages"]) || [];
      queryClient.setQueryData(["/api/bioclimatic-zones", zone.id, "coverages"], prev.filter(c => c.id !== coverageId));
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/bioclimatic-zones", zone.id, "coverages"], ctx.prev);
      toast({ title: 'Erro', description: 'Falha ao remover abrangência', variant: 'destructive' });
    },
    onSuccess: () => { toast({ title: 'Abrangência removida' }); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] }); }
  });

  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Local search for coverages (UF e Município)
  const [coverSearch, setCoverSearch] = useState("");
  const norm = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filteredCoverages = useMemo(() => {
    const q = norm(coverSearch);
    if (!q) return coverages;
    return coverages.filter((c) => norm((c as any).state).includes(q) || norm((c as any).city).includes(q));
  }, [coverSearch, coverages]);

  return (
    <div className="fixed inset-y-0 right-0 w-[34rem] bg-white shadow-2xl border-l border-slate-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Abrangências — {zone.code}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>

      <div className="space-y-3">
        {/* Busca por UF/Município */}
        <div className="relative w-full">
          <input
            type="text"
            value={coverSearch}
            onChange={(e) => setCoverSearch(e.target.value)}
            placeholder="Buscar (UF, Município)"
            className="w-full h-8 rounded-md border px-8 text-sm"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NotchedField label="UF" requiredMark>
            <select
              className="h-8 w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
              value={selectedStateId ?? ''}
              onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setSelectedStateId(v); setSelectedCityId(null); }}
            >
              <option value="">Selecione a UF</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </NotchedField>
          <NotchedField label="Município" requiredMark>
            <select
              className="h-8 w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
              value={selectedCityId ?? ''}
              onChange={(e) => setSelectedCityId(e.target.value ? Number(e.target.value) : null)}
              disabled={!selectedStateId}
            >
              <option value="">Selecione o Município</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </NotchedField>
        </div>
        <div className="flex justify-end mt-1.5">
      <Button size="sm" onClick={() => {
            if (!selectedCityId) return;
            if (editingId) {
              updateMutation.mutate({ id: editingId, payload: { cityId: selectedCityId || undefined } });
            } else {
              addMutation.mutate({ cityId: selectedCityId });
            }
          }} disabled={!selectedCityId || addMutation.isPending || updateMutation.isPending}>{editingId ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
  {isLoading ? (
          <p className="text-slate-500">Carregando...</p>
  ) : filteredCoverages.length === 0 ? (
          <p className="text-slate-500">Nenhuma abrangência cadastrada.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">UF</th>
                  <th className="px-2 py-1 text-left">Município</th>
                  <th className="px-2 py-1 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoverages.map((c) => (
                  <tr key={(c as any).id} className="border-b">
                    <td className="px-2 py-1">{(c as any).state}</td>
                    <td className="px-2 py-1">{(c as any).city}</td>
                    <td className="px-2 py-1 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId((c as any).id);
                          setSelectedStateId((c as any).stateId);
                          // When state changes, cities will load via useQuery. Preselect current city
                          setSelectedCityId((c as any).cityId);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate((c as any).id)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
