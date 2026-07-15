import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CalendarClock, TrendingUp, TrendingDown, Search } from "lucide-react";

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR");
};

// Calcula vencimento: usa due_date se existir, senão data base + 30 dias
const calcDue = (item, baseField) => {
  if (item.due_date) return new Date(item.due_date);
  const base = new Date(item[baseField] || item.created_date || new Date());
  if (isNaN(base)) return new Date();
  base.setDate(base.getDate() + 30);
  return base;
};

export default function ForecastReport({ user }) {
  const [exitOrders, setExitOrders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [exits, ents] = await Promise.all([
          base44.entities.PDVExitOrder.filter({
            user_email: user.email,
            status: { $ne: "cancelada" },
          }),
          base44.entities.PDVEntryOperation.filter({
            user_email: user.email,
            status: { $ne: "cancelada" },
          }),
        ]);
        setExitOrders(exits);
        setEntries(ents);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  // Recebimentos = saídas a prazo (payment_method "1") ou com due_date, não recebidas
  const receivables = useMemo(() => {
    return exitOrders
      .filter(o => o.payment_status !== "recebido")
      .filter(o => {
        const aPrazo = o.payment_method === "1" || !!o.due_date;
        if (!aPrazo) return false;
        if (search) {
          const q = search.toLowerCase();
          return o.customer_name?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q);
        }
        return true;
      })
      .map(o => ({
        ...o,
        due: calcDue(o, "order_date"),
        partner: o.customer_name,
        doc: o.order_number || o.nfe_number || "—",
        amount: num(o.total_nota),
      }))
      .filter(o => {
        if (!startDate && !endDate) return true;
        const d = o.due.getTime();
        const s = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
        const e = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
        return d >= s && d <= e;
      })
      .sort((a, b) => a.due - b.due);
  }, [exitOrders, search, startDate, endDate]);

  // Pagamentos = entradas a prazo (payment_method "1") ou com due_date, não pagas
  const payables = useMemo(() => {
    return entries
      .filter(e => e.payment_status !== "pago")
      .filter(e => {
        const aPrazo = e.payment_method === "1" || !!e.due_date || !e.payment_method;
        if (!aPrazo) return false;
        if (search) {
          const q = search.toLowerCase();
          return e.supplier_name?.toLowerCase().includes(q) || e.nota_number?.toLowerCase().includes(q);
        }
        return true;
      })
      .map(e => ({
        ...e,
        due: calcDue(e, "issue_date"),
        partner: e.supplier_name,
        doc: e.nota_number || "—",
        amount: num(e.total_nota),
      }))
      .filter(e => {
        if (!startDate && !endDate) return true;
        const d = e.due.getTime();
        const s = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
        const e2 = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
        return d >= s && d <= e2;
      })
      .sort((a, b) => a.due - b.due);
  }, [entries, search, startDate, endDate]);

  // Agrupa por dia
  const groupByDay = (items) => {
    const map = new Map();
    for (const item of items) {
      const key = item.due.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { date: item.due, items: [], total: 0 });
      const g = map.get(key);
      g.items.push(item);
      g.total += item.amount;
    }
    return Array.from(map.values());
  };

  const receivableDays = useMemo(() => groupByDay(receivables), [receivables]);
  const payableDays = useMemo(() => groupByDay(payables), [payables]);

  const totalReceivable = receivables.reduce((s, i) => s + i.amount, 0);
  const totalPayable = payables.reduce((s, i) => s + i.amount, 0);
  const saldo = totalReceivable - totalPayable;

  const clearFilters = () => { setStartDate(""); setEndDate(""); setSearch(""); };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">A Receber</p>
            <p className="text-xl font-bold text-emerald-600">{fmtBRL(totalReceivable)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">A Pagar</p>
            <p className="text-xl font-bold text-red-600">{fmtBRL(totalPayable)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${saldo >= 0 ? "bg-blue-100" : "bg-amber-100"}`}>
            <CalendarClock className={`w-5 h-5 ${saldo >= 0 ? "text-blue-600" : "text-amber-600"}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Saldo Projetado</p>
            <p className={`text-xl font-bold ${saldo >= 0 ? "text-blue-600" : "text-amber-600"}`}>{fmtBRL(saldo)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Vencimento inicial</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 rounded-md border border-gray-300 px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Vencimento final</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 rounded-md border border-gray-300 px-3 text-sm" />
        </div>
        <div className="flex-1 min-w-[180px] flex flex-col gap-1">
          <label className="text-xs text-gray-500">Buscar parceiro / documento</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cliente, fornecedor ou nº documento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 pl-8 pr-3 text-sm"
            />
          </div>
        </div>
        <button onClick={clearFilters} className="h-9 px-4 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          Limpar
        </button>
      </div>

      {/* Receivables */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-emerald-50 flex items-center justify-between">
          <h3 className="font-semibold text-emerald-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Previsão de Recebimento
          </h3>
          <span className="text-sm text-emerald-600 font-medium">{receivables.length} título(s)</span>
        </div>
        {receivableDays.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Nenhum recebimento previsto</p>
        ) : (
          <div className="divide-y">
            {receivableDays.map((day, i) => (
              <div key={i}>
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{fmtDate(day.date)}</span>
                  <span className="font-bold text-emerald-600">{fmtBRL(day.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {day.items.map((item, j) => (
                      <tr key={j} className="border-t">
                        <td className="px-4 py-2 text-gray-600">{item.partner}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{item.doc}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{item.nfe_number ? `NF ${item.nfe_number}` : ""}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-700">{fmtBRL(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payables */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-red-50 flex items-center justify-between">
          <h3 className="font-semibold text-red-700 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Previsão de Pagamento
          </h3>
          <span className="text-sm text-red-600 font-medium">{payables.length} título(s)</span>
        </div>
        {payableDays.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Nenhum pagamento previsto</p>
        ) : (
          <div className="divide-y">
            {payableDays.map((day, i) => (
              <div key={i}>
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{fmtDate(day.date)}</span>
                  <span className="font-bold text-red-600">{fmtBRL(day.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {day.items.map((item, j) => (
                      <tr key={j} className="border-t">
                        <td className="px-4 py-2 text-gray-600">{item.partner}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{item.doc}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{item.nota_number ? `NF ${item.nota_number}` : ""}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-700">{fmtBRL(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}