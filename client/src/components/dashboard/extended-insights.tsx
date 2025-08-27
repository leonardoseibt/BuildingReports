import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, Legend, LineChart, Line } from 'recharts';
import { AlertTriangle, Activity, AlertOctagon } from 'lucide-react';

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
    buildingsWithoutEvaluation: number;
    pendingEvaluations: number;
  };
  technicians: Array<{ technicianId: number; name: string; count: number }>;
  forecast?: { reportsCurrentMonth: number; projectedTotal: number; averagePerDay: number; daysSoFar: number; daysInMonth: number; progressPercent: number } | null;
  avgReportLeadTimeHours: number;
}

export function ExtendedInsights() {
  const { data, isLoading } = useQuery<ExtendedStats>({ queryKey: ['/api/dashboard/extended-stats'] });

  if (isLoading) return <div className="text-slate-500 text-sm">Carregando insights...</div>;
  if (!data) return null;

  const topTypologies = data.distributions.typologies.slice(0,5).map(t=>({ name: t.label || t.code || '—', count: t.count }));
  const weekly = data.weeklyActivity.map(w=>({ week: w.label, Edificacoes: w.buildings, Relatorios: w.reports }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
      <Card className="shadow-sm border-slate-200 lg:col-span-2">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Atividade Semanal (8 semanas)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ChartContainer config={{ Edificacoes: { label: 'Edificações', color: '#2563eb' }, Relatorios: { label: 'Relatórios', color: '#16a34a' } }} className="w-full">
              <LineChart data={weekly}>
                <XAxis dataKey="week" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} width={40} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="Edificacoes" stroke="var(--color-Edificacoes)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Relatorios" stroke="var(--color-Relatorios)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Top Tipologias</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ChartContainer config={{ count: { label: 'Quantidade', color: '#6366f1' } }} className="w-full">
              <BarChart data={topTypologies}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" fontSize={12} width={40} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4,4,0,0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

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

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Lead Time Médio</CardTitle></CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-slate-900">{data.avgReportLeadTimeHours.toFixed(2)}h</p>
          <p className="text-xs text-slate-500 mt-1">Criação da edificação → geração de relatório</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 lg:col-span-3">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold">Alertas de Dados</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg flex items-start gap-3 bg-amber-50 border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Edificações incompletas</p>
                <p className="text-2xl font-semibold text-slate-800">{data.alerts.incompleteBuildings}</p>
              </div>
            </div>
            <div className="p-4 border rounded-lg flex items-start gap-3 bg-rose-50 border-rose-200">
              <AlertOctagon className="w-5 h-5 text-rose-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Sem avaliação</p>
                <p className="text-2xl font-semibold text-slate-800">{data.alerts.buildingsWithoutEvaluation}</p>
              </div>
            </div>
            <div className="p-4 border rounded-lg flex items-start gap-3 bg-blue-50 border-blue-200">
              <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Avaliações pendentes</p>
                <p className="text-2xl font-semibold text-slate-800">{data.alerts.pendingEvaluations}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
