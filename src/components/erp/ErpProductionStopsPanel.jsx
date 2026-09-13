import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Activity, Timer, Users, AlertTriangle } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";
import { minsBetween, fmtDuration } from "./ErpProductionApontamentoModal";

const STOP_TYPES = { mecanica: "Parada Mecânica", eletrica: "Parada Elétrica", operacional: "Parada Operacional" };
const STOP_BAR = { mecanica: "bg-amber-500", eletrica: "bg-blue-500", operacional: "bg-gray-400" };
const PERIODS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

// Monitor de paradas de produção: consolida as paradas registradas nos
// apontamentos das OPs e mostra o tempo total perdido por motivo e por
// equipamento — indicando os gargalos operacionais da fábrica.
export default function ErpProductionStopsPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("90");

  useEffect(() => {
    setLoading(true);
    base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500)
      .then(setOrders)
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [user.email]);

  // Achata as paradas de todas as OPs dentro do período selecionado
  const stops = useMemo(() => {
    const limit = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
    return orders.flatMap(o => (o.stops || []).map(st => ({
      type: st.type,
      equipment_name: st.equipment_name || "",
      minutes: minsBetween(st.start_time, st.end_time),
      cost: Number(st.extra_cost) || 0,
      people: Number(st.people_count) || 0,
      ts: st.start_time ? new Date(st.start_time).getTime() : 0,
    }))).filter(s => s.ts >= limit);
  }, [orders, period]);

  const totalMin = stops.reduce((s, x) => s + x.minutes, 0);
  const totalCost = stops.reduce((s, x) => s + x.cost, 0);
  const totalPeople = stops.reduce((s, x) => s + x.people, 0);
  const avgMin = stops.length ? Math.round(totalMin / stops.length) : 0;

  // Agrupa as paradas por uma chave (motivo ou equipamento)
  const aggregate = (list, keyFn) => {
    const map = new Map();
    list.forEach(s => {
      const k = keyFn(s);
      if (!k) return;
      const cur = map.get(k) || { key: k, minutes: 0, count: 0, cost: 0, motives: {} };
      cur.minutes += s.minutes;
      cur.count += 1;
      cur.cost += s.cost;
      cur.motives[s.type] = (cur.motives[s.type] || 0) + s.minutes;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  };

  const byMotive = aggregate(stops, s => s.type);
  const byEquipment = aggregate(stops.filter(s => s.equipment_name), s => s.equipment_name);
  const worst = byEquipment[0];

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base flex items-center gap-2"><Activity className="w-5 h-5 text-red-500" /> Monitor de Paradas de Produção</h2>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {stops.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          <Timer className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Nenhuma parada registrada no período. As paradas são registradas no apontamento de cada ordem de produção.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Kpi label="Tempo total perdido" value={fmtDuration(totalMin)} icon={<Timer className="w-4 h-4" />} color="text-red-600 bg-red-50" />
            <Kpi label="Paradas registradas" value={stops.length} icon={<AlertTriangle className="w-4 h-4" />} color="text-amber-600 bg-amber-50" />
            <Kpi label="Duração média" value={fmtDuration(avgMin)} icon={<Timer className="w-4 h-4" />} color="text-blue-600 bg-blue-50" />
            <Kpi label="Custo extra das paradas" value={fmtMoney(totalCost)} icon={<AlertTriangle className="w-4 h-4" />} color="text-purple-600 bg-purple-50" />
            <Kpi label="Pessoas envolvidas" value={totalPeople} icon={<Users className="w-4 h-4" />} color="text-emerald-600 bg-emerald-50" />
          </div>

          {worst && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><b>Maior gargalo:</b> {worst.key} — {fmtDuration(worst.minutes)} de parada em {worst.count} ocorrência(s){worst.cost > 0 ? ` (${fmtMoney(worst.cost)} de custo extra)` : ""}.</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <StopGroupCard
              title="Tempo perdido por motivo"
              rows={byMotive.map(r => ({
                ...r,
                label: STOP_TYPES[r.key] || r.key,
                barColor: STOP_BAR[r.key] || "bg-gray-400",
              }))}
            />
            <StopGroupCard
              title="Tempo perdido por equipamento — gargalos"
              rows={byEquipment.map(r => {
                const dominant = Object.entries(r.motives).sort((a, b) => b[1] - a[1])[0]?.[0];
                return {
                  ...r,
                  label: r.key,
                  barColor: STOP_BAR[dominant] || "bg-gray-400",
                  motiveText: Object.entries(r.motives).map(([k, m]) => `${STOP_TYPES[k] || k}: ${fmtDuration(m)}`).join(" • "),
                };
              })}
            />
          </div>
          <p className="text-xs text-gray-400">As paradas operacionais não estão vinculadas a um equipamento e aparecem apenas no agrupamento por motivo.</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, icon, color }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${color}`}>
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-lg leading-tight">{value}</p>
      </div>
    </div>
  );
}

function StopGroupCard({ title, rows }) {
  const max = Math.max(...rows.map(r => r.minutes), 0);
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-50 text-sm font-semibold">{title}</div>
      <div className="p-3 space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Nenhuma parada registrada.</p>
        ) : rows.map(r => (
          <div key={r.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">{r.label} <span className="text-gray-400">({r.count} ocorrência{r.count !== 1 ? "s" : ""})</span></span>
              <span className="text-gray-600"><b>{fmtDuration(r.minutes)}</b>{r.cost > 0 ? <> • {fmtMoney(r.cost)}</> : null}</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${r.barColor}`} style={{ width: `${max > 0 ? (r.minutes / max) * 100 : 0}%` }} />
            </div>
            {r.motiveText && <p className="text-[10px] text-gray-500">{r.motiveText}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}