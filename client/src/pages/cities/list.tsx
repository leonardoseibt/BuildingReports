import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showSuccess, showError } from "@/lib/toast-messages";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FormHeader from "@/components/ui/form-header";
import { Input } from "@/components/ui/input";
import { NotchedField } from "@/components/ui/notched-field";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Loader2, Pencil, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationSimple as Pagination } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

 type StateRow = { id: number; code: string; name: string };
 type CityRow = {
   id: number;
   stateId: number;
   name: string;
   latitude?: string | number | null;
   longitude?: string | number | null;
   altitudeM?: string | number | null;
   tbsC?: string | number | null;
   urPercent?: string | number | null;
   radiacaoWm2?: string | number | null;
   ventoMS?: string | number | null;
   amplitudeC?: string | number | null;
  ventoBasicoMS?: string | number | null;
 };

export default function CitiesList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<CityRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CityRow | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"state" | "name" | "region" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const pageSize = 15;
  const [page, setPage] = useState(1);

  const [stateId, setStateId] = useState<number | "">("");
  const [cityName, setCityName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitudeM, setAltitudeM] = useState("");
  const [tbsC, setTbsC] = useState("");
  const [urPercent, setUrPercent] = useState("");
  const [radiacaoWm2, setRadiacaoWm2] = useState("");
  const [ventoMS, setVentoMS] = useState("");
  const [amplitudeC, setAmplitudeC] = useState("");
  const [ventoBasicoMS, setVentoBasicoMS] = useState("");

  function resetFormFields() {
    setStateId("");
    setCityName("");
    setLatitude("");
    setLongitude("");
    setAltitudeM("");
    setTbsC("");
    setUrPercent("");
    setRadiacaoWm2("");
    setVentoMS("");
    setAmplitudeC("");
  setVentoBasicoMS("");
  }


  // Centraliza redirecionamento / toast de sessão expirada
  useAuthRedirect();

  const { data: states = [] } = useQuery<StateRow[]>({ queryKey: ["/api/states"], enabled: isAuthenticated });
  const { data: cities = [], isFetching, isLoading: isLoadingItems } = useQuery<CityRow[]>({ queryKey: ["/api/cities"], enabled: isAuthenticated });

  const stateById = useMemo(() => new Map(states.map(s => [s.id, s])), [states]);

  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    if (!q) return cities;
    return cities.filter((t) => {
      const uf = stateById.get(t.stateId);
      return (
        normText(t.name).includes(q) ||
        (uf && (
          normText(uf.code).includes(q) ||
          normText(uf.name).includes(q) ||
          normText((uf as any).region ?? '').includes(q)
        ))
      );
    });
  }, [cities, search, stateById]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ua = stateById.get(a.stateId);
      const ub = stateById.get(b.stateId);
  const av = sortBy === 'name' ? a.name : sortBy === 'region' ? (ua as any)?.region ?? '' : ua?.code ?? '';
  const bv = sortBy === 'name' ? b.name : sortBy === 'region' ? (ub as any)?.region ?? '' : ub?.code ?? '';
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
    const res = await apiRequest('DELETE', `/api/cities/${id}`);
    await res.json().catch(() => ({}));
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
      showError(toast, `Erro ao excluir: ${String(err)}`);
    },
    onSuccess: (_data, t) => { showSuccess(toast, `${t.name} foi removido.`); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/cities"], refetchType: 'inactive' }); }
  });

  function askDelete(t: CityRow) { setSelectedItem(t); setConfirmOpen(true); }
  function confirmDelete() { if (!selectedItem) return; deleteMutation.mutate(selectedItem); setConfirmOpen(false); setSelectedItem(null); }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: cityName.trim(),
        stateId: stateId === "" ? undefined : Number(stateId),
        latitude: latitude === "" ? undefined : Number(latitude),
        longitude: longitude === "" ? undefined : Number(longitude),
        altitudeM: altitudeM === "" ? undefined : Number(altitudeM),
        tbsC: tbsC === "" ? undefined : Number(tbsC),
        urPercent: urPercent === "" ? undefined : Number(urPercent),
        radiacaoWm2: radiacaoWm2 === "" ? undefined : Number(radiacaoWm2),
        ventoMS: ventoMS === "" ? undefined : Number(ventoMS),
        amplitudeC: amplitudeC === "" ? undefined : Number(amplitudeC),
  ventoBasicoMS: ventoBasicoMS === "" ? undefined : Number(ventoBasicoMS),
      } as any;
      if (!body.stateId) throw new Error('Selecione uma UF');
      if (editItem) {
        const res = await apiRequest('PUT', `/api/cities/${editItem.id}`, body);
        return res.json();
      }
      const res = await apiRequest('POST', `/api/cities`, body);
      return res.json();
    },
    onSuccess: () => {
      setOpen(false); setEditItem(null); resetFormFields();
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      showSuccess(toast, 'Município salvo com sucesso.');
    },
    onError: (e) => { showError(toast, String(e)); },
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
              <Button onClick={() => { setEditItem(null); resetFormFields(); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Município
              </Button>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-lg">
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar municípios (nome, UF)"
                  className="h-9 pl-9"
                />
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
              <Button size="lg" onClick={() => { setEditItem(null); resetFormFields(); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Município
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
        <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
          <TableHead onClick={() => toggleSort('state')} aria-sort={sortBy === 'state' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[10%] cursor-pointer select-none">UF {sortBy === 'state' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead onClick={() => toggleSort('name')} aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[30%] cursor-pointer select-none">Município {sortBy === 'name' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead onClick={() => toggleSort('region')} aria-sort={sortBy === 'region' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="w-[14%] cursor-pointer select-none">Região {sortBy === 'region' && (sortDir === 'asc' ? <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" /> : <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />)}</TableHead>
          <TableHead className="w-[21%] text-right">Latitude</TableHead>
          <TableHead className="w-[21%] text-right">Longitude</TableHead>
          <TableHead className="w-[14%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((t) => {
                    const uf = stateById.get(t.stateId);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{uf?.code}</TableCell>
            <TableCell>{t.name}</TableCell>
            <TableCell>{(uf as any)?.region ?? '-'}</TableCell>
            <TableCell className="text-right">{t.latitude ?? '-'}</TableCell>
            <TableCell className="text-right">{t.longitude ?? '-'}</TableCell>
            <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="ghost" size="icon" onClick={() => { setEditItem(t); setStateId(t.stateId); setCityName(t.name); setLatitude(t.latitude != null ? String(t.latitude) : ""); setLongitude(t.longitude != null ? String(t.longitude) : ""); setAltitudeM(t.altitudeM != null ? String(t.altitudeM) : ""); setTbsC(t.tbsC != null ? String(t.tbsC) : ""); setUrPercent(t.urPercent != null ? String(t.urPercent) : ""); setRadiacaoWm2(t.radiacaoWm2 != null ? String(t.radiacaoWm2) : ""); setVentoMS(t.ventoMS != null ? String(t.ventoMS) : ""); setAmplitudeC(t.amplitudeC != null ? String(t.amplitudeC) : ""); setVentoBasicoMS(t.ventoBasicoMS != null ? String(t.ventoBasicoMS) : ""); setOpen(true); }}>
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

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditItem(null); resetFormFields(); } setOpen(v); }}>
  <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7 space-y-6">
            <FormHeader title={editItem ? 'Editar Município' : 'Novo Município'} subtitle={editItem ? 'Atualize os dados do município.' : 'Cadastre um novo município.'} initials={cityName ?? null} />
            <div className="grid grid-cols-1 sm:[grid-template-columns:22rem_1fr] gap-5 items-start">
              <NotchedField label="Estado (UF)" requiredMark labelClassName="whitespace-nowrap">
                <select
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-9 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 focus:outline-none"
                >
                  <option value="">Selecione o estado (UF)</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </NotchedField>
              <NotchedField label="Município" requiredMark labelClassName="whitespace-nowrap">
                <Input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Nome do município"
                  className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </NotchedField>
            </div>

            {/* Demais campos do cadastro de municípios (conforme tabela) */}
            {/* Linha 2: Latitude, Longitude, Altitude */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <NotchedField label="Latitude (°)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-30.0346" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
              <NotchedField label="Longitude (°)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-51.2177" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
              <NotchedField label="Altitude (m)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={altitudeM} onChange={(e) => setAltitudeM(e.target.value)} placeholder="100.00" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
            </div>
            {/* Linha 3: TBS, UR, Amplitude */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <NotchedField label="Temperatura de bulbo seco média anual (°C)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={tbsC} onChange={(e) => setTbsC(e.target.value)} placeholder="24.50" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
              <NotchedField label="Umidade relativa média anual (%)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={urPercent} onChange={(e) => setUrPercent(e.target.value)} placeholder="65.00" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
              <NotchedField label="Média anual da amplitude térmica (°C)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={amplitudeC} onChange={(e) => setAmplitudeC(e.target.value)} placeholder="10.00" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
            </div>
            {/* Linha 4: Radiação, Vento médio, Vento básico */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <NotchedField label="Média anual da radiação global diária (W/m²)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={radiacaoWm2} onChange={(e) => setRadiacaoWm2(e.target.value)} placeholder="500.00" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
              <NotchedField label="Velocidade do vento média anual (m/s)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={ventoMS} onChange={(e) => setVentoMS(e.target.value)} placeholder="2.50" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
              <NotchedField label="Velocidade básica do vento (m/s)" labelClassName="whitespace-nowrap">
                <Input type="number" step="0.01" value={ventoBasicoMS} onChange={(e) => setVentoBasicoMS(e.target.value)} placeholder="30.00" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </NotchedField>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setOpen(false); setEditItem(null); resetFormFields(); }}>Cancelar</Button>
              <Button size="sm" className="min-w-32 rounded-xl" onClick={() => saveMutation.mutate()} disabled={!stateId || !cityName || saveMutation.isPending}>Salvar</Button>
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
