import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Globe2, Plus, Loader2, Pencil, Trash2, MapPin, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { BioclimaticZone, BioclimaticZoneCoverage } from "@shared/schema";
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Não autorizado", description: "Você não está logado. Fazendo login...", variant: "destructive" });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: zones = [], isFetching, isLoading: isLoadingItems } = useQuery<BioclimaticZone[]>({ queryKey: ["/api/bioclimatic-zones"], enabled: isAuthenticated });

  async function deleteRequest(id: number) {
    const res = await fetch(`/api/bioclimatic-zones/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
  const deleteMutation = useMutation({
    mutationFn: async (z: BioclimaticZone) => deleteRequest(z.id),
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
          {isLoadingItems ? (
            <div className="text-center py-12"><Globe2 className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Carregando...</p></div>
          ) : zones.length === 0 ? (
            <div className="text-center py-12">
              <Globe2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma zona cadastrada</h3>
              <p className="text-slate-500 mb-6">Cadastre as zonas ZB1..ZB8 e suas abrangências.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Zona
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead className="w-[12%]">Código</TableHead>
                    <TableHead className="w-[40%]">Descrição</TableHead>
                    <TableHead className="w-[22%]">Ativa</TableHead>
                    <TableHead className="w-[18%]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="font-medium">{z.code}</TableCell>
                      <TableCell>{z.label}</TableCell>
                      <TableCell>{(z as any).isActive ? 'Sim' : 'Não'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => { setCoveragesFor(z); }}>
                            <MapPin className="h-4 w-4 mr-1" /> Abrangências
                          </Button>
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
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <ZoneForm key={formKey} initialItem={editItem} onSuccess={() => { setEditItem(null); setOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones"] }); }} onCancel={() => setOpen(false)} />
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
  const { data: coverages = [], isLoading } = useQuery<BioclimaticZoneCoverage[]>({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"], queryFn: async () => {
    const res = await fetch(`/api/bioclimatic-zones/${zone.id}/coverages`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }});

  const addMutation = useMutation({
    mutationFn: async (payload: { state: string; city?: string; }) => {
      const res = await fetch(`/api/bioclimatic-zones/${zone.id}/coverages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] }); toast({ title: 'Abrangência adicionada' }); },
    onError: () => { toast({ title: 'Erro', description: 'Falha ao adicionar abrangência', variant: 'destructive' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (coverageId: number) => {
      const res = await fetch(`/api/bioclimatic-zones/coverages/${coverageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bioclimatic-zones", zone.id, "coverages"] }); toast({ title: 'Abrangência removida' }); },
    onError: () => { toast({ title: 'Erro', description: 'Falha ao remover abrangência', variant: 'destructive' }); },
  });

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  return (
    <div className="fixed inset-y-0 right-0 w-[28rem] bg-white shadow-2xl border-l border-slate-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Abrangências — {zone.code}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="UF" className="col-span-1 h-8 border rounded px-2" maxLength={2} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade (opcional para UF toda)" className="col-span-2 h-8 border rounded px-2" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => addMutation.mutate({ state, city: city.trim() || undefined })} disabled={!state || addMutation.isPending}>Adicionar</Button>
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : coverages.length === 0 ? (
          <p className="text-slate-500">Nenhuma abrangência cadastrada.</p>
        ) : (
          <ul className="space-y-1">
            {coverages.map((c) => (
              <li key={(c as any).id} className="flex items-center justify-between border rounded px-3 py-2">
                <span>{c.state} {c.city ? `— ${c.city}` : '(UF inteira)'}</span>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate((c as any).id)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
