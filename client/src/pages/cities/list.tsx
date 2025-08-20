import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FormHeader from "@/components/ui/form-header";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationSimple as Pagination } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

 type StateRow = { id: number; code: string; name: string };
 type CityRow = { id: number; stateId: number; name: string };

export default function CitiesList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<CityRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CityRow | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"state" | "name" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 10;
  const [page, setPage] = useState(1);

  const [stateId, setStateId] = useState<number | "">("");
  const [cityName, setCityName] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Não autorizado", description: "Você não está logado. Fazendo login...", variant: "destructive" });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: states = [] } = useQuery<StateRow[]>({ queryKey: ["/api/states"], enabled: isAuthenticated });
  const { data: cities = [], isFetching, isLoading: isLoadingItems } = useQuery<CityRow[]>({ queryKey: ["/api/cities"], enabled: isAuthenticated });

  const stateById = useMemo(() => new Map(states.map(s => [s.id, s])), [states]);

  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return cities;
    return cities.filter((t) => {
      const uf = stateById.get(t.stateId);
      return normText(t.name).includes(q) || (uf && (normText(uf.code).includes(q) || normText(uf.name).includes(q)));
    });
  }, [cities, search, stateById]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ua = stateById.get(a.stateId);
      const ub = stateById.get(b.stateId);
      const av = sortBy === 'name' ? a.name : ua?.code ?? '';
      const bv = sortBy === 'name' ? b.name : ub?.code ?? '';
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { usage: 'sort', sensitivity: 'accent', numeric: true, ignorePunctuation: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir, stateById]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedItems = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);

  const toggleSort = (col: typeof sortBy) => {
    if (col === null) return;
    if (sortBy !== col) { setSortBy(col); setSortDir('asc'); } else { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    setPage(1);
  };

  async function deleteRequest(id: number) {
    const res = await fetch(`/api/cities/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (t: CityRow) => deleteRequest(t.id),
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: ["/api/cities"] });
      const prev = queryClient.getQueryData<CityRow[]>(["/api/cities"]) || [];
      queryClient.setQueryData<CityRow[]>(["/api/cities"], prev.filter(x => x.id !== t.id));
      return { prev };
    },
    onError: (err, _t, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/cities"], ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/cities"], refetchType: 'inactive' }); }
  });

  function askDelete(t: CityRow) { setSelectedItem(t); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name: cityName.trim(), stateId: stateId === "" ? undefined : Number(stateId) } as any;
      if (!body.stateId) throw new Error('Selecione uma UF');
      if (editItem) {
        const res = await fetch(`/api/cities/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
      const res = await fetch(`/api/cities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setOpen(false); setEditItem(null); setStateId(""); setCityName("");
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      toast({ title: 'Município salvo' });
    },
    onError: (e) => { toast({ title: 'Erro', description: String(e), variant: 'destructive' }); },
  });

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Municípios"
          description="Gerencie a lista de municípios"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button onClick={() => { setEditItem(null); setStateId(""); setCityName(""); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Município
              </Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-lg">
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar municípios (nome, UF)" className="w-full h-9 rounded-md border px-9 text-sm" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
          {isLoadingItems ? (
            <div className="text-center py-12"><Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Carregando...</p></div>
          ) : cities.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum município cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro município para utilizá-lo nas abrangências.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setStateId(""); setCityName(""); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Município
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead onClick={() => toggleSort('state')} aria-sort={sortBy === 'state' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[18%] cursor-pointer select-none">UF {sortBy === 'state' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('name')} aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[64%] cursor-pointer select-none">Município {sortBy === 'name' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead className="w-[18%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((t) => {
                    const uf = stateById.get(t.stateId);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{uf?.code}</TableCell>
                        <TableCell>{t.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="ghost" size="icon" onClick={() => { setEditItem(t); setStateId(t.stateId); setCityName(t.name); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(t)} disabled={deleteMutation.isPending && selectedItem?.id === t.id}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-slate-600">
                <p>
                  Mostrando <span className="font-semibold">{pagedItems.length}</span> de {" "}
                  <span className="font-semibold">{filtered.length}</span> municípios
                </p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setEditItem(null); setOpen(v); }}>
    <DialogContent className="max-w-xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7 space-y-3">
            <FormHeader title={editItem ? 'Editar Município' : 'Novo Município'} subtitle={editItem ? 'Atualize os dados do município.' : 'Cadastre um novo município.'} initials={cityName ?? null} />
            <div className="grid grid-cols-1 sm:[grid-template-columns:12rem_1fr] gap-2 items-start">
              <select value={stateId} onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : "")} className="h-9 border rounded px-2 w-full">
                <option value="">UF</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
              <input value={cityName} onChange={(e) => setCityName(e.target.value)} placeholder="Município" className="h-9 border rounded px-2 w-full" />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!stateId || !cityName || saveMutation.isPending}>{editItem ? 'Salvar' : 'Adicionar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir município</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.name} `}</strong>) : ("este município")}?
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
