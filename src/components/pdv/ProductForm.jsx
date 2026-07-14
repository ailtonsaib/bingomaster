import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProductForm({ user, categories, product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    barcode: product?.barcode || "",
    price: product?.price || "",
    cost: product?.cost || "",
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    category_id: product?.category_id || "",
    unit: product?.unit || "UN",
    ncm: product?.ncm || "",
    cfop_default: product?.cfop_default || "",
    monofasic: product?.monofasic || false,
    description: product?.description || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const cat = categories.find(c => c.id === form.category_id);
      const data = {
        ...form,
        price: parseFloat(form.price),
        cost: parseFloat(form.cost) || 0,
        stock: parseInt(form.stock) || 0,
        min_stock: parseInt(form.min_stock) || 0,
        category_name: cat?.name || "",
        user_email: user.email,
        is_active: true,
      };
      if (product) {
        await base44.entities.PDVProduct.update(product.id, data);
      } else {
        await base44.entities.PDVProduct.create(data);
      }
      onSaved();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{product ? "Editar Produto" : "Novo Produto"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="mb-1 block">Nome *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block">Código de Barras</Label>
              <Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Unidade</Label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="UN">UN</option><option value="KG">KG</option><option value="LT">LT</option>
                <option value="CX">CX</option><option value="MT">MT</option><option value="M2">M²</option>
              </select>
            </div>
            <div>
              <Label className="mb-1 block">NCM</Label>
              <Input value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })} placeholder="12345678" className="font-mono" maxLength={8} />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <Checkbox
              id="monofasic"
              checked={form.monofasic}
              onCheckedChange={(v) => setForm({ ...form, monofasic: v })}
            />
            <div>
              <label htmlFor="monofasic" className="text-sm font-medium flex items-center gap-1 cursor-pointer">
                <Scale className="w-3.5 h-3.5 text-indigo-600" /> Monofásico (Lei 13.097/2015)
              </label>
              <p className="text-xs text-indigo-600">Aplica CST 08 (sem incidência) para PIS/COFINS nas saídas</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Preço Venda *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <Label className="mb-1 block">Preço Custo</Label>
              <Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Estoque</Label>
              <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Estoque Mínimo</Label>
              <Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Categoria</Label>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">Sem categoria</option>
              {categories.filter(c => !c.parent_id).map(parent => (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>{parent.name}</option>
                  {categories.filter(c => c.parent_id === parent.id).map(sub => (
                    <option key={sub.id} value={sub.id}>  ↳ {sub.name}</option>
                  ))}
                </optgroup>
              ))}
              {categories.filter(c => !c.parent_id).length === 0 &&
                categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" style={{ backgroundColor: "#EA580C" }} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}