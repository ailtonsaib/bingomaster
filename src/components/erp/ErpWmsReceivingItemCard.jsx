import { Plus, Trash2, AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Cartão de conferência de um item da NF no recebimento WMS: ordem de compra
// (com comparação de quantidade/valor), lotes (N por produto) e endereço de
// armazenagem para produtos endereçados.
export default function ErpWmsReceivingItemCard({ item, product, factor, poOptions, poId, onPoChange, divergence, lots, onLotsChange, locationId, onLocationChange, locations, occupancy }) {
  const lotSum = lots.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const lotOk = Math.abs(lotSum - (Number(item.quantity) || 0)) < 0.001;
  const nfQtyConv = r3((Number(item.quantity) || 0) * factor);
  const nfUnitConv = factor > 0 ? (Number(item.unit_price) || 0) / factor : 0;
  const setLot = (i, k, v) => onLotsChange(lots.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  // Endereços disponíveis primeiro (saldo das movimentações x capacidade)
  const sortedLocs = [...(locations || [])].sort((a, b) => {
    const free = (l) => (!l.capacity || (occupancy.get(l.id) || 0) < l.capacity) ? 0 : 1;
    return free(a) - free(b);
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="font-medium text-sm">{item.product_name || product?.name || "Item sem descrição"}</span>
          {item.product_code && <span className="font-mono text-[11px] text-gray-500 ml-1">{item.product_code}</span>}
          <span className="block text-xs text-gray-500">
            NF: {item.quantity} {item.unit || ""} × {fmtMoney(item.unit_price)}
            {product && factor > 1 && <> — convertido: <b>{nfQtyConv} {product.unit}</b> (fator {factor})</>}
          </span>
        </div>
        <div className="flex gap-1.5">
          {product?.controla_lote && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Controla lote</span>}
          {product?.enderecado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Endereçado</span>}
        </div>
      </div>

      {!product ? (
        <p className="p-2.5 text-xs text-amber-700 bg-amber-50">Item sem produto cadastrado — o recebimento físico deste item não será registrado. Vincule o produto na entrada fiscal.</p>
      ) : (
        <div className="p-3 space-y-3">
          {/* Ordem de compra do produto — comparação quantidade/valor */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-600">Ordem de Compra deste produto</label>
            <select value={poId} onChange={e => onPoChange(e.target.value)} className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs">
              <option value="">Sem ordem de compra localizada</option>
              {poOptions.map(po => <option key={po.id} value={po.id}>{po.order_number} — {fmtMoney(po.total_value)} ({po.status})</option>)}
            </select>
            {divergence && (
              <div className={`rounded-md border p-2 text-xs ${divergence.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  {divergence.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {divergence.ok ? "Conferência com a OC — quantidade e valor batem" : "DIVERGÊNCIA com a ordem de compra"}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>Quantidade — NF: <b>{r3(divergence.nfQtyConv)}</b> • OC: <b>{divergence.poItem.quantity}</b>{!divergence.qtyOk && <span className="font-bold"> ✗</span>}</div>
                  <div>Valor unit. — NF: <b>{fmtMoney(divergence.nfUnitConv)}</b> • OC: <b>{fmtMoney(divergence.poItem.unit_cost)}</b>{!divergence.valOk && <span className="font-bold"> ✗</span>}</div>
                </div>
              </div>
            )}
            {!poId && <p className="text-[10px] text-gray-400">Nenhuma ordem de compra deste produto para este fornecedor.</p>}
          </div>

          {/* Lotes — N lotes por produto */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-gray-600">Lotes ({lots.length})</label>
              <button type="button" onClick={() => onLotsChange([...lots, { lot: "", fabricacao: "", validade: "", quantity: 0 }])} className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"><Plus className="w-3 h-3" /> Lote</button>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b text-gray-500">
                <tr><th className="p-1.5 text-left">Lote</th><th className="p-1.5 text-left">Fabricação</th><th className="p-1.5 text-left">Validade</th><th className="p-1.5 text-right">Qtd NF</th><th className="p-1.5 w-8"></th></tr>
              </thead>
              <tbody>
                {lots.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1.5"><input value={l.lot} onChange={e => setLot(i, "lot", e.target.value)} className="w-full h-7 rounded border border-input px-1.5" /></td>
                    <td className="p-1.5"><input type="date" value={l.fabricacao} onChange={e => setLot(i, "fabricacao", e.target.value)} className="w-full h-7 rounded border border-input px-1" /></td>
                    <td className="p-1.5"><input type="date" value={l.validade} onChange={e => setLot(i, "validade", e.target.value)} className="w-full h-7 rounded border border-input px-1" /></td>
                    <td className="p-1.5"><input type="number" step="0.001" value={l.quantity} onChange={e => setLot(i, "quantity", e.target.value)} className="w-20 h-7 rounded border border-input px-1 text-right" /></td>
                    <td className="p-1.5 text-center">{lots.length > 1 && <button type="button" onClick={() => onLotsChange(lots.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`text-[10px] ${lotOk ? "text-emerald-600" : "text-red-600 font-medium"}`}>
              Lotes: {lotSum} de {item.quantity} {item.unit || ""} — {lotOk ? "quantidade confere" : "a soma dos lotes deve ser igual à quantidade da NF"}
              {factor > 1 && <> • entrada no estoque: {r3(lotSum * factor)} {product.unit}</>}
            </p>
          </div>

          {/* Endereçamento — produto marcado como endereçado */}
          {product.enderecado && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereço de armazenagem</label>
              <select value={locationId} onChange={e => onLocationChange(e.target.value)} className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs">
                <option value="">Selecione o endereço...</option>
                {sortedLocs.map(l => {
                  const occ = occupancy.get(l.id) || 0;
                  const free = !l.capacity || occ < l.capacity;
                  return <option key={l.id} value={l.id}>{l.code}{l.zone ? ` — ${l.zone}` : ""} (ocupação: {occ}{l.capacity ? `/${l.capacity}` : ""} — {free ? "disponível" : "ocupado"})</option>;
                })}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}