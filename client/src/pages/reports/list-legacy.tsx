// Legacy reports list (temporarily archived until real implementation is finalized)
// Original functionality preserved here.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Calendar, Building2, Download, Eye } from "lucide-react";
import type { Report } from "@shared/schema";

export default function ReportListLegacy() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useAuthRedirect();

  const { data: reports, isLoading, error } = useQuery<Report[]>({
    queryKey: ['/api/reports'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({ title: 'Sessão finalizada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [error, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const formatDate = (dateStr: string | Date) => {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-slate-50" data-testid="report-list-container-legacy">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Relatórios"
          description="Visualize e gerencie seus relatórios gerados"
          action={
            <Link href="/buildings">
              <Button data-testid="button-new-report">
                <Plus className="w-4 h-4 mr-2" />
                Novo Relatório
              </Button>
            </Link>
          }
        />
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-slate-600">Carregando relatórios...</p>
              </div>
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2" data-testid="text-no-reports">
                Nenhum relatório encontrado
              </h3>
              <p className="text-slate-500 mb-6">
                Cadastre uma edificação e execute a avaliação de desempenho para gerar seu primeiro relatório.
              </p>
              <Link href="/buildings">
                <Button size="lg" data-testid="button-create-first-report">
                  <Building2 className="w-4 h-4 mr-2" />
                  Cadastrar Edificação
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow" data-testid={`card-report-${report.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <Badge variant="secondary" data-testid={`badge-report-version-${report.id}`}>
                        v{report.version}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg" data-testid={`text-report-building-${report.id}`}>
                      {(report as any).buildingName || 'Relatório de Desempenho'}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <Calendar className="w-3 h-3" />
                      <span data-testid={`text-report-date-${report.id}`}>
                        Gerado em {formatDate(report.generatedAt!)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm">
                      <p className="text-slate-500 mb-2">ID do Relatório:</p>
                      <p className="font-mono text-xs bg-slate-100 p-2 rounded break-all" data-testid={`text-report-id-${report.id}`}>
                        {report.id}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${report.id}`}>
                        <Eye className="w-3 h-3 mr-1" />
                        Visualizar
                      </Button>
                      <Button size="sm" className="flex-1" data-testid={`button-download-${report.id}`}>
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
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
