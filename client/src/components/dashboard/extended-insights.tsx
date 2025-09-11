import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface ExtendedStats {
  buildingsLast30: number;
  reportsLast30: number;
  distributions: {
    typologies: Array<{ typologyId: number | null; code: string | null; label: string | null; count: number }>;
    noiseClasses: Array<{ noiseClassId: number | null; code: string | null; label: string | null; count: number }>;
    aggressivenessClasses: Array<{ aggressivenessClassId: number | null; code: string | null; label: string | null; count: number }>;
    states: Array<{ state: string; count: number; percent: number }>;
  };
  weeklyActivity: Array<{ label: string; buildings: number; reports: number }>;
  alerts: {
    incompleteBuildings: number;
  };
  technicians: Array<{ technicianId: number; name: string; count: number }>;
  forecast?: { reportsCurrentMonth: number; projectedTotal: number; averagePerDay: number; daysSoFar: number; daysInMonth: number; progressPercent: number } | null;
  avgReportLeadTimeHours: number;
}

export function ExtendedInsights() {
  const { data, isLoading } = useQuery<ExtendedStats>({
    queryKey: ['/api/dashboard/extended-stats'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div className="text-slate-500 text-sm">Carregando insights...</div>;
  if (!data) return null;

  // Cards de atividade semanal e top tipologias removidos conforme solicitação.

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
  {/* Cards removidos: Atividade Semanal e Top Tipologias */}

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Ranking Técnicos</CardTitle></CardHeader>
        <CardContent>
          {data.technicians.length === 0 ? <p className="text-sm text-slate-500">Sem técnicos vinculados.</p> : (
            <ul className="space-y-2 text-sm">
              {data.technicians.map((t,i)=>(
                <li key={t.technicianId} className="flex justify-between">
                  <span><span className="font-mono text-slate-400 mr-1">#{i+1}</span>{t.name || '—'}</span>
                  <span className="font-medium">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Distribuição por UF</CardTitle></CardHeader>
        <CardContent>
          {data.distributions.states.length === 0 ? <p className="text-sm text-slate-500">Sem UF preenchida.</p> : (
            <div className="space-y-2 text-xs">
              {data.distributions.states.slice(0,8).map(s=> (
                <div key={s.state}>
                  <div className="flex justify-between mb-0.5"><span className="font-medium">{s.state}</span><span>{s.count} ({s.percent}%)</span></div>
                  <div className="h-1.5 bg-slate-100 rounded">
                    <div className="h-full rounded bg-indigo-500" style={{width:`${s.percent}%`}} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Forecast Relatórios</CardTitle></CardHeader>
        <CardContent>
          {!data.forecast ? <p className="text-sm text-slate-500">Sem dados para projeção.</p> : (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Emitidos:</span> {data.forecast.reportsCurrentMonth} / {data.forecast.projectedTotal} (proj.)</p>
              <p><span className="font-semibold">Média/dia:</span> {data.forecast.averagePerDay}</p>
              <div className="h-2 bg-slate-100 rounded">
                <div className="h-full bg-emerald-500 rounded" style={{width: `${data.forecast.progressPercent}%`}} />
              </div>
              <p className="text-xs text-slate-500">{data.forecast.daysSoFar} de {data.forecast.daysInMonth} dias</p>
            </div>
          )}
        </CardContent>
      </Card>


      <Card className="shadow-sm border-slate-200 lg:col-span-3">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Alertas de Dados</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 border rounded-lg flex items-start gap-3 bg-amber-50 border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Edificações incompletas</p>
                <p className="text-2xl font-semibold text-slate-800">{data.alerts.incompleteBuildings}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
