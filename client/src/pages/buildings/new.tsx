import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import BuildingForm from "@/components/buildings/building-form";

export default function NewBuilding() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você não está logado. Fazendo login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" data-testid="new-building-container">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <Header 
          title="Nova Edificação"
          description="Complete os dados para iniciar a avaliação de desempenho"
        />
        
        <main className="flex-1 overflow-y-auto overscroll-contain p-6 min-h-0">
          <BuildingForm />
        </main>
      </div>
    </div>
  );
}
