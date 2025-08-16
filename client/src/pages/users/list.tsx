import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import UserForm from "@/components/users/user-form";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { PublicUser as User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function UsersList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openCreate, setOpenCreate] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);

  // paginação — 10 itens por página
  const pageSize = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você não está logado. Fazendo login...",
        variant: "destructive",
      });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: users = [], isFetching, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated,
  });

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedUsers = useMemo(
    () => users.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [users, pageSafe]
  );

  // --- Mutação de exclusão com confirmação ---
  async function deleteUserRequest(id: string | number) {
    return apiRequest("DELETE", `/api/users/${id}`);
  }

  const deleteMutation = useMutation({
    mutationFn: async (u: User) => {
      const res = await deleteUserRequest(u.id);
      return res.json().catch(() => undefined);
    },
    onMutate: async (u) => {
      // otimista: cancelar queries e aplicar snapshot
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });
      const prev = queryClient.getQueryData<User[]>(["/api/users"]) || [];
      queryClient.setQueryData<User[]>(["/api/users"], prev.filter((x) => x.id !== u.id));
      return { prev };
    },
    onError: (err, _u, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/users"], ctx.prev);
      toast({ title: "Erro ao excluir", description: (err as Error).message, variant: "destructive" });
    },
    onSuccess: (_data, u) => {
  toast({ title: "Usuário excluído", description: `${u.fullName} foi removido.` });
    },
    onSettled: () => {
  // Revalida em background sem limpar lista atual
  queryClient.invalidateQueries({ queryKey: ["/api/users"], refetchType: "inactive" });
    },
  });

  function askDelete(u: User) {
    setSelectedUser(u);
    setConfirmOpen(true);
  }

  function confirmDelete() {
    if (!selectedUser) return;
    deleteMutation.mutate(selectedUser);
    setConfirmOpen(false);
    setSelectedUser(null);
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Usuários"
          description="Cadastre e gerencie os usuários do sistema"
          action={
            <div className="flex items-center gap-2">
              {isFetching && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />
              )}
              <Button onClick={() => { setEditUser(null); setFormKey((k) => k + 1); setOpenCreate(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Usuário
              </Button>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto p-6">
          {isLoadingUsers ? null : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum usuário cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro usuário.</p>
              <Button size="lg" onClick={() => { setEditUser(null); setFormKey((k) => k + 1); setOpenCreate(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Usuário
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/60">
                      <TableHead className="w-[40%]">Nome</TableHead>
                      <TableHead className="w-[40%]">E-mail</TableHead>
                      <TableHead className="w-[20%] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedUsers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          {u.fullName}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar ${u.fullName}`}
                              title="Editar"
                              className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              onClick={() => { setEditUser(u); setFormKey((k) => k + 1); setOpenCreate(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Excluir ${u.fullName}`}
                              title="Excluir"
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => askDelete(u)}
                              disabled={deleteMutation.isPending && selectedUser?.id === u.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação (10 por página) */}
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-slate-600">
                <p>
                  Mostrando <span className="font-semibold">{pagedUsers.length}</span> de {" "}
                  <span className="font-semibold">{users.length}</span> usuários
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageSafe === 1}
                  >
                    Anterior
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={pageSafe === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                      className={pageSafe === p ? "" : "bg-white"}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageSafe === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal de criação */}
  <Dialog open={openCreate} onOpenChange={(v) => { if (v) setFormKey((k) => k + 1); if (!v) setEditUser(null); setOpenCreate(v); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
            <UserForm
      key={formKey}
              initialUser={editUser ? { id: editUser.id, fullName: editUser.fullName, email: editUser.email || '', phone: editUser.phone ?? '' } : null}
  onSuccess={() => {
        setEditUser(null);
        setOpenCreate(false);
                queryClient.invalidateQueries({ queryKey: ["/api/users"] });
              }}
              onCancel={() => setOpenCreate(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedUser ? (
                <strong>{` ${selectedUser.fullName} `}</strong>
              ) : (
                "este usuário"
              )}
              ? Essa ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>
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
