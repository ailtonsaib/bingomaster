import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, AlertTriangle, ClipboardCheck } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => { const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };

export default function ErpPreventivePanel({ user }) {
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        base44.entities.ErpMaintenancePlan.filter({ user_email: user.email }, "next_execution", 500),
        base44.entities.ErpMaintenanceOrder.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setPlans(p); setOrders(o);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const today = todayISO();
  const nextDateOf = (p) => {
    if (p.next_execution) return p.next_execution.slice(0, 10);
    if (p.last_execution) return addDays(p.last_execution.slice(0, 10), Number(p.frequency_days) || 30);
    return today;
  };
  const activePlans = plans.filter(p => p.is_active !== false && p.equipment_id).map(p => ({ ...p, next: nextDateOf(p) }));
  const pend = activePlans.filter(p => p.next <= today)
    .map(p => ({ ...p, daysLate: Math.max(0, Math.floor((new Date(today) - new Date(p.next)) / 86400000)) }))
    .sort((a, b) => b.daysLate - a.daysLate);
  const upcoming = activePlans.filter(p => p.next > today && p.next <= addDays(today, 30)).sort((a, b) => a.next.localeCompare(b.next));

  // Aderência: % de preventivas concluídas entre as programadas nos últimos 90 dias
  const limit90 = addDays(today, -90);
  const prevOS = orders.filter(o => o.order_type === "preventiva" && (o.scheduled_date || o.opened_date || "").slice(0, 10) >= limit90);
  const aderencia = prevOS.length ? Math.round(prevOS.filter(o => o.status === "concluida").length / prevOS.length * 100) : null;

  const generate = async () => {
    if (!pend.length) return;
    if (!confirm(`Gerar ${pend.length} OS preventiva(s) vencida(s) agora? Cada plano será reagendado para a próxima periodicidade.`)) return;
    setBusy(true);
    try {
      let seq = orders.length;
      for (const p of pend) {
        const checklist = (p.checklist || "").split("\n").map(s => s.trim()).filter(Boolean).map(t => ({ text: t, done: false }));
        await base44.entities.ErpMaintenanceOrder.create({
          user_email: user.email,
          number: `OS ${String(++seq).padStart(3, "0")}/${new Date().getFullYear()}`,
          equipment_id: p.equipment_id, equipment_name: p.equipment_name,
          order_type: "preventiva",
          description: `Preventiva — ${p.description}`,
          status: "aberta", responsible: p.responsible || "",
          opened_date: today, scheduled_date: p.next,
          plan_id: p.id, checklist_items: checklist,
        });
        let next = p.next;
        while (next <= today) next = addDays(next, Number(p.frequency_days) || 30);
        await base44.entities.ErpMaintenancePlan.update(p.id, { next_execution: next });
      }
      alert(`${pend.length} OS preventiva(s) gerada(s) — veja na aba Ordem de Serviço e no Calendário.`);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Preventivas Automáticas</h2>
        <Button size="sm" onClick={generate} disabled={busy || !pend.length} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Gerar OS Preventivas ({pend.length})
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Planos vencidos</p><p className="text-xl font-bold text-red-600">{pend.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Aderência (90 dias)</p><p className="text-xl font-bold text-emerald-600">{aderencia === null ? "—" : aderencia + "%"}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Próximas 30 dias</p><p className="text-xl font-bold">{upcoming.length}</p></div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="w-4 h-4 text-red-500" /> Planos Vencidos ({pend.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr><th className="p-2 text-left">Equipamento</th><th className="p-2 text-left">Plano</th><th className="p-2 text-right">Periodicidade</th><th className="p-2 text-left">Vencida em</th><th className="p-2 text-right">Atraso</th></tr>
            </thead>
            <tbody>
              {pend.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum plano preventivo vencido. Tudo em dia!</td></tr>
                : pend.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{p.equipment_name}</td>
                    <td className="p-2 max-w-[260px] truncate" title={p.description}>{p.description}</td>
                    <td className="p-2 text-right text-xs">{p.frequency_days} dias</td>
                    <td className="p-2 text-xs">{p.next.split("-").reverse().join("/")}</td>
                    <td className="p-2 text-right"><span className={`text-xs px-2 py-0.5 rounded-full ${p.daysLate > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.daysLate > 0 ? `${p.daysLate} dia(s)` : "Hoje"}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="w-4 h-4 text-emerald-600" /> Próximas 30 dias ({upcoming.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr><th className="p-2 text-left">Equipamento</th><th className="p-2 text-left">Plano</th><th className="p-2 text-left">Prevista para</th></tr>
            </thead>
            <tbody>
              {upcoming.length === 0 ? <tr><td colSpan={3} className="p-6 text-center text-gray-400">Nenhuma preventiva prevista para os próximos 30 dias.</td></tr>
                : upcoming.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{p.equipment_name}</td>
                    <td className="p-2 max-w-[280px] truncate" title={p.description}>{p.description}</td>
                    <td className="p-2 text-xs">{p.next.split("-").reverse().join("/")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">Ao gerar, o sistema cria a OS preventiva com o checklist do plano já anexado e reagenda o plano para a próxima periodicidade. A aderência mede as preventivas concluídas entre as programadas nos últimos 90 dias.</p>
    </div>
  );
}