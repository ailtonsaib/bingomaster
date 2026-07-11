import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

const fmtMoney = (v) =>
  `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtAxis = (v) => parseFloat(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {fmtMoney(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function CashFlowForecast({ transactions }) {
  const forecast = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const horizons = [5, 10, 15, 30];

    // Saldo atual = receitas baixadas - despesas baixadas (realizado até hoje)
    const settledBalance = transactions
      .filter((t) => t.status === "settled")
      .reduce((s, t) => s + (t.type === "income" ? parseFloat(t.amount) : -parseFloat(t.amount)), 0);

    const rows = horizons.map((days) => {
      const limit = new Date(now);
      limit.setDate(limit.getDate() + days);
      limit.setHours(23, 59, 59, 999);

      let income = 0;
      let expense = 0;
      let count = 0;

      transactions.forEach((tx) => {
        if (tx.status === "settled") return; // já contabilizado no saldo inicial
        const ref = new Date(tx.due_date || tx.date);
        if (isNaN(ref.getTime())) return;
        ref.setHours(0, 0, 0, 0);
        if (ref > now && ref <= limit) {
          count++;
          const amt = parseFloat(tx.amount) || 0;
          if (tx.type === "income") income += amt;
          else expense += amt;
        }
      });

      const projected = settledBalance + income - expense;
      return { horizon: `${days} dias`, Receitas: income, Despesas: expense, Saldo: projected, count };
    });

    return { rows, settledBalance };
  }, [transactions]);

  if (!transactions.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          Projeção de Fluxo de Caixa
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Saldo atual realizado: <span className="font-semibold">{fmtMoney(forecast.settledBalance)}</span>
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={forecast.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="horizon" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={60} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
            <Line dataKey="Saldo" stroke="#6200EA" strokeWidth={2.5} dot={{ r: 5, fill: "#6200EA" }} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Cards resumo por horizonte */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {forecast.rows.map((r) => (
            <div key={r.horizon} className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">{r.horizon}</p>
              <p className={`text-base font-bold ${r.Saldo >= 0 ? "text-primary" : "text-red-600"}`}>
                {fmtMoney(r.Saldo)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {r.count} lançamento(s) pendente(s)
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}