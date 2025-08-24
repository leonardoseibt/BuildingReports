import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListChecks, Plus, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { ActiveToggleButton } from '@/components/common/active-toggle-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationSimple as Pagination } from '@/components/ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Parameter, Analysis, Criterion } from '@shared/schema';
import ParameterForm from '@/components/parameters/parameter-form';

export default function ParametersList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<Parameter | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Parameter | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'label' | 'analysisId' | 'isActive' | 'unit' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [criterionFilter, setCriterionFilter] = useState<number | 'all'>('all');
  const [analysisFilter, setAnalysisFilter] = useState<number | 'all'>('all');
  const pageSize = 15; const [page, setPage] = useState(1);

  useEffect(() => { if (!isLoading && !isAuthenticated) { toast({ title: 'Não autorizado', description: 'Você não está logado. Fazendo login...', variant: 'destructive' }); setTimeout(() => (window.location.href = '/api/login'), 500); } }, [isAuthenticated, isLoading, toast]);

  const { data: criteria = [] } = useQuery<Criterion[]>({ queryKey: ['/api/criteria'], enabled: isAuthenticated });
  const { data: analyses = [] } = useQuery<Analysis[]>({ queryKey: ['/api/analyses', { criterionId: criterionFilter }], enabled: isAuthenticated, queryFn: async () => {
    const param = criterionFilter !== 'all' ? `?criterionId=${criterionFilter}` : '';
    const res = await fetch(`/api/analyses${param}`, { credentials: 'include' }); if (!res.ok) throw new Error('Erro'); return res.json(); } });
  const { data: items = [], isFetching, isLoading: isLoadingItems } = useQuery<Parameter[]>({
    queryKey: ['/api/parameters', { analysisId: analysisFilter, criterionId: criterionFilter }],
    queryFn: async () => {
      const qs: string[] = [];
      if (analysisFilter !== 'all') qs.push(`analysisId=${analysisFilter}`); else if (criterionFilter !== 'all') qs.push(`criterionId=${criterionFilter}`);
      const res = await fetch(`/api/parameters${qs.length ? '?' + qs.join('&') : ''}`, { credentials: 'include' }); if (!res.ok) throw new Error('Erro'); return res.json();
    }, enabled: isAuthenticated,
  });

  const normText = (v: any) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]+/g, '');
  const filtered = useMemo(() => { const q = normText(search); if (!q) return items; return items.filter(t => normText(t.label).includes(q) || normText((t as any).unit).includes(q)); }, [items, search]);
  const sorted = useMemo(() => { if (!sortBy) return filtered; const arr = [...filtered]; arr.sort((a,b)=>{ const av = (a as any)[sortBy]; const bv = (b as any)[sortBy]; let cmp=0; if(sortBy==='isActive'){ cmp = Number(a.isActive)-Number(b.isActive);} else if(sortBy==='analysisId'){ cmp = (a.analysisId??0)-(b.analysisId??0);} else { cmp= String(av??'').localeCompare(String(bv??''),'pt-BR',{sensitivity:'base'});} return sortDir==='asc'?cmp:-cmp;}); return arr; }, [filtered, sortBy, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize)); const pageSafe = Math.min(page, totalPages); const pagedItems = useMemo(()=> sorted.slice((pageSafe-1)*pageSize, pageSafe*pageSize),[sorted,pageSafe]);
  const toggleSort = (col: typeof sortBy)=>{ if(col===null)return; if(sortBy!==col){ setSortBy(col); setSortDir('asc'); } else { setSortDir(d=>d==='asc'?'desc':'asc'); } setPage(1); };

  async function deleteRequest(id:number){ const res= await fetch(`/api/parameters/${id}`, { method:'DELETE', credentials:'include'}); if(!res.ok) throw new Error(await res.text()); return true; }
  const deleteMutation = useMutation({ mutationFn: async (t:Parameter)=> deleteRequest(t.id), onMutate: async (t)=>{ await queryClient.cancelQueries({ queryKey: ['/api/parameters']}); const prev = queryClient.getQueryData<Parameter[]>(['/api/parameters', { analysisId: analysisFilter, criterionId: criterionFilter }])||[]; queryClient.setQueryData<Parameter[]>(['/api/parameters', { analysisId: analysisFilter, criterionId: criterionFilter }], prev.filter(x=>x.id!==t.id)); return { prev }; }, onError:(err,_t,ctx)=>{ if(ctx?.prev) queryClient.setQueryData(['/api/parameters', { analysisId: analysisFilter, criterionId: criterionFilter }], ctx.prev); toast({ title:'Erro ao excluir', description:String(err), variant:'destructive'}); }, onSuccess:(_d,t)=> toast({ title:'Parâmetro excluído', description:`${t.label} foi removido.`}), onSettled:()=> queryClient.invalidateQueries({ queryKey: ['/api/parameters']}) });
  function askDelete(t:Parameter){ setSelectedItem(t); setConfirmOpen(true);} function confirmDelete(){ if(!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null);} if(isLoading||!isAuthenticated) return null;

  return (<div className="flex h-screen bg-slate-50"><Sidebar /><div className="flex-1 flex flex-col overflow-hidden"><Header title="Parâmetros" description="Gerencie os parâmetros das análises" action={<div className="flex items-center gap-2">{isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" /> }<Button onClick={()=>{ setEditItem(null); setFormKey(k=>k+1); setOpen(true); }}><Plus className="w-4 h-4 mr-2"/> Novo Parâmetro</Button></div>} />
    <main className="flex-1 overflow-y-auto p-6">
      <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col md:flex-row gap-3 flex-1">
            <div className="relative w-full md:max-w-xs">
              <input type="text" value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); }} placeholder="Search parameters" className="w-full h-9 rounded-md border px-9 text-sm" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
            <select value={criterionFilter} onChange={(e)=>{ const v = e.target.value==='all'?'all':Number(e.target.value); setCriterionFilter(v); setAnalysisFilter('all'); setPage(1); }} className="h-9 text-sm rounded-md border px-2 bg-white">
              <option value="all">All Criteria</option>
              {criteria.map(c=> <option key={c.id} value={c.id}>{c.code} - {c.label}</option>)}
            </select>
            <select value={analysisFilter} onChange={(e)=>{ const v = e.target.value==='all'?'all':Number(e.target.value); setAnalysisFilter(v); setPage(1); }} className="h-9 text-sm rounded-md border px-2 bg-white">
              <option value="all">All Analyses</option>
              {analyses.map(a=> <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        </div>
      </div>
      {isLoadingItems ? (<div className="text-center py-12"><ListChecks className="w-16 h-16 text-slate-300 mx-auto mb-4"/><p className="text-slate-500">Carregando...</p></div>) : items.length===0 ? (<div className="text-center py-12"><ListChecks className="w-16 h-16 text-slate-300 mx-auto mb-4"/><h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum parâmetro cadastrado</h3><p className="text-slate-500 mb-6">Cadastre o primeiro.</p><Button size="lg" onClick={()=>{ setEditItem(null); setFormKey(k=>k+1); setOpen(true); }}><Plus className="w-4 h-4 mr-2"/> Cadastrar Parâmetro</Button></div>) : (<div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60"><Table className="table-fixed"><TableHeader><TableRow className="bg-slate-100/60"><TableHead onClick={()=>toggleSort('analysisId')} aria-sort={sortBy==='analysisId'?(sortDir==='asc'?'ascending':'descending'):'none'} className="w-[15%] cursor-pointer select-none">Analysis {sortBy==='analysisId' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/>:<ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead><TableHead onClick={()=>toggleSort('label')} aria-sort={sortBy==='label'?(sortDir==='asc'?'ascending':'descending'):'none'} className="w-[30%] cursor-pointer select-none">Description {sortBy==='label' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/>:<ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead><TableHead className="w-[8%]">Min</TableHead><TableHead className="w-[10%]">Intermediate</TableHead><TableHead className="w-[8%]">Superior</TableHead><TableHead onClick={()=>toggleSort('unit')} aria-sort={sortBy==='unit'?(sortDir==='asc'?'ascending':'descending'):'none'} className="w-[8%] cursor-pointer select-none">Unit {sortBy==='unit' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/>:<ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead><TableHead onClick={()=>toggleSort('isActive')} aria-sort={sortBy==='isActive'?(sortDir==='asc'?'ascending':'descending'):'none'} className="w-[8%] cursor-pointer select-none">Active {sortBy==='isActive' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/>:<ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead><TableHead className="w-[13%] text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{pagedItems.map(t=>{ const analysis = analyses.find(a=>a.id===t.analysisId); return (<TableRow key={t.id}><TableCell className="font-medium">{analysis?analysis.label:t.analysisId}</TableCell><TableCell>{t.label}</TableCell><TableCell>{(t as any).minimumValue ?? '-'}</TableCell><TableCell>{(t as any).intermediateValue ?? '-'}</TableCell><TableCell>{(t as any).superiorValue ?? '-'}</TableCell><TableCell>{(t as any).unit ?? '-'}</TableCell><TableCell>{t.isActive?'Yes':'No'}</TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-1.5"><Button variant="ghost" size="icon" onClick={()=>{ setEditItem(t); setFormKey(k=>k+1); setOpen(true); }}><Pencil className="h-4 w-4"/></Button><ActiveToggleButton id={t.id} resource="parameters" isActive={t.isActive as any} queryKey={['/api/parameters', { analysisId: analysisFilter, criterionId: criterionFilter }]} entityLabel="Parâmetro"/><Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={()=>askDelete(t)} disabled={deleteMutation.isPending && selectedItem?.id===t.id}><Trash2 className="h-4 w-4"/></Button></div></TableCell></TableRow>); })}</TableBody></Table><div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-slate-600"><p>Mostrando <span className="font-semibold">{pagedItems.length}</span> de <span className="font-semibold">{filtered.length}</span> parâmetros</p><Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p:number)=> setPage(p)} /></div></div>) }
    </main></div>
    <Dialog open={open} onOpenChange={(v)=>{ if(v) setFormKey(k=>k+1); if(!v) setEditItem(null); setOpen(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden"><div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7"><ParameterForm key={formKey} initialItem={editItem} onSuccess={()=>{ setEditItem(null); setOpen(false); queryClient.invalidateQueries({ queryKey: ['/api/parameters']}); }} onCancel={()=> setOpen(false)} /></div></DialogContent>
    </Dialog>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir parâmetro</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.label} `}</strong>):('este parâmetro')}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=> setSelectedItem(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700" disabled={deleteMutation.isPending}>{deleteMutation.isPending? 'Excluindo…':'Excluir'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>);
}
