import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, BarChart3, TrendingUp, Users, Wrench, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SPECIALTY_LABELS = {
  motor: "Motor", eletrica: "Elétrica", suspensao: "Suspensão",
  freios: "Freios", ar_condicionado: "Ar Condicionado",
  transmissao: "Transmissão", geral: "Geral",
};

const BAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-orange-500", "bg-indigo-500",
];

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MechanicProductivityPanel({ userEmail }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [orders, setOrders] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [orderData, mechData] = await Promise.all([
          base44.entities.ServiceOrder.filter({ user_email: userEmail }, "-created_date"),
          base44.entities.DiagnosticMechanic.filter({ user_email: userEmail }, "-created_date"),
        ]);
        setOrders(orderData);
        setMechanics(mechData);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [userEmail]);

  // Current month orders by mechanic
  const monthData = useMemo(() => {
    const filtered = orders.filter(o => {
      if (o.status === "cancelada") return false;
      const d = new Date(o.created_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const map = {};
    for (const o of filtered) {
      const id = o.mechanic_id || "none";
      const name = o.mechanic_name || "Sem mecânico";
      if (!map[id]) {
        map[id] = {
          mechanic_id: id, mechanic_name: name,
          order_count: 0, completed_count: 0, pending_count: 0,
          parts_total: 0, labor_total: 0, grand_total: 0,
          service_items: 0, part_items: 0,
        };
      }
      map[id].order_count++;
      map[id].parts_total += o.parts_total || 0;
      map[id].labor_total += o.labor_total || 0;
      map[id].grand_total += o.total || 0;
      if (o.status === "concluida" || o.status === "entregue") map[id].completed_count++;
      else map[id].pending_count++;

      for (const item of o.items || []) {
        if (item.type === "servico") map[id].service_items += Number(item.quantity) || 1;
        else if (item.type === "peca") map[id].part_items += Number(item.quantity) || 1;
      }
    }

    const result = Object.values(map).sort((a, b) => b.order_count - a.order_count);
    result.forEach((r, i) => {
      const mech = mechanics.find(m => m.id === r.mechanic_id);
      if (mech) {
        r.specialty = mech.specialty;
        r.is_active = mech.is_active;
      }
      r.color = BAR_COLORS[i % BAR_COLORS.length];
    });
    return result;
  }, [orders, mechanics, year, month]);

  // 6-month history for trend chart
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()].substring(0, 3) });
    }
    return months.map(m => {
      const filtered = orders.filter(o => {
        if (o.status === "cancelada") return false;
        const d = new Date(o.created_date);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const byMech = {};
      for (const o of filtered) {
        const id = o.mechanic_id || "none";
        byMech[id] = (byMech[id] || 0) + 1;
      }
      return { ...m, total: filtered.length, byMech };
    });
  }, [orders, year, month]);

  const totals = useMemo(() => {
    const totalServices = monthData.reduce((s, m) => s + m.order_count, 0);
    const totalCompleted = monthData.reduce((s, m) => s + m.completed_count, 0);
    const totalRevenue = monthData.reduce((s, m) => s + m.grand_total, 0);
    const avgPerMechanic = monthData.length > 0 ? totalServices / monthData.length : 0;
    const bestMechanic = monthData.length > 0 ? [...monthData].sort((a, b) => b.order_count - a.order_count)[0] : null;
    return { totalServices, totalCompleted, totalRevenue, avgPerMechanic, bestMechanic };
  }, [monthData]);

  const maxOrders = monthData.length > 0 ? Math.max(...monthData.map(m => m.order_count)) : 1;
  const maxTrend = trendData.length > 0 ? Math.max(...trendData.map(t => t.total), 1) : 1;

  const handlePrev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const handleNext = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1B1C21] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#2563EB]" /> Produtividade da Equipe
          </h2>
          <p className="text-sm text-[#71717A]">Serviços realizados e desempenho por mecânico</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-[#52525B]" />
          </button>
          <span className="font-bold text-sm text-[#1B1C21] min-w-[140px] text-center flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#A1A1AA]" />
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={handleNext}
            disabled={year === now.getFullYear() && month === now.getMonth()}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-[#52525B]" />
          </button>
        </div>
      </div>

      {monthData.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <BarChart3 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-[#71717A]">Nenhum serviço registrado em {MONTH_NAMES[month]} {year}.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Serviços</span>
              </div>
              <p className="text-lg font-bold text-[#1B1C21]">{totals.totalServices}</p>
              <p className="text-[10px] text-[#71717A]">ordens de serviço</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Concluídas</span>
              </div>
              <p className="text-lg font-bold text-green-600">{totals.totalCompleted}</p>
              <p className="text-[10px] text-[#71717A]">{totals.totalServices > 0 ? Math.round((totals.totalCompleted / totals.totalServices) * 100) : 0}% do total</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Média/Mecânico</span>
              </div>
              <p className="text-lg font-bold text-[#1B1C21]">{totals.avgPerMechanic.toFixed(1)}</p>
              <p className="text-[10px] text-[#71717A]">OS por pessoa</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Receita</span>
              </div>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</p>
              <p className="text-[10px] text-[#71717A]">no mês</p>
            </div>
          </div>

          {/* Bar chart - services per mechanic */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[#1B1C21]">Serviços por Mecânico</h3>
              {totals.bestMechanic && (
                <span className="text-xs text-[#71717A]">
                  Destaque: <span className="font-bold text-amber-600">{totals.bestMechanic.mechanic_name}</span> ({totals.bestMechanic.order_count} OS)
                </span>
              )}
            </div>
            <div className="space-y-4">
              {monthData.map((m, i) => {
                const pct = (m.order_count / maxOrders) * 100;
                const completedPct = m.order_count > 0 ? (m.completed_count / m.order_count) * 100 : 0;
                return (
                  <div key={m.mechanic_id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#A1A1AA] w-5">#{i + 1}</span>
                        <span className="text-xs font-medium text-[#1B1C21]">{m.mechanic_name}</span>
                        {m.specialty && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-[#52525B]">
                            {SPECIALTY_LABELS[m.specialty] || m.specialty}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#1B1C21]">{m.order_count} OS</span>
                    </div>
                    <div className="relative h-7 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${m.color} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                        style={{ width: `${pct}%` }}
                      >
                        <div
                          className="h-full bg-green-400/40 absolute left-0 top-0 rounded-lg"
                          style={{ width: `${(completedPct / 100) * pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#71717A]">
                      <span className="text-green-600">{m.completed_count} concluídas</span>
                      <span className="text-amber-600">{m.pending_count} em andamento</span>
                      <span>{m.service_items} serviços • {m.part_items} peças</span>
                      <span className="ml-auto font-medium text-[#1B1C21]">{formatCurrency(m.grand_total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50 text-[10px] text-[#71717A]">
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-500 rounded" /> Total de OS</div>
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-400/60 rounded" /> Concluídas</div>
            </div>
          </div>

          {/* 6-month trend chart */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <h3 className="font-bold text-sm text-[#1B1C21] mb-4">Tendência — Últimos 6 Meses</h3>
            <div className="flex items-end justify-between gap-2 h-40">
              {trendData.map((t, i) => {
                const h = (t.total / maxTrend) * 100;
                const isCurrent = i === trendData.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-xs font-bold ${isCurrent ? "text-[#2563EB]" : "text-[#71717A]"}`}>{t.total}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                      <div
                        className={`w-full max-w-[40px] rounded-t-md transition-all duration-500 ${
                          isCurrent ? "bg-[#2563EB]" : "bg-blue-300"
                        }`}
                        style={{ height: `${h}%`, minHeight: "2px" }}
                      />
                    </div>
                    <span className={`text-[10px] ${isCurrent ? "font-bold text-[#2563EB]" : "text-[#71717A]"}`}>{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail table */}
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-bold text-sm text-[#1B1C21]">Detalhamento por Mecânico</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Mecânico</th>
                    <th className="p-3 font-medium text-center">OS Total</th>
                    <th className="p-3 font-medium text-center">Concluídas</th>
                    <th className="p-3 font-medium text-center">Andamento</th>
                    <th className="p-3 font-medium text-center">Taxa Conclusão</th>
                    <th className="p-3 font-medium text-right">Mão de Obra</th>
                    <th className="p-3 font-medium text-right">Peças</th>
                    <th className="p-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthData.map((m, i) => {
                    const completionRate = m.order_count > 0 ? Math.round((m.completed_count / m.order_count) * 100) : 0;
                    return (
                      <tr key={m.mechanic_id} className="border-t border-gray-100">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${m.color}`} />
                            <div>
                              <div className="font-medium text-[#1B1C21]">{m.mechanic_name}</div>
                              {m.specialty && <div className="text-[10px] text-[#A1A1AA]">{SPECIALTY_LABELS[m.specialty] || m.specialty}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold">{m.order_count}</td>
                        <td className="p-3 text-center text-green-600">{m.completed_count}</td>
                        <td className="p-3 text-center text-amber-600">{m.pending_count}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            completionRate >= 80 ? "bg-green-50 text-green-600" :
                            completionRate >= 50 ? "bg-amber-50 text-amber-600" :
                            "bg-red-50 text-red-600"
                          }`}>
                            {completionRate}%
                          </span>
                        </td>
                        <td className="p-3 text-right text-purple-600">{formatCurrency(m.labor_total)}</td>
                        <td className="p-3 text-right text-blue-600">{formatCurrency(m.parts_total)}</td>
                        <td className="p-3 text-right font-bold text-green-600">{formatCurrency(m.grand_total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="p-3 font-bold">Total</td>
                    <td className="p-3 text-center font-bold">{totals.totalServices}</td>
                    <td className="p-3 text-center font-bold text-green-600">{totals.totalCompleted}</td>
                    <td className="p-3 text-center font-bold text-amber-600">{totals.totalServices - totals.totalCompleted}</td>
                    <td className="p-3 text-center font-bold">
                      {totals.totalServices > 0 ? Math.round((totals.totalCompleted / totals.totalServices) * 100) : 0}%
                    </td>
                    <td colSpan={2}></td>
                    <td className="p-3 text-right font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}