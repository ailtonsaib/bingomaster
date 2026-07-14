import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, Users, Search } from "lucide-react";
import { lookupCnpj } from "@/lib/cnpjLookup";
import { maskCpfCnpj, maskPhone, maskCep } from "@/lib/brMasks";

const EMPTY = {
  name: "", cpf_cnpj: "", ie: "", email: "", phone: "",
  cep: "", address: "", number: "", complement: "", district: "",
  city: "", uf: "", ibge_code: "", buyer_type: "consumidor_final", is_active: true,
};

const BUYER_TYPE_LABELS = {
  consumidor_final: "Consumidor Final",
  revendedor: "Revendedor / Varejista",
  distribuidor: "Distribuidor / Atacadista",
};

const BUYER_TYPE_COLORS = {
  consumidor_final: "bg-gray-100 text-gray-700",
  revendedor: "bg-blue-100 text-blue-700",
  distribuidor: "bg-amber-100 text-amber-700",
};

const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function CustomerManager({ user }) {
  const [customers, setCustomers] = useState([]);
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
        ibge_code: data.ibge_code || prev.ibge_code,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
      }));
    }
    setCnpjLoading(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVCustomer.filter({ user_email: user.email });
      setCustomers(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(search)
  );

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ ...EMPTY, ...c }); setEditing(c); setShowForm(true); };

  const save = async () => {
    if (!form.name) { alert("Informe o nome do cliente!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      if (editing?.id) {
        await base44.entities.PDVCustomer.update(editing.id, data);
      } else {
        await base44.entities.PDVCustomer.create(data);
      }
      setShowForm(false);
      load();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  const remove = async (c) => {
    if (!confirm(`Excluir cliente "${c.name}"?`)) return;
    await base44.entities.PDVCustomer.delete(c.id);
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Clientes</h2>
          <span className="text-sm text-gray-500">({customers.length})</span>
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
          <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum cliente cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{c.name}</h3>
                  <p className="text-xs text-gray-500">{c.cpf_cnpj ? `CPF/CNPJ: ${c.cpf_cnpj}` : "Sem CPF/CNPJ"}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(c)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${BUYER_TYPE_COLORS[c.buyer_type] || BUYER_TYPE_COLORS.consumidor_final}`}>
                  {BUYER_TYPE_LABELS[c.buyer_type] || "Consumidor Final"}
                </span>
                {c.phone && <p>📞 {c.phone}</p>}
                {c.email && <p>✉️ {c.email}</p>}
                {c.address && <p>📍 {c.address}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold">{editing ? "Editar Cliente" : "Novo Cliente"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label>Nome / Razão Social *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CPF / CNPJ</Label>
                  <div className="flex gap-1">
                    <Input value={maskCpfCnpj(form.cpf_cnpj)} onChange={e => setForm({...form, cpf_cnpj: e.target.value.replace(/\D/g, '').slice(0,14)})} onBlur={e => handleCnpjLookup(e.target.value)} className="h-9 font-mono" placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={form.cpf_cnpj?.length !== 14 || cnpjLoading} onClick={() => handleCnpjLookup(form.cpf_cnpj)} title="Buscar dados na Receita">
                      {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={maskPhone(form.phone)} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g, '').slice(0,11)})} className="h-9" placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input value={maskCep(form.cep)} onChange={e => setForm({...form, cep: e.target.value.replace(/\D/g, '').slice(0,8)})} className="h-9" placeholder="00000-000" />
                </div>
                <div>
                  <Label>UF</Label>
                  <select value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Selecione</option>
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.number} onChange={e => setForm({...form, number: e.target.value})} className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Complemento</Label>
                  <Input value={form.complement} onChange={e => setForm({...form, complement: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.district} onChange={e => setForm({...form, district: e.target.value})} className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Município</Label>
                  <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="h-9" />
                </div>
                <div>
                  <Label>Código IBGE (7 dígitos)</Label>
                  <Input value={form.ibge_code} onChange={e => setForm({...form, ibge_code: e.target.value.replace(/\D/g, '').slice(0,7)})} className="h-9 font-mono" placeholder="4205407" />
                </div>
              </div>
              <div>
                <Label>Tipo de Comprador *</Label>
                <select value={form.buyer_type} onChange={e => setForm({...form, buyer_type: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="consumidor_final">Consumidor Final</option>
                  <option value="revendedor">Revendedor / Varejista</option>
                  <option value="distribuidor">Distribuidor / Atacadista</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Determina a regra de PIS/COFINS em produtos monofásicos bifásicos (Lei 13.097/2015).
                  Venda a distribuidor aplica alíquota reduzida; demais = 0%.
                </p>
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