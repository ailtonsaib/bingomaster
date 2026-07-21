import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Trash2 } from "lucide-react";

const MODALITIES = [
  { value: "pregao_eletronico", label: "Pregão Eletrônico" },
  { value: "pregao_presencial", label: "Pregão Presencial" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "tomada_precos", label: "Tomada de Preços" },
  { value: "convite", label: "Convite" },
  { value: "dispensa", label: "Dispensa de Licitação" },
  { value: "inexigibilidade", label: "Inexigibilidade" },
];

export default function BidFormModal({ initial, agencies, onSave, onClose }) {
  const [form, setForm] = useState({
    bid_number: initial?.bid_number || "",
    modality: initial?.modality || "pregao_eletronico",
    agency_id: initial?.agency_id || "",
    object_description: initial?.object_description || "",
    opening_date: initial?.opening_date ? initial.opening_date.slice(0, 16) : "",
    closing_date: initial?.closing_date ? initial.closing_date.slice(0, 16) : "",
    notes: initial?.notes || "",
    items: initial?.items || [{ description: "", quantity: 1, unit: "UN", reference_price: 0 }],
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setItem = (i, k, v) => setForm(f => ({
    ...f,
    items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it)
  }));

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: "", quantity: 1, unit: "UN", reference_price: 0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const totalRef = form.items.reduce((s, it) => s + (it.quantity * it.reference_price || 0), 0);

  const submit = (e) => {
    e.preventDefault();
    if (!form.bid_number.trim() || !form.object_description.trim()) return;
    const payload = {
      ...form,
      agency_name: agencies.find(a => a.id === form.agency_id)?.name || "",
      opening_date: form.opening_date ? new Date(form.opening_date).toISOString() : "",
      closing_date: form.closing_date ? new Date(form.closing_date).toISOString() : "",
      items: form.items.filter(it => it.description.trim()),
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{initial ? "Editar Pregão" : "Novo Pregão / Licitação"}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Número do pregão *</Label>
            <Input value={form.bid_number} onChange={e => set("bid_number", e.target.value)} placeholder="PE 001/2026" required />
          </div>
          <div>
            <Label>Modalidade</Label>
            <select value={form.modality} onChange={e => set("modality", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              {MODALITIES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Órgão público</Label>
            <select value={form.agency_id} onChange={e => set("agency_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">— Selecione —</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Objeto da licitação *</Label>
            <Input value={form.object_description} onChange={e => set("object_description", e.target.value)} placeholder="Aquisição de..." required />
          </div>
          <div>
            <Label>Abertura das propostas</Label>
            <Input type="datetime-local" value={form.opening_date} onChange={e => set("opening_date", e.target.value)} />
          </div>
          <div>
            <Label>Encerramento das propostas</Label>
            <Input type="datetime-local" value={form.closing_date} onChange={e => set("closing_date", e.target.value)} />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">Itens do pregão</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="w-3 h-3" /> Item</Button>
          </div>
          <div className="space-y-2">
            {form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <Input className="col-span-5" placeholder="Descrição" value={it.description} onChange={e => setItem(i, "description", e.target.value)} />
                <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Qtd" value={it.quantity} onChange={e => setItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                <Input className="col-span-2" placeholder="Un." value={it.unit} onChange={e => setItem(i, "unit", e.target.value)} />
                <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Preço ref." value={it.reference_price} onChange={e => setItem(i, "reference_price", parseFloat(e.target.value) || 0)} />
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex items-center justify-center h-9 text-red-500 hover:bg-red-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="text-right text-sm text-gray-500 mt-2">Total de referência: <span className="font-bold text-gray-800">{totalRef.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></p>
        </div>

        <div>
          <Label className="mt-4">Observações</Label>
          <Input value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>

        <div className="flex gap-2 mt-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0">Salvar Pregão</Button>
        </div>
      </form>
    </div>
  );
}