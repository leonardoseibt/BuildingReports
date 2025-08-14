import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import UserForm from "@/components/users/user-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { User } from "@shared/schema";

export default function UsersList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Não autorizado", description: "Você não está logado. Fazendo login...", variant: "destructive" });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"], enabled: isAuthenticated });

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Usuários"
          description="Cadastre e gerencie os usuários do sistema"
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Usuário
            </Button>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          {!users || users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum usuário cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro usuário.</p>
              <Button size="lg" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Usuário
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium">
                        {u.firstName} {u.lastName}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-5 border-b bg-gradient-to-r from-primary/10 to-transparent">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-xl">Novo Usuário</DialogTitle>
              <DialogDescription className="text-slate-600">
                Cadastre um novo usuário com nome e e-mail para acesso ao sistema.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Modal Body */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <UserForm onSuccess={() => setOpen(false)} />
          </div>
          <Separator />
          {/* Modal Footer */}
          <div className="px-6 py-4 flex items-center justify-end gap-3 bg-white">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
