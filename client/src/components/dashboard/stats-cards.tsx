import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, FileText, Clock, TrendingUp, TrendingDown } from "lucide-react";

interface DashboardStats {
  totalBuildings: number;
  totalReports: number;
  recentBuildings: any[];
}

interface ExtendedStats {
  avgReportLeadTimeHours: number;
}

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: extendedStats } = useQuery<ExtendedStats>({
    queryKey: ['/api/dashboard/extended-stats'],
  });

  const cards = [
    {
      title: "Total de Edificações",
      value: stats?.totalBuildings || 0,
      change: "+2 este mês",
      trend: "up",
      icon: Building2,
      iconBg: "bg-primary-100",
      iconColor: "text-primary-600",
      testId: "card-total-buildings"
    },
    {
      title: "Relatórios Gerados",
      value: stats?.totalReports || 0,
      change: "+5 esta semana",
      trend: "up",
      icon: FileText,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      testId: "card-total-reports"
    },
    {
      title: "Tempo Médio/Relatório",
      value: extendedStats?.avgReportLeadTimeHours 
        ? `${extendedStats.avgReportLeadTimeHours.toFixed(1)}h`
        : "--",
      change: "-70% vs manual",
      trend: "down",
      icon: Clock,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      testId: "card-average-time"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trend === "up" ? TrendingUp : card.trend === "down" ? TrendingDown : Clock;
        const trendColor = card.trend === "up" ? "text-green-600" : card.trend === "down" ? "text-green-600" : "text-yellow-600";
        
        return (
          <Card key={card.title} className="shadow-sm border-slate-200" data-testid={card.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium" data-testid={`text-${card.testId}-title`}>
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-slate-900 mt-2" data-testid={`text-${card.testId}-value`}>
                    {card.value}
                  </p>
                  <p className={`text-sm mt-2 flex items-center ${trendColor}`}>
                    <TrendIcon className="w-3 h-3 mr-1" />
                    <span data-testid={`text-${card.testId}-change`}>{card.change}</span>
                  </p>
                </div>
                <div className={`w-12 h-12 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${card.iconColor} text-xl w-6 h-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
