import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Volume2, Plus, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { NoiseClass } from "@shared/schema";
import NoiseClassForm from "@/components/noise-classes/noise-class-form";

export default function NoiseClassesList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<NoiseClass | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NoiseClass | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "label" | "isActive" | "createdAt" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 10;
  const [page, setPage] = useState(1);

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString('pt-BR');
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Não autorizado", description: "Você não está logado. Fazendo login...", variant: "destructive" });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: items = [], isFetching, isLoading: isLoadingItems } = useQuery<NoiseClass[]>({ queryKey: ["/api/noise-classes"], enabled: isAuthenticated });
  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return items;
    return items.filter((t) =>
      normText(t.code).includes(q) ||
      normText(t.label).includes(q) ||
      normText((t as any).createdAt).includes(q)
    );
  }, [items, search]);
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
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedItems = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);
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

  async function deleteRequest(id: number) {
    const res = await fetch(`/api/noise-classes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (t: NoiseClass) => deleteRequest(t.id),
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: ["/api/noise-classes"] });
      const prev = queryClient.getQueryData<NoiseClass[]>(["/api/noise-classes"]) || [];
      queryClient.setQueryData<NoiseClass[]>(["/api/noise-classes"], prev.filter(x => x.id !== t.id));
      return { prev };
    },
    onError: (err, _t, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/noise-classes"], ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSuccess: (_data, t) => { toast({ title: 'Classe de ruído excluída', description: `${t.label} foi removida.` }); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/noise-classes"], refetchType: 'inactive' }); }
  });

  function askDelete(t: NoiseClass) { setSelectedItem(t); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Classes de Ruído"
          description="Gerencie as classes de ruído do entorno"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Nova Classe
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
                  placeholder="Buscar classes (código, descrição, data)"
                  className="w-full h-9 rounded-md border px-9 text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
          {isLoadingItems ? (
            <div className="text-center py-12"><Volume2 className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Carregando...</p></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Volume2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma classe cadastrada</h3>
              <p className="text-slate-500 mb-6">Cadastre a primeira para utilizá-la nas edificações.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Classe
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead onClick={() => toggleSort('code')} aria-sort={sortBy === 'code' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[18%] cursor-pointer select-none">Código {sortBy === 'code' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('label')} aria-sort={sortBy === 'label' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[50%] cursor-pointer select-none">Descrição {sortBy === 'label' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('isActive')} aria-sort={sortBy === 'isActive' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[10%] cursor-pointer select-none">Ativa {sortBy === 'isActive' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('createdAt')} aria-sort={sortBy === 'createdAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[14%] cursor-pointer select-none">Criado em {sortBy === 'createdAt' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead className="w-[8%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((t: NoiseClass) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.code}</TableCell>
                      <TableCell>{t.label}</TableCell>
                      <TableCell>{(t as any).isActive ? 'Sim' : 'Não'}</TableCell>
                      <TableCell>{formatDate((t as any).createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => { setEditItem(t); setFormKey(k => k + 1); setOpen(true); }}>
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
                  <span className="font-semibold">{filtered.length}</span> classes
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}>Anterior</Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button key={p} variant={pageSafe === p ? "default" : "outline"} size="sm" onClick={() => setPage(p)} className={pageSafe === p ? "" : "bg-white"}>
                      {p}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>Próxima</Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <NoiseClassForm key={formKey} initialItem={editItem} onSuccess={() => { setEditItem(null); setOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/noise-classes"] }); }} onCancel={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir classe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.label} `}</strong>) : ("esta classe")}?
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
