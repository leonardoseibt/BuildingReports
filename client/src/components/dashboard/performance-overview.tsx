import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, Calculator } from "lucide-react";
import PerformanceMatrix from "@/components/performance/performance-matrix";
import { Link } from "wouter";

const mockPerformanceData = {
  structuralSafety: "superior" as const,
  thermalPerformance: "intermediate" as const,
  acousticPerformance: "superior" as const,
  waterTightness: "minimum" as const,
  fireSafety: "superior" as const,
};

export default function PerformanceOverview() {
  return (
    <div className="space-y-6">
      {/* Performance Matrix */}
      <Card className="shadow-sm border-slate-200" data-testid="card-performance-matrix">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Matriz de Desempenho</CardTitle>
          <p className="text-sm text-slate-500">Último projeto avaliado</p>
        </CardHeader>
        <CardContent>
          <PerformanceMatrix data={mockPerformanceData} />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="shadow-sm border-slate-200" data-testid="card-quick-actions">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/buildings/new">
            <Button 
              variant="ghost" 
              className="w-full justify-start space-x-3 h-auto p-3 hover:bg-slate-50"
              data-testid="button-new-building"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-900">Nova Edificação</p>
                <p className="text-sm text-slate-500">Cadastrar novo projeto</p>
              </div>
            </Button>
          </Link>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start space-x-3 h-auto p-3 hover:bg-slate-50"
            data-testid="button-generate-report"
          >
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileDown className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-900">Gerar Relatório</p>
              <p className="text-sm text-slate-500">Exportar em PDF</p>
            </div>
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start space-x-3 h-auto p-3 hover:bg-slate-50"
            data-testid="button-calculate-performance"
          >
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calculator className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-900">Calcular Desempenho</p>
              <p className="text-sm text-slate-500">Executar análise técnica</p>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
