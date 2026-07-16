import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Loader2, UserCog, Phone, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { maskCpf, maskPhone } from "@/lib/brMasks";

const SPECIALTIES = [
  { value: "geral", label: "Geral" },
  { value: "motor", label: "Motor" },
  { value: "eletrica", label: "Elétrica" },
  { value: "suspensao", label: "Suspensão" },
  { value: "freios", label: "Freios" },
  { value: "ar_condicionado", label: "Ar Condicionado" },
  { value: "transmissao", label: "Transmissão" },
];

export default function MechanicManager({ userEmail }) {
  const { toast } = useToast();
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", cpf: "", phone: "", email: "", specialty: "geral", hire_date: "", commission_rate: 0, is_active: true });

  const load = async () => {
    try {
      const data = await base44.entities.DiagnosticMechanic.filter({ user_email: userEmail }, "-created_date");
      setMechanics(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, cpf: m.cpf || "", phone: m.phone || "", email: m.email || "", specialty: m.specialty || "geral", hire_date: m.hire_date || "", commission_rate: m.commission_rate || 0, is_active: m.is_active !== false });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({ name: "", cpf: "", phone: "", email: "", specialty: "geral", hire_date: "", commission_rate: 0, is_active: true });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Informe o nome do mecânico.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, user_email: userEmail, commission_rate: Number(form.commission_rate) || 0 };
      if (editing) {
        await base44.entities.DiagnosticMechanic.update(editing.id, data);
      } else {
        await base44.entities.DiagnosticMechanic.create(data);
      }
      toast({ title: "Sucesso", description: editing ? "Mecânico atualizado." : "Mecânico cadastrado." });
      setShowForm(false);
      load();
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este mecânico?")) return;
    try {
      await base44.entities.DiagnosticMechanic.delete(id);
      toast({ title: "Excluído", description: "Mecânico removido." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2"><UserCog className="w-5 h-5 text-blue-600" /> Mecânicos ({mechanics.length})</h3>
        <Button onClick={handleNew} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
          <Plus className="w-4 h-4" /> Novo Mecânico
        </Button>
      </div>

      {mechanics.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <UserCog className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Nenhum mecânico cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mechanics.map((m) => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{SPECIALTIES.find(s => s.value === m.specialty)?.label || "Geral"}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(m)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                {m.cpf && <p>CPF: {m.cpf}</p>}
                {m.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {m.phone}</p>}
                {m.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email}</p>}
                {m.commission_rate > 0 && <p>Comissão: {m.commission_rate}%</p>}
              </div>
              {!m.is_active && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Inativo</span>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? "Editar Mecânico" : "Novo Mecânico"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-sm">Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">CPF</Label>
                <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCpf(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: maskPhone(e.target.value) })} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-sm">Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Especialidade</Label>
                <select value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
                  {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm">Data de Admissão</Label>
                <Input type="date" value={form.hire_date ? form.hire_date.split("T")[0] : ""} onChange={e => setForm({ ...form, hire_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Comissão (%)</Label>
                <Input type="number" step="0.1" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} className="mt-1" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                  Ativo
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: "#2563EB" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}