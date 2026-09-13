import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fmtDate, fmtMoney } from "@/lib/erpUtils";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);

const EXPENSE_CATEGORIES = {
  pedagio: "Pedágio",
  multa: "Multa",
  seguro: "Seguro",
  ipva_licenciamento: "IPVA/Licenciamento",
  estacionamento: "Estacionamento",
  lavagem: "Lavagem",
  outros: "Outros",
};

// Relatórios da frota: km rodado (odômetro dos abastecimentos), consumo (km/L),
// custo por km e gastos por categoria (combustível, manutenção, pneus e outros)
// — filtráveis por período e por veículo.
export default function ErpFleetReportsPanel({ user }) {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [fuel, setFuel] = useState([]);
  const [maint, setMaint] = useState([]);
  const [tires, setTires] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [v, d, f, m, t, e] = await Promise.all([
        base44.entities.ErpFleetVehicle.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpFleetDriver.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpFleetFuelEntry.filter({ user_email: user.email }, "-entry_date", 500).catch(() => []),
        base44.entities.ErpFleetMaintenance.filter({ user_email: user.email }, "-service_date", 500).catch(() => []),
        base44.entities.ErpFleetTire.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpFleetExpense.filter({ user_email: user.email }, "-expense_date", 500).catch(() => []),
      ]);
      setVehicles(v); setDrivers(d); setFuel(f); setMaint(m); setTires(t); setExpenses(e);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.email]);

  const inPeriod = (dateStr) => {
    const s = String(dateStr || "").slice(0, 10);
    return (!from || s >= from) && (!to || s <= to);
  };

  const rows = useMemo(() => vehicles.filter(v => !vehicleFilter || v.id === vehicleFilter).map(v => {
    const vfuel = fuel.filter(f => f.vehicle_id === v.id && inPeriod(f.entry_date));
    const odo = vfuel.map(f => Number(f.odometer) || 0).filter(x => x > 0);
    const km = odo.length >= 2 ? r2(Math.max(...odo) - Math.min(...odo)) : 0;
    const lastOdo = odo.length ? Math.max(...odo) : (Number(v.current_mileage) || 0);
    const liters = r2(vfuel.reduce((s, f) => s + (Number(f.liters) || 0), 0));
    const fuelCost = r2(vfuel.reduce((s, f) => s + (Number(f.total_value) || 0), 0));
    const maintCost = r2(maint.filter(m => m.vehicle_id === v.id && inPeriod(m.service_date) && (m.status || "realizada") === "realizada")
      .reduce((s, m) => s + (Number(m.cost) || 0), 0));
    const tireCost = r2(tires.filter(t => t.vehicle_id === v.id && inPeriod(t.purchase_date))
      .reduce((s, t) => s + (Number(t.purchase_cost) || 0), 0));
    const expCost = r2(expenses.filter(e => e.vehicle_id === v.id && inPeriod(e.expense_date))
      .reduce((s, e) => s + (Number(e.value) || 0), 0));
    const total = r2(fuelCost + maintCost + tireCost + expCost);
    return {
      plate: v.plate,
      name: `${v.brand || ""} ${v.model || ""}`.trim() || "—",
      km, lastOdo, liters, fuelCost, maintCost, tireCost, expCost, total,
      kmPerLiter: liters > 0 ? r2(km / liters) : 0,
      costPerKm: km > 0 ? r2(total / km) : 0,
    };
  }), [vehicles, fuel, maint, tires, expenses, from, to, vehicleFilter]);

  const totals = useMemo(() => {
    const km = r2(rows.reduce((s, r) => s + r.km, 0));
    const liters = r2(rows.reduce((s, r) => s + r.liters, 0));
    const fuelCost = r2(rows.reduce((s, r) => s + r.fuelCost, 0));
    const maintCost = r2(rows.reduce((s, r) => s + r.maintCost, 0));
    const tireCost = r2(rows.reduce((s, r) => s + r.tireCost, 0));
    const expCost = r2(rows.reduce((s, r) => s + r.expCost, 0));
    const total = r2(fuelCost + maintCost + tireCost + expCost);
    return {
      km, liters, fuelCost, maintCost, tireCost, expCost, total,
      kmPerLiter: liters > 0 ? r2(km / liters) : 0,
      costPerKm: km > 0 ? r2(total / km) : 0,
    };
  }, [rows]);

  const chartData = useMemo(() => {
    const byCat = new Map();
    byCat.set("Combustível", totals.fuelCost);
    byCat.set("Manutenção", totals.maintCost);
    byCat.set("Pneus", totals.tireCost);
    expenses.filter(e => inPeriod(e.expense_date) && (!vehicleFilter || e.vehicle_id === vehicleFilter)).forEach(e => {
      const label = EXPENSE_CATEGORIES[e.category] || "Outros";
      byCat.set(label, r2((byCat.get(label) || 0) + (Number(e.value) || 0)));
    });
    return [...byCat.entries()].map(([cat, value]) => ({ cat, value })).filter(d => d.value > 0);
  }, [expenses, totals, from, to, vehicleFilter]);

  const alerts = useMemo(() => {
    const out = [];
    const today = todayISO();
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitISO = limit.toISOString().slice(0, 10);
    (drivers || []).forEach(d => {
      if (d.status !== "ativo" || !d.cnh_expiry) return;
      const s = String(d.cnh_expiry).slice(0, 10);
      if (s < today) out.push({ level: "error", text: `CNH de ${d.name} vencida em ${fmtDate(d.cnh_expiry)}` });
      else if (s <= limitISO) out.push({ level: "warn", text: `CNH de ${d.name} vence em ${fmtDate(d.cnh_expiry)}` });
    });
    (maint || []).forEach(m => {
      if (!m.next_service_date) return;
      const s = String(m.next_service_date).slice(0, 10);
      const who = m.vehicle_plate || "veículo";
      if (s < today) out.push({ level: "error", text: `Manutenção de ${who} venceu em ${fmtDate(m.next_service_date)} — ${m.description || ""}` });
      else if (s <= limitISO) out.push({ level: "warn", text: `Manutenção de ${who} prevista para ${fmtDate(m.next_service_date)} — ${m.description || ""}` });
    });
    return out;
  }, [drivers, maint]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-base flex-1">Relatórios da Frota</h2>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" title="Data inicial" />
        <span className="text-xs text-gray-400">até</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" title="Data final" />
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
          <option value="">Todos os veículos</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
        </select>
        <button onClick={load} title="Atualizar" className="p-1 hover:bg-gray-100 rounded"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: "Km rodado", value: `${totals.km.toLocaleString("pt-BR")} km` },
              { label: "Litros abastecidos", value: `${totals.liters.toLocaleString("pt-BR")} L` },
              { label: "Custo total", value: fmtMoney(totals.total) },
              { label: "Consumo médio", value: totals.kmPerLiter ? `${totals.kmPerLiter.toLocaleString("pt-BR")} km/L` : "—" },
              { label: "Custo por km", value: totals.costPerKm ? fmtMoney(totals.costPerKm) : "—" },
            ].map((c, i) => (
              <div key={i} className="bg-white border rounded-lg p-3">
                <p className="text-[11px] text-gray-500">{c.label}</p>
                <p className="text-sm font-bold text-indigo-700">{c.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">O km rodado e o consumo são calculados pelas leituras de odômetro registradas nos abastecimentos do período.</p>

          {chartData.length > 0 && (
            <div className="bg-white border rounded-lg p-3">
              <p className="text-xs font-semibold mb-2">Gastos por categoria</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
              {alerts.map((a, i) => (
                <p key={i} className={`text-xs flex items-start gap-1.5 ${a.level === "error" ? "text-red-700" : "text-amber-800"}`}>
                  {a.level === "error" ? <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                  {a.text}
                </p>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-500">
                  <tr>
                    <th className="p-2 text-left">Veículo</th>
                    <th className="p-2 text-right">Odômetro</th>
                    <th className="p-2 text-right">Km rodado</th>
                    <th className="p-2 text-right">Litros</th>
                    <th className="p-2 text-right">Km/L</th>
                    <th className="p-2 text-right">Combustível</th>
                    <th className="p-2 text-right">Manutenção</th>
                    <th className="p-2 text-right">Pneus</th>
                    <th className="p-2 text-right">Outros gastos</th>
                    <th className="p-2 text-right">Custo total</th>
                    <th className="p-2 text-right">Custo/km</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={11} className="p-6 text-center text-gray-400">Nenhum veículo cadastrado.</td></tr>
                  ) : rows.map(r => (
                    <tr key={r.plate} className="border-t hover:bg-gray-50">
                      <td className="p-2"><b>{r.plate}</b> <span className="text-gray-500">{r.name}</span></td>
                      <td className="p-2 text-right">{r.lastOdo ? r.lastOdo.toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2 text-right font-medium">{r.km ? r.km.toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2 text-right">{r.liters ? r.liters.toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2 text-right">{r.kmPerLiter ? r.kmPerLiter.toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2 text-right">{fmtMoney(r.fuelCost)}</td>
                      <td className="p-2 text-right">{fmtMoney(r.maintCost)}</td>
                      <td className="p-2 text-right">{fmtMoney(r.tireCost)}</td>
                      <td className="p-2 text-right">{fmtMoney(r.expCost)}</td>
                      <td className="p-2 text-right font-semibold">{fmtMoney(r.total)}</td>
                      <td className="p-2 text-right">{r.costPerKm ? fmtMoney(r.costPerKm) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}