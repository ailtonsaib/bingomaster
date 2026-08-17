import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Trash2 } from "lucide-react";
import { genOrderNumber, fmtMoney } from "@/lib/erpUtils";

export default function ErpPurchaseFormModal({ user, order, products, suppliers, onClose, onSaved }) {
  const [quotations, setQuotations] = useState([]);
  const [useQuotation, setUseQuotation] = useState(!!order?.quotation_id);
  const [form, setForm] = useState({
    order_number: order?.order_number || genOrderNumber("PC"),
    supplier_id: order?.supplier_id || "",
    quotation_id: order?.quotation_id || "",
    emission_date: order?.emission_date ? new Date(order.emission_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    expected_date: order?.expected_date ? new Date(order.expected_date).toISOString().slice(0, 10) : "",
    notes: order?.notes || "",
    items: order?.items || [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        // Apenas tomadas de preço fechadas
        setQuotations(await base44.entities.ErpQuotation.filter({ user_email: user.email, status: "fechada" }, "-created_date", 200));
      } catch (e) { console.error(e); }
    })();
  }, [user.email]);

  const applyQuotation = (quotationId) => {
    const q = quotations.find(x => x.id === quotationId);
    if (!q) { set("quotation_id", ""); return; }
    const items = (q.items || []).map(it => ({
      product_id: it.product_id || "",
      product_name: it.product_name || it.description || "",
      ncm: "",
      unit: it.unit || "UN",
      quantity: Number(it.quantity) || 0,
      unit_cost: Number(it.unit_price) || 0,
      total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));
    setForm(prev => ({
      ...prev,
      quotation_id: quotationId,
      supplier_id: q.winner_supplier_id || prev.supplier_id,
      items: items.length ? items : prev.items,
    }));
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { product_id: "", product_name: "", unit: "UN", quantity: 1, unit_cost: 0, total: 0 }] }));
  const removeItem = (i) => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(prev => {
    const items = [...prev.items];
    items[i] = { ...items[i], [field]: value };
    if (field === "product_id") {
      const p = products.find(p => p.id === value);
      if (p) { items[i].product_name = p.name; items[i].unit = p.unit; items[i].unit_cost = p.cost_price || 0; items[i].ncm = p.ncm || ""; items[i].product_code = p.code || ""; }
    }
    if (["quantity", "unit_cost"].includes(field)) items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_cost) || 0);
    return { ...prev, items };
  });

  const total = form.items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const handleSave = async () => {
    if (!form.items.length) { alert("Adicione ao menos um item."); return; }
    if (!form.supplier_id) { alert("Selecione um fornecedor."); return; }
    setSaving(true);
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    const quotation = form.quotation_id ? quotations.find(q => q.id === form.quotation_id) : null;
    const payload = {
      user_email: user.email,
      order_number: form.order_number,
      supplier_id: form.supplier_id,
      supplier_name: supplier?.name || "",
      supplier_cnpj: supplier?.document || "",
      quotation_id: form.quotation_id || undefined,
      quotation_number: quotation?.number || undefined,
      emission_date: new Date(form.emission_date).toISOString(),
      expected_date: form.expected_date ? new Date(form.expected_date).toISOString() : undefined,
      items: form.items,
      total_value: total,
      status: order?.status || "rascunho",
      notes: form.notes || undefined,
    };
    try {
      if (order?.id) await base44.entities.ErpPurchaseOrder.update(order.id, payload);
      else await base44.entities.ErpPurchaseOrder.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{order ? "Editar Pedido de Compra" : "Novo Pedido de Compra"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useQuotation} onChange={e => { setUseQuotation(e.target.checked); if (!e.target.checked) set("quotation_id", ""); }} className="w-4 h-4" />
            Vincular a tomada de preço
          </label>
          {useQuotation && (
            <div>
              <Label>Tomada de Preço (fechadas)</Label>
              <select value={form.quotation_id} onChange={e => applyQuotation(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {quotations.map(q => <option key={q.id} value={q.id}>{q.number} — {q.description}{q.winner_supplier_name ? ` (Vencedor: ${q.winner_supplier_name})` : ""}</option>)}
              </select>
              {quotations.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhuma tomada de preço fechada disponível.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Número</Label><Input value={form.order_number} onChange={e => set("order_number", e.target.value)} /></div>
            <div>
              <Label>Fornecedor *</Label>
              <select value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Emissão</Label><Input type="date" value={form.emission_date} onChange={e => set("emission_date", e.target.value)} /></div>
            <div><Label>Entrega prevista</Label><Input type="date" value={form.expected_date} onChange={e => set("expected_date", e.target.value)} /></div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
              <span className="text-sm font-semibold">Itens</span>
              <Button size="sm" variant="outline" onClick={addItem} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button>
            </div>
            {form.items.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">Nenhum item adicionado.</p>
            ) : form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                <div className="col-span-4">
                  <Label className="text-[10px]">Produto</Label>
                  <select value={it.product_id} onChange={e => updateItem(i, "product_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                    <option value="">Selecione...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label className="text-[10px]">Qtd</Label><Input type="number" value={it.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-2"><Label className="text-[10px]">Custo unit.</Label><Input type="number" step="0.01" value={it.unit_cost} onChange={e => updateItem(i, "unit_cost", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-3"><Label className="text-[10px]">Total</Label><p className="h-8 flex items-center font-medium">{fmtMoney(it.total)}</p></div>
                <div className="col-span-1"><button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-sm text-gray-500">Total do pedido</span>
            <span className="text-lg font-bold">{fmtMoney(total)}</span>
          </div>
          <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Pedido"}</Button>
        </div>
      </div>
    </div>
  );
}