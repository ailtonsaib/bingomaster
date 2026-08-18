import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, CheckCircle2, XCircle } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

// Modal de aprovação NF x OC: admin valida a divergência e aprova/reprova a entrada da nota.
export default function ErpFiscalApprovalModal({ entry, userName, onClose, onDone }) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (status) => {
    if (status === "nao_aprovada" && !obs.trim()) { alert("Informe o motivo da não aprovação."); return; }
    setSaving(true);
    try {
      await base44.entities.ErpFiscalEntry.update(entry.id, {
        status,
        approval_status: status === "aprovada" ? "aprovada" : "reprovada",
        approved_by_name: userName,
        approved_date: new Date().toISOString(),
        approval_obs: obs.trim() || undefined,
      });
      onDone();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Aprovação NF x OC — NF {entry.nota_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="text-sm text-gray-600 space-y-0.5 bg-gray-50 rounded-lg p-3">
            <div><b>Fornecedor:</b> {entry.supplier_name || "—"}</div>
            <div><b>OC:</b> {entry.purchase_order_number || "—"}</div>
            <div><b>Itens na nota:</b> {entry.items?.length || 0}</div>
          </div>
          <div className={`rounded-lg p-3 border ${entry.values_match ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <h4 className="text-sm font-semibold mb-1">Conferência de Valores</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-xs text-gray-500">Total da OC</p><p className="font-medium">{fmtMoney(entry.po_total_value)}</p></div>
              <div><p className="text-xs text-gray-500">Total da NF</p><p className="font-medium">{fmtMoney(entry.total_nota)}</p></div>
              <div><p className="text-xs text-gray-500">Diferença</p><p className={`font-medium ${entry.values_match ? "text-emerald-700" : "text-amber-700"}`}>{fmtMoney(entry.value_diff)}</p></div>
            </div>
            {!entry.values_match && <p className="text-xs text-amber-700 mt-2">Os valores divergem — valide antes de aprovar.</p>}
          </div>
          <div>
            <Label>Observação / Motivo <span className="text-red-500 font-normal text-xs">(obrigatório para não aprovar)</span></Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Observação da aprovação (opcional) ou motivo da não aprovação (obrigatório)..." />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Fechar</Button>
          <Button size="sm" onClick={() => submit("nao_aprovada")} disabled={saving} className="bg-red-600 hover:bg-red-700 gap-1.5"><XCircle className="w-4 h-4" /> Não Aprovar</Button>
          <Button size="sm" onClick={() => submit("aprovada")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"><CheckCircle2 className="w-4 h-4" /> Aprovar</Button>
        </div>
      </div>
    </div>
  );
}