import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Package, RefreshCw, Loader2 } from "lucide-react";
import ErpProductFormModal from "./ErpProductFormModal";
import { fmtMoney, typeLabel, typeColor } from "@/lib/erpUtils";
import { buildKardexRows, kardexAverageCost } from "@/lib/erpKardex";

export default function ErpProductManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showNoStock, setShowNoStock] = useState(false);
  const [kardexData, setKardexData] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, entries, sales, productions, moves, inventories, requisitions] = await Promise.all([
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpWmsInventory.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
        base44.entities.ErpWarehouseRequisition.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      ]);
      setItems(list);
      setKardexData({ entries, sales, productions, moves, inventories, requisitions });
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  // Custo médio (média móvel do kardex) por produto — usado para exibir/gravar
  // custo quando o custo cadastrado está zerado mas há movimentação valuada
  const costMap = useMemo(() => {
    const map = {};
    if (kardexData) items.forEach(p => { map[p.id] = kardexAverageCost(buildKardexRows(kardexData, p), p); });
    return map;
  }, [kardexData, items]);

  // Grava o custo médio do kardex no cadastro dos produtos com custo zerado
  const handleSyncCosts = async () => {
    const updates = items
      .filter(p => !(Number(p.cost_price) > 0) && (Number(costMap[p.id]) || 0) > 0)
      .map(p => ({ id: p.id, cost_price: Math.round((Number(costMap[p.id]) || 0) * 10000) / 10000 }));
    if (!updates.length) { alert("Nenhum produto com custo zerado que possua custo médio no kardex."); return; }
    if (!window.confirm(`Atualizar o custo cadastrado de ${updates.length} produto(s) pelo custo médio do kardex?`)) return;
    setSyncing(true);
    try {
      await base44.entities.ErpProduct.bulkUpdate(updates);
      alert(`Custo atualizado para ${updates.length} produto(s).`);
      load();
    } catch (e) { alert("Erro ao atualizar custos: " + e.message); }
    setSyncing(false);
  };

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
        <Button size="sm" variant="outline" onClick={handleSyncCosts} disabled={syncing || !kardexData} className="gap-1.5">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar custos (kardex)
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
                  <td className="p-2 text-right text-gray-600">
                    {Number(p.cost_price) > 0 ? fmtMoney(p.cost_price) : (Number(costMap[p.id]) > 0
                      ? <span className="text-indigo-600" title="Custo médio do kardex — o custo cadastrado está zerado">{fmtMoney(costMap[p.id])} *</span>
                      : fmtMoney(0))}
                  </td>
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
      <p className="text-[11px] text-gray-400">
        * Custo médio do kardex (custo cadastrado zerado) — use "Atualizar custos (kardex)" para gravá-lo no cadastro.
      </p>

      {showForm && (
        <ErpProductFormModal user={user} product={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}