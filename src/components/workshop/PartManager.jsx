import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Loader2, Package, Search, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PartManager({ userEmail }) {
  const { toast } = useToast();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", code: "", barcode: "", brand: "", category: "", unit: "UN", cost_price: 0, sale_price: 0, stock: 0, min_stock: 0, supplier: "", location: "", ncm: "", is_active: true });

  const load = async () => {
    try {
      const data = await base44.entities.DiagnosticPart.filter({ user_email: userEmail }, "-created_date");
      setParts(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = parts.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, code: p.code || "", barcode: p.barcode || "", brand: p.brand || "", category: p.category || "", unit: p.unit || "UN", cost_price: p.cost_price || 0, sale_price: p.sale_price || 0, stock: p.stock || 0, min_stock: p.min_stock || 0, supplier: p.supplier || "", location: p.location || "", ncm: p.ncm || "", is_active: p.is_active !== false });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({ name: "", code: "", barcode: "", brand: "", category: "", unit: "UN", cost_price: 0, sale_price: 0, stock: 0, min_stock: 0, supplier: "", location: "", ncm: "", is_active: true });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Informe o nome da peça.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, user_email: userEmail, cost_price: Number(form.cost_price) || 0, sale_price: Number(form.sale_price) || 0, stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0 };
      if (editing) {
        await base44.entities.DiagnosticPart.update(editing.id, data);
      } else {
        await base44.entities.DiagnosticPart.create(data);
      }
      toast({ title: "Sucesso", description: editing ? "Peça atualizada." : "Peça cadastrada." });
      setShowForm(false);
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir esta peça?")) return;
    try {
      await base44.entities.DiagnosticPart.delete(id);
      toast({ title: "Excluído", description: "Peça removida." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /> Peças ({parts.length})</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar peça..." className="pl-9 w-56" />
          </div>
          <Button onClick={handleNew} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
            <Plus className="w-4 h-4" /> Nova Peça
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>{search ? "Nenhuma peça encontrada." : "Nenhuma peça cadastrada."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-medium">Código</th>
                <th className="p-3 font-medium">Peça</th>
                <th className="p-3 font-medium">Marca</th>
                <th className="p-3 font-medium text-right">Preço</th>
                <th className="p-3 font-medium text-center">Estoque</th>
                <th className="p-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const lowStock = p.stock <= (p.min_stock || 0) && p.stock <= 5;
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-gray-500 font-mono text-xs">{p.code || "—"}</td>
                    <td className="p-3 font-medium text-gray-900">{p.name}</td>
                    <td className="p-3 text-gray-500">{p.brand || "—"}</td>
                    <td className="p-3 text-right font-medium text-green-600">{formatCurrency(p.sale_price)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${lowStock ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                        {lowStock && <AlertTriangle className="w-3 h-3" />} {p.stock} {p.unit || "UN"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEdit(p)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? "Editar Peça" : "Nova Peça"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-2">
                <Label className="text-sm">Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Unidade</Label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 mt-1 text-sm">
                  {["UN", "CX", "KG", "LT", "MT"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm">Código / SKU</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Código de Barras</Label>
                <Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Marca</Label>
                <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Categoria</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">NCM</Label>
                <Input value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Preço de Custo</Label>
                <Input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Preço de Venda *</Label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Estoque</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Estoque Mínimo</Label>
                <Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-sm">Fornecedor</Label>
                <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-3">
                <Label className="text-sm">Localização (prateleira/binha)</Label>
                <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1" />
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