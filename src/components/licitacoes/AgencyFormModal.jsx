import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export default function AgencyFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    cnpj: initial?.cnpj || "",
    contact_person: initial?.contact_person || "",
    phone: initial?.phone || "",
    email: initial?.email || "",
    address: initial?.address || "",
    city: initial?.city || "",
    uf: initial?.uf || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, cnpj: (form.cnpj || "").replace(/\D/g, "") });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{initial ? "Editar Órgão" : "Novo Órgão Público"}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome do órgão *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Prefeitura / Secretaria / Autarquia" required />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="Apenas números" />
          </div>
          <div>
            <Label>Ordenador / Pregoeiro</Label>
            <Input value={form.contact_person} onChange={e => set("contact_person", e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div>
            <Label>Município</Label>
            <Input value={form.city} onChange={e => set("city", e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={form.uf} onChange={e => set("uf", e.target.value.toUpperCase())} maxLength={2} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0">Salvar</Button>
        </div>
      </form>
    </div>
  );
}