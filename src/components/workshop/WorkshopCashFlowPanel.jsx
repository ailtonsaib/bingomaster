import { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark, TrendingUp, TrendingDown, Wallet, Loader2, CalendarClock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from "recharts";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtAxis = (v) => parseFloat(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function CashTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const saldo = (payload[0]?.value || 0) - (payload[1]?.value || 0);
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {fmtMoney(entry.value)}
        </p>
      ))}
      <p className="mt-1 pt-1 border-t border-border font-semibold">
        Saldo: <span className={saldo >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtMoney(saldo)}</span>
      </p>
    </div>
  );
}

export default function WorkshopCashFlowPanel({ transactions, userEmail }) {
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    if (!userEmail) { setLoadingBanks(false); return; }
    base44.entities.WorkshopBankAccount.filter({ user_email: userEmail, is_active: true })
      .then(setBanks)
      .catch(() => {})
      .finally(() => setLoadingBanks(false));
  }, [userEmail]);

  // Gráfico: últimos 6 meses de entradas e saídas (apenas baixados)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      rows.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        Entradas: 0,
        Saidas: 0,
      });
    }
    transactions.forEach((tx) => {
      if (tx.status !== "settled") return;
      const ref = tx.settled_date ? new Date(tx.settled_date) : (tx.due_date ? new Date(tx.due_date) : null);
      if (!ref || isNaN(ref.getTime())) return;
      const idx = rows.findIndex(r => r.year === ref.getFullYear() && r.month === ref.getMonth());
      if (idx === -1) return;
      const amt = parseFloat(tx.settled_amount || tx.amount) || 0;
      if (tx.type === "income") rows[idx].Entradas += amt;
      else rows[idx].Saidas += amt;
    });
    return rows;
  }, [transactions]);

  const totalEntradas = monthlyData.reduce((s, d) => s + d.Entradas, 0);
  const totalSaidas = monthlyData.reduce((s, d) => s + d.Saidas, 0);
  const saldoConsolidado = totalEntradas - totalSaidas;

  // Saldo por banco — soma das transações baixadas que informaram bank_name
  const bankBalances = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      if (tx.status !== "settled" || !tx.bank_name) return;
      if (!map[tx.bank_name]) map[tx.bank_name] = { bank_name: tx.bank_name, income: 0, expense: 0, count: 0 };
      const amt = parseFloat(tx.settled_amount || tx.amount) || 0;
      if (tx.type === "income") map[tx.bank_name].income += amt;
      else map[tx.bank_name].expense += amt;
      map[tx.bank_name].count++;
    });
    // Inclui bancos cadastrados sem movimentação ainda
    banks.forEach((b) => {
      const key = `${b.bank_code} — ${b.bank_name}`;
      if (!map[key]) map[key] = { bank_name: key, income: 0, expense: 0, count: 0, registered: true };
    });
    return Object.values(map).sort((a, b) => (b.income - b.expense) - (a.income - a.expense));
  }, [transactions, banks]);

  // Previsão de recebimentos futuros (pendentes com vencimento à frente)
  const futureReceivables = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = transactions
      .filter(t => t.type === "income" && (!t.status || t.status === "pending" || t.status === "partial") && t.due_date && new Date(t.due_date) >= today)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    
    // Agrupar por mês
    const byMonth = {};
    items.forEach(tx => {
      const d = new Date(tx.due_date);
      const key = `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      if (!byMonth[key]) byMonth[key] = { label: key, items: [], total: 0 };
      byMonth[key].items.push(tx);
      byMonth[key].total += parseFloat(tx.status === "partial" ? tx.remaining_amount : tx.amount) || 0;
    });
    return Object.values(byMonth);
  }, [transactions]);

  const totalFuture = futureReceivables.reduce((s, m) => s + m.total, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" /> Fluxo de Caixa Consolidado
        </CardTitle>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Entradas (6 meses): <span className="font-semibold text-emerald-600">{fmtMoney(totalEntradas)}</span></span>
          <span>Saídas (6 meses): <span className="font-semibold text-red-600">{fmtMoney(totalSaidas)}</span></span>
          <span>Saldo: <span className={`font-semibold ${saldoConsolidado >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(saldoConsolidado)}</span></span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gráfico de barras — Entradas vs Saídas por mês */}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={55} />
            <Tooltip content={<CashTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={50} name="Entradas" />
            <Bar dataKey="Saidas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={50} name="Saídas" />
          </BarChart>
        </ResponsiveContainer>

        {/* Saldo por banco */}
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5 mb-3">
            <Landmark className="w-4 h-4 text-blue-600" /> Saldo Consolidado por Banco
          </p>
          {loadingBanks ? (
            <div className="flex items-center gap-2 py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /><span className="text-xs text-gray-400">Carregando contas...</span></div>
          ) : bankBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Nenhuma movimentação baixada com banco informado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {bankBalances.map((b) => {
                const balance = b.income - b.expense;
                return (
                  <div key={b.bank_name} className={`p-3 rounded-lg border ${b.registered ? "bg-muted/20" : "bg-card"}`}>
                    <p className="text-xs font-medium text-muted-foreground truncate">{b.bank_name}</p>
                    <p className={`text-lg font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(balance)}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-emerald-500" />{fmtMoney(b.income)}</span>
                      <span className="flex items-center gap-0.5"><TrendingDown className="w-3 h-3 text-red-500" />{fmtMoney(b.expense)}</span>
                      {b.count > 0 && <span>{b.count} baixa(s)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Previsão de recebimentos futuros */}
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5 mb-3">
            <CalendarClock className="w-4 h-4 text-primary" /> Previsão de Recebimentos Futuros
          </p>
          {futureReceivables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Nenhum recebimento futuro previsto.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-primary/10 text-primary border-0">Total previsto: {fmtMoney(totalFuture)}</Badge>
              </div>
              <div className="space-y-3">
                {futureReceivables.map((month) => (
                  <div key={month.label} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                      <span className="text-sm font-medium">{month.label}</span>
                      <span className="text-sm font-bold text-emerald-600">{fmtMoney(month.total)}</span>
                    </div>
                    <div className="divide-y">
                      {month.items.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <TrendingUp className="w-3 h-3 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium">{tx.description}</p>
                              <p className="text-muted-foreground">
                                {tx.contact_name && `${tx.contact_name} · `}
                                Venc: {fmtDate(tx.due_date)}
                                {tx.status === "partial" && <Badge className="ml-1 text-[10px] py-0 bg-amber-100 text-amber-700 border-0">Parcial</Badge>}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-emerald-600">
                            {fmtMoney(tx.status === "partial" ? tx.remaining_amount : tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}