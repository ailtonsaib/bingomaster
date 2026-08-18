import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link2, Plus, Trash2, Save } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

// Gerencia os vínculos de um produto (meu) com os códigos dos fornecedores.
// Permite que um único produto seja comprado de N fornecedores, cada um com seu próprio cProd.
export default function ErpProductSupplierLinks({ user, product }) {
  const [links, setLinks] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ supplier_id: "", supplier_product_code: "", supplier_product_name: "", unit: product?.unit || "UN", last_unit_cost: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        base44.entities.ErpProductSupplier.filter({ user_email: user.email, product_id: product.id }, "-created_date", 200),
        base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "name", 500),
      ]);
      setLinks(l); setSuppliers(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [product.id, user.email]);

  const addLink = async () => {
    if (!draft.supplier_id) { alert("Selecione o fornecedor."); return; }
    if (!draft.supplier_product_code.trim()) { alert("Informe o código do produto no fornecedor."); return; }
    const sup = suppliers.find(s => s.id === draft.supplier_id);
    const exists = links.find(l => l.supplier_id === draft.supplier_id && l.supplier_product_code === draft.supplier_product_code);
    if (exists) { alert("Já existe um vínculo com este fornecedor/código."); return; }
    try {
      const created = await base44.entities.ErpProductSupplier.create({
        user_email: user.email,
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        supplier_id: sup.id,
        supplier_name: sup.name,
        supplier_document: sup.document,
        supplier_product_code: draft.supplier_product_code.trim(),
        supplier_product_name: draft.supplier_product_name.trim(),
        unit: draft.unit,
        last_unit_cost: Number(draft.last_unit_cost) || 0,
        last_purchased_date: new Date().toISOString(),
      });
      setLinks(p => [created, ...p]);
      setDraft({ supplier_id: "", supplier_product_code: "", supplier_product_name: "", unit: product?.unit || "UN", last_unit_cost: 0 });
      setAdding(false);
    } catch (e) { alert(e.message); }
  };

  const removeLink = async (l) => {
    if (!confirm(`Remover vínculo com ${l.supplier_name} (cód. ${l.supplier_product_code})?`)) return;
    await base44.entities.ErpProductSupplier.delete(l.id);
    setLinks(p => p.filter(x => x.id !== l.id));
  };

  const updateCost = async (l, v) => {
    const updated = await base44.entities.ErpProductSupplier.update(l.id, { last_unit_cost: Number(v) || 0 });
    setLinks(p => p.map(x => x.id === l.id ? updated : x));
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-indigo-50 px-3 py-2 border-b flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="w-4 h-4 text-indigo-600" /> Vínculos com Fornecedores (cProd)</h4>
        {!adding && <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1"><Plus className="w-3.5 h-3.5" /> Vínculo</Button>}
      </div>

      {adding && (
        <div className="p-3 bg-gray-50 border-b space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-gray-600">Fornecedor *</label>
              <select value={draft.supplier_id} onChange={e => setDraft(p => ({ ...p, supplier_id: e.target.value }))} className="w-full h-8 rounded border border-input px-2 text-xs">
                <option value="">Selecione...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600">Código no fornecedor (cProd) *</label>
              <input value={draft.supplier_product_code} onChange={e => setDraft(p => ({ ...p, supplier_product_code: e.target.value }))} className="w-full h-8 rounded border border-input px-2 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-gray-600">Descrição do fornecedor</label>
              <input value={draft.supplier_product_name} onChange={e => setDraft(p => ({ ...p, supplier_product_name: e.target.value }))} className="w-full h-8 rounded border border-input px-2 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600">Último custo (R$)</label>
              <input type="number" step="0.01" value={draft.last_unit_cost} onChange={e => setDraft(p => ({ ...p, last_unit_cost: e.target.value }))} className="w-full h-8 rounded border border-input px-2 text-right text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={addLink} className="gap-1 bg-indigo-600 hover:bg-indigo-700"><Save className="w-3.5 h-3.5" /> Salvar Vínculo</Button>
          </div>
        </div>
      )}

      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b"><tr><th className="p-2 text-left">Fornecedor</th><th className="p-2 text-left">Cód. Fornecedor</th><th className="p-2 text-left">Descrição do fornecedor</th><th className="p-2 text-right w-28">Último custo</th><th className="p-2 text-left w-24">Últ. compra</th><th className="p-2 w-10"></th></tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="p-3 text-center text-gray-400">Carregando...</td></tr>
          ) : links.length === 0 && !adding ? (
            <tr><td colSpan={6} className="p-3 text-center text-gray-400">Nenhum vínculo. Ao entrar uma NF deste fornecedor, o sistema vinculará automaticamente pelo cProd.</td></tr>
          ) : links.map(l => (
            <tr key={l.id} className="border-b">
              <td className="p-2">{l.supplier_name}</td>
              <td className="p-2 font-mono">{l.supplier_product_code}</td>
              <td className="p-2 text-gray-600">{l.supplier_product_name || "—"}</td>
              <td className="p-2 text-right"><input type="number" step="0.01" defaultValue={l.last_unit_cost} onBlur={e => updateCost(l, e.target.value)} className="w-24 h-7 rounded border border-input px-1 text-right text-xs" /></td>
              <td className="p-2 text-gray-500">{fmtDate(l.last_purchased_date)}</td>
              <td className="p-2 text-center"><button onClick={() => removeLink(l)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}