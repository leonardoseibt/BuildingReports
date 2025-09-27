import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comparePt } from '@/lib/utils';
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showSuccess, showError } from "@/lib/toast-messages";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import UserForm from "@/components/users/user-form";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Pencil, Trash2, Loader2, Search, ArrowDown, ArrowUp, ShieldAlert, AlertCircle } from "lucide-react";
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

// Local formatter to display BR phone numbers stored as digits
function formatPhoneBRDisplay(v?: string | null) {
  if (!v) return "";
  const digits = String(v).replace(/\D/g, "").slice(0, 11);
  if (digits.length < 10) return v; // fallback if incomplete
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
import { apiRequest } from "@/lib/queryClient";
import { parseApiError } from "@/lib/api-error";
import { usePageSize } from "@/hooks/useSettings";

export default function UsersList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [openCreate, setOpenCreate] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"fullName" | "email" | "phone" | "createdAt" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // paginação — 10 itens por página
  const pageSize = usePageSize(isAuthenticated);
  const [page, setPage] = useState(1);

  useAuthRedirect();

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const usersQuery = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated,
  });

  const {
    data: usersData,
    error: usersError,
    isError,
    isSuccess,
    isFetching,
    isLoading: isLoadingUsers,
  } = usersQuery;

  const lastHandledError = useRef<string | null>(null);

  useEffect(() => {
    if (!isSuccess) return;
    lastHandledError.current = null;
    setAccessDenied(false);
    setLoadError(null);
  }, [isSuccess]);

  useEffect(() => {
    if (!isError || !usersError) return;
    const parsed = parseApiError(usersError);
    const key = `${parsed.status ?? "unknown"}:${parsed.message}`;
    if (lastHandledError.current === key) return;
    lastHandledError.current = key;
    if (parsed.status === 403) {
      const description = parsed.message || "Você não tem permissão para acessar a gestão de usuários.";
      setAccessDenied(true);
      setLoadError(description);
      showError(toast, description);
    } else {
      const description = parsed.message || "Não foi possível carregar os usuários.";
      setLoadError(description);
      showError(toast, description);
    }
  }, [isError, usersError, toast]);

  const canManageUsers = !accessDenied;
  const users: User[] = canManageUsers ? usersData ?? [] : [];

  useEffect(() => {
    if (!canManageUsers) {
      setOpenCreate(false);
      setConfirmOpen(false);
      setEditUser(null);
      setSelectedUser(null);
      setPage(1);
    }
  }, [canManageUsers]);

  // Filter (supports punctuation like '(' in phones and '/' in dates)
  const normText = (v: any) =>
    String(v ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]+/g, "");
  const onlyDigits = (v: any) => String(v ?? "").replace(/\D+/g, "");
  const filtered = useMemo(() => {
    const q = normText(search);
    const qDigits = onlyDigits(search);
    if (!q) return users;
    return users.filter((u) => {
      const name = normText(u.fullName);
      const email = normText(u.email);
      const phoneDisplay = formatPhoneBRDisplay(u.phone);
      const phoneText = normText(phoneDisplay);
      const phoneDigits = onlyDigits(u.phone);
      const createdDisplay = formatDateBR(u.createdAt as any);
      const createdText = normText(createdDisplay);
      const createdRaw = normText(u.createdAt as any);
      return (
        name.includes(q) ||
        email.includes(q) ||
        phoneText.includes(q) ||
        (!!qDigits && phoneDigits.includes(qDigits)) ||
        createdText.includes(q) ||
        createdRaw.includes(q)
      );
    });
  }, [users, search]);

  // Sort
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
      } else {
  cmp = comparePt(av, bv);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  // Pagination over sorted list
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedUsers = useMemo(
    () => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [sorted, pageSafe, pageSize],
  );

  const toggleSort = (col: typeof sortBy) => {
    if (col === null) return;
    if (sortBy !== col) {
      setSortBy(col);
  setSortDir('asc'); // first click is ascending
    } else {
  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
    setPage(1);
  };

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
      const parsed = parseApiError(err);
      if (parsed.status === 403) {
        const description = parsed.message || "Você não tem permissão para executar esta ação.";
        setAccessDenied(true);
        setLoadError(description);
        showError(toast, description);
      } else {
        const detail = parsed.message ? `Erro ao excluir: ${parsed.message}` : "Erro ao excluir usuário.";
        showError(toast, detail);
      }
    },
    onSuccess: (_data, u) => {
      showSuccess(toast, `${u.fullName} foi removido.`);
    },
    onSettled: (_result, error) => {
      if (error) {
        const parsed = parseApiError(error);
        if (parsed.status === 403) {
          return;
        }
      }
      // Revalida em background sem limpar lista atual
      queryClient.invalidateQueries({ queryKey: ["/api/users"], refetchType: "inactive" });
    },
  });

  function askDelete(u: User) {
    if (!canManageUsers) return;
    setSelectedUser(u);
    setConfirmOpen(true);
  }

  function confirmDelete() {
    if (!selectedUser || !canManageUsers) return;
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
            canManageUsers ? (
              <div className="flex items-center gap-2">
                {isFetching && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" />
                )}
                <Button onClick={() => { setEditUser(null); setFormKey((k) => k + 1); setOpenCreate(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Novo Usuário
                </Button>
              </div>
            ) : (
              isFetching ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando" /> : undefined
            )
          }
        />

        <main className="flex-1 overflow-y-auto p-6">
          {accessDenied ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center shadow-sm text-rose-700">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-2">Acesso negado</h3>
              <p className="text-rose-700/80 max-w-xl mx-auto">
                {loadError ?? 'Você não tem permissão para acessar a gestão de usuários.'}
              </p>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center shadow-sm text-amber-800">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-2">Não foi possível carregar os usuários</h3>
              <p className="text-amber-800/80 max-w-xl mx-auto">{loadError}</p>
            </div>
          ) : (
            <>
              {/* Search Card */}
              <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-full max-w-lg">
                    <Input
                      type="text"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Buscar usuários (nome, e-mail, telefone, data)"
                      className="h-9 pl-9"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  </div>
                </div>
              </div>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Carregando usuários...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum usuário cadastrado</h3>
                  <p className="text-slate-500 mb-6">Cadastre o primeiro usuário.</p>
                  <Button
                    size="lg"
                    onClick={() => { setEditUser(null); setFormKey((k) => k + 1); setOpenCreate(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Cadastrar Usuário
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                  <div className="overflow-x-auto">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow className="bg-slate-100/60">
                          <TableHead
                            onClick={() => toggleSort('fullName')}
                            aria-sort={sortBy === 'fullName' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            className="w-[27%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none"
                          >
                            <span>Nome</span>
                            {sortBy === 'fullName' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" />
                              ) : (
                                <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('email')}
                            aria-sort={sortBy === 'email' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            className="w-[27%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none"
                          >
                            <span>E-mail</span>
                            {sortBy === 'email' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" />
                              ) : (
                                <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('phone')}
                            aria-sort={sortBy === 'phone' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            className="w-[18%] whitespace-nowrap max-sm:whitespace-normal cursor-pointer select-none"
                          >
                            <span>Telefone</span>
                            {sortBy === 'phone' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="inline-block w-3 h-3 ml-1 opacity-70" />
                              ) : (
                                <ArrowDown className="inline-block w-3 h-3 ml-1 opacity-70" />
                              ))}
                          </TableHead>
                          <TableHead className="w-[28%] text-right whitespace-nowrap">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedUsers.map((u) => (
                          <TableRow key={u.id} className="hover:bg-slate-50">
                            <TableCell className="w-[27%] font-medium whitespace-nowrap max-sm:whitespace-normal overflow-hidden text-ellipsis">
                              {u.fullName}
                            </TableCell>
                            <TableCell className="w-[27%] whitespace-nowrap max-sm:whitespace-normal overflow-hidden text-ellipsis">
                              {u.email}
                            </TableCell>
                            <TableCell className="w-[18%] whitespace-nowrap max-sm:whitespace-normal overflow-hidden text-ellipsis">
                              {formatPhoneBRDisplay(u.phone)}
                            </TableCell>
                            <TableCell className="w-[28%]">
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
                      Mostrando <span className="font-semibold">{pagedUsers.length}</span> de{" "}
                      <span className="font-semibold">{users.length}</span> usuários
                    </p>
                    <Pagination totalPages={totalPages} page={pageSafe} onPageChange={(p: number) => setPage(p)} />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de criação */}
      {canManageUsers && (
        <Dialog
          open={openCreate}
          onOpenChange={(v) => {
            if (v) setFormKey((k) => k + 1);
            if (!v) setEditUser(null);
            setOpenCreate(v);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
              <UserForm
                key={formKey}
                initialUser={editUser ? { id: editUser.id, fullName: editUser.fullName, email: editUser.email || '', phone: editUser.phone ?? '', isAdmin: (editUser as any).isAdmin ?? false, allowedModules: (editUser as any).allowedModules ?? [] } : null}
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
      )}

      {/* Modal de confirmação de exclusão */}
      {canManageUsers && (
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
      )}
    </div>
  );
}
