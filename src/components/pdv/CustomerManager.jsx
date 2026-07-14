import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, Users, Search } from "lucide-react";

const EMPTY = {
  name: "", cpf_cnpj: "", email: "", phone: "", address: "", is_active: true,
};

export default function CustomerManager({ user }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

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
              <div>
                <Label>CPF / CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={e => setForm({...form, cpf_cnpj: e.target.value})} className="h-9" />
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
                <Label>Endereço</Label>
                <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="h-9" />
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