import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const REQ_STATUS = {
  pendente: { label: "Pendente", color: "text-amber-700 bg-amber-100" },
  atendida: { label: "Atendida", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-red-700 bg-red-100" },
};

export default function RequisitionsTable({ reqs, loading, search, onOpen }) {
  const s = (search || "").toLowerCase();
  const filtered = reqs.filter(r =>
    (r.number + " " + (r.production_order_number || "") + " " + (r.items || []).map(i => i.product_name).join(" ")).toLowerCase().includes(s)
  );
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr>
              <th className="p-2 text-left">Requisição</th>
              <th className="p-2 text-left">OP Vinculada</th>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-right">Itens</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma requisição ao almoxarifado.
              </td></tr>
            ) : filtered.map(r => {
              const st = REQ_STATUS[r.status] || { label: r.status, color: "text-gray-700 bg-gray-100" };
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(r)}>
                  <td className="p-2 font-mono text-xs">{r.number}</td>
                  <td className="p-2 font-medium">{r.production_order_number || "—"}</td>
                  <td className="p-2 text-gray-600">{fmtDate(r.request_date)}</td>
                  <td className="p-2 text-right">{(r.items || []).length}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                  <td className="p-2 text-right">
                    <button onClick={e => { e.stopPropagation(); onOpen(r); }} className="text-xs text-blue-600 hover:underline">Ver itens</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RequisitionDetailModal({ req, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const st = REQ_STATUS[req.status] || { label: req.status, color: "text-gray-700 bg-gray-100" };

  const changeStatus = async (status) => {
    if (status === "cancelada" && !confirm(`Cancelar a requisição ${req.number}?`)) return;
    setBusy(true);
    try {
      await base44.entities.ErpWarehouseRequisition.update(req.id, { status });
      onSaved();
      onClose();
    } catch (e) { alert("Erro: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Requisição {req.number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-gray-500">OP vinculada: </span><b>{req.production_order_number || "—"}</b></div>
            <div><span className="text-gray-500">Data: </span><b>{fmtDate(req.request_date)}</b></div>
            <div><span className="text-gray-500">Status: </span><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></div>
          </div>
          <div>
            <p className="font-semibold mb-1">Itens solicitados:</p>
            {req.items?.length ? (
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-100"><tr><th className="p-1.5 text-left">Insumo</th><th className="p-1.5 text-left">Un.</th><th className="p-1.5 text-right">Solicitado</th><th className="p-1.5 text-right">Estoque na ocasião</th></tr></thead>
                <tbody>
                  {req.items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1.5">{it.product_name}</td>
                      <td className="p-1.5">{it.unit}</td>
                      <td className="p-1.5 text-right font-medium">{it.quantity}</td>
                      <td className="p-1.5 text-right">{it.stock_at_request}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-gray-400">Sem itens.</p>}
          </div>
          {req.notes && <div><span className="text-gray-500">Obs: </span>{req.notes}</div>}
          {req.status === "pendente" && (
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("cancelada")} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"><XCircle className="w-4 h-4" /> Cancelar</Button>
              <Button size="sm" disabled={busy} onClick={() => changeStatus("atendida")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4" /> Marcar como Atendida</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}