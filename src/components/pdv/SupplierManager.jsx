import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, Building2, Search } from "lucide-react";
import { lookupCnpj } from "@/lib/cnpjLookup";

const EMPTY = {
  name: "", cpf_cnpj: "", ie: "", email: "", phone: "",
  cep: "", address: "", number: "", complement: "", district: "",
  city: "", uf: "", is_active: true,
};

const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function SupplierManager({ user }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const handleCnpjLookup = async (cnpjValue) => {
    const clean = (cnpjValue || "").replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);
    const data = await lookupCnpj(clean);
    if (data?.error) {
      alert(data.error);
    } else if (data) {
      setForm(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        cep: data.cep || prev.cep,
        address: data.address || prev.address,
        number: data.number || prev.number,
        complement: data.complement || prev.complement,
        district: data.district || prev.district,
        city: data.city || prev.city,
        uf: data.uf || prev.uf,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
      }));
    }
    setCnpjLoading(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVSupplier.filter({ user_email: user.email });
      setSuppliers(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.cpf_cnpj?.includes(search)
  );

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ ...EMPTY, ...s }); setEditing(s); setShowForm(true); };

  const save = async () => {
    if (!form.name) { alert("Informe a razão social!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      if (editing?.id) {
        await base44.entities.PDVSupplier.update(editing.id, data);
      } else {
        await base44.entities.PDVSupplier.create(data);
      }
      setShowForm(false);
      load();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  const remove = async (s) => {
    if (!confirm(`Excluir fornecedor "${s.name}"?`)) return;
    await base44.entities.PDVSupplier.delete(s.id);
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Fornecedores</h2>
          <span className="text-sm text-gray-500">({suppliers.length})</span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 w-48" />
          </div>
          <Button onClick={openNew} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum fornecedor cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{s.name}</h3>
                  <p className="text-xs text-gray-500">{s.cpf_cnpj ? `CNPJ: ${s.cpf_cnpj}` : "Sem CNPJ"}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(s)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {s.city && <p>📍 {s.city}/{s.uf}</p>}
                {s.phone && <p>📞 {s.phone}</p>}
                {s.email && <p>✉️ {s.email}</p>}
                {s.ie && <p>IE: {s.ie}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold">{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Razão Social / Nome *</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>CNPJ / CPF</Label>
                  <div className="flex gap-1">
                    <Input value={form.cpf_cnpj} onChange={e => setForm({...form, cpf_cnpj: e.target.value.replace(/\D/g, '').slice(0,14)})} onBlur={e => handleCnpjLookup(e.target.value)} className="h-9 font-mono" placeholder="CPF ou CNPJ" />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={form.cpf_cnpj?.length !== 14 || cnpjLoading} onClick={() => handleCnpjLookup(form.cpf_cnpj)} title="Buscar dados na Receita">
                      {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>UF</Label>
                  <select value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Selecione</option>
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.number} onChange={e => setForm({...form, number: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input value={form.complement} onChange={e => setForm({...form, complement: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.district} onChange={e => setForm({...form, district: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Município</Label>
                  <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="h-9" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}