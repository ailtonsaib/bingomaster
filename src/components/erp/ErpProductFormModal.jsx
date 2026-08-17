import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { PRODUCT_TYPES, UNITS } from "@/lib/erpUtils";

const empty = {
  code: "", barcode: "", name: "", product_type: "mercadoria",
  category: "", ncm: "", unit: "UN", stock: 0, min_stock: 0,
  cost_price: 0, sale_price: 0, is_active: true, notes: "",
  subgroup_id: "", subgroup_name: "",
  account_estoque_id: "", account_estoque_name: "",
  account_venda_id: "", account_venda_name: "",
  account_devolucao_id: "", account_devolucao_name: "",
  account_transferencia_id: "", account_transferencia_name: "",
};

export default function ErpProductFormModal({ user, product, onClose, onSaved }) {
  const [form, setForm] = useState({ ...empty, ...(product || {}) });
  const [saving, setSaving] = useState(false);
  const [subgroups, setSubgroups] = useState([]);
  const [accountsEstoque, setAccountsEstoque] = useState([]);
  const [accountsVenda, setAccountsVenda] = useState([]);
  const [accountsDevolucao, setAccountsDevolucao] = useState([]);
  const [accountsTransferencia, setAccountsTransferencia] = useState([]);

  useEffect(() => {
    base44.entities.ErpStockSubgroup.filter({ user_email: user.email }, "-created_date", 500).then(setSubgroups).catch(() => setSubgroups([]));
    base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, tipo_gerencial: "estoque" }, "-created_date", 500).then(setAccountsEstoque).catch(() => setAccountsEstoque([]));
    base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, tipo_gerencial: "venda" }, "-created_date", 500).then(setAccountsVenda).catch(() => setAccountsVenda([]));
    base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, tipo_gerencial: "devolucao" }, "-created_date", 500).then(setAccountsDevolucao).catch(() => setAccountsDevolucao([]));
    base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, tipo_gerencial: "transferencia" }, "-created_date", 500).then(setAccountsTransferencia).catch(() => setAccountsTransferencia([]));
  }, [user.email]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const pickAccount = (list, key, id) => {
    const o = list.find(a => a.id === id);
    setForm(prev => ({ ...prev, [`${key}_id`]: id, [`${key}_name`]: o ? `${o.code} - ${o.name}` : "" }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome do produto."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email,
      code: form.code || undefined,
      barcode: form.barcode || undefined,
      name: form.name.trim(),
      product_type: form.product_type,
      category: form.category || undefined,
      ncm: form.ncm || undefined,
      unit: form.unit,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      is_active: form.is_active,
      subgroup_id: form.subgroup_id || undefined,
      subgroup_name: form.subgroup_name || undefined,
      account_estoque_id: form.account_estoque_id || undefined,
      account_estoque_name: form.account_estoque_name || undefined,
      account_venda_id: form.account_venda_id || undefined,
      account_venda_name: form.account_venda_name || undefined,
      account_devolucao_id: form.account_devolucao_id || undefined,
      account_devolucao_name: form.account_devolucao_name || undefined,
      account_transferencia_id: form.account_transferencia_id || undefined,
      account_transferencia_name: form.account_transferencia_name || undefined,
      notes: form.notes || undefined,
    };
    try {
      if (product?.id) await base44.entities.ErpProduct.update(product.id, payload);
      else await base44.entities.ErpProduct.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message || "Erro ao salvar produto"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{product ? "Editar Produto" : "Novo Produto"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><Label>Código interno</Label><Input value={form.code} onChange={e => set("code", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Código de barras</Label><Input value={form.barcode} onChange={e => set("barcode", e.target.value)} /></div>
            <div><Label>NCM</Label><Input value={form.ncm} onChange={e => set("ncm", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <select value={form.product_type} onChange={e => set("product_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {PRODUCT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div><Label>Categoria</Label><Input value={form.category} onChange={e => set("category", e.target.value)} /></div>
          </div>
          <div>
            <Label>Subgrupo de estoque</Label>
            <select value={form.subgroup_id} onChange={e => {
              const opt = subgroups.find(s => s.id === e.target.value);
              set("subgroup_id", e.target.value);
              set("subgroup_name", opt ? opt.name : "");
            }} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">Selecione o subgrupo...</option>
              {subgroups.map(s => <option key={s.id} value={s.id}>{s.name}{s.group_name ? ` (${s.group_name})` : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta de Estoque</Label>
              <select value={form.account_estoque_id} onChange={e => pickAccount(accountsEstoque, "account_estoque", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {accountsEstoque.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Conta de Venda</Label>
              <select value={form.account_venda_id} onChange={e => pickAccount(accountsVenda, "account_venda", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {accountsVenda.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta de Devolução</Label>
              <select value={form.account_devolucao_id} onChange={e => pickAccount(accountsDevolucao, "account_devolucao", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {accountsDevolucao.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Conta de Transferência</Label>
              <select value={form.account_transferencia_id} onChange={e => pickAccount(accountsTransferencia, "account_transferencia", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {accountsTransferencia.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Unidade</Label>
              <select value={form.unit} onChange={e => set("unit", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><Label>Estoque</Label><Input type="number" value={form.stock} onChange={e => set("stock", e.target.value)} /></div>
            <div><Label>Estoque mín.</Label><Input type="number" value={form.min_stock} onChange={e => set("min_stock", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço de custo (R$)</Label><Input type="number" step="0.01" value={form.cost_price} onChange={e => set("cost_price", e.target.value)} /></div>
            <div><Label>Preço de venda (R$)</Label><Input type="number" step="0.01" value={form.sale_price} onChange={e => set("sale_price", e.target.value)} /></div>
          </div>
          <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Produto ativo
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}