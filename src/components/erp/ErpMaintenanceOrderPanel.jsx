import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, PlayCircle, CheckCircle2, Wrench, Timer } from "lucide-react";

const TYPE_OPTS = [
  { value: "preventiva", label: "Preventiva", color: "bg-blue-100 text-blue-700" },
  { value: "corretiva", label: "Corretiva", color: "bg-red-100 text-red-700" },
  { value: "preditiva", label: "Preditiva", color: "bg-amber-100 text-amber-700" },
];
const STATUS_OPTS = [
  { value: "aberta", label: "Aberta", color: "bg-blue-100 text-blue-700" },
  { value: "em_execucao", label: "Em Execução", color: "bg-amber-100 text-amber-700" },
  { value: "concluida", label: "Concluída", color: "bg-emerald-100 text-emerald-700" },
  { value: "cancelada", label: "Cancelada", color: "bg-gray-100 text-gray-600" },
];
const badge = (list, v) => {
  const o = list.find(o => o.value === v);
  return o ? <span className={`text-xs px-2 py-0.5 rounded-full ${o.color}`}>{o.label}</span> : v || "—";
};
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ErpMaintenanceOrderPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [closing, setClosing] = useState(null);
  const [closeForm, setCloseForm] = useState({ downtime_hours: 0, cost: 0, notes: "", part_product_id: "", part_quantity: 0, checklist: [] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [o, e, p] = await Promise.all([
        base44.entities.ErpMaintenanceOrder.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpEquipment.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setOrders(o); setEquipments(e); setProducts(p);
    } catch (err) { console.error(err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const nextNumber = `OS ${String(orders.length + 1).padStart(3, "0")}/${new Date().getFullYear()}`;
  const qty = (s) => orders.filter(o => o.status === s).length;
  const done = orders.filter(o => o.status === "concluida");
  const mttr = done.length ? (done.reduce((s, o) => s + (Number(o.downtime_hours) || 0), 0) / done.length).toFixed(1) + "h" : "—";
  const custoTotal = done.reduce((s, o) => s + (Number(o.cost) || 0), 0);
  // MTBF — intervalo médio entre falhas corretivas (horas), por equipamento
  const mtbf = (() => {
    const intervals = [];
    const byEquip = {};
    orders.filter(o => o.order_type === "corretiva").forEach(o => {
      if (!o.opened_date || !o.equipment_id) return;
      (byEquip[o.equipment_id] = byEquip[o.equipment_id] || []).push(new Date(o.opened_date).getTime());
    });
    Object.values(byEquip).forEach(dates => {
      dates.sort((a, b) => a - b);
      for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / 3600000);
    });
    return intervals.length ? (intervals.reduce((s, v) => s + v, 0) / intervals.length).toFixed(0) + "h" : "—";
  })();
  // Disponibilidade da frota ativa nos últimos 90 dias
  const disponibilidade = (() => {
    const ativos = equipments.filter(e => e.status !== "inativo");
    if (!ativos.length) return "—";
    const calHours = ativos.length * 90 * 24;
    const limit = Date.now() - 90 * 24 * 3600000;
    const down = done.reduce((s, o) => {
      const closed = new Date(o.closed_date || o.opened_date || 0).getTime();
      return s + (closed >= limit ? (Number(o.downtime_hours) || 0) : 0);
    }, 0);
    return Math.max(0, ((calHours - down) / calHours) * 100).toFixed(1) + "%";
  })();

  const filtered = orders.filter(o => {
    if (typeFilter && o.order_type !== typeFilter) return false;
    const t = [o.number, o.equipment_name, o.description, o.responsible].map(v => String(v ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const start = async (o) => { await base44.entities.ErpMaintenanceOrder.update(o.id, { status: "em_execucao" }); load(); };

  const confirmClose = async () => {
    setSaving(true);
    try {
      // Peça de reposição: baixa no estoque + movimentação WMS (ciclo 4.4 da especificação)
      const partQty = Number(closeForm.part_quantity) || 0;
      const part = products.find(p => p.id === closeForm.part_product_id);
      let partsNotes = closing.parts_notes || "";
      if (part && partQty > 0) {
        const stock = Number(part.stock) || 0;
        if (stock < partQty) { setSaving(false); return alert(`Estoque insuficiente da peça "${part.name}". Saldo: ${stock}.`); }
        await base44.entities.ErpProduct.update(part.id, { stock: stock - partQty });
        await base44.entities.ErpWmsMove.create({
          user_email: user.email, move_type: "saida",
          product_id: part.id, product_code: part.code || "", product_name: part.name, unit: part.unit || "",
          quantity: partQty, document: closing.number,
          move_date: todayISO(), notes: `Consumo de peça — ${closing.number}`,
        });
        partsNotes = (partsNotes ? partsNotes + "; " : "") + `${part.name} x ${partQty}`;
      }
      await base44.entities.ErpMaintenanceOrder.update(closing.id, {
        status: "concluida", closed_date: todayISO(),
        downtime_hours: Number(closeForm.downtime_hours) || 0,
        cost: Number(closeForm.cost) || 0,
        notes: closeForm.notes || closing.notes || "",
        parts_notes: partsNotes,
        checklist_items: closeForm.checklist,
      });
      setClosing(null); load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Ordens de Serviço — Manutenção</h2>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova OS</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Abertas" value={qty("aberta")} icon={<Wrench className="w-4 h-4" />} color="text-blue-600 bg-blue-50" />
        <Kpi label="Em Execução" value={qty("em_execucao")} icon={<PlayCircle className="w-4 h-4" />} color="text-amber-600 bg-amber-50" />
        <Kpi label="Concluídas" value={done.length} icon={<CheckCircle2 className="w-4 h-4" />} color="text-emerald-600 bg-emerald-50" />
        <Kpi label="MTTR Médio / Custo" value={mttr} sub={`R$ ${custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={<Wrench className="w-4 h-4" />} color="text-purple-600 bg-purple-50" />
        <Kpi label="MTBF (entre falhas)" value={mtbf} icon={<Timer className="w-4 h-4" />} color="text-blue-600 bg-blue-50" />
        <Kpi label="Disponibilidade (90d)" value={disponibilidade} icon={<CheckCircle2 className="w-4 h-4" />} color="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar OS, equipamento, responsável..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Todos os tipos</option>
          {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">OS</th><th className="p-2 text-left">Equipamento</th><th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Serviço</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Responsável</th>
                <th className="p-2 text-left">Abertura</th><th className="p-2 text-right">Parada (h)</th><th className="p-2 text-right">Custo</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhuma ordem de serviço.</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{o.number}</td>
                  <td className="p-2">{o.equipment_name || "—"}</td>
                  <td className="p-2">{badge(TYPE_OPTS, o.order_type)}</td>
                  <td className="p-2 max-w-[220px] truncate" title={o.description}>{o.description || "—"}</td>
                  <td className="p-2">{badge(STATUS_OPTS, o.status)}</td>
                  <td className="p-2">{o.responsible || "—"}</td>
                  <td className="p-2 text-xs">{(o.opened_date || "").slice(0, 10)}</td>
                  <td className="p-2 text-right">{o.downtime_hours || "—"}</td>
                  <td className="p-2 text-right">{o.cost ? Number(o.cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {o.status === "aberta" && <button title="Iniciar" onClick={() => start(o)} className="p-1 hover:bg-blue-50 rounded"><PlayCircle className="w-4 h-4 text-blue-500" /></button>}
                    {(o.status === "aberta" || o.status === "em_execucao") && (
                      <button title="Concluir" onClick={() => { setClosing(o); setCloseForm({ downtime_hours: o.downtime_hours || 0, cost: o.cost || 0, notes: o.notes || "", part_product_id: "", part_quantity: 0, checklist: (o.checklist_items || []).map(c => ({ ...c })) }); }} className="p-1 hover:bg-emerald-50 rounded"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></button>
                    )}
                    <button title="Excluir" onClick={async () => { if (confirm(`Excluir "${o.number}"?`)) { await base44.entities.ErpMaintenanceOrder.delete(o.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <OsForm user={user} equipments={equipments} defaultNumber={nextNumber} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}

      {closing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold">Concluir {closing.number}</h2>
              <button onClick={() => setClosing(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-600">Horas de Parada (MTTR)</Label>
                <Input type="number" step="0.1" value={closeForm.downtime_hours} onChange={e => setCloseForm(p => ({ ...p, downtime_hours: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Custo Total (R$)</Label>
                <Input type="number" step="0.01" value={closeForm.cost} onChange={e => setCloseForm(p => ({ ...p, cost: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2 border-t pt-3">
                <Label className="text-xs font-medium text-gray-600">Peça de Reposição (baixa automática no estoque)</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <select value={closeForm.part_product_id} onChange={e => setCloseForm(p => ({ ...p, part_product_id: e.target.value }))} className="col-span-2 h-9 rounded-md border border-input bg-white px-3 text-sm">
                    <option value="">Nenhuma</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.code ? p.code + " — " : ""}{p.name} (saldo: {Number(p.stock || 0).toLocaleString("pt-BR")})</option>)}
                  </select>
                  <Input type="number" step="0.01" placeholder="Qtd" value={closeForm.part_quantity} onChange={e => setCloseForm(p => ({ ...p, part_quantity: e.target.value }))} />
                </div>
              </div>
              {closeForm.checklist.length > 0 && (
                <div className="col-span-2 border-t pt-3">
                  <Label className="text-xs font-medium text-gray-600">Checklist de Execução ({closeForm.checklist.filter(c => c.done).length}/{closeForm.checklist.length})</Label>
                  <div className="space-y-1 mt-1">
                    {closeForm.checklist.map((c, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={c.done} onChange={e => setCloseForm(p => { const ch = [...p.checklist]; ch[i] = { ...ch[i], done: e.target.checked }; return { ...p, checklist: ch }; })} />
                        <span className={c.done ? "line-through text-gray-400" : ""}>{c.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <Label className="text-xs font-medium text-gray-600">Observações / Laudo Técnico</Label>
                <textarea value={closeForm.notes} onChange={e => setCloseForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full rounded-md border border-input px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setClosing(null)}>Cancelar</Button>
              <Button size="sm" disabled={saving} onClick={confirmClose} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Concluir OS"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, icon, color }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${color}`}>
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-lg leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function OsForm({ user, equipments, defaultNumber, onClose, onSaved }) {
  const [form, setForm] = useState({
    number: defaultNumber, equipment_id: "", order_type: "corretiva",
    description: "", responsible: "", opened_date: todayISO(),
    scheduled_date: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === "equipment_id") next.equipment_name = equipments.find(e => e.id === v)?.name || "";
      return next;
    });
  };
  const save = async () => {
    if (!form.equipment_id) return alert("Selecione o equipamento.");
    if (!form.description.trim()) return alert("Informe a descrição do serviço.");
    setSaving(true);
    try {
      await base44.entities.ErpMaintenanceOrder.create({ user_email: user.email, ...form });
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Nova Ordem de Serviço</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-gray-600">Número</Label>
            <Input value={form.number} onChange={e => set("number", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Tipo</Label>
            <select value={form.order_type} onChange={e => set("order_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Equipamento *</Label>
            <select value={form.equipment_id} onChange={e => set("equipment_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {equipments.map(e => <option key={e.id} value={e.id}>{e.code ? e.code + " — " : ""}{e.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Descrição do Serviço *</Label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="w-full rounded-md border border-input px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Responsável</Label>
            <Input value={form.responsible} onChange={e => set("responsible", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Data de Abertura</Label>
            <Input type="date" value={form.opened_date} onChange={e => set("opened_date", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Data Prevista (Agendamento)</Label>
            <Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}