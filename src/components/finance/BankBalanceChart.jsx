import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Wallet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const CHART_COLORS = [
  "#7c3aed", "#059669", "#d97706", "#2563eb", "#db2777",
  "#0891b2", "#9333ea", "#dc2626", "#16a34a", "#ca8a04",
];

function fmtCurrency(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function BankBalanceChart({ bankAccounts, transactions }) {
  const chartData = useMemo(() => {
    const balances = {};
    bankAccounts.forEach((acc) => {
      balances[acc.id] = {
        id: acc.id,
        name: `${acc.bank_name}`,
        detail: `Ag ${acc.agency} · Conta ${acc.account_number}`,
        type: acc.account_type,
        balance: 0,
      };
    });

    transactions
      .filter((t) => t.status === "settled" && t.bank_account_id)
      .forEach((t) => {
        if (!balances[t.bank_account_id]) return;
        const val = parseFloat(t.amount) || 0;
        balances[t.bank_account_id].balance += t.type === "income" ? val : -val;
      });

    return Object.values(balances).sort((a, b) => b.balance - a.balance);
  }, [bankAccounts, transactions]);

  const totalBalance = chartData.reduce((s, b) => s + b.balance, 0);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          Saldos por Conta Bancária
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Total */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/30">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalBalance >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
            <Wallet className={`w-5 h-5 ${totalBalance >= 0 ? "text-emerald-600" : "text-red-600"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo Total Consolidado</p>
            <p className={`text-xl font-bold ${totalBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmtCurrency(totalBalance)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 56)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tickFormatter={(v) => fmtCurrency(v).replace(/\s/g, "")}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={90}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => [fmtCurrency(v), "Saldo"]}
              labelFormatter={(_, payload) => {
                if (!payload?.[0]?.payload) return "";
                const p = payload[0].payload;
                return `${p.name} — ${p.detail}`;
              }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="balance" radius={[0, 6, 6, 0]} barSize={32}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={entry.id}
                  fill={entry.balance < 0 ? "#dc2626" : CHART_COLORS[idx % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend list */}
        <div className="mt-4 space-y-2">
          {chartData.map((b, idx) => (
            <div key={b.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: b.balance < 0 ? "#dc2626" : CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.detail} · {b.type === "corrente" ? "Corrente" : "Poupança"}</p>
                </div>
              </div>
              <p className={`text-sm font-bold shrink-0 ml-2 ${b.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtCurrency(b.balance)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}