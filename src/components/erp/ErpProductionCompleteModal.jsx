import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";
import { createWarehouseRequisition } from "@/lib/erpProductionStock";
import { buildKardexRows, kardexAverageCost } from "@/lib/erpKardex";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const todayISO = () => new Date().toISOString().slice(0, 10);

// Quebra x devolvida dos insumos excedentes: o usuário informa uma das duas
// quantidades e a outra recebe automaticamente o saldo restante
// (requisitado − consumo teórico). A parte devolvida pode voltar ao estoque
// ou permanecer em processo (WIP).

// Conclusão da ordem de produção: quantidade real produzida, consumo teórico x
// requisitado, requisição complementar (produziu mais), destino dos insumos
// excedentes (produziu menos) e valorização do produzido pelo custo dos insumos.
export default function ErpProductionCompleteModal({ user, order, products, onClose, onSaved }) {
  const [produced, setProduced] = useState(String(order.output_quantity || 0));
  const [req, setReq] = useState(undefined); // undefined = carregando | null = sem requisição
  const [kardexData, setKardexData] = useState(null);
  const [excessInputs, setExcessInputs] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order.requisition_id) setReq(null);
    else base44.entities.ErpWarehouseRequisition.get(order.requisition_id).then(setReq).catch(() => setReq(null));
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

  const reqAtendida = req?.status === "atendida";
  const plannedQty = Number(order.output_quantity) || 0;
  const producedQty = Math.max(0, Number(produced) || 0);
  const outUnit = products.find(p => p.id === order.output_product_id)?.unit || "";
  // Quantidade bipada no WMS (Bipagem de Produção) que já entrou no estoque
  const bipedQty = useMemo(() => {
    if (!kardexData) return 0;
    const doc = `OP ${order.order_number}`;
    return r3((kardexData.moves || [])
      .filter(m => m.move_type === "entrada" && m.document === doc && m.product_id === order.output_product_id)
      .reduce((s, m) => s + (Number(m.quantity) || 0), 0));
  }, [kardexData, order.id, order.order_number, order.output_product_id]);
  // Divergência entre estoque bipado e apontamento de produção impede o encerramento
  const bipedDivergence = bipedQty > 0 && Math.abs(bipedQty - producedQty) > 0.001;

  // Por insumo: consumo teórico p/ qtd real, requisitado, excedente/complemento e custo médio
  const lines = useMemo(() => (order.bom_items || []).filter(b => b.product_id).map(b => {
    const inputProduct = products.find(p => p.id === b.product_id);
    const avgCost = kardexData && inputProduct
      ? kardexAverageCost(buildKardexRows(kardexData, inputProduct), inputProduct)
      : (Number(inputProduct?.cost_price) || 0);
    const perUnit = Number(b.quantity_per_unit) || 0;
    const theoretical = r3(perUnit * producedQty);
    const reqItem = (req?.items || []).find(it => it.product_id === b.product_id);
    const requisitioned = reqAtendida ? (Number(reqItem?.quantity) || 0) : 0;
    const excess = reqAtendida ? Math.max(0, r3(requisitioned - theoretical)) : 0;
    // Quebra x devolvida: a quantidade informada completa a outra com o saldo restante
    const st = excessInputs[b.product_id] || {};
    const qTyped = st.quebra !== undefined && st.quebra !== null ? Number(st.quebra) || 0 : null;
    const dTyped = st.devolvida !== undefined && st.devolvida !== null ? Number(st.devolvida) || 0 : null;
    let excQuebra = 0, excDevolvida = excess;
    if (qTyped !== null) { excQuebra = Math.min(qTyped, excess); excDevolvida = r3(excess - excQuebra); }
    else if (dTyped !== null) { excDevolvida = Math.min(dTyped, excess); excQuebra = r3(excess - excDevolvida); }
    return {
      ...b, avgCost, perUnit, theoretical, requisitioned, excess,
      excQuebra, excDevolvida, excMode: st.mode || "devolver",
      complement: reqAtendida ? Math.max(0, r3(theoretical - requisitioned)) : 0,
      theoreticalValue: r2(theoretical * avgCost),
      complementValue: r2(Math.max(0, theoretical - requisitioned) * avgCost),
    };
  }), [order, products, kardexData, req, reqAtendida, producedQty, excessInputs]);

  const hasExcess = lines.some(l => l.excess > 0);
  const hasComplement = lines.some(l => l.complement > 0);
  const consumedValue = r2(lines.reduce((s, l) => s + l.theoreticalValue, 0));
  const lossValue = r2(lines.reduce((s, l) => s + l.excQuebra * l.avgCost, 0));
  const wipValue = r2(lines.reduce((s, l) => s + (l.excMode === "processo" ? l.excDevolvida * l.avgCost : 0), 0));
  const returnValue = r2(lines.reduce((s, l) => s + (l.excMode === "devolver" ? l.excDevolvida * l.avgCost : 0), 0));
  // Custo extra das paradas do apontamento (mecânicas/elétricas/operacionais)
  const stopsCost = r2(Number(order.extra_cost_total) || 0);
  const totalCost = r2(consumedValue + lossValue + stopsCost);
  const unitCost = producedQty > 0 ? r2(totalCost / producedQty) : 0;
  const loading = req === undefined || !kardexData;

  const confirm = async () => {
    if (producedQty <= 0) return alert("Informe a quantidade real produzida.");
    if (bipedDivergence) {
      alert(`DIVERGÊNCIA entre estoque e apontamento de produção:\n\nBipado no WMS: ${bipedQty} ${outUnit}\nApontamento: ${producedQty} ${outUnit}\n\nAjuste a quantidade produzida ou realize a bipagem da produção no WMS (Bipagem Produção) antes de encerrar a ordem de produção.`);
      return;
    }
    setSaving(true);
    try {
      // Sem requisição atendida: consome o consumo teórico direto do estoque
      if (!reqAtendida) {
        for (const l of lines) {
          const p = await base44.entities.ErpProduct.get(l.product_id);
          if ((Number(p.stock) || 0) < l.theoretical) {
            alert(`Estoque insuficiente de "${p.name}". Disponível: ${p.stock} ${p.unit || ""} | Necessário: ${l.theoretical} ${p.unit || ""}`);
            setSaving(false);
            return;
          }
        }
        for (const l of lines) {
          const p = await base44.entities.ErpProduct.get(l.product_id);
          await base44.entities.ErpProduct.update(l.product_id, { stock: r3((Number(p.stock) || 0) - l.theoretical) });
        }
      }
      let compReq = null;
      if (reqAtendida) {
        // Produziu mais que o planejado: requisição complementar dos insumos adicionais
        if (hasComplement) {
          compReq = await createWarehouseRequisition(user, {
            production_order_id: order.id,
            production_order_number: order.order_number,
            items: lines.filter(l => l.complement > 0).map(l => ({
              product_id: l.product_id, product_name: l.product_name, product_code: l.product_code, unit: l.unit, quantity: l.complement,
            })),
          });
        }
        // Parte devolvida marcada para voltar ao estoque (saldo não consumido que não foi quebra nem WIP)
        for (const l of lines) {
          if (l.excess <= 0 || l.excMode !== "devolver" || l.excDevolvida <= 0) continue;
          const p = await base44.entities.ErpProduct.get(l.product_id);
          await base44.entities.ErpProduct.update(l.product_id, { stock: r3((Number(p.stock) || 0) + l.excDevolvida) });
          await base44.entities.ErpWmsMove.create({
            user_email: user.email,
            move_type: "entrada",
            product_id: l.product_id,
            product_code: l.product_code || "",
            product_name: l.product_name || "",
            unit: l.unit || "",
            quantity: l.excDevolvida,
            document: `OP ${order.order_number}`,
            move_date: todayISO(),
            notes: "Devolução de insumos ao estoque — produção menor que a programada",
          });
        }
      }
      // Quebra informada = perda (entra no custo); devolvida marcada como processo = WIP (fora do custo)
      const lossItems = lines.filter(l => l.excess > 0 && l.excQuebra > 0).map(l => ({ product_id: l.product_id, product_name: l.product_name, product_code: l.product_code, unit: l.unit, quantity: l.excQuebra, value: r2(l.excQuebra * l.avgCost) }));
      const wipItems = lines.filter(l => l.excess > 0 && l.excMode === "processo" && l.excDevolvida > 0).map(l => ({ product_id: l.product_id, product_name: l.product_name, product_code: l.product_code, unit: l.unit, quantity: l.excDevolvida, value: r2(l.excDevolvida * l.avgCost) }));
      // Produto acabado: entra no estoque valorizado pelo custo dos insumos consumidos
      const outProd = await base44.entities.ErpProduct.get(order.output_product_id);
      // Estoque já alimentado pela bipagem no WMS — não duplica a entrada do produto acabado
      const stockUpdate = bipedQty > 0 ? {} : { stock: r3((Number(outProd.stock) || 0) + producedQty) };
      await base44.entities.ErpProduct.update(order.output_product_id, {
        ...stockUpdate,
        ...(unitCost > 0 ? { cost_price: Math.round(unitCost * 10000) / 10000 } : {}),
      });
      await base44.entities.ErpProductionOrder.update(order.id, {
        status: "concluida",
        produced_quantity: producedQty,
        completion_date: new Date().toISOString(),
        bom_items: (order.bom_items || []).map(b => ({ ...b, total_consumed: r3((Number(b.quantity_per_unit) || 0) * producedQty) })),
        input_cost_total: totalCost,
        output_unit_cost: unitCost,
        loss_items: lossItems,
        wip_items: wipItems,
        ...(compReq ? { complementary_requisition_id: compReq.id, complementary_requisition_number: compReq.number } : {}),
      });
      const parts = [`Produção concluída: ${producedQty} un. de "${order.output_product_name}".\nCusto dos insumos consumidos: ${fmtMoney(totalCost)} — custo unitário produzido: ${fmtMoney(unitCost)}.`];
      if (compReq) parts.push(`Requisição complementar ${compReq.number} gerada — o estoque dos insumos adicionais será baixado quando o almoxarifado atendê-la.`);
      if (lossItems.length) parts.push(`Quebra/perda de insumos: ${lossItems.map(i => `${i.quantity} ${i.unit || ""} de ${i.product_name}`).join(", ")} — ${fmtMoney(lossValue)} incluídos no custo de produção.`);
      if (wipItems.length) parts.push(`Insumos deixados em processo (WIP): ${fmtMoney(wipValue)} — fora do custo de produção.`);
      if (returnValue > 0 && reqAtendida) parts.push(`Insumos devolvidos ao estoque: ${fmtMoney(returnValue)}.`);
      if (stopsCost > 0) parts.push(`Custo extra das paradas de produção (apontamento) agregado ao custo: ${fmtMoney(stopsCost)}.`);
      if (bipedQty > 0) parts.push(`O estoque do produto acabado já foi alimentado pela bipagem no WMS (${bipedQty} ${outUnit}) — o saldo não é duplicado aqui.`);
      alert(parts.join("\n\n"));
      onSaved();
    } catch (e) { alert("Erro ao concluir produção: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Concluir Produção — {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando custos dos insumos...</div>
        ) : (
          <>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">Produto: </span><b>{order.output_product_name}</b></div>
                <div><span className="text-gray-500">Qtd planejada: </span><b>{order.output_quantity}</b></div>
                <div className="col-span-2"><span className="text-gray-500">Requisição ao almoxarifado: </span><b>{req ? `${req.number} — ${req.status}` : "—"}</b></div>
                <div className="col-span-2"><span className="text-gray-500">Bipado no WMS (entrada por etiquetas de produção): </span><b>{bipedQty > 0 ? `${bipedQty} ${outUnit}` : "—"}</b></div>
              </div>
              {bipedDivergence && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  DIVERGÊNCIA entre estoque bipado no WMS ({bipedQty} {outUnit}) e o apontamento de produção ({producedQty} {outUnit}) — a ordem de produção não pode ser encerrada até as quantidades coincidirem.
                </div>
              )}
              <div>
                <Label className="text-xs font-medium text-gray-600">Quantidade Real Produzida *</Label>
                <Input type="number" step="0.001" min="0" value={produced} onChange={e => setProduced(e.target.value)} className="mt-1" />
                {producedQty !== plannedQty && (
                  <p className={`text-xs mt-1 ${producedQty > plannedQty ? "text-blue-700" : "text-amber-700"}`}>
                    {producedQty > plannedQty
                      ? "Produziu mais que o planejado: será gerada uma requisição complementar ao almoxarifado com os insumos adicionais."
                      : "Produziu menos que o planejado: confira abaixo o consumo teórico x a quantidade requisitada ao almoxarifado."}
                  </p>
                )}
              </div>
              {lines.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 text-gray-500">
                      <tr>
                        <th className="p-2 text-left">Insumo</th>
                        <th className="p-2 text-right">Por unid.</th>
                        <th className="p-2 text-right">Consumo teórico</th>
                        {reqAtendida && <th className="p-2 text-right">Requisitado</th>}
                        {reqAtendida && <th className="p-2 text-right">Diferença</th>}
                        <th className="p-2 text-right">Custo médio</th>
                        <th className="p-2 text-right">Valor consumido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{l.product_name}</td>
                          <td className="p-2 text-right">{l.perUnit} {l.unit || ""}</td>
                          <td className="p-2 text-right font-medium">{l.theoretical}</td>
                          {reqAtendida && <td className="p-2 text-right text-gray-600">{l.requisitioned}</td>}
                          {reqAtendida && (
                            <td className={`p-2 text-right font-medium ${l.complement > 0 ? "text-blue-700" : l.excess > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                              {l.complement > 0 ? `+${l.complement} (complemento)` : l.excess > 0 ? `${l.excess} (excedente)` : "—"}
                            </td>
                          )}
                          <td className="p-2 text-right text-gray-600">{fmtMoney(l.avgCost)}</td>
                          <td className="p-2 text-right">{fmtMoney(l.theoreticalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {hasComplement && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                  A quantidade real excede o planejado: a requisição complementar ({fmtMoney(r2(lines.reduce((s, l) => s + l.complementValue, 0)))} em insumos adicionais) será gerada com status pendente — o estoque será baixado quando o almoxarifado atendê-la.
                </div>
              )}
              {hasExcess && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-800">
                    Insumos excedentes (requisitado − consumo teórico): informe a quebra/perda <b>ou</b> a quantidade devolvida — o sistema completa a outra com o saldo restante.
                  </p>
                  <div className="border border-amber-200 rounded-md overflow-hidden bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100 text-amber-800">
                        <tr>
                          <th className="p-2 text-left">Insumo</th>
                          <th className="p-2 text-right">Saldo</th>
                          <th className="p-2 text-right">Quebra (perda)</th>
                          <th className="p-2 text-right">Devolvida</th>
                          <th className="p-2 text-left">Destino da devolvida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.filter(l => l.excess > 0).map(l => (
                          <tr key={l.product_id} className="border-t">
                            <td className="p-2">{l.product_name}</td>
                            <td className="p-2 text-right font-medium text-amber-700">{l.excess} {l.unit || ""}</td>
                            <td className="p-2 text-right">
                              <input type="number" step="0.001" min="0" value={l.excQuebra}
                                onChange={e => setExcessInputs(prev => ({ ...prev, [l.product_id]: { ...(prev[l.product_id] || {}), quebra: e.target.value, devolvida: null } }))}
                                className="w-20 h-7 rounded border border-input px-1 text-right" />
                            </td>
                            <td className="p-2 text-right">
                              <input type="number" step="0.001" min="0" value={l.excDevolvida}
                                onChange={e => setExcessInputs(prev => ({ ...prev, [l.product_id]: { ...(prev[l.product_id] || {}), devolvida: e.target.value, quebra: null } }))}
                                className="w-20 h-7 rounded border border-input px-1 text-right" />
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <label className="inline-flex items-center gap-1 mr-2 cursor-pointer">
                                <input type="radio" name={`exc-mode-${l.product_id}`} checked={l.excMode === "devolver"}
                                  onChange={() => setExcessInputs(prev => ({ ...prev, [l.product_id]: { ...(prev[l.product_id] || {}), mode: "devolver" } }))} />
                                Devolver ao estoque
                              </label>
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`exc-mode-${l.product_id}`} checked={l.excMode === "processo"}
                                  onChange={() => setExcessInputs(prev => ({ ...prev, [l.product_id]: { ...(prev[l.product_id] || {}), mode: "processo" } }))} />
                                Em processo (WIP)
                              </label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
                <div className="flex justify-between text-xs"><span>Custo dos insumos consumidos (produção real)</span><b>{fmtMoney(consumedValue)}</b></div>
                {lossValue > 0 && <div className="flex justify-between text-xs text-red-600"><span>Quebra/perda de insumos (incluída no custo)</span><b>{fmtMoney(lossValue)}</b></div>}
                {wipValue > 0 && <div className="flex justify-between text-xs text-amber-600"><span>Insumos em processo — WIP (fora do custo)</span><b>{fmtMoney(wipValue)}</b></div>}
                {returnValue > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>Insumos devolvidos ao estoque (fora do custo)</span><b>{fmtMoney(returnValue)}</b></div>}
                {stopsCost > 0 && <div className="flex justify-between text-xs text-red-600"><span>Custo extra de paradas de produção (apontamento)</span><b>{fmtMoney(stopsCost)}</b></div>}
                <div className="flex justify-between text-xs border-t pt-1"><span>Custo total de produção</span><b>{fmtMoney(totalCost)}</b></div>
                <div className="flex justify-between text-sm"><span>Custo unitário do produto produzido</span><b className="text-indigo-700">{fmtMoney(unitCost)}</b></div>
                <p className="text-[11px] text-gray-500 pt-1 border-t">O produto acabado entra no estoque valorizado por esse custo — o kardex calcula a média móvel e o custo do produto é atualizado.</p>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={saving || bipedDivergence} onClick={confirm} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Concluindo..." : "Concluir Produção"}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}