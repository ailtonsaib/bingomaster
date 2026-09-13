import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/erpUtils";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);

const MAINT_TYPES = [
  { value: "preventiva", label: "Preventiva", color: "bg-blue-100 text-blue-700" },
  { value: "corretiva", label: "Corretiva", color: "bg-red-100 text-red-700" },
];

const MAINT_STATUS = [
  { value: "planejada", label: "Planejada", color: "bg-amber-100 text-amber-700" },
  { value: "realizada", label: "Realizada", color: "bg-emerald-100 text-emerald-700" },
];

// Cadastro de manutenção de veículos: serviço (mão de obra) + itens comprados
// (peças, pneus, lubrificantes etc.) com quantidade e valor unitário
export default function ErpFleetMaintenancePanel({ user }) {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, v] = await Promise.all([
        base44.entities.ErpFleetMaintenance.filter({ user_email: user.email }, "-service_date", 500),
        base44.entities.ErpFleetVehicle.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setRecords(m); setVehicles(v);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = records.filter(r => {
    const t = [r.vehicle_plate, r.description, r.supplier_name].map(x => String(x ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (r) => {
    if (!confirm(`Excluir a manutenção "${r.description}"?`)) return;
    await base44.entities.ErpFleetMaintenance.delete(r.id);
    load();
  };

  const itemsTotal = (r) => r2((r.items || []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_value) || 0), 0));
  const grandTotal = (r) => r2((Number(r.cost) || 0) + itemsTotal(r));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar manutenção..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Manutenção</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Veículo</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Serviço</th>
                <th className="p-2 text-left">Situação</th>
                <th className="p-2 text-right">Itens</th>
                <th className="p-2 text-right">Peças/Itens</th>
                <th className="p-2 text-right">Mão de Obra</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Próxima</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nenhuma manutenção registrada.</td></tr>
              ) : filtered.map(r => {
                const typeOpt = MAINT_TYPES.find(o => o.value === r.maintenance_type);
                const statusOpt = MAINT_STATUS.find(o => o.value === r.status);
                return (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">{fmtDate(r.service_date)}</td>
                    <td className="p-2 font-medium">{r.vehicle_plate || "—"}</td>
                    <td className="p-2">{typeOpt ? <span className={`text-xs px-2 py-0.5 rounded-full ${typeOpt.color}`}>{typeOpt.label}</span> : r.maintenance_type}</td>
                    <td className="p-2">
                      {r.description}
                      {(r.items || []).length > 0 && (
                        <span className="block text-[10px] text-gray-500">{r.items.map(i => `${i.quantity}x ${i.description}`).join(", ")}</span>
                      )}
                    </td>
                    <td className="p-2">{statusOpt ? <span className={`text-xs px-2 py-0.5 rounded-full ${statusOpt.color}`}>{statusOpt.label}</span> : r.status}</td>
                    <td className="p-2 text-right">{(r.items || []).length || "—"}</td>
                    <td className="p-2 text-right">{itemsTotal(r) > 0 ? fmtMoney(itemsTotal(r)) : "—"}</td>
                    <td className="p-2 text-right">{Number(r.cost) > 0 ? fmtMoney(r.cost) : "—"}</td>
                    <td className="p-2 text-right font-semibold">{fmtMoney(grandTotal(r))}</td>
                    <td className="p-2">{r.next_service_date ? fmtDate(r.next_service_date) : "—"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => handleDelete(r)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpFleetMaintenanceForm user={user} vehicles={vehicles} editing={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}

function ErpFleetMaintenanceForm({ user, vehicles, editing, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    vehicle_id: editing?.vehicle_id || "",
    maintenance_type: editing?.maintenance_type || "preventiva",
    status: editing?.status || "realizada",
    service_date: editing?.service_date ? String(editing.service_date).slice(0, 10) : todayISO(),
    odometer: editing?.odometer ?? "",
    description: editing?.description || "",
    cost: editing?.cost ?? "",
    supplier_name: editing?.supplier_name || "",
    next_service_date: editing?.next_service_date ? String(editing.next_service_date).slice(0, 10) : "",
    next_odometer: editing?.next_odometer ?? "",
    notes: editing?.notes || "",
  }));
  const [items, setItems] = useState(() => (editing?.items || []).map(i => ({ description: i.description || "", quantity: i.quantity ?? "", unit_value: i.unit_value ?? "" })));
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setItems(prev => prev.map((x, xi) => xi === i ? { ...x, [k]: v } : x));
  const itemsTotal = r2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_value) || 0), 0));
  const grandTotal = r2((Number(form.cost) || 0) + itemsTotal);

  const handleSave = async () => {
    if (!form.vehicle_id) return alert("Selecione o veículo.");
    if (!String(form.description).trim()) return alert("Informe a descrição do serviço.");
    setSaving(true);
    try {
      const vehicle = vehicles.find(v => v.id === form.vehicle_id);
      const payload = {
        user_email: user.email,
        vehicle_id: form.vehicle_id,
        vehicle_plate: vehicle?.plate || "",
        maintenance_type: form.maintenance_type,
        status: form.status,
        service_date: form.service_date || undefined,
        odometer: Number(form.odometer) || 0,
        description: form.description,
        cost: Number(form.cost) || 0,
        supplier_name: form.supplier_name || undefined,
        next_service_date: form.next_service_date || undefined,
        next_odometer: Number(form.next_odometer) || 0,
        notes: form.notes || undefined,
        items: items.filter(i => String(i.description).trim()).map(i => ({
          description: i.description,
          quantity: Number(i.quantity) || 0,
          unit_value: Number(i.unit_value) || 0,
          value: r2((Number(i.quantity) || 0) * (Number(i.unit_value) || 0)),
        })),
        items_total: itemsTotal,
      };
      if (editing?.id) await base44.entities.ErpFleetMaintenance.update(editing.id, payload);
      else await base44.entities.ErpFleetMaintenance.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const inputCls = "w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1";
  const labelCls = "text-xs font-medium text-gray-600";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{editing ? "Editar" : "Nova"} Manutenção</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Veículo *</label>
            <select value={form.vehicle_id} onChange={e => set("vehicle_id", e.target.value)} className={inputCls}>
              <option value="">Selecione o veículo...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.brand || ""} {v.model || ""}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tipo *</label>
            <select value={form.maintenance_type} onChange={e => set("maintenance_type", e.target.value)} className={inputCls}>
              {MAINT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Situação *</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls}>
              {MAINT_STATUS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data do Serviço *</label>
            <input type="date" value={form.service_date} onChange={e => set("service_date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Odômetro no Serviço (km)</label>
            <input type="number" step="0.1" min="0" value={form.odometer} onChange={e => set("odometer", e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Descrição do Serviço *</label>
            <input value={form.description} onChange={e => set("description", e.target.value)} className={inputCls} placeholder="Ex.: Troca de óleo e filtros, revisão dos freios..." />
          </div>
          <div>
            <label className={labelCls}>Custo do Serviço / Mão de Obra (R$)</label>
            <input type="number" step="0.01" min="0" value={form.cost} onChange={e => set("cost", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Oficina/Fornecedor</label>
            <input value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)} className={inputCls} />
          </div>

          <div className="col-span-2 border rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Itens comprados (peças, pneus etc.)</p>
              <button onClick={() => setItems(prev => [...prev, { description: "", quantity: "", unit_value: "" }])} className="text-xs text-indigo-600 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Incluir item</button>
            </div>
            {items.length === 0 && <p className="text-xs text-gray-400">Nenhum item — use "Incluir item" para registrar peças, pneus, lubrificantes etc.</p>}
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={it.description} onChange={e => setItem(i, "description", e.target.value)} placeholder="Descrição do item" className="flex-1 h-8 rounded-md border border-input bg-white px-2 text-xs" />
                <input type="number" step="0.001" min="0" value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} placeholder="Qtd" className="w-20 h-8 rounded-md border border-input bg-white px-2 text-xs" />
                <input type="number" step="0.01" min="0" value={it.unit_value} onChange={e => setItem(i, "unit_value", e.target.value)} placeholder="Valor unit." className="w-24 h-8 rounded-md border border-input bg-white px-2 text-xs" />
                <span className="w-24 text-right text-xs font-medium">{fmtMoney((Number(it.quantity) || 0) * (Number(it.unit_value) || 0))}</span>
                <button onClick={() => setItems(prev => prev.filter((_, xi) => xi !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
              </div>
            ))}
            <div className="flex justify-end gap-6 text-xs border-t pt-2">
              <span>Total dos itens: <b>{fmtMoney(itemsTotal)}</b></span>
              <span>Total geral (mão de obra + itens): <b className="text-indigo-700">{fmtMoney(grandTotal)}</b></span>
            </div>
          </div>

          <div>
            <label className={labelCls}>Próxima Manutenção (data)</label>
            <input type="date" value={form.next_service_date} onChange={e => set("next_service_date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Próxima por Km</label>
            <input type="number" step="0.1" min="0" value={form.next_odometer} onChange={e => set("next_odometer", e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Observações</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}