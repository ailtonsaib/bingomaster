import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

const empty = { name: "", cnpj: "", contact_person: "", phone: "", email: "", address: "", city: "", uf: "", is_active: true };

export default function ErpSupplierFormModal({ user, supplier, onClose, onSaved }) {
  const [form, setForm] = useState({ ...empty, ...(supplier || {}) });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe a razão social."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email,
      name: form.name.trim(),
      cnpj: form.cnpj || undefined,
      contact_person: form.contact_person || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      uf: form.uf || undefined,
      is_active: form.is_active,
    };
    try {
      if (supplier?.id) await base44.entities.ErpSupplier.update(supplier.id, payload);
      else await base44.entities.ErpSupplier.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{supplier ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><Label>Razão social *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} /></div>
            <div><Label>Contato</Label><Input value={form.contact_person} onChange={e => set("contact_person", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
          </div>
          <div><Label>Endereço</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Município</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div><Label>UF</Label><Input value={form.uf} onChange={e => set("uf", e.target.value)} maxLength={2} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Fornecedor ativo
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}