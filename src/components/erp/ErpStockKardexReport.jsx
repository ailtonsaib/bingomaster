import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Printer, Loader2, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";
import { printElements } from "@/lib/printUtils";
import ErpCombobox from "@/components/erp/ErpCombobox";

// Kardex de estoque: toda a movimentação de um produto — entradas de NF, vendas
// faturadas, produção (consumo e acabado), requisições ao almoxarifado,
// movimentações WMS e ajustes de inventário — ordenada por data e documento,
// com quantidade de entrada/saída e saldo acumulado.
export default function ErpStockKardexReport({ user }) {
  const [data, setData] = useState(null);
  const [productId, setProductId] = useState("");
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
    ]).then(d => setData({
      products: d[0], entries: d[1], sales: d[2], productions: d[3],
      moves: d[4], inventories: d[5], requisitions: d[6],
    })).then(() => setLoading(false));
  }, [user.email]);

  const product = data?.products.find(p => p.id === productId) || null;
  const productOptions = (data?.products || []).filter(p => p.controla_estoque !== false)
    .map(p => ({ id: p.id, label: `${p.code ? `${p.code} — ` : ""}${p.name}` }));

  // Todas as movimentações do produto, ordenadas por data e documento, com saldo acumulado
  const rows = useMemo(() => {
    if (!data || !product) return [];
    const rows = [];
    // Entradas de NF (lançadas — o estoque foi atualizado no lançamento).
    // Reconhece o produto pelo vínculo (ID), código, código de barras ou descrição
    // — mesmo critério usado na baixa de estoque do lançamento.
    const sameProd = (it) => it.product_id === product.id
      || (it.product_code && it.product_code === product.code)
      || (it.barcode && it.barcode === product.barcode)
      || (it.product_name || "").trim().toLowerCase() === (product.name || "").trim().toLowerCase();
    data.entries.filter(e => e.status === "lancada" && e.entry_kind !== "despesa").forEach(e => {
      (e.items || []).filter(sameProd).forEach(it => {
        rows.push({ date: e.entry_date || e.issue_date || e.created_date, doc: `NF ${e.nota_number}`, hist: `Entrada de nota — ${e.supplier_name || ""}`, in: Number(it.quantity) || 0, out: 0 });
      });
    });
    // Vendas faturadas (o estoque é baixado no faturamento)
    data.sales.filter(o => o.status === "faturado").forEach(o => {
      (o.items || []).filter(it => it.product_id === product.id).forEach(it => {
        rows.push({ date: o.emission_date || o.created_date, doc: `PV ${o.number}`, hist: `Venda — ${o.customer_name || ""}`, in: 0, out: Number(it.quantity) || 0 });
      });
    });
    // Ordens de produção concluídas: consumo de insumos + produto acabado.
    // Quando a requisição ao almoxarifado foi atendida, os insumos já saíram do
    // estoque na baixa da requisição (linha "Requisição ..." das movimentações
    // WMS) — o consumo não é repetido aqui.
    data.productions.filter(o => o.status === "concluida").forEach(o => {
      const d = o.completion_date || o.created_date;
      const reqAtendida = (data.requisitions || []).some(r => r.id === o.requisition_id && r.status === "atendida");
      if (!reqAtendida) (o.bom_items || []).filter(b => b.product_id === product.id && (Number(b.total_consumed) || 0) > 0).forEach(b => {
        rows.push({ date: d, doc: `OP ${o.order_number}`, hist: "Consumo de insumos — ordem de produção", in: 0, out: Number(b.total_consumed) || 0 });
      });
      if (o.output_product_id === product.id && (Number(o.produced_quantity) || 0) > 0) {
        rows.push({ date: d, doc: `OP ${o.order_number}`, hist: "Produção concluída — produto acabado", in: Number(o.produced_quantity) || 0, out: 0 });
      }
    });
    // Requisições atendidas ao almoxarifado movimentam o estoque (saída por
    // requisição). Ajustes de inventário têm linha própria (INV) — a movimentação
    // WMS espelho é ignorada para não duplicar. Transferência não altera o saldo.
    data.moves.filter(m =>
      m.product_id === product.id &&
      m.move_type !== "transferencia" &&
      !(m.notes || "").startsWith("Ajuste de inventário")
    ).forEach(m => {
      rows.push({
        date: m.move_date || m.created_date, doc: m.document || "WMS",
        hist: `${m.move_type === "entrada" ? "Entrada" : "Saída"} WMS${m.warehouse_name ? ` — ${m.warehouse_name}` : ""}${m.notes ? ` (${m.notes})` : ""}`,
        in: m.move_type === "entrada" ? Number(m.quantity) || 0 : 0,
        out: m.move_type === "saida" ? Number(m.quantity) || 0 : 0,
      });
    });
    // Ajustes de inventário (contagem: diferença entre contado e sistema)
    data.inventories.filter(i => i.product_id === product.id && i.status === "ajustado").forEach(i => {
      const diff = (Number(i.counted_qty) || 0) - (Number(i.system_qty) || 0);
      if (!diff) return;
      rows.push({ date: i.count_date || i.created_date, doc: `INV ${i.warehouse_name || ""}`.trim(), hist: `Ajuste de inventário — contado ${i.counted_qty} / sistema ${i.system_qty}`, in: diff > 0 ? diff : 0, out: diff < 0 ? -diff : 0 });
    });
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.doc).localeCompare(String(b.doc)));
    let saldo = 0;
    return rows.map(r => { saldo += r.in - r.out; return { ...r, saldo }; });
  }, [data, productId]);

  // Período: saldo anterior acumulado antes da data inicial + linhas do período
  const view = useMemo(() => {
    if (!from && !to) return { prev: null, list: rows };
    const day = (d) => String(d || "").slice(0, 10);
    const before = rows.filter(r => from && day(r.date) < from);
    const list = rows.filter(r => (!from || day(r.date) >= from) && (!to || day(r.date) <= to));
    return { prev: from && before.length ? { saldo: before[before.length - 1].saldo, in: 0, out: 0 } : null, list };
  }, [rows, from, to]);

  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const totalIn = view.list.reduce((s, r) => s + r.in, 0);
  const totalOut = view.list.reduce((s, r) => s + r.out, 0);
  const finalSaldo = rows.length ? rows[rows.length - 1].saldo : 0;
  const stockMismatch = product && rows.length && r2(finalSaldo) !== r2(product.stock);
  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <ErpCombobox value={productId} onValueChange={setProductId} options={productOptions} placeholder="Selecione o produto..." />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>Período</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 rounded-md border border-input px-2 text-sm" />
          <span>a</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 rounded-md border border-input px-2 text-sm" />
        </div>
        <button onClick={() => printElements(["erp-kardex-print"])} disabled={!product} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"><Printer className="w-4 h-4" /> Imprimir</button>
      </div>

      {!product && !loading && (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Selecione um produto para ver toda a movimentação de estoque (kardex) — entradas de NF, vendas, produção, requisições, WMS e ajustes de inventário, ordenadas por data e documento.
        </div>
      )}

      {product && (
        <div id="erp-kardex-print" className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-semibold">Kardex — Movimentação de Estoque</h3>
                <p className="text-[11px] text-gray-500">{product.code ? `${product.code} — ` : ""}{product.name} ({product.unit || "UN"}) • Emitido em {today}</p>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="text-gray-500">Estoque atual cadastrado: <b>{r2(product.stock)} {product.unit || "UN"}</b></p>
              <p className="text-gray-500">Saldo calculado (kardex): <b>{r2(finalSaldo)}</b></p>
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
                  <th className="p-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...</td></tr>
                ) : view.prev ? (
                  <tr className="bg-gray-50 border-t">
                    <td className="p-2" colSpan={3}>{from ? `Saldo anterior a ${fmtDate(from)}` : ""}</td>
                    <td className="p-2 text-right">—</td>
                    <td className="p-2 text-right">—</td>
                    <td className="p-2 text-right font-semibold">{r2(view.prev.saldo)}</td>
                  </tr>
                ) : null}
                {view.list.length === 0 && !loading && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">
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
                    <td className="p-2 text-right text-xs font-semibold">{r2(view.list.length ? view.list[view.list.length - 1].saldo : view.prev.saldo)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}