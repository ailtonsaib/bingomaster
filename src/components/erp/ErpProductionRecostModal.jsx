import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";
import { buildKardexRows, kardexAverageCost } from "@/lib/erpKardex";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Recálculo do custo de uma OP concluída com custo zerado ou desatualizado:
// revaloriza os insumos consumidos (e as perdas registradas) pelo custo médio
// atual do kardex e atualiza o custo total e o custo unitário produzido.
export default function ErpProductionRecostModal({ user, order, products, onClose, onSaved }) {
  const [kardexData, setKardexData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWmsInventory.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
      base44.entities.ErpWarehouseRequisition.filter({ user_email: user.email }, "-created_date", 500).catch(() => []),
    ]).then(([entries, sales, productions, moves, inventories, requisitions]) =>
      setKardexData({ entries, sales, productions, moves, inventories, requisitions }));
  }, [order.id, user.email]);

  const producedQty = Number(order.produced_quantity) || Number(order.output_quantity) || 0;
  const avgOf = (productId) => {
    const p = products.find(x => x.id === productId);
    return p && kardexData ? kardexAverageCost(buildKardexRows(kardexData, p), p) : 0;
  };

  const lines = useMemo(() => kardexData ? (order.bom_items || []).filter(b => b.product_id).map(b => {
    const qty = Number(b.total_consumed) || r3((Number(b.quantity_per_unit) || 0) * producedQty);
    const avg = avgOf(b.product_id);
    return { ...b, qty, avg, value: r2(qty * avg) };
  }) : [], [kardexData, order, products, producedQty]);

  const lossLines = useMemo(() => kardexData ? (order.loss_items || []).map(l => {
    const avg = avgOf(l.product_id);
    return { ...l, avg, value: r2((Number(l.quantity) || 0) * avg) };
  }) : [], [kardexData, order, products]);

  const lossValue = lossLines.reduce((s, l) => s + l.value, 0);
  const newCost = r2(lines.reduce((s, l) => s + l.value, 0) + lossValue);
  const newUnit = producedQty > 0 ? r2(newCost / producedQty) : 0;
  const oldCost = r2(Number(order.input_cost_total) || 0);
  const oldUnit = r2(Number(order.output_unit_cost) || 0);
  const changed = r2(newCost) !== oldCost;

  const handleRecalc = async () => {
    if (newCost <= 0) { alert("Não foi possível calcular o custo — os insumos não possuem custo médio no kardex."); return; }
    if (!window.confirm(`Recalcular o custo da produção ${order.order_number}?\n\nCusto atual: ${fmtMoney(oldCost)} (unitário ${fmtMoney(oldUnit)})\nNovo custo: ${fmtMoney(newCost)} (unitário ${fmtMoney(newUnit)})`)) return;
    setSaving(true);
    try {
      await base44.entities.ErpProductionOrder.update(order.id, {
        input_cost_total: newCost,
        output_unit_cost: newUnit,
        loss_items: lossLines,
      });
      if (newUnit > 0) {
        await base44.entities.ErpProduct.update(order.output_product_id, { cost_price: Math.round(newUnit * 10000) / 10000 });
      }
      alert(`Custo recalculado.\nCusto dos insumos consumidos: ${fmtMoney(newCost)}\nCusto unitário produzido: ${fmtMoney(newUnit)}`);
      onSaved();
    } catch (e) { alert("Erro ao recalcular o custo: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2"><Calculator className="w-5 h-5 text-amber-600" /> Recalcular Custo — {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        {!kardexData ? (
          <div className="p-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando custos dos insumos...</div>
        ) : (
          <>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Produto: </span><b>{order.output_product_name}</b></div>
                <div><span className="text-gray-500">Qtd produzida: </span><b>{producedQty}</b></div>
                <div><span className="text-gray-500">Custo atual: </span><b>{fmtMoney(oldCost)}</b></div>
                <div><span className="text-gray-500">Custo unitário atual: </span><b>{fmtMoney(oldUnit)}</b></div>
              </div>
              <p className="text-xs text-gray-500">
                OPs concluídas antes da valoração por custo médio podem ter ficado com custo zerado. O recálculo revaloriza os insumos consumidos pelo custo médio atual do kardex.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-gray-500">
                    <tr>
                      <th className="p-2 text-left">Insumo</th>
                      <th className="p-2 text-right">Consumo</th>
                      <th className="p-2 text-right">Custo médio</th>
                      <th className="p-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{l.product_name}</td>
                        <td className="p-2 text-right">{l.qty} {l.unit || ""}</td>
                        <td className="p-2 text-right text-gray-600">{fmtMoney(l.avg)}</td>
                        <td className="p-2 text-right font-medium">{fmtMoney(l.value)}</td>
                      </tr>
                    ))}
                    {lossLines.length > 0 && (
                      <tr className="border-t bg-red-50">
                        <td className="p-2 text-red-700 font-medium" colSpan={3}>Perdas de insumos (incluídas no custo)</td>
                        <td className="p-2 text-right text-red-700 font-medium">{fmtMoney(lossValue)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
                <div className="flex justify-between text-xs"><span>Custo dos insumos consumidos</span><b>{fmtMoney(lines.reduce((s, l) => s + l.value, 0))}</b></div>
                {lossValue > 0 && <div className="flex justify-between text-xs text-red-600"><span>Perdas</span><b>{fmtMoney(lossValue)}</b></div>}
                <div className="flex justify-between text-xs border-t pt-1"><span>Novo custo total de produção</span><b>{fmtMoney(newCost)}</b></div>
                <div className="flex justify-between text-sm"><span>Novo custo unitário produzido</span><b className="text-indigo-700">{fmtMoney(newUnit)}</b></div>
                {!changed && <p className="text-[11px] text-emerald-700 pt-1 border-t">O custo já está correto — nada a ajustar.</p>}
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={saving || !changed || newCost <= 0} onClick={handleRecalc} className="bg-amber-600 hover:bg-amber-700">{saving ? "Recalculando..." : "Recalcular Custo"}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}