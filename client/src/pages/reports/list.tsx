import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { usePageSize } from '@/hooks/useSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PaginationSimple as Pagination } from '@/components/ui/pagination';
import { Plus, Pencil, Trash2, MapPin, Search, Printer, FileText, FileDown, Braces } from 'lucide-react';
import ReportForm from '@/components/reports/report-form';
import type { Report } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { showError, showSuccess } from '@/lib/toast-messages';
import { useToast } from '@/hooks/use-toast';

interface ReportItem extends Report {
  buildingName?: string;
  buildingLocation?: string;
  buildingArea?: string;
  buildingHeight?: string;
  buildingFloors?: number;
}

export default function ReportsList() {
  const { isAuthenticated, isLoading } = useAuth();
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editItem, setEditItem] = useState<ReportItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReportItem | null>(null);
  const [search, setSearch] = useState("");

  // Variáveis de paginação
  const pageSize = usePageSize(isAuthenticated);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const { data: allItems = [] } = useQuery<ReportItem[]>({ queryKey: ['/api/reports'], enabled: isAuthenticated });

  // Função helper para normalizar texto (remove acentos, lowercase)
  const normText = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
  
  // Filtrar itens baseado na busca
  const filteredItems = useMemo(() => {
    if (!search) return allItems;
    const q = normText(search);
    return allItems.filter((item) => {
      const buildingName = normText(item.buildingName || "");
      const buildingLocation = normText(item.buildingLocation || "");
      const buildingArea = normText(item.buildingArea || "");
      const buildingHeight = normText(item.buildingHeight || "");
      const floors = normText(item.buildingFloors || "");
      const date = normText(item.generatedAt ? new Date(item.generatedAt as any).toLocaleDateString('pt-BR') : "");

      return (
        buildingName.includes(q) ||
        buildingLocation.includes(q) ||
        buildingArea.includes(q) ||
        buildingHeight.includes(q) ||
        floors.includes(q) ||
        date.includes(q)
      );
    });
  }, [allItems, search]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== pageSafe) {
      setPage(pageSafe);
    }
  }, [page, pageSafe]);

  const pagedItems = useMemo(() => {
    const startIndex = (pageSafe - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, pageSafe, pageSize]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/reports/${id}`);
      return true;
    },
    onSuccess: () => {
      showSuccess(toast, 'Relatório removido.');
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: () => showError(toast, 'Falha ao excluir relatório'),
  });

  function askDelete(item: ReportItem) {
    setSelectedItem(item);
    setConfirmOpen(true);
  }

  function openReportPdf(item: ReportItem) {
    const pdfUrl = `/api/reports/${item.id}/puppeteer?inline=1`;
    const popup = window.open('', '_blank');
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        /* noop */
      }
      popup.location.href = pdfUrl;
    } else {
      window.location.href = pdfUrl;
    }
  }

  function openReportPdfJs(item: ReportItem) {
    const pdfUrl = `/api/reports/${item.id}/jsreport?inline=1`;
    const popup = window.open('', '_blank');
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        /* noop */
      }
      popup.location.href = pdfUrl;
    } else {
      window.location.href = pdfUrl;
    }
  }

  function openReportJson(item: ReportItem) {
    const jsonUrl = `/api/reports/${item.id}/json?inline=1`;
    const popup = window.open('', '_blank');
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        /* noop */
      }
      popup.location.href = jsonUrl;
    } else {
      window.location.href = jsonUrl;
    }
  }

  function confirmDelete() {
    if (!selectedItem) return;
    deleteMutation.mutate(selectedItem.id);
    setConfirmOpen(false);
    setSelectedItem(null);
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Relatórios"
          description="Gerencie os relatórios cadastrados"
          action={
            <Button onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Novo Relatório
            </Button>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Search Card */}
          <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-lg">
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar relatórios (edificação, localização, área, altura, data)"
                  className="h-9 pl-9"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>
          </div>
          
          {filteredItems.length === 0 && allItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum relatório cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro para utilizá-lo nas avaliações.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Relatório
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum resultado encontrado</h3>
              <p className="text-slate-500 mb-6">Tente ajustar os termos da busca para encontrar relatórios.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead>Edificação</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Área</TableHead>
                    <TableHead className="text-right">Altura</TableHead>
                    <TableHead className="text-right">Pav.</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.buildingName || r.buildingId}</TableCell>
                      <TableCell>
                        {r.buildingLocation ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {r.buildingLocation}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.buildingArea ? `${r.buildingArea}m²` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.buildingHeight != null ? `${r.buildingHeight}m` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.buildingFloors || '—'}
                      </TableCell>
                      <TableCell>{r.generatedAt ? new Date(r.generatedAt as any).toLocaleDateString('pt-BR') : ''}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => { setEditItem(r); setFormKey(k => k + 1); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openReportPdf(r)} title="Gerar PDF (Puppeteer)">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openReportPdfJs(r)} title="Gerar PDF (jsreport)">
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openReportJson(r)} title="Gerar JSON">
                            <Braces className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(r)}>
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
                  <span className="font-semibold">{filteredItems.length}</span> relatórios
                </p>
                <Pagination
                  totalPages={totalPages}
                  page={pageSafe}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-7 overflow-hidden">
          <ReportForm key={formKey} initialItem={editItem} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['/api/reports'] }); if (editItem) { setEditItem(null); setOpen(false); } }} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>


      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este relatório?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
