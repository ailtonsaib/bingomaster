import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, Zap, AlertTriangle } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => { const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
const STATUS_OPTS = {
  aberta: { label: "Aberta", color: "bg-blue-100 text-blue-700" },
  em_execucao: { label: "Em Execução", color: "bg-amber-100 text-amber-700" },
  concluida: { label: "Concluída", color: "bg-emerald-100 text-emerald-700" },
  cancelada: { label: "Cancelada", color: "bg-gray-100 text-gray-600" },
};
const TYPE_LABEL = { preventiva: "Preventiva", corretiva: "Corretiva", preditiva: "Preditiva" };

export default function ErpMaintenanceCalendar({ user }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setOrders(await base44.entities.ErpMaintenanceOrder.filter({ user_email: user.email }, "-created_date", 500)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const detail = orders.find(o => o.id === detailId) || null;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const iso = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayStr = todayISO();
  const ordersOf = (d) => orders.filter(o => (o.scheduled_date || o.opened_date || "").slice(0, 10) === iso(d));
  const isOverdue = (o) => ["aberta", "em_execucao"].includes(o.status) && (o.scheduled_date || "").slice(0, 10) < todayStr;

  const toggleItem = async (o, i) => {
    const items = (o.checklist_items || []).map((c, idx) => idx === i ? { ...c, done: !c.done } : c);
    try {
      await base44.entities.ErpMaintenanceOrder.update(o.id, { checklist_items: items });
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base flex items-center gap-2"><CalendarDays className="w-5 h-5 text-purple-600" /> Calendário de Ordens de Serviço</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-medium text-sm min-w-[140px] text-center">{MONTHS[month]} / {year}</span>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-gray-100 border rounded-t-xl text-center text-xs font-medium text-gray-500">
        {WEEKDAYS.map(w => <div key={w} className="p-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-t-0 rounded-b-xl overflow-hidden">
        {Array.from({ length: startOffset }).map((_, i) => <div key={"b" + i} className="bg-gray-50 min-h-[96px]" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const list = ordersOf(d);
          const isToday = iso(d) === todayStr;
          return (
            <div key={d} className={`bg-white min-h-[96px] p-1.5 ${isToday ? "ring-2 ring-inset ring-purple-400" : ""}`}>
              <p className={`text-xs font-semibold mb-1 ${isToday ? "text-purple-600" : "text-gray-400"}`}>{d}</p>
              {list.slice(0, 3).map(o => (
                <button key={o.id} onClick={() => setDetailId(o.id)} className={`block w-full text-left text-[10px] px-1 py-0.5 rounded mb-0.5 truncate ${STATUS_OPTS[o.status]?.color || "bg-gray-100"} ${isOverdue(o) ? "border border-red-400" : ""}`} title={`${o.number} — ${o.equipment_name}`}>
                  {o.number} {TYPE_LABEL[o.order_type]?.[0]}
                </button>
              ))}
              {list.length > 3 && <p className="text-[10px] text-gray-400">+{list.length - 3} OS</p>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400">As OS aparecem na data prevista (agendamento) ou, sem agendamento, na data de abertura. Em vermelho: OS atrasadas ainda não concluídas.</p>

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold">{detail.number} {isOverdue(detail) && <AlertTriangle className="w-4 h-4 text-red-500 inline" />}</h2>
              <button onClick={() => setDetailId(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Equipamento: </span><b>{detail.equipment_name || "—"}</b></div>
                <div><span className="text-gray-500">Tipo: </span><b>{TYPE_LABEL[detail.order_type] || detail.order_type}</b></div>
                <div><span className="text-gray-500">Status: </span><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_OPTS[detail.status]?.color}`}>{STATUS_OPTS[detail.status]?.label}</span></div>
                <div><span className="text-gray-500">Responsável: </span><b>{detail.responsible || "—"}</b></div>
                <div><span className="text-gray-500">Abertura: </span><b>{fmtDate(detail.opened_date)}</b></div>
                <div><span className="text-gray-500">Prevista: </span><b>{fmtDate(detail.scheduled_date)}</b></div>
              </div>
              {detail.description && <div className="border-t pt-2"><span className="text-gray-500">Serviço: </span>{detail.description}</div>}
              {detail.notes && <div className="border-t pt-2"><span className="text-gray-500">Laudo/Obs: </span>{detail.notes}</div>}
              {(detail.checklist_items || []).length > 0 && (
                <div className="border-t pt-2">
                  <p className="font-semibold mb-1 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Checklist de Execução ({detail.checklist_items.filter(c => c.done).length}/{detail.checklist_items.length})</p>
                  <div className="space-y-1">
                    {detail.checklist_items.map((c, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!c.done} onChange={() => toggleItem(detail, i)} />
                        <span className={c.done ? "line-through text-gray-400" : ""}>{c.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}