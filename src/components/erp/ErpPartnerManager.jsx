import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, Loader2, Handshake } from "lucide-react";
import { lookupCnpj } from "@/lib/cnpjLookup";
import { maskCpfCnpj, maskCep, maskPhone, onlyDigits } from "@/lib/brMasks";

const PARTNER_TYPE_OPTS = [
  { value: "cliente", label: "Cliente", color: "text-emerald-700 bg-emerald-100" },
  { value: "fornecedor", label: "Fornecedor", color: "text-blue-700 bg-blue-100" },
  { value: "ambos", label: "Cliente e Fornecedor", color: "text-purple-700 bg-purple-100" },
];

async function lookupCep(cep) {
  const clean = onlyDigits(cep);
  if (clean.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const d = await resp.json();
    if (d?.erro) return null;
    return {
      address: d.logradouro || "",
      district: d.bairro || "",
      city: d.localidade || "",
      uf: d.uf || "",
      ibge_code: d.ibge ? String(d.ibge) : "",
    };
  } catch (e) { return null; }
}

export default function ErpPartnerManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ErpPartner.filter({ user_email: user.email }, "-created_date", 500);
      setItems(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(p => (p.name + " " + (p.nome_fantasia || "") + " " + (p.document || "") + " " + (p.city || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (p) => { if (!confirm(`Excluir "${p.name}"?`)) return; await base44.entities.ErpPartner.delete(p.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ/CPF, cidade..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Parceiro</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Nome / Razão Social</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">CNPJ/CPF</th>
                <th className="p-2 text-left">Cidade/UF</th>
                <th className="p-2 text-left">Contato</th>
                <th className="p-2 text-left">Ativo</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-gray-400"><Handshake className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum parceiro cadastrado.</td></tr>
              : filtered.map(p => {
                const tp = PARTNER_TYPE_OPTS.find(o => o.value === p.partner_type) || PARTNER_TYPE_OPTS[0];
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{p.name}{p.nome_fantasia ? <span className="block text-xs text-gray-400">{p.nome_fantasia}</span> : null}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${tp.color}`}>{tp.label}</span></td>
                    <td className="p-2 font-mono text-xs">{p.document_type ? maskCpfCnpj(p.document) : (p.document || "—")}</td>
                    <td className="p-2">{p.city ? `${p.city}/${p.uf || ""}` : "—"}</td>
                    <td className="p-2 text-xs">{p.phone || p.email || "—"}</td>
                    <td className="p-2">{p.is_active ? <span className="text-emerald-600 text-xs">Sim</span> : <span className="text-gray-400 text-xs">Não</span>}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(p)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpPartnerForm user={user} editing={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}

function ErpPartnerForm({ user, editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    partner_type: editing?.partner_type || "cliente",
    document_type: editing?.document_type || "",
    document: editing?.document || "",
    name: editing?.name || "",
    nome_fantasia: editing?.nome_fantasia || "",
    ie: editing?.ie || "",
    im: editing?.im || "",
    cep: editing?.cep || "",
    address: editing?.address || "",
    number: editing?.number || "",
    district: editing?.district || "",
    city: editing?.city || "",
    uf: editing?.uf || "",
    ibge_code: editing?.ibge_code || "",
    phone: editing?.phone || "",
    email: editing?.email || "",
    contact_person: editing?.contact_person || "",
    is_active: editing?.is_active !== false,
    notes: editing?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const onDocumentChange = (v) => {
    const masked = maskCpfCnpj(v);
    const digits = onlyDigits(v);
    const dtype = digits.length === 14 ? "cnpj" : digits.length === 11 ? "cpf" : "";
    set("document", masked);
    set("document_type", dtype);
  };

  const lookupDocument = async () => {
    const digits = onlyDigits(form.document);
    if (digits.length !== 14) { setMsg(""); return; }
    setBusy(true); setMsg("Consultando CNPJ na Receita...");
    const res = await lookupCnpj(digits);
    setBusy(false);
    if (res?.error) { setMsg("⚠ " + res.error); return; }
    setForm(prev => ({
      ...prev,
      document_type: "cnpj",
      name: res.razao_social || prev.name,
      nome_fantasia: res.nome_fantasia || prev.nome_fantasia,
      cep: res.cep ? maskCep(res.cep) : prev.cep,
      address: res.address || prev.address,
      number: res.number || prev.number,
      district: res.district || prev.district,
      city: res.city || prev.city,
      uf: res.uf || prev.uf,
      ibge_code: res.ibge_code || prev.ibge_code,
      phone: res.phone ? maskPhone(res.phone) : prev.phone,
      email: res.email || prev.email,
    }));
    setMsg("Dados preenchidos pela Receita Federal.");
  };

  const onCepChange = (v) => set("cep", maskCep(v));

  const lookupAddress = async () => {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) { return; }
    setBusy(true); setMsg("Buscando endereço...");
    const res = await lookupCep(digits);
    setBusy(false);
    if (!res) { setMsg("CEP não encontrado."); return; }
    setForm(prev => ({
      ...prev,
      address: res.address || prev.address,
      district: res.district || prev.district,
      city: res.city || prev.city,
      uf: res.uf || prev.uf,
      ibge_code: res.ibge_code || prev.ibge_code,
    }));
    setMsg("Endereço preenchido pelo CEP.");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome/razão social."); return; }
    if (!form.partner_type) { alert("Selecione o tipo."); return; }
    setSaving(true);
    const payload = { user_email: user.email, ...form, document: onlyDigits(form.document), cep: onlyDigits(form.cep), phone: onlyDigits(form.phone) };
    if (!payload.document) delete payload.document;
    if (!payload.document_type) delete payload.document_type;
    ["ie", "im", "address", "number", "district", "city", "uf", "ibge_code", "email", "contact_person", "notes"].forEach(k => { if (!payload[k]) delete payload[k]; });
    try {
      if (editing?.id) await base44.entities.ErpPartner.update(editing.id, payload);
      else await base44.entities.ErpPartner.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const isCnpj = form.document_type === "cnpj";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{editing ? "Editar Parceiro" : "Novo Parceiro (Cliente / Fornecedor)"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Parceiro *</Label>
              <select value={form.partner_type} onChange={e => set("partner_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                {PARTNER_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label>CNPJ / CPF</Label>
              <div className="flex gap-1 mt-1">
                <Input value={form.document} onChange={e => onDocumentChange(e.target.value)} onBlur={lookupDocument} placeholder="00.000.000/0000-00 ou 000.000.000-00" />
                {isCnpj && <Button type="button" variant="outline" size="sm" onClick={lookupDocument} disabled={busy}><Loader2 className={`w-4 h-4 ${busy ? "animate-spin" : "hidden"}`} /></Button>}
              </div>
            </div>
          </div>

          {msg && <p className="text-xs text-gray-500">{busy && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}{msg}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>{isCnpj ? "Razão Social *" : "Nome Completo *"}</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            {isCnpj && <div className="col-span-2"><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={e => set("nome_fantasia", e.target.value)} /></div>}
            <div><Label>CEP</Label><Input value={form.cep} onChange={e => onCepChange(e.target.value)} onBlur={lookupAddress} placeholder="00000-000" /></div>
            <div><Label>Logradouro</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
            <div><Label>Número</Label><Input value={form.number} onChange={e => set("number", e.target.value)} /></div>
            <div><Label>Bairro</Label><Input value={form.district} onChange={e => set("district", e.target.value)} /></div>
            <div><Label>Município</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div><Label>UF</Label><Input value={form.uf} onChange={e => set("uf", e.target.value)} maxLength={2} /></div>
            {isCnpj && <><div><Label>Inscrição Estadual</Label><Input value={form.ie} onChange={e => set("ie", e.target.value)} /></div><div><Label>Inscrição Municipal</Label><Input value={form.im} onChange={e => set("im", e.target.value)} /></div></>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => set("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div className="col-span-2"><Label>Pessoa de Contato</Label><Input value={form.contact_person} onChange={e => set("contact_person", e.target.value)} /></div>
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Parceiro ativo</label>
          <div><Label>Observações</Label><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || busy}>{saving ? "Salvando..." : "Salvar Parceiro"}</Button>
        </div>
      </div>
    </div>
  );
}