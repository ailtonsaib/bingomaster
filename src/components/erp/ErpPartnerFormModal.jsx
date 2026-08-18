import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

const digits = (v) => String(v || "").replace(/\D/g, "");

// Cadastro rápido de fornecedor (ErpPartner) — usado na Entrada de Despesa
// quando o fornecedor (PF/PJ) não está cadastrado. Para PJ o cadastro é automático
// via Receita; este modal abre principalmente para Pessoa Física (CPF).
export default function ErpPartnerFormModal({ user, prefill = {}, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: prefill.name || "",
    document: prefill.document || "",
    uf: prefill.uf || "",
    ie: "",
    cep: "",
    address: "",
    number: "",
    district: "",
    city: "",
    phone: "",
    email: "",
    contact_person: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isCpf = digits(form.document).length <= 11;

  const handleSave = async () => {
    setErr("");
    if (!form.name.trim()) { setErr("Informe o nome/razão social."); return; }
    const doc = digits(form.document);
    setSaving(true);
    try {
      const payload = {
        user_email: user.email,
        partner_type: "fornecedor",
        document_type: doc.length <= 11 ? "cpf" : "cnpj",
        document: doc || undefined,
        name: form.name.trim(),
        ie: form.ie || undefined,
        cep: form.cep || undefined,
        address: form.address || undefined,
        number: form.number || undefined,
        district: form.district || undefined,
        city: form.city || undefined,
        uf: form.uf || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        contact_person: form.contact_person || undefined,
        is_active: form.is_active,
      };
      const created = await base44.entities.ErpPartner.create(payload);
      onSaved?.(created);
      onClose?.();
    } catch (e) { setErr(e.message || "Erro ao cadastrar fornecedor."); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Cadastrar Fornecedor ({isCpf ? "Pessoa Física" : "Pessoa Jurídica"})</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
          <div><label className="text-xs font-medium text-gray-600">Nome / Razão social *</label><input value={form.name} onChange={e => set("name", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600">{isCpf ? "CPF" : "CNPJ"}</label><input value={form.document} onChange={e => set("document", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">Inscrição Estadual</label><input value={form.ie} onChange={e => set("ie", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-medium text-gray-600">CEP</label><input value={form.cep} onChange={e => set("cep", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-gray-600">Endereço</label><input value={form.address} onChange={e => set("address", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-medium text-gray-600">Número</label><input value={form.number} onChange={e => set("number", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">Bairro</label><input value={form.district} onChange={e => set("district", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">UF</label><input value={form.uf} onChange={e => set("uf", e.target.value.toUpperCase().slice(0, 2))} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Município</label><input value={form.city} onChange={e => set("city", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600">Telefone</label><input value={form.phone} onChange={e => set("phone", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600">Email</label><input value={form.email} onChange={e => set("email", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Pessoa de Contato</label><input value={form.contact_person} onChange={e => set("contact_person", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Fornecedor ativo
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Salvar Fornecedor
          </Button>
        </div>
      </div>
    </div>
  );
}