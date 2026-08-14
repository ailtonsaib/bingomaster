import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, Gavel, X, ClipboardList, Link2, Unlink } from "lucide-react";
import { genOrderNumber, fmtMoney, fmtDate, UNITS } from "@/lib/erpUtils";

const STATUS = {
  aberta: { label: "Aberta", color: "text-blue-700 bg-blue-100" },
  fechada: { label: "Fechada", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-red-700 bg-red-100" },
};

export default function ErpQuotationPanel({ user }) {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, sups] = await Promise.all([
        base44.entities.ErpQuotation.filter({ user_email: user.email }, "-quotation_date", 500),
        base44.entities.ErpSupplier.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setItems(list); setSuppliers(sups);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const t = (o.number + " " + (o.supplier_name || "") + " " + (o.description || "") + " " + (o.requisition_number || "")).toLowerCase();
    return okS && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => { if (!confirm(`Excluir cotação "${o.number}"?`)) return; await base44.entities.ErpQuotation.delete(o.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cotação..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Cotação</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Número</th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Fornecedor</th>
                <th className="p-2 text-left">Solicitação</th>
                <th className="p-2 text-left">Objeto</th>
                <th className="p-2 text-right">Itens</th>
                <th className="p-2 text-right">Valor</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400"><Gavel className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma cotação.</td></tr>
              : filtered.map(o => {
                const st = STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{o.number}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.quotation_date)}</td>
                    <td className="p-2">{o.supplier_name || "—"}</td>
                    <td className="p-2 font-mono text-xs text-indigo-600">{o.requisition_number || "—"}</td>
                    <td className="p-2 max-w-[260px] truncate" title={o.description}>{o.description || "—"}</td>
                    <td className="p-2 text-right">{o.items?.length || 0}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.quoted_value)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(o); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(o)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpQuotationForm
          user={user} quotation={editing} suppliers={suppliers}
          onClose={() => setShowForm(false)} onSaved={load}
        />
      )}
    </div>
  );
}

