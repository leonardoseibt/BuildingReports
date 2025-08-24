import { useAuth } from "@/hooks/useAuth";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import StatsCards from "@/components/dashboard/stats-cards";
import RecentProjects from "@/components/dashboard/recent-projects";
import PerformanceOverview from "@/components/dashboard/performance-overview";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  useAuthRedirect();

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
    <div className="flex h-screen bg-slate-50" data-testid="dashboard-container">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Dashboard"
          description="Visão geral dos seus projetos e relatórios"
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          <StatsCards />

          {/* Quick Actions below stats */}
          <div className="mt-6">
            <PerformanceOverview />
          </div>

          {/* Recent Projects as the last card */}
          <div className="mt-8">
            <RecentProjects />
          </div>
        </main>
      </div>
    </div>
  );
}
