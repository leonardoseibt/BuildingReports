import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TechnicianForm from "@/components/technicians/technician-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IdCard, Plus, MoreHorizontal, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationSimple as Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Technician } from "@shared/schema";

function formatPhoneBRDisplay(v?: string | null) {
  if (!v) return "-";
  const digits = String(v).replace(/\D/g, "").slice(0, 11);
  if (digits.length < 10) return v;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function formatDateBR(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export default function TechniciansList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"fullName" | "creaCau" | "email" | "phone" | "createdAt" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 15;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
  toast({ title: 'Sessão finalizada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
  toast({ title: 'Sessão finalizada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
  setTimeout(() => (window.location.href = "/login"), 400);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: technicians = [], isFetching, isLoading: isLoadingTechs } = useQuery<Technician[]>({ queryKey: ["/api/technicians"], enabled: isAuthenticated });

  // Filter helpers
  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const onlyDigits = (v: any) => String(v ?? "").replace(/\D+/g, "");

  const filtered = useMemo(() => {
    const q = normText(search);
    const qDigits = onlyDigits(search);
    if (!q) return technicians;
    return technicians.filter((t) => {
      const name = normText(t.fullName);
      const reg = normText(`${t.creaCau ?? ""} ${t.licenseState ?? ""}`);
      const email = normText(t.email);
      const phoneDisplay = formatPhoneBRDisplay(t.phone);
      const phoneText = normText(phoneDisplay);
      const phoneDigits = onlyDigits(t.phone);
      const createdDisplay = formatDateBR((t as any).createdAt);
      const createdText = normText(createdDisplay);
      const createdRaw = normText((t as any).createdAt);
      return (
        name.includes(q) ||
        reg.includes(q) ||
        email.includes(q) ||
        phoneText.includes(q) ||
        (!!qDigits && phoneDigits.includes(qDigits)) ||
        createdText.includes(q) ||
        createdRaw.includes(q)
      );
    });
  }, [technicians, search]);

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
      } else if (sortBy === 'phone') {
        cmp = onlyDigits(av).localeCompare(onlyDigits(bv));
      } else if (sortBy === 'creaCau') {
        const aReg = `${a.creaCau ?? ''} ${a.licenseState ?? ''}`;
        const bReg = `${b.creaCau ?? ''} ${b.licenseState ?? ''}`;
        cmp = aReg.localeCompare(bReg, 'pt-BR', { sensitivity: 'base' });
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedTechnicians = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);

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

  // Delete mutation with optimistic update
  async function deleteTechRequest(id: number) {
    const res = await fetch(`/api/technicians/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (t: Technician) => deleteTechRequest(t.id),
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: ["/api/technicians"] });
      const prev = queryClient.getQueryData<Technician[]>(["/api/technicians"]) || [];
      queryClient.setQueryData<Technician[]>(["/api/technicians"], prev.filter(x => x.id !== t.id));
      return { prev };
    },
    onError: (err, _t, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/technicians"], ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSuccess: (_data, t) => {
      toast({ title: 'Responsável técnico excluído', description: `${t.fullName} foi removido.` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"], refetchType: 'inactive' });
    }
  });

  function askDelete(t: Technician) { setSelectedTech(t); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedTech) return; deleteMutation.mutate(selectedTech); setConfirmOpen(false); setSelectedTech(null); }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Responsáveis Técnicos"
          description="Cadastre e gerencie os profissionais"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button onClick={() => { setEditTech(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Responsável Técnico
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
                  placeholder="Buscar técnicos (nome, registro, e-mail, telefone, data)"
                  className="w-full h-9 rounded-md border px-9 text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
          {isLoadingTechs ? null : technicians.length === 0 ? (
            <div className="text-center py-12">
              <IdCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum responsável técnico cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro para utilizá-lo nos relatórios.</p>
              <Button size="lg" onClick={() => { setEditTech(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Responsável Técnico
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead onClick={() => toggleSort('fullName')} aria-sort={sortBy === 'fullName' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[20%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">Nome {sortBy === 'fullName' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('creaCau')} aria-sort={sortBy === 'creaCau' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[15%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">Registro {sortBy === 'creaCau' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('email')} aria-sort={sortBy === 'email' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[24%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">E-mail {sortBy === 'email' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead onClick={() => toggleSort('phone')} aria-sort={sortBy === 'phone' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[18%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none">Telefone {sortBy === 'phone' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
                    <TableHead className="w-[17%] text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTechnicians.map((t) => (
                      <TableRow key={t.id} data-testid={`row-technician-${t.id}`} className="hover:bg-slate-50">
                      <TableCell className="w-[22%] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal">{t.fullName}</TableCell>
                      <TableCell className="w-[18%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal">
                        {t.creaCau}
                        {t.licenseState ? ` / ${t.licenseState}` : ""}
                      </TableCell>
                      <TableCell className="w-[24%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal">{t.email || "-"}</TableCell>
                      <TableCell className="w-[18%] whitespace-nowrap overflow-hidden text-ellipsis max-sm:whitespace-normal">{formatPhoneBRDisplay(t.phone)}</TableCell>
                      <TableCell className="w-[17%] text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${t.fullName}`}
                            title="Editar"
                            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            onClick={() => { setEditTech(t); setFormKey(k => k + 1); setOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${t.fullName}`}
                            title="Excluir"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => askDelete(t)}
                            disabled={deleteMutation.isPending && selectedTech?.id === t.id}
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
                  Mostrando <span className="font-semibold">{pagedTechnicians.length}</span> de {" "}
                  <span className="font-semibold">{filtered.length}</span> técnicos
                </p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>
      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditTech(null); setOpen(v); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <TechnicianForm
              key={formKey}
              initialTech={editTech ? {
                id: editTech.id,
                fullName: editTech.fullName,
                creaCau: editTech.creaCau,
                licenseState: editTech.licenseState,
                cpfCnpj: editTech.cpfCnpj || "",
                email: editTech.email || "",
                phone: editTech.phone || "",
                company: editTech.company || "",
                street: (editTech as any).street || "",
                addressNumber: (editTech as any).addressNumber || "",
                neighborhood: (editTech as any).neighborhood || "",
                city: editTech.city || "",
                state: editTech.state,
                cep: editTech.cep || "",
                notes: editTech.notes || "",
              } : null}
              onSuccess={() => { setEditTech(null); setOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/technicians"] }); }}
              onCancel={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir responsável técnico</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedTech ? (
                <strong>{` ${selectedTech.fullName} `}</strong>
              ) : (
                "este responsável técnico"
              )}
              ? Essa ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTech(null)}>
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
