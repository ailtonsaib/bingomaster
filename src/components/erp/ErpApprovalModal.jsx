import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, CheckCircle2, XCircle, Gavel, Trophy } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

// Modal de aprovação de pedido de compra.
// Substitui os prompt() do navegador — o "Cancelar" não aprova mais.
// "Aprovar": observação opcional. "Não Aprovar": motivo obrigatório.
export default function ErpApprovalModal({ order, erpUser, userName, onClose, onDone }) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);

  // Carrega a tomada de preço vinculada (somente visualização)
  useEffect(() => {
    let active = true;
    if (!order.quotation_id) return;
    setLoadingQ(true);
    base44.entities.ErpQuotation.get(order.quotation_id)
      .then(q => active && setQuotation(q))
      .catch(() => active && setQuotation(null))
      .finally(() => active && setLoadingQ(false));
    return () => { active = false; };
  }, [order.quotation_id]);

  const submit = async (status) => {
    if (status === "reprovada" && !obs.trim()) {
      alert("Informe o motivo da não aprovação.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ErpPurchaseOrder.update(order.id, {
        approval_status: status,
        approved_by_id: erpUser?.id || undefined,
        approved_by_name: erpUser?.name || userName,
        approved_date: new Date().toISOString(),
        approval_obs: obs.trim() || undefined,
      });
      onDone();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  const setores = order.apportionments?.length
    ? order.apportionments.map(a => a.department_name).filter(Boolean).join(", ")
    : order.department_name;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Aprovação do Pedido {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="text-sm text-gray-600 space-y-0.5 bg-gray-50 rounded-lg p-3">
            <div><b>Fornecedor:</b> {order.supplier_name || "—"}</div>
            <div><b>Setor:</b> {setores || "—"}</div>
            <div><b>Total:</b> {fmtMoney(order.total_value)}</div>
          </div>

          {order.quotation_id && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 text-xs font-semibold">
                <Gavel className="w-3.5 h-3.5" /> Tomada de Preço {quotation?.number ? `— ${quotation.number}` : ""}
              </div>
              {loadingQ ? (
                <div className="p-3 text-center text-xs text-gray-400">Carregando tomada...</div>
              ) : !quotation ? (
                <div className="p-3 text-center text-xs text-gray-400">Tomada não encontrada.</div>
              ) : (
                <div className="p-3 space-y-2">
                  <div className="text-xs text-gray-500">{quotation.description || ""} {quotation.quotation_date && `• ${fmtDate(quotation.quotation_date)}`}</div>
                  <table className="w-full text-xs">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left font-medium pb-1">Fornecedor</th>
                        <th className="text-right font-medium pb-1">Valor</th>
                        <th className="text-center font-medium pb-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quotation.supplier_quotes || []).map((sq, i) => {
                        const isWinner = quotation.winner_supplier_id && sq.supplier_id === quotation.winner_supplier_id;
                        return (
                          <tr key={i} className={`border-t ${isWinner ? "bg-emerald-50" : ""}`}>
                            <td className="py-1.5">
                              <span className="flex items-center gap-1">
                                {isWinner && <Trophy className="w-3 h-3 text-emerald-600" />}
                                {sq.supplier_name || "—"}
                              </span>
                            </td>
                            <td className="py-1.5 text-right font-medium">{fmtMoney(sq.quoted_value)}</td>
                            <td className="py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${sq.quote_status === "respondida" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                                {sq.quote_status === "respondida" ? "Respondida" : "Pendente"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {(!quotation.supplier_quotes || quotation.supplier_quotes.length === 0) && (
                        <tr><td colSpan={3} className="py-2 text-center text-gray-400">Nenhum fornecedor participante.</td></tr>
                      )}
                    </tbody>
                  </table>
                  {(quotation.winner_supplier_name || quotation.suggested_supplier_name) && (
                    <div className="text-xs text-gray-600 pt-1 border-t space-y-0.5">
                      {quotation.suggested_supplier_name && (
                        <div><b>Sugerido (menor preço):</b> {quotation.suggested_supplier_name} — {fmtMoney(quotation.suggested_value)}</div>
                      )}
                      {quotation.winner_supplier_name && (
                        <div className="text-emerald-700"><b>Vencedora:</b> {quotation.winner_supplier_name} — {fmtMoney(quotation.winner_value)}</div>
                      )}
                      {quotation.change_reason && (
                        <div className="text-amber-600 text-[11px]"><b>Motivo da alteração:</b> {quotation.change_reason}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Observação / Motivo <span className="text-red-500 font-normal text-xs">(obrigatório para não aprovar)</span></Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Observação da aprovação (opcional) ou motivo da não aprovação (obrigatório)..." />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Fechar</Button>
          <Button size="sm" onClick={() => submit("reprovada")} disabled={saving} className="bg-red-600 hover:bg-red-700 gap-1.5">
            <XCircle className="w-4 h-4" /> Não Aprovar
          </Button>
          <Button size="sm" onClick={() => submit("aprovada")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Aprovar
          </Button>
        </div>
      </div>
    </div>
  );
}