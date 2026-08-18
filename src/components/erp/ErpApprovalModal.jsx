import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, CheckCircle2, XCircle } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

// Modal de aprovação de pedido de compra.
// Substitui os prompt() do navegador — o "Cancelar" não aprova mais.
// "Aprovar": observação opcional. "Não Aprovar": motivo obrigatório.
export default function ErpApprovalModal({ order, erpUser, userName, onClose, onDone }) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Aprovação do Pedido {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-gray-600 space-y-0.5 bg-gray-50 rounded-lg p-3">
            <div><b>Fornecedor:</b> {order.supplier_name || "—"}</div>
            <div><b>Setor:</b> {setores || "—"}</div>
            <div><b>Total:</b> {fmtMoney(order.total_value)}</div>
          </div>
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