import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Printer, Loader2, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/erpUtils";
import { printElements } from "@/lib/printUtils";
import ErpCombobox from "@/components/erp/ErpCombobox";
import { buildKardexRows, applyPeriod, kardexAverageCost } from "@/lib/erpKardex";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Bloco de kardex de um produto — usado isolado ou em sequência (grupo/subgrupo)
function KardexBlock({ data, product, from, to }) {
  const rows = useMemo(() => buildKardexRows(data, product), [data, product]);
  const view = useMemo(() => applyPeriod(rows, from, to), [rows, from, to]);
  const totalIn = view.list.reduce((s, r) => s + r.in, 0);
  const totalOut = view.list.reduce((s, r) => s + r.out, 0);
  const finalSaldo = rows.length ? rows[rows.length - 1].saldo : 0;
  const finalCost = kardexAverageCost(rows, product);
  const stockMismatch = rows.length && r2(finalSaldo) !== r2(product.stock);
  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div id={`erp-kardex-print-${product.id}`} className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-semibold">Kardex — {product.code ? `${product.code} — ` : ""}{product.name}</h3>
            <p className="text-[11px] text-gray-500">Movimentação de estoque ({product.unit || "UN"}) • Emitido em {today}</p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-gray-500">Estoque atual cadastrado: <b>{r2(product.stock)} {product.unit || "UN"}</b></p>
          <p className="text-gray-500">Saldo final (kardex) — qtd: <b>{r2(finalSaldo)} {product.unit || "UN"}</b></p>
          <p className="text-gray-500">Custo unitário (médio): <b>{fmtMoney(finalCost)}</b></p>
          <p className="text-gray-500">Valor total do saldo: <b>{fmtMoney(r2((Number(finalSaldo) || 0) * finalCost))}</b></p>
        </div>
      </div>
      {stockMismatch && (
        <div className="px-4 py-2 bg-amber-50 border-b text-xs text-amber-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> O saldo do kardex ({r2(finalSaldo)}) difere do estoque cadastrado ({r2(product.stock)}) — confira as movimentações ou faça um inventário de ajuste.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Documento</th>
              <th className="p-2 text-left">Histórico / Origem</th>
              <th className="p-2 text-right">Entrada</th>
              <th className="p-2 text-right">Saída</th>
              <th className="p-2 text-right">Custo Unit.</th>
              <th className="p-2 text-right">Valor Total</th>
              <th className="p-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {view.prev ? (
              <tr className="bg-gray-50 border-t">
                <td className="p-2" colSpan={3}>{from ? `Saldo anterior a ${fmtDate(from)}` : ""}</td>
                <td className="p-2 text-right">—</td>
                <td className="p-2 text-right">—</td>
                <td className="p-2 text-right">—</td>
                <td className="p-2 text-right">—</td>
                <td className="p-2 text-right font-semibold">{r2(view.prev.saldo)}</td>
              </tr>
            ) : null}
            {view.list.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">
                Nenhuma movimentação que afete o estoque neste período.<br />
                <span className="text-[11px]">As movimentações são registradas quando: a NF de entrada é <b>lançada</b> (status "lancada"), a venda é <b>faturada</b>, a produção é <b>concluída</b> (consumo dos insumos e entrada do acabado), há movimentação <b>WMS</b> de entrada/saída ou o inventário é <b>ajustado</b>. Ordens de produção em andamento e requisições pendentes ainda não movimentam o estoque.</span>
              </td></tr>
            )}
            {view.list.map((r, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="p-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="p-2 font-medium whitespace-nowrap">{r.doc}</td>
                <td className="p-2 text-gray-600">{r.hist}</td>
                <td className="p-2 text-right text-emerald-700 font-medium">{r.in ? r.in.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : ""}</td>
                <td className="p-2 text-right text-red-600 font-medium">{r.out ? r.out.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : ""}</td>
                <td className="p-2 text-right text-gray-600">{r.unit_cost ? fmtMoney(r.unit_cost) : ""}</td>
                <td className="p-2 text-right text-gray-600">{fmtMoney(r2((Number(r.saldo) || 0) * (Number(r.avg_cost) || 0)))}</td>
                <td className="p-2 text-right font-semibold">{r2(r.saldo)}</td>
              </tr>
            ))}
          </tbody>
          {(view.list.length > 0 || view.prev) && (
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={3} className="p-2 text-xs font-semibold">Totais do período</td>
                <td className="p-2 text-right text-xs font-semibold text-emerald-700">{r2(totalIn)}</td>
                <td className="p-2 text-right text-xs font-semibold text-red-600">{r2(totalOut)}</td>
                <td className="p-2 text-right text-xs font-semibold">{fmtMoney(finalCost)}</td>
                <td className="p-2 text-right text-xs font-semibold">{fmtMoney(r2((Number(finalSaldo) || 0) * finalCost))}</td>
                <td className="p-2 text-right text-xs font-semibold">{r2(view.list.length ? view.list[view.list.length - 1].saldo : view.prev.saldo)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// Kardex de estoque: gera o kardex de um produto selecionado ou de todos os
// produtos de um grupo/subgrupo de estoque.
export default function ErpStockKardexReport({ user }) {
  const [data, setData] = useState(null);
  const [productId, setProductId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpProduct.filter({ user_email: user.email }, "name", 500).catch(() => []),
      base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWmsInventory.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWarehouseRequisition.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpStockGroup.filter({ user_email: user.email }, "code", 500).catch(() => []),
      base44.entities.ErpStockSubgroup.filter({ user_email: user.email }, "code", 500).catch(() => []),
    ]).then(d => setData({
      products: d[0], entries: d[1], sales: d[2], productions: d[3],
      moves: d[4], inventories: d[5], requisitions: d[6], groups: d[7], subgroups: d[8],
    })).then(() => setLoading(false));
  }, [user.email]);

  const productOptions = (data?.products || []).filter(p => p.controla_estoque !== false)
    .map(p => ({ id: p.id, label: `${p.code ? `${p.code} — ` : ""}${p.name}` }));
  const subgroups = data?.subgroups || [];
  const filteredSubgroups = subgroups.filter(s => !groupId || s.group_id === groupId);

  // Produtos em escopo: o produto selecionado ou todos os do grupo/subgrupo
  const scopedProducts = useMemo(() => {
    if (!data) return [];
    const list = data.products.filter(p => p.controla_estoque !== false);
    if (productId) return list.filter(p => p.id === productId);
    if (subgroupId) return list.filter(p => p.subgroup_id === subgroupId);
    if (groupId) {
      const sgs = new Set(subgroups.filter(s => s.group_id === groupId).map(s => s.id));
      return list.filter(p => sgs.has(p.subgroup_id));
    }
    return [];
  }, [data, productId, groupId, subgroupId, subgroups]);

  const selectGroup = (v) => { setGroupId(v); setSubgroupId(""); setProductId(""); };
  const selectSubgroup = (v) => { setSubgroupId(v); setProductId(""); };
  const selectProduct = (v) => setProductId(v);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-64 min-w-[200px]">
          <ErpCombobox value={productId} onValueChange={selectProduct} options={productOptions} placeholder="Produto específico..." clearable />
        </div>
        <select value={groupId} onChange={e => selectGroup(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Grupo — todos</option>
          {(data?.groups || []).map(g => <option key={g.id} value={g.id}>{g.code ? g.code + " — " : ""}{g.name}</option>)}
        </select>
        <select value={subgroupId} onChange={e => selectSubgroup(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm" disabled={subgroups.length === 0}>
          <option value="">Subgrupo — todos</option>
          {filteredSubgroups.map(s => <option key={s.id} value={s.id}>{s.code ? s.code + " — " : ""}{s.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>Período</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 rounded-md border border-input px-2 text-sm" />
          <span>a</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 rounded-md border border-input px-2 text-sm" />
        </div>
        <button
          onClick={() => printElements(scopedProducts.map(p => `erp-kardex-print-${p.id}`))}
          disabled={loading || scopedProducts.length === 0}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border p-6 text-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...
        </div>
      )}

      {!loading && scopedProducts.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Selecione um produto para ver a movimentação individual, ou selecione um <b>grupo</b> ou <b>subgrupo</b> de estoque para gerar o kardex de todos os produtos do grupo — entradas de NF, vendas, produção, requisições, WMS e ajustes de inventário, ordenadas por data e documento.
        </div>
      )}

      <div className="space-y-3">
        {scopedProducts.map(p => (
          <KardexBlock key={p.id} data={data} product={p} from={from} to={to} />
        ))}
      </div>
    </div>
  );
}