function ErpQuotationForm({ user, quotation, suppliers, onClose, onSaved }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [form, setForm] = useState({
    number: quotation?.number || genOrderNumber("COT"),
    quotation_date: quotation?.quotation_date || new Date().toISOString().slice(0, 10),
    supplier_id: quotation?.supplier_id || "",
    supplier_name: quotation?.supplier_name || "",
    requisition_id: quotation?.requisition_id || "",
    requisition_number: quotation?.requisition_number || "",
    description: quotation?.description || "",
    items: quotation?.items || [],
    status: quotation?.status || "aberta",
    is_winner: quotation?.is_winner || false,
    notes: quotation?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.ErpRequisition.filter({ user_email: user.email, status: { $in: ["aberta", "aprovada"] } }, "-request_date", 200);
        setRequisitions(list);
      } catch (e) { console.error(e); }
      setLoadingReqs(false);
    })();
  }, [user.email]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const total = form.items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  // Buscar solicitação e trazer todos os itens
  const handlePickRequisition = (reqId) => {
    if (!reqId) {
      setForm(prev => ({ ...prev, requisition_id: "", requisition_number: "" }));
      return;
    }
    const req = requisitions.find(r => r.id === reqId);
    if (!req) return;
    const importedItems = (req.items || []).map(it => ({
      item_type: it.item_type || "novo",
      product_id: it.product_id || "",
      product_name: it.product_name || "",
      description: it.description || it.product_name || "",
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "UN",
      unit_price: Number(it.unit_price) || 0,
      total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    }));
    setForm(prev => ({
      ...prev,
      requisition_id: req.id,
      requisition_number: req.number,
      items: importedItems,
      description: prev.description || (req.department_name ? `Solicitação ${req.number} — ${req.department_name}` : `Solicitação ${req.number}`),
    }));
  };

  const unlinkRequisition = () => setForm(prev => ({ ...prev, requisition_id: "", requisition_number: "" }));

  const addItem = () => setForm(prev => ({
    ...prev,
    items: [...prev.items, { item_type: "novo", product_id: "", product_name: "", description: "", quantity: 1, unit: "UN", unit_price: 0, total: 0 }],
  }));
  const removeItem = (i) => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(prev => {
    const items = [...prev.items]; items[i] = { ...items[i], [field]: value };
    if (["quantity", "unit_price"].includes(field)) items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    return { ...prev, items };
  });

  const handleSave = async () => {
    if (!form.description) { alert("Informe o objeto cotado."); return; }
    if (!form.items.length && !form.quoted_value) { /* ok, valor avulso */ }
    setSaving(true);
    const payload = {
      user_email: user.email,
      number: form.number,
      quotation_date: new Date(form.quotation_date).toISOString(),
      supplier_id: form.supplier_id || undefined,
      supplier_name: suppliers.find(s => s.id === form.supplier_id)?.name || form.supplier_name || undefined,
      requisition_id: form.requisition_id || undefined,
      requisition_number: form.requisition_number || undefined,
      description: form.description,
      items: form.items,
      quantity: form.items.length || 1,
      unit: "UN",
      quoted_value: form.items.length ? total : (Number(form.quoted_value) || 0),
      status: form.status,
      is_winner: !!form.is_winner,
      notes: form.notes || undefined,
    };
    try {
      if (quotation?.id) await base44.entities.ErpQuotation.update(quotation.id, payload);
      else await base44.entities.ErpQuotation.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{quotation ? "Editar Cotação" : "Nova Cotação / Tomada de Preço"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Número</Label><Input value={form.number} onChange={e => set("number", e.target.value)} /></div>
            <div><Label>Data</Label><Input type="date" value={form.quotation_date?.slice(0,10)} onChange={e => set("quotation_date", e.target.value)} /></div>
            <div><Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Fornecedor</Label>
            <select value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">Selecione...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Buscar Solicitação (opcional) */}
          <div className="border rounded-lg p-2.5 bg-indigo-50/40">
            <Label className="text-xs text-indigo-700 flex items-center gap-1.5 mb-1.5"><ClipboardList className="w-3.5 h-3.5" /> Buscar Solicitação (opcional)</Label>
            <div className="flex gap-2 items-center">
              {loadingReqs ? (
                <span className="text-xs text-gray-400">Carregando solicitações...</span>
              ) : (
                <>
                  <select
                    value={form.requisition_id}
                    onChange={e => handlePickRequisition(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="">Não vincular — cotação avulsa</option>
                    {requisitions.map(r => (
                      <option key={r.id} value={r.id}>{r.number} — {r.department_name || r.requested_by || "—"} ({r.items?.length || 0} itens)</option>
                    ))}
                  </select>
                  {form.requisition_id && (
                    <button type="button" onClick={unlinkRequisition} title="Desvincular solicitação" className="p-2 hover:bg-white rounded text-indigo-600">
                      <Unlink className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
            {form.requisition_id && (
              <p className="text-[11px] text-indigo-600 mt-1.5 flex items-center gap-1"><Link2 className="w-3 h-3" /> Vinculada a {form.requisition_number} — itens importados ({form.items.length}).</p>
            )}
          </div>

          <div><Label>Objeto Cotado</Label><Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descrição do objeto cotado" /></div>

          {/* Itens */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
              <span className="text-sm font-semibold">Itens da Cotação</span>
              <Button size="sm" variant="outline" onClick={addItem} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button>
            </div>
            {form.items.length === 0 ? <p className="p-4 text-center text-sm text-gray-400">Nenhum item. {form.requisition_id ? "" : "Você pode vincular uma solicitação para importar, ou adicionar manualmente."}</p> : form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                <div className="col-span-5"><Label className="text-[10px]">Descrição / Serviço</Label>
                  <Input value={it.description || it.product_name || ""} onChange={e => updateItem(i, "description", e.target.value)} className="h-8 text-xs" placeholder="Descrição do item" />
                </div>
                <div className="col-span-1"><Label className="text-[10px]">Qtd</Label><Input type="number" step="0.01" value={it.quantity} onChange={e => updateItem(i, "quantity", Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="col-span-1"><Label className="text-[10px]">Un.</Label>
                  <select value={it.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="w-full h-8 rounded border border-input px-1 text-xs">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label className="text-[10px]">Vlr. unit.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(i, "unit_price", Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="col-span-2"><Label className="text-[10px]">Total</Label><p className="h-8 flex items-center font-medium">{fmtMoney(it.total)}</p></div>
                <div className="col-span-1"><button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
            <div className="flex justify-end p-2 bg-gray-50 border-t text-sm"><span className="mr-3 text-gray-500">Total cotado:</span><b>{fmtMoney(total)}</b></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm mt-1">
              <input type="checkbox" checked={form.is_winner} onChange={e => set("is_winner", e.target.checked)} />
              Cotação vencedora
            </label>
            <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Cotação"}</Button>
        </div>
      </div>
    </div>
  );
}