import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Loader2, Building2, Search, Phone, Mail, MapPin, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCnpj, maskCep, maskPhone, maskCpfCnpj } from "@/lib/brMasks";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function SupplierManager({ userEmail }) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", trade_name: "", cpf_cnpj: "", ie: "", contact_person: "",
    phone: "", whatsapp: "", email: "", website: "",
    cep: "", address: "", number: "", complement: "", district: "", city: "", uf: "",
    payment_terms: "", delivery_time: "", category: "", notes: "", is_active: true,
  });

  const load = async () => {
    try {
      const data = await base44.entities.DiagnosticSupplier.filter({ user_email: userEmail }, "-created_date");
      setSuppliers(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.cpf_cnpj?.includes(search) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleNew = () => {
    setEditing(null);
    setForm({
      name: "", trade_name: "", cpf_cnpj: "", ie: "", contact_person: "",
      phone: "", whatsapp: "", email: "", website: "",
      cep: "", address: "", number: "", complement: "", district: "", city: "", uf: "",
      payment_terms: "", delivery_time: "", category: "", notes: "", is_active: true,
    });
    setShowForm(true);
  };

  const handleEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || "", trade_name: s.trade_name || "", cpf_cnpj: s.cpf_cnpj || "",
      ie: s.ie || "", contact_person: s.contact_person || "",
      phone: s.phone || "", whatsapp: s.whatsapp || "", email: s.email || "", website: s.website || "",
      cep: s.cep || "", address: s.address || "", number: s.number || "",
      complement: s.complement || "", district: s.district || "", city: s.city || "", uf: s.uf || "",
      payment_terms: s.payment_terms || "", delivery_time: s.delivery_time || "",
      category: s.category || "", notes: s.notes || "", is_active: s.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Informe a razão social do fornecedor.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, user_email: userEmail };
      if (editing) {
        await base44.entities.DiagnosticSupplier.update(editing.id, data);
      } else {
        await base44.entities.DiagnosticSupplier.create(data);
      }
      toast({ title: "Sucesso", description: editing ? "Fornecedor atualizado." : "Fornecedor cadastrado." });
      setShowForm(false);
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (s) => {
    if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return;
    try {
      await base44.entities.DiagnosticSupplier.delete(s.id);
      toast({ title: "Excluído", description: "Fornecedor removido." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Fornecedores ({suppliers.length})
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor..." className="pl-9 h-9 w-56" />
          </div>
          <Button type="button" onClick={handleNew} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
            <Plus className="w-4 h-4" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>{search ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{s.name}</h3>
                  {s.trade_name && <p className="text-xs text-gray-500 truncate">{s.trade_name}</p>}
                  <p className="text-xs text-gray-500">{s.cpf_cnpj ? `CNPJ: ${maskCpfCnpj(s.cpf_cnpj)}` : "Sem CNPJ"}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => handleEdit(s)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDelete(s)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                {s.category && <p className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{s.category}</span></p>}
                {s.contact_person && <p>👤 {s.contact_person}</p>}
                {s.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {maskPhone(s.phone)}</p>}
                {s.email && <p className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {s.email}</p>}
                {s.city && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.city}/{s.uf}</p>}
                {s.payment_terms && <p className="text-gray-400">💳 {s.payment_terms}</p>}
              </div>
              {!s.is_active && (
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label className="text-sm">Razão Social *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Ex: Auto Peças Silva Ltda" />
              </div>
              <div>
                <Label className="text-sm">Nome Fantasia</Label>
                <Input value={form.trade_name} onChange={e => setForm({ ...form, trade_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">CNPJ / CPF</Label>
                <Input value={form.cpf_cnpj ? maskCpfCnpj(form.cpf_cnpj) : ""} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value.replace(/\D/g, "") })} className="mt-1" placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label className="text-sm">Inscrição Estadual</Label>
                <Input value={form.ie} onChange={e => setForm({ ...form, ie: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Categoria</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="Ex: Peças, Óleos, Ferramentas" />
              </div>
              <div className="md:col-span-3">
                <div className="h-px bg-gray-100 my-2" />
                <p className="text-xs font-semibold text-gray-400 mb-2">CONTATO</p>
              </div>
              <div>
                <Label className="text-sm">Pessoa de Contato</Label>
                <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="mt-1" placeholder="Vendedor / Representante" />
              </div>
              <div>
                <Label className="text-sm">Telefone</Label>
                <Input value={form.phone ? maskPhone(form.phone) : ""} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} className="mt-1" placeholder="(00) 0000-0000" />
              </div>
              <div>
                <Label className="text-sm">WhatsApp</Label>
                <Input value={form.whatsapp ? maskPhone(form.whatsapp) : ""} onChange={e => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, "") })} className="mt-1" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label className="text-sm">Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Site</Label>
                <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="mt-1" placeholder="www.exemplo.com" />
              </div>
              <div className="md:col-span-3">
                <div className="h-px bg-gray-100 my-2" />
                <p className="text-xs font-semibold text-gray-400 mb-2">ENDEREÇO</p>
              </div>
              <div>
                <Label className="text-sm">CEP</Label>
                <Input value={form.cep ? maskCep(form.cep) : ""} onChange={e => setForm({ ...form, cep: e.target.value.replace(/\D/g, "") })} className="mt-1" placeholder="00000-000" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-sm">Logradouro</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Número</Label>
                <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Complemento</Label>
                <Input value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Bairro</Label>
                <Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-sm">Município</Label>
                <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">UF</Label>
                <select value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
                  <option value="">—</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <div className="h-px bg-gray-100 my-2" />
                <p className="text-xs font-semibold text-gray-400 mb-2">COMERCIAL</p>
              </div>
              <div>
                <Label className="text-sm">Condições de Pagamento</Label>
                <Input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} className="mt-1" placeholder="Ex: 30/60 dias, À vista" />
              </div>
              <div>
                <Label className="text-sm">Prazo de Entrega</Label>
                <Input value={form.delivery_time} onChange={e => setForm({ ...form, delivery_time: e.target.value })} className="mt-1" placeholder="Ex: 3 dias úteis" />
              </div>
              <div className="md:col-span-3">
                <Label className="text-sm">Observações</Label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 mt-1 text-sm" />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                <Label htmlFor="is_active" className="text-sm cursor-pointer">Fornecedor ativo</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="button" onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}