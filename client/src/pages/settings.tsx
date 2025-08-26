import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPlaceholder() {
  return (
    <div className="flex h-screen bg-slate-50" data-testid="settings-layout">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Configurações"
          description="Página ainda não implementada"
        />
        <main className="flex-1 overflow-y-auto p-8 flex items-start justify-center">
          <Card className="w-full max-w-xl" data-testid="settings-not-implemented">
            <CardContent className="pt-8 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <h1 className="text-2xl font-bold text-slate-900">404 - Página não encontrada</h1>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                A seção de Configurações ainda não foi desenvolvida. Ela aparecerá aqui mantendo a navegação padrão (sidebar e header) assim que estiver pronta.
              </p>
              <p className="mt-4 text-slate-500 text-xs">
                Se você esperava ver algum recurso específico, registre isso como feedback para priorizarmos.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
