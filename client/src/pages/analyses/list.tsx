import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Beaker, Plus, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { ActiveToggleButton } from '@/components/common/active-toggle-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationSimple as Pagination } from '@/components/ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Analysis, Criterion, Requirement } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { comparePt } from '@/lib/utils';
import AnalysisForm from '@/components/analyses/analysis-form';

export default function AnalysesList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<Analysis | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Analysis | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'label' | 'isActive' | 'criterionId' | 'createdAt' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [criterionFilter, setCriterionFilter] = useState<number | 'all'>('all');
  const [requirementFilter, setRequirementFilter] = useState<number | 'all'>('all');
  const pageSize = 15;
  const [page, setPage] = useState(1);

  useAuthRedirect();

  const { data: criteria = [] } = useQuery<Criterion[]>({ queryKey: ['/api/criteria'], enabled: isAuthenticated });
  const { data: requirements = [] } = useQuery<Requirement[]>({ queryKey: ['/api/requirements'], enabled: isAuthenticated });
  const analysesQueryKey: any = ['/api/analyses', { criterionId: criterionFilter, requirementId: requirementFilter }];
  const { data: items = [], isFetching, isLoading: isLoadingItems } = useQuery<Analysis[]>({
    queryKey: analysesQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (criterionFilter !== 'all') params.append('criterionId', String(criterionFilter));
      if (requirementFilter !== 'all') params.append('requirementId', String(requirementFilter));
      const qs = params.toString();
      const res = await fetch(`/api/analyses${qs ? `?${qs}` : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar análises');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const normText = (v: any) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]+/g, '');
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return items;
    return items.filter(t => normText(t.code).includes(q) || normText(t.label).includes(q));
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
      } else if (sortBy === 'criterionId') {
        cmp = (a.criterionId ?? 0) - (b.criterionId ?? 0);
      } else {
        cmp = comparePt(av, bv);
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
    if (sortBy !== col) { setSortBy(col); setSortDir('asc'); } else { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    setPage(1);
  };

  async function deleteRequest(id: number) {
    await apiRequest('DELETE', `/api/analyses/${id}`);
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (t: Analysis) => deleteRequest(t.id),
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: analysesQueryKey });
      const prev = queryClient.getQueryData<Analysis[]>(analysesQueryKey) || [];
      queryClient.setQueryData<Analysis[]>(analysesQueryKey, prev.filter(x => x.id !== t.id));
      return { prev };
    },
    onError: (err, _t, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(analysesQueryKey, ctx.prev);
      toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' });
    },
    onSuccess: (_data, t) => { toast({ title: 'Análise excluída', description: `${t.label} foi removida.` }); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['/api/analyses'] }); }
  });

  function askDelete(t: Analysis) { setSelectedItem(t); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Análises"
          description="Gerencie as análises associadas a critérios"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />}
              <Button onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Nova Análise
              </Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex gap-3 flex-1">
                <div className="relative w-full max-w-lg">
                  <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar análises" className="w-full h-9 rounded-md border px-9 text-sm" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                </div>
                <select value={requirementFilter} onChange={(e) => { const v = e.target.value === 'all' ? 'all' : Number(e.target.value); setRequirementFilter(v); setPage(1); }} className="h-9 text-sm rounded-md border px-2 bg-white">
                  <option value="all">Todos os Requisitos</option>
                  {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.label}</option>)}
                </select>
                <select value={criterionFilter} onChange={(e) => { const v = e.target.value === 'all' ? 'all' : Number(e.target.value); setCriterionFilter(v); setPage(1); }} className="h-9 text-sm rounded-md border px-2 bg-white">
                  <option value="all">Todos os Critérios</option>
                  {criteria.map(c => <option key={c.id} value={c.id}>{c.code} - {c.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          {isLoadingItems ? (
            <div className="text-center py-12"><Beaker className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Carregando...</p></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Beaker className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma análise cadastrada</h3>
              <p className="text-slate-500 mb-6">Cadastre a primeira para utilizá-la nas avaliações.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Análise
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
          <TableHead className="w-[18%]">Requisito</TableHead>
          <TableHead onClick={() => toggleSort('criterionId')} aria-sort={sortBy === 'criterionId' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[18%] cursor-pointer select-none">Critério {sortBy === 'criterionId' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead onClick={() => toggleSort('code')} aria-sort={sortBy === 'code' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[10%] cursor-pointer select-none">Código {sortBy === 'code' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead onClick={() => toggleSort('label')} aria-sort={sortBy === 'label' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[32%] cursor-pointer select-none">Descrição {sortBy === 'label' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead onClick={() => toggleSort('isActive')} aria-sort={sortBy === 'isActive' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[8%] cursor-pointer select-none">Ativa {sortBy === 'isActive' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead className="w-[14%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map(t => {
                    const crit = criteria.find(c => c.id === t.criterionId);
          const req = requirements.find(r => r.id === (crit as any)?.requirementId || r.id === (t as any).requirementId);
                    return (
                      <TableRow key={t.id}>
            <TableCell className="font-medium">{req ? req.label : (t as any).requirementId || '-'}</TableCell>
            <TableCell>{crit ? crit.label : t.criterionId}</TableCell>
                        <TableCell>{t.code}</TableCell>
                        <TableCell>{t.label}</TableCell>
                        <TableCell>{(t as any).isActive ? 'Sim' : 'Não'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="ghost" size="icon" onClick={() => { setEditItem(t); setFormKey(k => k + 1); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <ActiveToggleButton id={t.id} resource="analyses" isActive={(t as any).isActive} queryKey={analysesQueryKey} entityLabel="Análise" />
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
                <p>Mostrando <span className="font-semibold">{pagedItems.length}</span> de <span className="font-semibold">{filtered.length}</span> análises</p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <AnalysisForm key={formKey} initialItem={editItem} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['/api/analyses'] }); if (editItem) { setEditItem(null); setOpen(false); } }} onCancel={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.label} `}</strong>) : ('esta análise')}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700" disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
