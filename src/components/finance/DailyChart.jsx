import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const fmtMoney = (v) =>
  `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtAxis = (v) =>
  parseFloat(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

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
      <p className="mt-1.5 pt-1.5 border-t border-border text-muted-foreground">
        Saldo: {fmtMoney(payload.reduce((s, e) => s + (e.name === "Despesas" ? -e.value : e.value), 0))}
      </p>
    </div>
  );
}

export default function DailyChart({ transactions }) {
  const dailyData = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const raw = tx.date || tx.launch_date;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!map[key]) map[key] = { date: key, Receitas: 0, Despesas: 0 };
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === "income") map[key].Receitas += amt;
      else map[key].Despesas += amt;
    });
    return Object.values(map).sort((a, b) => {
      const [da, db] = a.date.split("/").map(Number);
      const [ba, bb] = b.date.split("/").map(Number);
      return da === db ? db - db : db - da;
    });
  }, [transactions]);

  if (!dailyData.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Movimentações Diárias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={60} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}