import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/erpUtils";
import { printElements } from "@/lib/printUtils";
import { X } from "lucide-react";

// Relatório de Separação e Carregamento — imprime endereço (WMS), lote e paletização
export default function ErpLoadReportModal({ load, onClose }) {
  const wmsLines = (it) => {
    const w = (it.wms || []).filter(x => Number(x.quantity) > 0);
    if (w.length === 0) return "—";
    return w.map(x =>
      x.pending
        ? `${x.quantity.toLocaleString("pt-BR")} ${it.unit || ""} sem endereço no WMS`
        : `${x.location_code || "—"}${x.lot ? ` — Lote ${x.lot}` : ""}${x.expiry_date ? ` (val. ${fmtDate(x.expiry_date)})` : ""}: ${x.quantity.toLocaleString("pt-BR")}`
    ).join("<br/>");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 no-print">
          <h2 className="font-bold">Relatório de Separação e Carregamento — {load.number}</h2>
          <div className="flex gap-2 items-center">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => printElements(["load-report-area"])}>Imprimir</Button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div id="load-report-area" className="p-6 text-sm text-gray-900">
          <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-4">
            <div>
              <h1 className="text-lg font-bold">Ordem de Separação e Carregamento</h1>
              <p className="text-xs">Carga {load.number} — {fmtDate(load.load_date)}</p>
            </div>
            <div className="text-right text-xs">
              <p><b>Veículo:</b> {load.vehicle_plate || "—"}</p>
              <p><b>Motorista:</b> {load.driver_name || "—"}</p>
              <p><b>Total:</b> {Number(load.total_volumes || 0).toLocaleString("pt-BR")} volumes — {Number(load.total_pallets || 0).toLocaleString("pt-BR")} pallets</p>
            </div>
          </div>

          <h2 className="font-semibold mb-1">Pedidos da Carga</h2>
          <table className="w-full border-collapse mb-4 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1.5 text-left">Pedido</th>
                <th className="border p-1.5 text-left">Cliente</th>
                <th className="border p-1.5 text-left">Vendedor</th>
                <th className="border p-1.5 text-left">Cidade / Bairro</th>
                <th className="border p-1.5 text-right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {(load.orders || []).map((o, i) => (
                <tr key={i}>
                  <td className="border p-1.5">{o.order_number}</td>
                  <td className="border p-1.5">{o.customer_name}</td>
                  <td className="border p-1.5">{o.seller_name || "—"}</td>
                  <td className="border p-1.5">{o.city || "—"}{o.district ? ` / ${o.district}` : ""}</td>
                  <td className="border p-1.5 text-right">{(Number(o.total) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="font-semibold mb-1">Separação de Produtos</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1.5 text-left">Produto</th>
                <th className="border p-1.5 text-right">Volumes</th>
                <th className="border p-1.5 text-right">Pallets</th>
                <th className="border p-1.5 text-right">Volumes avulsos</th>
                <th className="border p-1.5 text-left">Endereço / Lote (WMS)</th>
              </tr>
            </thead>
            <tbody>
              {(load.items || []).map((it, i) => (
                <tr key={i}>
                  <td className="border p-1.5">
                    {it.product_code ? <span className="font-mono mr-1">{it.product_code}</span> : ""}{it.product_name}
                    <span className="block text-[10px] text-gray-500">
                      Fator pallet {Number(it.fator_pallet) || 0} · {Number(it.volumes_por_camada) || 0} vol./camada · {Number(it.quantidade_camadas) || 0} camadas
                    </span>
                  </td>
                  <td className="border p-1.5 text-right font-medium">{Number(it.quantity || 0).toLocaleString("pt-BR")} {it.unit || ""}</td>
                  <td className="border p-1.5 text-right">{Number(it.pallets || 0).toLocaleString("pt-BR")}</td>
                  <td className="border p-1.5 text-right">
                    {Number(it.loose_volumes || 0).toLocaleString("pt-BR")}
                    {Number(it.layers) > 0 && Number(it.loose_volumes) > 0 && <span className="text-[10px] text-gray-500"> ({it.layers} camada{it.layers > 1 ? "s" : ""})</span>}
                  </td>
                  <td className="border p-1.5" dangerouslySetInnerHTML={{ __html: wmsLines(it) }} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-50">
                <td className="border p-1.5">Total</td>
                <td className="border p-1.5 text-right">{Number(load.total_volumes || 0).toLocaleString("pt-BR")}</td>
                <td className="border p-1.5 text-right">{Number(load.total_pallets || 0).toLocaleString("pt-BR")}</td>
                <td className="border p-1.5 text-right"></td>
                <td className="border p-1.5"></td>
              </tr>
            </tfoot>
          </table>

          <div className="grid grid-cols-3 gap-6 mt-10 text-[11px]">
            {[ "Separado por", "Conferido por", "Motorista" ].map(label => (
              <div key={label} className="border-t border-gray-800 pt-1 text-center">{label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}