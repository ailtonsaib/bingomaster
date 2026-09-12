import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Printer, Loader2, Boxes, AlertTriangle } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";
import { printElements } from "@/lib/printUtils";
import { buildKardexRows, kardexAverageCost } from "@/lib/erpKardex";

// Relatório de Inventário (posição de estoque): todos os produtos com controle
// de estoque — quantidade atual, mínimo, custo unitário e valor total em estoque,
// com destaque para itens abaixo do mínimo.
export default function ErpStockInventoryReport({ user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);
  const [groups, setGroups] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [movData, setMovData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 500).catch(() => []),
      base44.entities.ErpStockGroup.filter({ user_email: user.email }, "code", 500).catch(() => []),
      base44.entities.ErpStockSubgroup.filter({ user_email: user.email }, "code", 500).catch(() => []),
      base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWmsInventory.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWarehouseRequisition.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
    ]).then(([p, g, s, entries, sales, productions, moves, inventories, requisitions]) => {
      setProducts(p.filter(x => x.controla_estoque !== false && x.is_active !== false));
      setGroups(g);
      setSubgroups(s);
      setMovData({ entries, sales, productions, moves, inventories, requisitions });
    }).catch(() => {}).then(() => setLoading(false));
  }, [user.email]);

  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  // Custo médio por produto (média móvel do kardex: entradas de NF, custo do
  // inventário e saídas ao custo médio) — fallback: custo cadastrado
  const costMap = useMemo(() => {
    const map = {};
    if (movData) products.forEach(p => {
      map[p.id] = kardexAverageCost(buildKardexRows(movData, p), p);
    });
    return map;
  }, [movData, products]);
  const rows = products.filter(p => {
    if (subgroupId && p.subgroup_id !== subgroupId) return false;
    if (!subgroupId && groupId && !subgroups.some(s => s.group_id === groupId && s.id === p.subgroup_id)) return false;
    if (onlyBelowMin && !((Number(p.stock) || 0) < (Number(p.min_stock) || 0))) return false;
    const t = `${p.code || ""} ${p.name || ""} ${p.category || ""}`.toLowerCase();
    return t.includes(search.toLowerCase());
  });
  const totalValue = rows.reduce((s, p) => s + ((Number(p.stock) || 0) * (costMap[p.id] ?? (Number(p.cost_price) || 0))), 0);
  const totalQty = rows.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const belowMin = rows.filter(p => (Number(p.stock) || 0) < (Number(p.min_stock) || 0));
  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, código ou categoria..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={groupId} onChange={e => { setGroupId(e.target.value); setSubgroupId(""); }} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Grupo — todos</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.code ? g.code + " — " : ""}{g.name}</option>)}
        </select>
        <select value={subgroupId} onChange={e => setSubgroupId(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm" disabled={subgroups.length === 0}>
          <option value="">Subgrupo — todos</option>
          {subgroups.filter(s => !groupId || s.group_id === groupId).map(s => <option key={s.id} value={s.id}>{s.code ? s.code + " — " : ""}{s.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyBelowMin} onChange={e => setOnlyBelowMin(e.target.checked)} className="w-4 h-4" />
          Apenas abaixo do mínimo
        </label>
        <button onClick={() => printElements(["erp-inventory-print"])} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"><Printer className="w-4 h-4" /> Imprimir</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Itens</p><p className="text-lg font-semibold">{rows.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Quantidade total</p><p className="text-lg font-semibold">{r2(totalQty)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Valor total em estoque</p><p className="text-lg font-semibold text-indigo-700">{fmtMoney(totalValue)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Abaixo do mínimo</p><p className={`text-lg font-semibold ${belowMin.length ? "text-red-600" : ""}`}>{belowMin.length}</p></div>
      </div>

      <div id="erp-inventory-print" className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Boxes className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-semibold">Relatório de Inventário — Posição de Estoque</h3>
            <p className="text-[11px] text-gray-500">
              Emitido em {today} — {subgroupId ? `Subgrupo: ${subgroups.find(s => s.id === subgroupId)?.name || ""}` : groupId ? `Grupo: ${groups.find(g => g.id === groupId)?.name || ""}` : "produtos com controle de estoque"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Unidade</th>
                <th className="p-2 text-right">Estoque</th>
                <th className="p-2 text-right">Mínimo</th>
                <th className="p-2 text-right">Custo Unit.</th>
                <th className="p-2 text-right">Valor Total</th>
                <th className="p-2 text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum produto encontrado.</td></tr>
              ) : rows.map(p => {
                const below = (Number(p.stock) || 0) < (Number(p.min_stock) || 0);
                const cost = costMap[p.id] ?? (Number(p.cost_price) || 0);
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{p.code || "—"}</td>
                    <td className="p-2">{p.name}{p.category ? <span className="text-[10px] text-gray-400 block">{p.category}</span> : ""}</td>
                    <td className="p-2 text-xs">{p.unit || "UN"}</td>
                    <td className="p-2 text-right font-medium">{r2(p.stock)}</td>
                    <td className="p-2 text-right text-gray-500">{r2(p.min_stock)}</td>
                    <td className="p-2 text-right">{fmtMoney(cost)}</td>
                    <td className="p-2 text-right font-medium text-indigo-700">{fmtMoney(r2((Number(p.stock) || 0) * cost))}</td>
                    <td className="p-2">
                      {below ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-red-700 bg-red-100 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> Abaixo do mínimo</span>
                      ) : (Number(p.stock) || 0) === 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-amber-700 bg-amber-100 w-fit">Zerado</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-100 w-fit">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={3} className="p-2 text-xs font-semibold">Total — {rows.length} itens</td>
                  <td className="p-2 text-right text-xs font-semibold">{r2(totalQty)}</td>
                  <td colSpan={2}></td>
                  <td className="p-2 text-right text-xs font-semibold text-indigo-700">{fmtMoney(totalValue)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}