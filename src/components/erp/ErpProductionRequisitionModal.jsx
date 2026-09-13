import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { computeNeeded, checkStock, shortagesMessage, createWarehouseRequisition } from "@/lib/erpProductionStock";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Solicitação ao almoxarifado: o necessário do BOM é abatido pelos insumos em
// processo (WIP) deixados na mesma linha de produção por OPs concluídas — o
// almoxarifado atende apenas a diferença. É possível informar insumos
// adicionais à solicitação (podendo ou não).
export default function ErpProductionRequisitionModal({ user, order, products, orders, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [extras, setExtras] = useState([]);

  // Insumos em processo (WIP) de OPs concluídas da mesma linha de produção
  const wipOrders = useMemo(() => (orders || []).filter(x =>
    x.id !== order.id && x.status === "concluida" &&
    x.production_line_id && x.production_line_id === order.production_line_id &&
    (x.wip_items || []).length > 0
  ), [orders, order.id, order.production_line_id]);

  const rows = useMemo(() => computeNeeded(order.bom_items, order.output_quantity).map(n => {
    const wip = r3((wipOrders || []).reduce((s, o) =>
      s + (Number((o.wip_items || []).find(w => w.product_id === n.product_id)?.quantity) || 0), 0));
    const wipUsed = Math.min(wip, n.quantity);
    return { ...n, wip, wipUsed, request: Math.max(0, r3(n.quantity - wipUsed)) };
  }), [order, wipOrders]);

  const extraItems = extras
    .filter(e => e.product_id && (Number(e.quantity) || 0) > 0)
    .map(e => {
      const p = products.find(p => p.id === e.product_id);
      return { product_id: e.product_id, product_name: p?.name || "", product_code: p?.code || "", unit: p?.unit || "UN", quantity: r3(Number(e.quantity)), stock: Number(p?.stock) || 0 };
    });

  const shortages = checkStock(products, [
    ...rows.filter(r => r.request > 0).map(r => ({ ...r, quantity: r.request })),
    ...extraItems,
  ]);

  const confirm = async () => {
    setSaving(true);
    try {
      const items = [
        ...rows.filter(r => r.request > 0).map(r => {
          const p = products.find(p => p.id === r.product_id);
          return { ...r, stock: Number(p?.stock) || 0 };
        }),
        ...extraItems,
      ];

      // Abate o WIP aproveitado das OPs de origem (FIFO pela data de conclusão)
      const remainingByProduct = new Map(rows.filter(r => r.wipUsed > 0).map(r => [r.product_id, r.wipUsed]));
      if (remainingByProduct.size) {
        const srcs = [...wipOrders].sort((a, b) => String(a.completion_date || "").localeCompare(String(b.completion_date || "")));
        for (const src of srcs) {
          let wip = (src.wip_items || []).map(w => ({ ...w }));
          let changed = false;
          for (const pid of remainingByProduct.keys()) {
            let need = remainingByProduct.get(pid);
            if (need <= 0) continue;
            wip = wip.map(w => {
              if (need <= 0 || w.product_id !== pid) return w;
              const take = Math.min(need, r3(w.quantity));
              if (take <= 0) return w;
              need = r3(need - take);
              changed = true;
              return { ...w, quantity: r3(r3(w.quantity) - take) };
            });
            remainingByProduct.set(pid, need);
          }
          if (changed) await base44.entities.ErpProductionOrder.update(src.id, { wip_items: wip.filter(w => r3(w.quantity) > 0) });
        }
      }

      // OP de subproduto: referencia a OP de produto acabado de origem
      const parent = order.parent_order_number ? orders.find(x => x.order_number === order.parent_order_number) : null;
      let req = null;
      if (items.length) {
        req = await createWarehouseRequisition(user, {
          production_order_id: order.id,
          production_order_number: order.order_number,
          finished_order_number: parent ? parent.order_number : undefined,
          finished_product_name: parent ? parent.output_product_name : undefined,
          items,
        });
      }
      await base44.entities.ErpProductionOrder.update(order.id, {
        ...(req ? { requisition_id: req.id, requisition_number: req.number } : {}),
        status: order.status === "standby" ? "rascunho" : order.status,
      });

      const parts = [];
      if (req) parts.push(`Solicitação ao almoxarifado gerada: ${req.number}.`);
      else parts.push("Nada a solicitar — o necessário já está coberto pelos insumos em processo (WIP) da linha.");
      const wipDetail = rows.filter(r => r.wipUsed > 0).map(r => `${r.wipUsed} ${r.unit || ""} de ${r.product_name}`);
      if (wipDetail.length) parts.push(`Insumos em processo (WIP) aproveitados da linha: ${wipDetail.join(", ")}.`);
      if (extraItems.length) parts.push(`Insumos adicionais incluídos: ${extraItems.map(e => `${e.quantity} ${e.unit || ""} de ${e.product_name}`).join(", ")}.`);
      alert(parts.join("\n"));
      onSaved();
    } catch (e) { alert("Erro ao gerar solicitação: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Solicitação ao Almoxarifado — {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="text-xs text-gray-500">
            Linha de produção: <b>{order.production_line_name || "—"}</b> — os insumos em processo (WIP) deixados por OPs concluídas desta linha são abatidos automaticamente; o almoxarifado atende apenas a diferença.
          </p>
          {rows.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-500">
                  <tr>
                    <th className="p-2 text-left">Insumo</th>
                    <th className="p-2 text-right">Necessário</th>
                    <th className="p-2 text-right">WIP na linha</th>
                    <th className="p-2 text-right">A solicitar</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.product_id} className="border-t">
                      <td className="p-2">{r.product_name}</td>
                      <td className="p-2 text-right">{r.quantity} {r.unit || ""}</td>
                      <td className="p-2 text-right text-amber-600">{r.wipUsed > 0 ? r.wipUsed : "—"}</td>
                      <td className="p-2 text-right font-medium">
                        {r.request > 0 ? `${r.request} ${r.unit || ""}` : <span className="text-emerald-600 font-normal">coberto pelo WIP</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Esta OP não possui insumos no BOM — você ainda pode incluir insumos adicionais abaixo.</p>
          )}

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold">Insumos adicionais (opcional)</p>
            {extras.map((ex, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={ex.product_id} onChange={e => setExtras(prev => prev.map((x, xi) => xi === i ? { ...x, product_id: e.target.value } : x))} className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                  <option value="">Selecione o insumo...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
                </select>
                <input type="number" step="0.001" min="0" placeholder="Qtd" value={ex.quantity}
                  onChange={e => setExtras(prev => prev.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))}
                  className="w-24 h-8 rounded-md border border-input px-2 text-xs" />
                <button onClick={() => setExtras(prev => prev.filter((_, xi) => xi !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
              </div>
            ))}
            <button onClick={() => setExtras(prev => [...prev, { product_id: "", quantity: "" }])} className="text-xs text-indigo-600 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Incluir insumo</button>
          </div>

          {shortages.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 whitespace-pre-line">
              {"Atenção — insumos com estoque insuficiente para a solicitação:\n" + shortagesMessage(shortages) + "\nA solicitação será gerada mesmo assim."}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={confirm} className="bg-amber-600 hover:bg-amber-700">{saving ? "Gerando..." : "Gerar Solicitação"}</Button>
        </div>
      </div>
    </div>
  );
}