import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, throwIfResNotOk } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useToast } from '@/hooks/use-toast';
import { Plus, Database, Search, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import { ActiveToggleButton } from '@/components/common/active-toggle-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationSimple as Pagination } from '@/components/ui/pagination';

interface AttributeDefinitionFormData {
  id?: number;
  friendlyName: string;
  sourceTable: string;
  sourceColumn: string;
  dataKind: string;
  valueSource?: string | null;
  valueIdField?: string;
  valueLabelField?: string;
  isActive?: boolean;
}

const DATA_KINDS = ['numeric','reference','text','boolean','date'];
const VALUE_SOURCES = ['typologies','noise_classes','aggressiveness_classes','bioclimatic_zones','isopleths'];

export default function AttributesList() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  useAuthRedirect();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<AttributeDefinitionFormData | null>(null);
  // Filtros removidos (tipo / somente ativos) conforme solicitação – mantendo apenas busca textual.
  const [metaTables, setMetaTables] = useState<Array<{ name: string; columns: string[] }>>([]);
  const [selectedTable, setSelectedTable] = useState('buildings');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'friendlyName' | 'dataKind' | 'source' | 'valueSource' | 'isActive' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const pageSize = 15;
  const [page, setPage] = useState(1);

  const { data: attributes = [], isLoading, error, isFetching } = useQuery<AttributeDefinitionFormData[]>({
    queryKey: ['/api/attributes'],
    queryFn: async () => {
      const res = await fetch(`/api/attributes`, { credentials: 'include' });
      await throwIfResNotOk(res);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch metadata tables once
  const metaQuery = useQuery<{ name: string; columns: string[] }[]>({
    queryKey: ['/api/metadata/tables'],
    queryFn: async () => {
      const res = await fetch('/api/metadata/tables', { credentials: 'include' });
      await throwIfResNotOk(res);
      return res.json();
    },
    enabled: isAuthenticated,
  });
  useEffect(() => {
    if (metaQuery.data) {
      setMetaTables(metaQuery.data);
      if (metaQuery.data.length && !selectedTable) setSelectedTable(metaQuery.data[0].name);
    }
  }, [metaQuery.data, selectedTable]);

  const attributeKey: any = ['/api/attributes'];

  const createMutation = useMutation({
    mutationFn: async (data: AttributeDefinitionFormData) => {
      const res = await apiRequest('POST', '/api/attributes', data);
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Atributo criado' }); queryClient.invalidateQueries({ queryKey: attributeKey }); }
  });
  const updateMutation = useMutation({
    mutationFn: async (data: AttributeDefinitionFormData) => {
      const res = await apiRequest('PUT', `/api/attributes/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Atributo atualizado' }); queryClient.invalidateQueries({ queryKey: attributeKey }); }
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/attributes/${id}`);
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Atributo desativado' }); queryClient.invalidateQueries({ queryKey: attributeKey }); }
  });

  function openNew() { setEditItem(null); setFormKey(k=>k+1); setOpen(true); }
  function openEdit(item: AttributeDefinitionFormData) { setEditItem(item); setFormKey(k=>k+1); setOpen(true); }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: AttributeDefinitionFormData = {
      id: editItem?.id,
  // code omitted (auto)
      friendlyName: (fd.get('friendlyName') as string).trim(),
      sourceTable: (fd.get('sourceTable') as string).trim(),
      sourceColumn: (fd.get('sourceColumn') as string).trim(),
      dataKind: fd.get('dataKind') as string,
      valueSource: (fd.get('valueSource') as string) || null,
      valueIdField: (fd.get('valueIdField') as string) || 'id',
      valueLabelField: (fd.get('valueLabelField') as string) || 'label',
      isActive: fd.get('isActive') === 'on'
    };
    if (payload.id) updateMutation.mutate(payload); else createMutation.mutate(payload);
    setTimeout(()=> setOpen(false), 50);
  }

  // Normaliza (minúsculas) e remove acentos simples sem usar normalize para compatibilidade ampla
  const norm = (v:string) => v.toLowerCase()
    .replace(/[áàãâä]/g,'a')
    .replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i')
    .replace(/[óòõôö]/g,'o')
    .replace(/[úùûü]/g,'u')
    .replace(/[ç]/g,'c');
  const filtered = useMemo(()=> {
    if (!search.trim()) return attributes;
    const s = norm(search.trim());
    return attributes.filter(a => {
      const source = `${a.sourceTable}.${a.sourceColumn}`;
      const parts = [a.friendlyName, source, a.dataKind, a.valueSource || '', a.isActive ? 'sim' : 'nao'];
      const hay = norm(parts.join(' '));
      return hay.includes(s);
    });
  }, [attributes, search]);

  const withSource = useMemo(()=> filtered.map(a => ({ ...a, source: `${a.sourceTable}.${a.sourceColumn}` })), [filtered]);
  const sorted = useMemo(()=> {
    if (!sortBy) return withSource;
    const arr = [...withSource];
    arr.sort((a,b)=> {
      let av:any = (a as any)[sortBy];
      let bv:any = (b as any)[sortBy];
      if (sortBy === 'isActive') { av = Number(!!av); bv = Number(!!bv); }
      return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
    });
    return arr;
  }, [withSource, sortBy, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(()=> sorted.slice((pageSafe-1)*pageSize, pageSafe*pageSize), [sorted, pageSafe]);

  function toggleSort(col: typeof sortBy) {
    if (!col) return;
    if (sortBy !== col) { setSortBy(col); setSortDir('asc'); }
    else setSortDir(d=> d==='asc' ? 'desc' : 'asc');
  }

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Atributos"
          description="Metadados de atributos disponíveis para parâmetros"
          action={
            <div className="flex items-center gap-2">
              {isFetching && <span className="text-xs text-slate-400">Atualizando…</span>}
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-2"/>Novo Atributo</Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4 space-y-3">
            <div className="relative w-full max-w-lg">
              <input type="text" value={search} onChange={(e)=> { setSearch(e.target.value); setPage(1); }} placeholder="Buscar atributos (qualquer campo)" className="w-full h-9 rounded-md border px-9 text-sm" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Carregando…</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum atributo cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro para começar a vincular aos parâmetros.</p>
              <Button size="lg" onClick={openNew}><Plus className="w-4 h-4 mr-2"/>Cadastrar Atributo</Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead onClick={()=> toggleSort('source')} className="w-[24%] cursor-pointer select-none">Tabela.Campo {sortBy==='source' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead>
                    <TableHead onClick={()=> toggleSort('friendlyName')} className="w-[28%] cursor-pointer select-none">Nome {sortBy==='friendlyName' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead>
                    <TableHead onClick={()=> toggleSort('dataKind')} className="w-[12%] cursor-pointer select-none">Tipo {sortBy==='dataKind' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead>
                    <TableHead onClick={()=> toggleSort('valueSource')} className="w-[16%] cursor-pointer select-none">Fonte Valor {sortBy==='valueSource' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead>
                    <TableHead onClick={()=> toggleSort('isActive')} className="w-[8%] cursor-pointer select-none">Ativa {sortBy==='isActive' && (sortDir==='asc'? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70"/> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70"/> )}</TableHead>
                    <TableHead className="w-[12%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {error && <TableRow><TableCell colSpan={6} className="text-center text-rose-600">Erro ao carregar</TableCell></TableRow>}
                  {paged.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-xs">{a.sourceTable}.{a.sourceColumn}</TableCell>
                      <TableCell>{a.friendlyName}</TableCell>
                      <TableCell>{a.dataKind}</TableCell>
                      <TableCell>{a.valueSource || '-'}</TableCell>
                      <TableCell>{a.isActive ? 'Sim' : 'Não'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" onClick={()=> openEdit(a)}><Pencil className="h-4 w-4"/></Button>
                          <ActiveToggleButton id={a.id!} resource="attributes" isActive={a.isActive as any} queryKey={attributeKey} entityLabel="Atributo" />
                          {a.isActive && <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={()=> deleteMutation.mutate(a.id!)} disabled={deleteMutation.isPending && editItem?.id === a.id}><Trash2 className="h-4 w-4"/></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-slate-600">
                <p>Mostrando <span className="font-semibold">{paged.length}</span> de <span className="font-semibold">{sorted.length}</span> atributos</p>
                <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p:number)=> setPage(p)} />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v)=> { if (v) setFormKey(k=>k+1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
          <h2 className="text-lg font-semibold mb-2">{editItem ? 'Editar Atributo' : 'Novo Atributo'}</h2>
          <form key={formKey} onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium mb-1">Nome Amigável *</label>
                <Input name="friendlyName" defaultValue={editItem?.friendlyName || ''} required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tabela *</label>
                <select
                  name="sourceTable"
                  className="border rounded w-full h-9 px-2 text-sm"
                  defaultValue={editItem?.sourceTable || selectedTable}
                  onChange={(e)=> setSelectedTable(e.target.value)}
                  required
                >
                  {metaTables.map(t=> <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Coluna *</label>
                <select
                  name="sourceColumn"
                  className="border rounded w-full h-9 px-2 text-sm"
                  defaultValue={editItem?.sourceColumn || ''}
                  required
                >
                  <option value="" disabled>{metaTables.length? 'Selecionar':'Carregando...'}</option>
                  {metaTables.find(t=> t.name === (editItem?.sourceTable || selectedTable))?.columns.map(c=> <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tipo *</label>
                <select name="dataKind" defaultValue={editItem?.dataKind || 'numeric'} className="border rounded w-full h-9 px-2 text-sm" required>
                  {DATA_KINDS.map(k=> <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Fonte Valor (se referência)</label>
                <select name="valueSource" defaultValue={editItem?.valueSource || ''} className="border rounded w-full h-9 px-2 text-sm">
                  <option value="">--</option>
                  {VALUE_SOURCES.map(v=> <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Campo ID</label>
                <Input name="valueIdField" defaultValue={editItem?.valueIdField || 'id'} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Campo Label</label>
                <Input name="valueLabelField" defaultValue={editItem?.valueLabelField || 'label'} />
              </div>
               {/* Unidade removida */}
              <div className="flex items-center gap-2 mt-6">
                <input type="checkbox" name="isActive" defaultChecked={editItem?.isActive ?? true} className="h-4 w-4" />
                <span className="text-sm">Ativo</span>
              </div>
            </div>
            {/* Descrição removida */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={()=> setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.status === 'pending' || updateMutation.status === 'pending'}>{editItem ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}