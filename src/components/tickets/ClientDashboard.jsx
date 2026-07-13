import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  iniciado: "Iniciado",
  em_teste: "Em Teste",
  concluido: "Concluído",
};

const STATUS_COLORS = {
  aberto: "#3b82f6",
  em_analise: "#f97316",
  iniciado: "#8b5cf6",
  em_teste: "#06b6d4",
  concluido: "#22c55e",
};

function parseISO(iso) {
  if (!iso) return null;
  try { return new Date(iso); } catch { return null; }
}

function diffHours(start, end) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!s || !e) return null;
  return Math.max(0, (e - s) / (1000 * 60 * 60));
}

function formatHours(h) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  const days = h / 24;
  return `${days.toFixed(1)} dias`;
}

export default function ClientDashboard({ tickets }) {
  const data = useMemo(() => {
    const byStatus = { aberto: 0, em_analise: 0, iniciado: 0, em_teste: 0, concluido: 0 };
    let openCount = 0;
    let closedCount = 0;
    let openTimeSum = 0;
    let openTimeCount = 0;
    let closedTimeSum = 0;
    let closedTimeCount = 0;
    const now = new Date();

    for (const t of tickets) {
      const st = t.status || "aberto";
      if (byStatus[st] != null) byStatus[st]++;

      if (st === "concluido") {
        closedCount++;
        const h = diffHours(t.aberto_at, t.concluido_at);
        if (h != null) { closedTimeSum += h; closedTimeCount++; }
      } else {
        openCount++;
        const h = diffHours(t.aberto_at, now.toISOString());
        if (h != null) { openTimeSum += h; openTimeCount++; }
      }
    }

    const pieData = Object.entries(byStatus).filter(([, v]) => v > 0).map(([k, v]) => ({
      name: STATUS_LABELS[k],
      value: v,
      color: STATUS_COLORS[k],
    }));

    const barData = [
      { name: "Abertos", Abertos: openCount, Concluídos: closedCount },
    ];

    const avgOpen = openTimeCount > 0 ? openTimeSum / openTimeCount : null;
    const avgClosed = closedTimeCount > 0 ? closedTimeSum / closedTimeCount : null;

    const timeBarData = [
      { name: "Abertos", "Tempo médio": avgOpen ? Number((avgOpen / 24).toFixed(1)) : 0 },
      { name: "Concluídos", "Tempo médio": avgClosed ? Number((avgClosed / 24).toFixed(1)) : 0 },
    ];

    return {
      pieData,
      barData,
      timeBarData,
      total: tickets.length,
      openCount,
      closedCount,
      avgOpen,
      avgClosed,
    };
  }, [tickets]);

  const resolutionRate = data.total > 0 ? Math.round((data.closedCount / data.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total de Chamados</p>
            <p className="text-2xl font-bold mt-1">{data.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Em Aberto</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{data.openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{data.closedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Taxa de Resolução</p>
            <p className="text-2xl font-bold mt-1 text-primary">{resolutionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie: distribution by status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            {data.pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum chamado para exibir</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={data.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {data.pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar: abertos x concluidos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Abertos x Concluídos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Abertos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Concluídos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Time: tempo médio aberto x concluido */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Tempo Médio (dias)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tempo médio em aberto</p>
                    <p className="text-lg font-bold text-blue-700">{formatHours(data.avgOpen)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tempo médio de resolução</p>
                    <p className="text-lg font-bold text-emerald-700">{formatHours(data.avgClosed)}</p>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.timeBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit=" d" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(v) => [`${v} dias`, "Tempo médio"]} />
                  <Bar dataKey="Tempo médio" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}