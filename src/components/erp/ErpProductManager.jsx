import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import ErpProductFormModal from "./ErpProductFormModal";
import { fmtMoney, typeLabel, typeColor } from "@/lib/erpUtils";

export default function ErpProductManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showNoStock, setShowNoStock] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500);
      setItems(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(p => {
    const okType = typeFilter === "all" || p.product_type === typeFilter;
    // Produtos sem controle de estoque (serviços) ficam fora da relação por padrão
    const okStock = showNoStock || p.controla_estoque !== false;
    const t = (p.name + " " + (p.code || "") + " " + (p.barcode || "")).toLowerCase();
    return okType && okStock && t.includes(search.toLowerCase());
  });

  const handleDelete = async (p) => {
    if (!confirm(`Excluir o produto "${p.name}"?`)) return;
    await base44.entities.ErpProduct.delete(p.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-base">Cadastro de Produtos</h2>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, código ou barras..." className="pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os tipos</option>
          <option value="materia_prima">Matéria-Prima</option>
          <option value="mercadoria">Mercadoria</option>
          <option value="produto_acabado">Produto Acabado</option>
          <option value="produto_em_processo">Em Processo</option>
          <option value="insumo">Insumo</option>
          <option value="servico">Serviço</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
          <input type="checkbox" checked={showNoStock} onChange={e => setShowNoStock(e.target.checked)} className="w-4 h-4" /> Sem estoque
        </label>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Novo Produto
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Subgrupo</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-right">Estoque</th>
                <th className="p-2 text-right">Custo</th>
                <th className="p-2 text-right">Venda</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhum produto encontrado.
                </td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.code || ""} {p.barcode ? `• ${p.barcode}` : ""}</p>
                  </td>
                  <td className="p-2 text-gray-600">{p.subgroup_name || "—"}</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColor(p.product_type)}`}>{typeLabel(p.product_type)}</span>
                  </td>
                  <td className="p-2 text-right">
                    <span className={Number(p.stock) <= Number(p.min_stock) && p.product_type !== "servico" ? "text-amber-600 font-bold" : ""}>
                      {p.stock} {p.unit}
                    </span>
                  </td>
                  <td className="p-2 text-right text-gray-600">{fmtMoney(p.cost_price)}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(p.sale_price)}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(p)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpProductFormModal user={user} product={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}