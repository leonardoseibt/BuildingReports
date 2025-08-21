import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FormHeader from "@/components/ui/form-header";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import { Globe2, Plus, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationSimple as Pagination } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type StateRow = { id: number; code: string; name: string; region?: string | null };

export default function StatesList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<StateRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StateRow | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "name" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 15;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Não autorizado", description: "Você não está logado. Fazendo login...", variant: "destructive" });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: items = [], isFetching, isLoading: isLoadingItems } = useQuery<StateRow[]>({ queryKey: ["/api/states"], enabled: isAuthenticated });

  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return items;
    return items.filter((t) =>
      normText(t.code).includes(q) ||
      normText(t.name).includes(q)
    );
  }, [items, search]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as any)[sortBy];
      const bv = (b as any)[sortBy];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { usage: 'sort', sensitivity: 'accent', numeric: true, ignorePunctuation: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedItems = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);

  const toggleSort = (col: typeof sortBy) => {
    if (col === null) return;
    if (sortBy !== col) { setSortBy(col); setSortDir('asc'); } else { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    setPage(1);
  };

  async function deleteRequest(id: number) {
    const res = await fetch(`/api/states/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (t: StateRow) => deleteRequest(t.id),
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: ["/api/states"] });
      const prev = queryClient.getQueryData<StateRow[]>(["/api/states"]) || [];
      queryClient.setQueryData<StateRow[]>(["/api/states"], prev.filter(x => x.id !== t.id));
      return { prev };
    },
    onError: (err, _t, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/states"], ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/states"], refetchType: 'inactive' }); }
  });

  function askDelete(t: StateRow) { setSelectedItem(t); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const macrorregioes = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;

  const saveMutation = useMutation({
    mutationFn: async () => {
  const body = { code: code.trim().toUpperCase(), name: name.trim(), region: region.trim() || undefined };
      if (editItem) {
        const res = await fetch(`/api/states/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
      const res = await fetch(`/api/states`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setOpen(false); setEditItem(null); setCode(""); setName(""); setRegion("");
      queryClient.invalidateQueries({ queryKey: ["/api/states"] });
      toast({ title: 'Estado salvo' });
    },
    onError: () => { toast({ title: 'Erro', description: 'Falha ao salvar estado', variant: 'destructive' }); },
  });

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Estados (UF)"
          description="Gerencie a lista de UFs"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button onClick={() => { setEditItem(null); setCode(""); setName(""); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Estado
              </Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-lg">
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar estados (código, nome)" className="w-full h-9 rounded-md border px-9 text-sm" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
          {isLoadingItems ? (
            <div className="text-center py-12"><Globe2 className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Carregando...</p></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Globe2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum estado cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre a primeira UF para utilizá-la nas cidades.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setCode(""); setName(""); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar UF
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead onClick={() => toggleSort('code')} aria-sort={sortBy === 'code' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[18%] cursor-pointer select-none">Código {sortBy === 'code' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('name')} aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[46%] cursor-pointer select-none">Nome {sortBy === 'name' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead className="w-[18%]">Região</TableHead>
                    <TableHead className="w-[18%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.code}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.region ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => { setEditItem(t); setCode(t.code); setName(t.name); setRegion(t.region ?? ""); setFormKey(k => k + 1); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(t)} disabled={deleteMutation.isPending && selectedItem?.id === t.id}>
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
                  Mostrando <span className="font-semibold">{pagedItems.length}</span> de {" "}
                  <span className="font-semibold">{filtered.length}</span> estados
                </p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7 space-y-6">
            {/* Header */}
            <FormHeader title={editItem ? 'Editar Estado' : 'Novo Estado'} subtitle={editItem ? 'Atualize os dados do estado (UF).' : 'Cadastre um novo estado (UF).'} initials={code ?? null} />
            <div className="grid grid-cols-1 md:[grid-template-columns:10rem_1fr] gap-5 items-start">
              <NotchedField label="Código" requiredMark>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="RS"
                  maxLength={2}
                  className="uppercase bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </NotchedField>
              <NotchedField label="Nome" requiredMark>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do estado"
                  className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </NotchedField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <NotchedField label="Região" labelClassName="whitespace-nowrap">
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full h-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                >
                  <option value="">Selecione a região</option>
                  {macrorregioes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </NotchedField>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setOpen(false); setEditItem(null); }}>Cancelar</Button>
              <Button size="sm" className="min-w-32 rounded-xl" onClick={() => saveMutation.mutate()} disabled={!code || !name || saveMutation.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir estado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.name} (${selectedItem.code}) `}</strong>) : ("este estado")}?
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
