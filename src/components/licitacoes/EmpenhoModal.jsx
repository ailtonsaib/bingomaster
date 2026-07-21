import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export default function EmpenhoModal({ bid, suppliers, onSave, onClose }) {
  const [form, setForm] = useState({
    order_number: "",
    supplier_id: bid?.winner_supplier_id || "",
    delivery_date: "",
    items: (bid?.items || []).map(it => ({
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.reference_price,
      total: it.quantity * it.reference_price,
    })),
    notes: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm(f => ({
    ...f,
    items: f.items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [k]: v };
      if (k === "quantity" || k === "unit_price") {
        next.total = (next.quantity || 0) * (next.unit_price || 0);
      }
      return next;
    })
  }));

  const total = form.items.reduce((s, it) => s + (it.total || 0), 0);

  const submit = (e) => {
    e.preventDefault();
    if (!form.order_number.trim() || !form.supplier_id) return;
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    onSave({
      ...form,
      delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : "",
      emission_date: new Date().toISOString(),
      supplier_name: supplier?.name || "",
      total_value: total,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Gerar Empenho — {bid?.bid_number}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Número do empenho *</Label>
            <Input value={form.order_number} onChange={e => set("order_number", e.target.value)} placeholder="NE 001/2026" required />
          </div>
          <div>
            <Label>Fornecedor *</Label>
            <select value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" required>
              <option value="">— Selecione —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Data de entrega</Label>
            <Input type="date" value={form.delivery_date} onChange={e => set("delivery_date", e.target.value)} />
          </div>
        </div>

        <div className="mt-5">
          <Label className="text-sm font-semibold mb-2 block">Itens empenhados</Label>
          <div className="space-y-2">
            {form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <Input className="col-span-4" placeholder="Descrição" value={it.description} onChange={e => setItem(i, "description", e.target.value)} />
                <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Qtd" value={it.quantity} onChange={e => setItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                <Input className="col-span-1" placeholder="Un." value={it.unit} onChange={e => setItem(i, "unit", e.target.value)} />
                <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Preço" value={it.unit_price} onChange={e => setItem(i, "unit_price", parseFloat(e.target.value) || 0)} />
                <div className="col-span-3 flex items-center h-9 text-sm font-semibold text-gray-700 border rounded-md px-3 bg-gray-50">
                  {(it.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-right text-sm text-gray-500 mt-2">Total do empenho: <span className="font-bold text-blue-700">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></p>
        </div>

        <div className="mt-4">
          <Label>Observações</Label>
          <Input value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>

        <div className="flex gap-2 mt-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0">Emitir Empenho</Button>
        </div>
      </form>
    </div>
  );
}