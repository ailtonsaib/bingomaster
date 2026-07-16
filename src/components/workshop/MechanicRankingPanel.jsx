import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Trophy, Wrench, Package, DollarSign, TrendingUp, Medal, Crown, Award, Calendar } from "lucide-react";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SPECIALTY_LABELS = {
  motor: "Motor",
  eletrica: "Elétrica",
  suspensao: "Suspensão",
  freios: "Freios",
  ar_condicionado: "Ar Condicionado",
  transmissao: "Transmissão",
  geral: "Geral",
};

const PERIODS = [
  { value: "month", label: "Este Mês" },
  { value: "week", label: "Esta Semana" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Este Ano" },
  { value: "all", label: "Todo Período" },
];

const RANK_ICONS = [
  { icon: Crown, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200" },
  { icon: Award, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
];

export default function MechanicRankingPanel({ userEmail }) {
  const [orders, setOrders] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

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

  const periodStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (period === "week") start.setDate(now.getDate() - 7);
    else if (period === "month") start.setMonth(now.getMonth(), 1);
    else if (period === "quarter") start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
    else if (period === "year") start.setMonth(0, 1);
    else return new Date(0);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [period]);

  const ranking = useMemo(() => {
    const filtered = orders.filter(o => {
      if (o.status === "cancelada") return false;
      return new Date(o.created_date) >= periodStart;
    });

    const map = {};
    for (const o of filtered) {
      const id = o.mechanic_id || "none";
      const name = o.mechanic_name || "Sem mecânico";
      if (!map[id]) {
        map[id] = {
          mechanic_id: id,
          mechanic_name: name,
          order_count: 0,
          parts_total: 0,
          labor_total: 0,
          grand_total: 0,
          completed_count: 0,
        };
      }
      map[id].order_count++;
      map[id].parts_total += o.parts_total || 0;
      map[id].labor_total += o.labor_total || 0;
      map[id].grand_total += o.total || 0;
      if (o.status === "concluida" || o.status === "entregue") {
        map[id].completed_count++;
      }
    }

    // Attach mechanic specialty
    for (const id in map) {
      const mech = mechanics.find(m => m.id === id);
      if (mech) {
        map[id].specialty = mech.specialty;
        map[id].commission_rate = mech.commission_rate || 0;
        map[id].is_active = mech.is_active;
      }
    }

    return Object.values(map).sort((a, b) => b.grand_total - a.grand_total);
  }, [orders, mechanics, periodStart]);

  const topStats = useMemo(() => {
    if (ranking.length === 0) return null;
    const top = ranking[0];
    const totalOrders = ranking.reduce((s, m) => s + m.order_count, 0);
    const totalRevenue = ranking.reduce((s, m) => s + m.grand_total, 0);
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { top, totalOrders, totalRevenue, avgTicket, mechanicCount: ranking.length };
  }, [ranking]);

  const maxTotal = ranking.length > 0 ? ranking[0].grand_total : 1;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1B1C21] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Ranking de Mecânicos
          </h2>
          <p className="text-sm text-[#71717A]">Desempenho por receita gerada em ordens de serviço</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                period === p.value ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <Trophy className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-[#71717A]">Nenhuma ordem de serviço encontrada no período selecionado.</p>
        </div>
      ) : (
        <>
          {/* Top stats */}
          {topStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Líder</span>
                </div>
                <p className="text-sm font-bold text-[#1B1C21] truncate">{topStats.top.mechanic_name}</p>
                <p className="text-xs text-green-600 font-medium">{formatCurrency(topStats.top.grand_total)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Total OS</span>
                </div>
                <p className="text-lg font-bold text-[#1B1C21]">{topStats.totalOrders}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Receita</span>
                </div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(topStats.totalRevenue)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">Ticket Médio</span>
                </div>
                <p className="text-lg font-bold text-[#1B1C21]">{formatCurrency(topStats.avgTicket)}</p>
              </div>
            </div>
          )}

          {/* Podium - top 3 */}
          {ranking.length >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ranking.slice(0, 3).map((m, i) => {
                const rank = RANK_ICONS[i] || RANK_ICONS[2];
                const RankIcon = rank.icon;
                const podiumOrder = i === 0 ? "md:order-2" : i === 1 ? "md:order-1" : "md:order-3";
                const podiumHeight = i === 0 ? "md:pt-0" : "md:pt-4";
                return (
                  <div key={m.mechanic_id} className={`${podiumOrder} ${podiumHeight}`}>
                    <div className={`rounded-xl border ${rank.border} bg-white p-5 text-center relative overflow-hidden`}>
                      <div className={`absolute top-0 left-0 right-0 h-1 ${rank.bg}`} />
                      <div className={`w-12 h-12 mx-auto rounded-full ${rank.bg} flex items-center justify-center mb-2`}>
                        <RankIcon className={`w-6 h-6 ${rank.color}`} />
                      </div>
                      <p className="text-xs font-bold text-[#A1A1AA] mb-1">#{i + 1} LUGAR</p>
                      <p className="font-bold text-sm text-[#1B1C21] truncate">{m.mechanic_name}</p>
                      {m.specialty && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-[#52525B]">
                          {SPECIALTY_LABELS[m.specialty] || m.specialty}
                        </span>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(m.grand_total)}</p>
                        <p className="text-xs text-[#71717A]">{m.order_count} OS • {m.completed_count} concluídas</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranking */}
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-bold text-sm text-[#1B1C21]">Classificação Completa</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 text-left">
                  <tr>
                    <th className="p-3 font-medium text-center w-12">#</th>
                    <th className="p-3 font-medium">Mecânico</th>
                    <th className="p-3 font-medium text-center">Especialidade</th>
                    <th className="p-3 font-medium text-center">OS</th>
                    <th className="p-3 font-medium text-center">Concluídas</th>
                    <th className="p-3 font-medium text-right">Peças</th>
                    <th className="p-3 font-medium text-right">Serviços</th>
                    <th className="p-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((m, i) => (
                    <tr key={m.mechanic_id} className={`border-t border-gray-100 ${i < 3 ? "bg-amber-50/30" : ""}`}>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          i === 0 ? "bg-amber-100 text-amber-700" :
                          i === 1 ? "bg-slate-100 text-slate-600" :
                          i === 2 ? "bg-orange-100 text-orange-600" :
                          "bg-gray-50 text-[#71717A]"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-[#1B1C21]">{m.mechanic_name}</div>
                        {m.is_active === false && (
                          <span className="text-[10px] text-red-500">Inativo</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {m.specialty && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-[#52525B]">
                            {SPECIALTY_LABELS[m.specialty] || m.specialty}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-medium">{m.order_count}</td>
                      <td className="p-3 text-center">
                        <span className="text-green-600 font-medium">{m.completed_count}</span>
                      </td>
                      <td className="p-3 text-right text-blue-600">{formatCurrency(m.parts_total)}</td>
                      <td className="p-3 text-right text-purple-600">{formatCurrency(m.labor_total)}</td>
                      <td className="p-3 text-right font-bold text-green-600">{formatCurrency(m.grand_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue bars */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <h3 className="font-bold text-sm text-[#1B1C21] mb-4">Comparativo de Receita</h3>
            <div className="space-y-3">
              {ranking.map((m, i) => {
                const pct = maxTotal > 0 ? (m.grand_total / maxTotal) * 100 : 0;
                const barColor = i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-blue-400";
                return (
                  <div key={m.mechanic_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#1B1C21] truncate">{m.mechanic_name}</span>
                      <span className="text-xs font-bold text-green-600">{formatCurrency(m.grand_total)}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}