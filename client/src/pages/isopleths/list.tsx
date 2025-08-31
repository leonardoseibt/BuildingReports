import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wind, Plus, Loader2, Pencil, Trash2, MapPin, X, Search, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { ActiveToggleButton } from '@/components/common/active-toggle-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationSimple as Pagination } from '@/components/ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { Isopleth } from '@shared/schema';
import IsoplethForm from '@/components/isopleths/isopleth-form';
import { NotchedField } from '@/components/ui/notched-field';
import { apiRequest } from '@/lib/queryClient';

export default function IsoplethsList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<Isopleth | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Isopleth | null>(null);
  const [coveragesFor, setCoveragesFor] = useState<Isopleth | null>(null);
  const [search, setSearch] = useState('');
  // Default ordering by código
  const [sortBy, setSortBy] = useState<'code' | 'label' | 'isActive' | 'windMinMS' | 'windMaxMS' | null>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const pageSize = 15;
  const [page, setPage] = useState(1);

  useAuthRedirect();

  const { data: items = [], isFetching, isLoading: isLoadingItems } = useQuery<Isopleth[]>({ queryKey: ['/api/isopleths'], enabled: isAuthenticated });
  // Map de isoplethId -> cidades (lazy load conjunto único)
  type CoverageRow = { isoplethId: number; city: string; state: string };
  const { data: coverageIndex = [] } = useQuery<CoverageRow[]>({
    queryKey: ['/api/isopleths/coverages-index'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await fetch('/api/isopleths/coverages-index');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  });
  const cityIndex = useMemo(() => {
    const map = new Map<number, { city: string; state: string }[]>();
    for (const r of coverageIndex) {
      if (!map.has(r.isoplethId)) map.set(r.isoplethId, []);
      map.get(r.isoplethId)!.push({ city: r.city, state: r.state });
    }
    return map;
  }, [coverageIndex]);

  const normText = (v: any) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]+/g, '');
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return items;
    return items.filter((z) => {
      if (normText(z.code).includes(q)) return true;
      if (normText(z.label).includes(q)) return true;
      if (normText((z as any).isActive ? 'sim' : 'nao').includes(q)) return true;
      const cities = cityIndex.get(z.id);
      if (cities) {
        for (const c of cities) {
          if (normText(c.city).includes(q) || normText(`${c.city}/${c.state}`).includes(q)) return true;
        }
      }
      return false;
    });
  }, [items, search, cityIndex]);
  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as any)[sortBy];
      const bv = (b as any)[sortBy];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv; else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { usage: 'sort', sensitivity: 'accent', numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  // Overlap detection for visual cues
  function parse(v: any, fallback: number) { if (v === undefined || v === null || v === '') return fallback; const n = Number(v); return isNaN(n) ? fallback : n; }
  const intervals = useMemo(() => sorted.map(z => ({
    item: z,
    min: parse((z as any).windMinMS, -Infinity),
    max: parse((z as any).windMaxMS, +Infinity)
  })), [sorted]);
  const overlapMap = useMemo(() => {
    const map = new Map<number, Isopleth[]>();
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i]; const b = intervals[j];
  // Igualdade na fronteira não sobrepõe
  if (a.min < b.max && b.min < a.max) { // overlap real
          if (!map.has(a.item.id)) map.set(a.item.id, []); map.get(a.item.id)!.push(b.item);
          if (!map.has(b.item.id)) map.set(b.item.id, []); map.get(b.item.id)!.push(a.item);
        }
      }
    }
    return map;
  }, [intervals]);
  const anyOverlap = overlapMap.size > 0;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize), [sorted, pageSafe]);
  const toggleSort = (col: typeof sortBy) => {
    if (col === null) return;
    if (sortBy !== col) { setSortBy(col); setSortDir('asc'); } else { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }
    setPage(1);
  };

  const deleteMutation = useMutation({
    mutationFn: async (z: Isopleth) => apiRequest('DELETE', `/api/isopleths/${z.id}`),
    onMutate: async (z) => {
      await queryClient.cancelQueries({ queryKey: ['/api/isopleths'] });
      const prev = queryClient.getQueryData<Isopleth[]>(['/api/isopleths']) || [];
      queryClient.setQueryData<Isopleth[]>(['/api/isopleths'], prev.filter(x => x.id !== z.id));
      return { prev };
    },
    onError: (err, _z, ctx) => { if (ctx?.prev) queryClient.setQueryData(['/api/isopleths'], ctx.prev); toast({ title: 'Erro ao excluir', description: String(err), variant: 'destructive' }); },
    onSuccess: (_d, z) => toast({ title: 'Isopleta excluída', description: `${z.code} - ${z.label} removida.` }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['/api/isopleths'], refetchType: 'inactive' })
  });

  function askDelete(z: Isopleth) { setSelectedItem(z); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className='flex h-screen bg-slate-50'>
      <Sidebar />
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header
          title='Isopletas'
          description='Gerencie as isopletas (faixas de velocidade básica do vento)'
          action={<div className='flex items-center gap-2'>{isFetching && <Loader2 className='h-4 w-4 animate-spin text-slate-400' />}<Button onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}><Plus className='w-4 h-4 mr-2' /> Nova Isopleta</Button></div>}
        />
        <main className='flex-1 overflow-y-auto p-6'>
          <div className='rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4'>
            <div className='flex items-center gap-3'>
              <div className='relative w-full max-w-lg'>
                <input type='text' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder='Buscar isopletas (código, descrição, status, município)' className='w-full h-9 rounded-md border px-9 text-sm' />
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4' />
              </div>
            </div>
          </div>
          {isLoadingItems ? (
            <div className='text-center py-12'><Wind className='w-16 h-16 text-slate-300 mx-auto mb-4' /><p className='text-slate-500'>Carregando...</p></div>
          ) : items.length === 0 ? (
            <div className='text-center py-12'>
              <Wind className='w-16 h-16 text-slate-300 mx-auto mb-4' />
              <h3 className='text-lg font-medium text-slate-900 mb-2'>Nenhuma isopleta cadastrada</h3>
              <p className='text-slate-500 mb-6'>Cadastre faixas de velocidade básica do vento.</p>
              <Button size='lg' onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}><Plus className='w-4 h-4 mr-2' /> Cadastrar Isopleta</Button>
            </div>
          ) : (
            <div className='rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60'>
              {anyOverlap && (
                <div className='px-4 py-2 flex items-start gap-2 text-amber-800 bg-amber-50 border-b border-amber-200 text-sm'>
                  <AlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Sobreposição de faixas de vento detectada</p>
                    <p className='text-xs'>Ajuste as isopletas para que as faixas (m/s) não se interceptem, se a sobreposição não for desejada.</p>
                  </div>
                </div>
              )}
              <Table className='table-fixed'>
                <TableHeader>
                  <TableRow className='bg-slate-100/60'>
                    <TableHead onClick={() => toggleSort('code')} className='w-[12%] cursor-pointer select-none'>Código {sortBy === 'code' && (sortDir === 'asc' ? <ArrowUp className='inline-block w-3 h-3 ml-1 opacity-70' /> : <ArrowDown className='inline-block w-3 h-3 ml-1 opacity-70' />)}</TableHead>
                    <TableHead onClick={() => toggleSort('label')} className='w-[32%] cursor-pointer select-none'>Descrição {sortBy === 'label' && (sortDir === 'asc' ? <ArrowUp className='inline-block w-3 h-3 ml-1 opacity-70' /> : <ArrowDown className='inline-block w-3 h-3 ml-1 opacity-70' />)}</TableHead>
                    <TableHead onClick={() => toggleSort('windMinMS')} className='w-[12%] cursor-pointer select-none text-right'>Vento Min (m/s) {sortBy === 'windMinMS' && (sortDir === 'asc' ? <ArrowUp className='inline-block w-3 h-3 ml-1 opacity-70' /> : <ArrowDown className='inline-block w-3 h-3 ml-1 opacity-70' />)}</TableHead>
                    <TableHead onClick={() => toggleSort('windMaxMS')} className='w-[12%] cursor-pointer select-none text-right'>Vento Max (m/s) {sortBy === 'windMaxMS' && (sortDir === 'asc' ? <ArrowUp className='inline-block w-3 h-3 ml-1 opacity-70' /> : <ArrowDown className='inline-block w-3 h-3 ml-1 opacity-70' />)}</TableHead>
                    <TableHead onClick={() => toggleSort('isActive')} className='w-[8%] cursor-pointer select-none text-center'>Ativa {sortBy === 'isActive' && (sortDir === 'asc' ? <ArrowUp className='inline-block w-3 h-3 ml-1 opacity-70' /> : <ArrowDown className='inline-block w-3 h-3 ml-1 opacity-70' />)}</TableHead>
                    <TableHead className='w-[24%] text-right'>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(z => {
                    const overlaps = overlapMap.get(z.id) || [];
                    return (
                      <TableRow key={z.id} className={overlaps.length ? 'bg-amber-50/40' : ''}>
                        <TableCell className='font-medium'>
                          <div className='flex items-center gap-2'>
                            <span>{z.code}</span>
                            {overlaps.length > 0 && (
                              <span title={`Sobrepõe: ${overlaps.map(o=>o.code).join(', ')}`} className='inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium'>Overlap</span>
                            )}
                          </div>
                        </TableCell>
                      <TableCell>{z.label}</TableCell>
                      <TableCell className='text-right'>{(z as any).windMinMS ?? '—'}</TableCell>
                      <TableCell className='text-right'>{(z as any).windMaxMS ?? '—'}</TableCell>
                      <TableCell className='text-center'>{(z as any).isActive ? 'Sim' : 'Não'}</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex items-center justify-end gap-1.5'>
                          <Button variant='ghost' size='sm' onClick={() => setCoveragesFor(z)}><MapPin className='h-4 w-4 mr-1' /> Abrangências</Button>
                          <ActiveToggleButton id={z.id} resource='isopleths' isActive={(z as any).isActive} queryKey={['/api/isopleths']} entityLabel='Isopleta' />
                          <Button variant='ghost' size='icon' onClick={() => { setEditItem(z); setFormKey(k => k + 1); setOpen(true); }}><Pencil className='h-4 w-4' /></Button>
                          <Button variant='ghost' size='icon' className='text-rose-600 hover:bg-rose-50 hover:text-rose-700' onClick={() => askDelete(z)} disabled={deleteMutation.isPending && selectedItem?.id === z.id}><Trash2 className='h-4 w-4' /></Button>
                        </div>
                      </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className='flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-slate-600'>
                <p>Mostrando <span className='font-semibold'>{paged.length}</span> de <span className='font-semibold'>{filtered.length}</span> isopletas</p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className='max-w-xl max-h-[90vh] p-0 overflow-hidden'>
          <div className='max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7'>
            <IsoplethForm key={formKey} initialItem={editItem} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['/api/isopleths'] }); if (editItem) { setEditItem(null); setOpen(false); } }} onCancel={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {coveragesFor && <IsoplethCoveragesPanel isopleth={coveragesFor} onClose={() => setCoveragesFor(null)} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir isopleta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir {selectedItem ? (<strong>{` ${selectedItem.code} - ${selectedItem.label} `}</strong>) : ('esta isopleta')}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className='bg-rose-600 hover:bg-rose-700' disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IsoplethCoveragesPanel({ isopleth, onClose }: { isopleth: Isopleth; onClose: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  type CoverageRow = { id: number; isoplethId: number; cityId: number; stateId: number; state: string; city: string };
  const { data: coverages = [], isLoading } = useQuery<CoverageRow[]>({ queryKey: ['/api/isopleths', isopleth.id, 'coverages'], queryFn: async () => {
    const res = await fetch(`/api/isopleths/${isopleth.id}/coverages`); if (!res.ok) throw new Error(await res.text()); return res.json();
  }});
  type State = { id: number; code: string; name: string };
  type City = { id: number; stateId: number; name: string };
  const { data: states = [] } = useQuery<State[]>({ queryKey: ['/api/states'], queryFn: async () => { const r = await fetch('/api/states'); if (!r.ok) throw new Error(await r.text()); return r.json(); } });
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['/api/states', selectedStateId, 'cities'],
    enabled: !!selectedStateId,
    queryFn: async () => { const r = await fetch(`/api/states/${selectedStateId}/cities`); if (!r.ok) throw new Error(await r.text()); return r.json(); }
  });
  const addMutation = useMutation({
    mutationFn: async (payload: { cityId: number }) => apiRequest('POST', `/api/isopleths/${isopleth.id}/coverages`, payload),
    onMutate: async (payload) => { await queryClient.cancelQueries({ queryKey: ['/api/isopleths', isopleth.id, 'coverages'] }); const prev = queryClient.getQueryData<any[]>(['/api/isopleths', isopleth.id, 'coverages']) || []; const optimistic = { id: Math.random()*-1, isoplethId: isopleth.id, cityId: payload.cityId, stateId: selectedStateId!, state: states.find(s=>s.id===selectedStateId)?.code ?? '', city: cities.find(c=>c.id===payload.cityId)?.name ?? '' }; queryClient.setQueryData(['/api/isopleths', isopleth.id, 'coverages'], [...prev, optimistic]); return { prev }; },
    onError: (_e,_v,ctx) => { if (ctx?.prev) queryClient.setQueryData(['/api/isopleths', isopleth.id, 'coverages'], ctx.prev); toast({ title:'Erro', description:'Falha ao adicionar abrangência', variant:'destructive' }); },
    onSuccess: () => toast({ title:'Abrangência adicionada' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['/api/isopleths', isopleth.id, 'coverages'] })
  });
  const deleteMutation = useMutation({
    mutationFn: async (coverageId: number) => apiRequest('DELETE', `/api/isopleths/coverages/${coverageId}`),
    onMutate: async (id) => { await queryClient.cancelQueries({ queryKey: ['/api/isopleths', isopleth.id, 'coverages'] }); const prev = queryClient.getQueryData<any[]>(['/api/isopleths', isopleth.id, 'coverages']) || []; queryClient.setQueryData(['/api/isopleths', isopleth.id, 'coverages'], prev.filter(c=>c.id!==id)); return { prev }; },
    onError: (_e,_v,ctx) => { if (ctx?.prev) queryClient.setQueryData(['/api/isopleths', isopleth.id, 'coverages'], ctx.prev); toast({ title:'Erro', description:'Falha ao remover abrangência', variant:'destructive' }); },
    onSuccess: () => toast({ title:'Abrangência removida' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['/api/isopleths', isopleth.id, 'coverages'] })
  });
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [coverSearch, setCoverSearch] = useState('');
  const norm = (v:any)=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]+/g,'');
  const filteredCoverages = coverages.filter(c=>{ const q = norm(coverSearch); if(!q) return true; return norm((c as any).state).includes(q)||norm((c as any).city).includes(q); });
  return (
    <div className='fixed inset-y-0 right-0 w-[34rem] bg-white shadow-2xl border-l border-slate-200 p-6 flex flex-col'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold'>Abrangências — {isopleth.code}</h3>
        <Button variant='ghost' size='icon' onClick={onClose}><X className='h-5 w-5' /></Button>
      </div>
      <div className='space-y-3'>
        <div className='relative w-full'>
          <input type='text' value={coverSearch} onChange={(e)=>setCoverSearch(e.target.value)} placeholder='Buscar (UF, Município)' className='w-full h-8 rounded-md border px-8 text-sm' />
          <Search className='absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4' />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <NotchedField label='UF' requiredMark>
            <select className='h-8 w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1' value={selectedStateId ?? ''} onChange={(e)=>{ const v = e.target.value?Number(e.target.value):null; setSelectedStateId(v); setSelectedCityId(null); }}>
              <option value=''>Selecione a UF</option>
              {states.map(s=> <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </NotchedField>
          <NotchedField label='Município' requiredMark>
            <select className='h-8 w-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1' value={selectedCityId ?? ''} onChange={(e)=>setSelectedCityId(e.target.value?Number(e.target.value):null)} disabled={!selectedStateId}>
              <option value=''>Selecione o Município</option>
              {cities.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </NotchedField>
        </div>
        <div className='flex justify-end mt-1.5'>
          <Button size='sm' onClick={()=>{ if(!selectedCityId) return; addMutation.mutate({ cityId: selectedCityId }); }} disabled={!selectedCityId || addMutation.isPending}>{addMutation.isPending ? 'Adicionando…' : 'Adicionar'}</Button>
        </div>
      </div>
      <div className='mt-6 flex-1 overflow-y-auto'>
        {isLoading ? <p className='text-slate-500'>Carregando...</p> : filteredCoverages.length === 0 ? <p className='text-slate-500'>Nenhuma abrangência cadastrada.</p> : (
          <div className='overflow-auto'>
            <table className='min-w-full text-sm'>
              <thead className='bg-slate-100'>
                <tr><th className='px-2 py-1 text-left'>UF</th><th className='px-2 py-1 text-left'>Município</th><th className='px-2 py-1 text-right'>Ações</th></tr>
              </thead>
              <tbody>
                {filteredCoverages.map(c => (
                  <tr key={(c as any).id} className='border-b'>
                    <td className='px-2 py-1'>{(c as any).state}</td>
                    <td className='px-2 py-1'>{(c as any).city}</td>
                    <td className='px-2 py-1 text-right'>
                      <div className='flex items-center justify-end gap-1.5'>
                        <Button variant='ghost' size='icon' onClick={()=> deleteMutation.mutate((c as any).id)} className='text-rose-600 hover:bg-rose-50 hover:text-rose-700'><Trash2 className='h-4 w-4' /></Button>
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
