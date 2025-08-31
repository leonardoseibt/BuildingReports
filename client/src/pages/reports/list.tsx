import Sidebar from "@/components/layout/sidebar";
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useAuth } from '@/hooks/useAuth';
import Header from "@/components/layout/header";
import { AlertCircle, FileText, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// Placeholder page for Reports until full feature implementation
export default function ReportList() {
  const { isAuthenticated, isLoading } = useAuth();
  useAuthRedirect();
  if (isLoading) return null;
  if (!isAuthenticated) return null;
  return (
    <div className="flex h-screen bg-slate-50" data-testid="reports-placeholder-layout">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Relatórios"
          description="Página ainda não implementada"
          action={
            <Link href="/buildings">
              <Button data-testid="button-new-report">
                <Plus className="w-4 h-4 mr-2" />
                Novo Relatório
              </Button>
            </Link>
          }
        />
        <main className="flex-1 overflow-y-auto p-8 flex items-start justify-center">
          <Card className="w-full max-w-xl" data-testid="reports-not-implemented">
            <CardContent className="pt-8 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <h1 className="text-2xl font-bold text-slate-900">404 - Página não encontrada</h1>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                A listagem e gerenciamento de relatórios ainda não foram desenvolvidos. Assim que os relatórios forem gerados a partir das avaliações de desempenho, eles aparecerão aqui.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FileText className="w-4 h-4" />
                <span>
                  Para gerar um relatório, primeiro cadastre uma edificação e execute uma avaliação de desempenho.
                </span>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
