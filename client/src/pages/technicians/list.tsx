import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TechnicianForm from "@/components/technicians/technician-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IdCard, Plus, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Technician } from "@shared/schema";

export default function TechniciansList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Não autorizado", description: "Você não está logado. Fazendo login...", variant: "destructive" });
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: technicians } = useQuery<Technician[]>({ queryKey: ["/api/technicians"], enabled: isAuthenticated });

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Responsáveis Técnicos"
          description="Cadastre e gerencie os profissionais"
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Responsável Técnico
            </Button>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          {!technicians || technicians.length === 0 ? (
            <div className="text-center py-12">
              <IdCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum responsável técnico cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro para utilizá-lo nos relatórios.</p>
              <Button size="lg" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Responsável Técnico
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.map((t) => (
                    <TableRow key={t.id} data-testid={`row-technician-${t.id}`}>
                      <TableCell className="font-medium">{t.fullName}</TableCell>
                      <TableCell>
                        {t.registrationType ? `${t.registrationType} ` : ""}
                        {t.creaCau}
                        {t.licenseState ? ` / ${t.licenseState}` : ""}
                      </TableCell>
                      <TableCell>{t.email || "-"}</TableCell>
                      <TableCell>{t.phone || "-"}</TableCell>
                      <TableCell>{t.company || "-"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Responsável Técnico</DialogTitle>
          </DialogHeader>
          <TechnicianForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
