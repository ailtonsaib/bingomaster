import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { BarChart3, TrendingUp, ShoppingBag, Users, Calendar } from "lucide-react";

export default function ErpSalesReport({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setOrders(await base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-emission_date", 500)); }
      catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const data = useMemo(() => {
    const faturado = orders.filter(o => o.status === "faturado");
    const aberto = orders.filter(o => o.status === "aberto");
    const totalFaturado = faturado.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const totalAberto = aberto.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const byCustomer = {};
    faturado.forEach(o => { byCustomer[o.customer_name] = (byCustomer[o.customer_name] || 0) + (Number(o.total) || 0); });
    const topCustomers = Object.entries(byCustomer).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const byMonth = {};
    faturado.forEach(o => {
      const m = o.emission_date ? new Date(o.emission_date).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }) : "—";
      byMonth[m] = (byMonth[m] || 0) + (Number(o.total) || 0);
    });
    const months = Object.entries(byMonth).sort();
    const maxMonth = Math.max(1, ...months.map(([, v]) => v));
    return { totalFaturado, totalAberto, countFaturado: faturado.length, countAberto: aberto.length, topCustomers, months, maxMonth };
  }, [orders]);

  const cards = [
    { label: "Faturado", value: fmtMoney(data.totalFaturado), sub: `${data.countFaturado} pedidos`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
    { label: "Em aberto", value: fmtMoney(data.totalAberto), sub: `${data.countAberto} pedidos`, icon: ShoppingBag, color: "text-amber-600 bg-amber-50" },
    { label: "Pedidos totais", value: orders.length, sub: "no período", icon: BarChart3, color: "text-blue-600 bg-blue-50" },
    { label: "Ticket médio", value: fmtMoney(data.countFaturado ? data.totalFaturado / data.countFaturado : 0), sub: "por pedido faturado", icon: Users, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl border p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}><Icon className="w-5 h-5" /></div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-bold">{c.value}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-blue-50"><Calendar className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-sm">Faturamento por mês</h3></div>
          <div className="p-3 space-y-2">
            {data.months.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Sem dados.</p> :
              data.months.map(([m, v]) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="text-xs w-16 text-gray-500">{m}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: (v / data.maxMonth * 100) + "%" }} />
                  </div>
                  <span className="text-xs font-medium w-24 text-right">{fmtMoney(v)}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-purple-50"><Users className="w-4 h-4 text-purple-600" /><h3 className="font-semibold text-sm">Top clientes (faturado)</h3></div>
          <div className="p-3 space-y-1">
            {data.topCustomers.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Sem dados.</p> :
              data.topCustomers.map(([name, v], i) => (
                <div key={name} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>{name || "—"}</span>
                  <span className="font-medium">{fmtMoney(v)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-3 border-b bg-gray-50"><h3 className="font-semibold text-sm">Pedidos recentes</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs"><tr><th className="p-2 text-left">Pedido</th><th className="p-2 text-left">Cliente</th><th className="p-2 text-left">Emissão</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr> :
                orders.slice(0, 12).map(o => (
                  <tr key={o.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{o.number}</td>
                    <td className="p-2">{o.customer_name || "—"}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.emission_date)}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.total)}</td>
                    <td className="p-2 text-gray-600 capitalize">{o.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}