import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
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

export default function MonthlyForecastChart({ transactions }) {
  const data = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();

    // Build array for each day of the month
    const rows = [];
    for (let day = 1; day <= daysInMonth; day++) {
      rows.push({
        day: String(day).padStart(2, "0"),
        label: `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`,
        Receber: 0,
        Pagar: 0,
        isPast: day < today,
        isToday: day === today,
      });
    }

    transactions.forEach((tx) => {
      if (tx.status === "settled") return;
      const ref = new Date(tx.due_date || tx.date);
      if (isNaN(ref.getTime())) return;
      if (ref.getFullYear() !== year || ref.getMonth() !== month) return;
      const day = ref.getDate();
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === "income") rows[day - 1].Receber += amt;
      else rows[day - 1].Pagar += amt;
    });

    return rows;
  }, [transactions]);

  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const totalReceber = data.reduce((s, d) => s + d.Receber, 0);
  const totalPagar = data.reduce((s, d) => s + d.Pagar, 0);
  const saldoMes = totalReceber - totalPagar;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          Previsão de Recebimentos e Pagamentos — {monthName}
        </CardTitle>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            A Receber: <span className="font-semibold text-emerald-600">{fmtMoney(totalReceber)}</span>
          </span>
          <span>
            A Pagar: <span className="font-semibold text-red-600">{fmtMoney(totalPagar)}</span>
          </span>
          <span>
            Saldo Previsto:{" "}
            <span className={`font-semibold ${saldoMes >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmtMoney(saldoMes)}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={55} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="Receber" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} name="A Receber" />
            <Bar dataKey="Pagar" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} name="A Pagar" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}