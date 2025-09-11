import { useState } from 'react';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import ReportForm from '@/components/reports/report-form';
import type { Report } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { showError, showSuccess } from '@/lib/toast-messages';
import { useToast } from '@/hooks/use-toast';

interface ReportItem extends Report {
  buildingName?: string;
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

  const { data: items = [] } = useQuery<ReportItem[]>({ queryKey: ['/api/reports'], enabled: isAuthenticated });

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
          {items.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum relatório cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro para utilizá-lo nas avaliações.</p>
              <Button size="lg" onClick={() => { setEditItem(null); setFormKey(k => k + 1); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Relatório
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/60">
                    <TableHead>Edificação</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.buildingName || r.buildingId}</TableCell>
                      <TableCell>{r.generatedAt ? new Date(r.generatedAt as any).toLocaleDateString('pt-BR') : ''}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => { setEditItem(r); setFormKey(k => k + 1); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
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
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (v) setFormKey(k => k + 1); if (!v) setEditItem(null); setOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <ReportForm key={formKey} initialItem={editItem} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['/api/reports'] }); if (editItem) { setEditItem(null); setOpen(false); } }} onCancel={() => setOpen(false)} />
          </div>
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
