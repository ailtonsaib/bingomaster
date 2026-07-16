import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Loader2, Wrench } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORIES = [
  { value: "motor", label: "Motor" },
  { value: "eletrica", label: "Elétrica" },
  { value: "suspensao", label: "Suspensão" },
  { value: "freios", label: "Freios" },
  { value: "ar_condicionado", label: "Ar Condicionado" },
  { value: "transmissao", label: "Transmissão" },
  { value: "geral", label: "Geral" },
];

const categoryLabels = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));
const categoryColors = {
  motor: "bg-red-50 text-red-600",
  eletrica: "bg-amber-50 text-amber-600",
  suspensao: "bg-blue-50 text-blue-600",
  freios: "bg-orange-50 text-orange-600",
  ar_condicionado: "bg-cyan-50 text-cyan-600",
  transmissao: "bg-purple-50 text-purple-600",
  geral: "bg-gray-100 text-gray-600",
};

export default function ServiceTypeManager({ userEmail }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "geral", description: "", default_price: 0, estimated_hours: 0, is_active: true });

  const load = async () => {
    try {
      const data = await base44.entities.DiagnosticServiceType.filter({ user_email: userEmail }, "-created_date");
      setItems(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category || "geral", description: item.description || "", default_price: item.default_price || 0, estimated_hours: item.estimated_hours || 0, is_active: item.is_active !== false });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({ name: "", category: "geral", description: "", default_price: 0, estimated_hours: 0, is_active: true });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Informe o nome do serviço.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, user_email: userEmail, default_price: Number(form.default_price) || 0, estimated_hours: Number(form.estimated_hours) || 0 };
      if (editing) {
        await base44.entities.DiagnosticServiceType.update(editing.id, data);
      } else {
        await base44.entities.DiagnosticServiceType.create(data);
      }
      toast({ title: "Sucesso", description: editing ? "Serviço atualizado." : "Serviço cadastrado." });
      setShowForm(false);
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este tipo de serviço?")) return;
    try {
      await base44.entities.DiagnosticServiceType.delete(id);
      toast({ title: "Excluído", description: "Serviço removido." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2"><Wrench className="w-5 h-5 text-blue-600" /> Tipos de Serviço ({items.length})</h3>
        <Button onClick={handleNew} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
          <Plus className="w-4 h-4" /> Novo Serviço
        </Button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Ao abrir uma OS, o mecânico é filtrado pela categoria do serviço. Mecânicos com especialidade <strong>"Geral"</strong> aparecem em qualquer serviço.
      </p>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Wrench className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Nenhum tipo de serviço cadastrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-medium">Serviço</th>
                <th className="p-3 font-medium">Categoria</th>
                <th className="p-3 font-medium text-right">Preço Padrão</th>
                <th className="p-3 font-medium text-center">Tempo Est.</th>
                <th className="p-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[item.category] || categoryColors.geral}`}>
                      {categoryLabels[item.category] || item.category}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium text-green-600">{formatCurrency(item.default_price)}</td>
                  <td className="p-3 text-center text-gray-500">{item.estimated_hours ? `${item.estimated_hours}h` : "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => handleEdit(item)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? "Editar Serviço" : "Novo Tipo de Serviço"}</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Nome do Serviço *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Troca de Pastilha de Freio" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Categoria / Especialidade *</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Mecânicos desta categoria (ou "Geral") serão sugeridos na OS.</p>
              </div>
              <div>
                <Label className="text-sm">Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 min-h-[60px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Preço Padrão (R$)</Label>
                  <Input type="number" step="0.01" value={form.default_price} onChange={e => setForm({ ...form, default_price: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Tempo Estimado (h)</Label>
                  <Input type="number" step="0.5" value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} className="mt-1" />
                </div>
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