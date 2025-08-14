import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdCard, Plus } from "lucide-react";
import type { Technician } from "@shared/schema";

export default function TechniciansList() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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
            <Link href="/technicians/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Novo Responsável Técnico
              </Button>
            </Link>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          {!technicians || technicians.length === 0 ? (
            <div className="text-center py-12">
              <IdCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum responsável técnico cadastrado</h3>
              <p className="text-slate-500 mb-6">Cadastre o primeiro para utilizá-lo nos relatórios.</p>
              <Link href="/technicians/new">
                <Button size="lg">
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar Responsável Técnico
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {technicians.map((t) => (
                <Card key={t.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <IdCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{t.fullName}</CardTitle>
                        <CardDescription>
                          {t.registrationType ? `${t.registrationType} ` : ""}{t.creaCau}
                          {t.licenseState ? ` / ${t.licenseState}` : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {t.email && (
                      <div>
                        <span className="text-slate-500">Email:</span> <span className="font-medium">{t.email}</span>
                      </div>
                    )}
                    {t.phone && (
                      <div>
                        <span className="text-slate-500">Telefone:</span> <span className="font-medium">{t.phone}</span>
                      </div>
                    )}
                    {t.company && (
                      <div>
                        <span className="text-slate-500">Empresa:</span> <span className="font-medium">{t.company}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
