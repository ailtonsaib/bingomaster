import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Receipt, Settings2, UploadCloud, FileText, ChevronDown, ChevronRight } from "lucide-react";
import NfseConfigModal from "@/components/workshop/NfseConfigModal";
import EmitNfseModal from "@/components/workshop/EmitNfseModal";

export default function NfsePanel({ userEmail }) {
  const [nfses, setNfses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmit, setShowEmit] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [transmitting, setTransmitting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, oRes] = await Promise.all([
        base44.functions.invoke("gerarNfse", { operation: "list", email: userEmail }),
        base44.functions.invoke("gerarNfse", { operation: "listOrders", email: userEmail }),
      ]);
      setNfses(nRes?.data?.nfses || []);
      setOrders(oRes?.data?.orders || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const transmit = async (nfse) => {
    setTransmitting(nfse.id);
    try {
      const res = await base44.functions.invoke("transmitirNfse", { email: userEmail, nfse_id: nfse.id });
      const d = res?.data || {};
      if (d.success) {
        alert(`NFS-e autorizada!\nNúmero: ${d.nfse_number}\nProtocolo: ${d.protocolo}`);
        load();
      } else {
        alert(`Transmissão não autorizada.\n${d.statusText || d.error || "Erro desconhecido."}` + (d.rawResponse ? "\n\nResposta (início):\n" + d.rawResponse.slice(0, 400) : ""));
        load();
      }
    } catch (e) { alert("Erro ao transmitir:\n" + (e?.message || "")); }
    setTransmitting(null);
  };

  const fmtMoney = (v) => "R$ " + (Number(v) || 0).toFixed(2);
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleString("pt-BR") : "—";

  const statusBadge = (s) => {
    const map = { rascunho: "bg-amber-100 text-amber-700", emitida: "bg-emerald-100 text-emerald-700", cancelada: "bg-red-100 text-red-600" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || map.rascunho}`}>{s || "rascunho"}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold">NFS-e (Nota Fiscal de Serviço)</h2>
          <span className="text-sm text-gray-500">({nfses.length})</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfig(true)} className="h-9 gap-1.5"><Settings2 className="w-4 h-4" /> Configurar NFS-e</Button>
          <Button onClick={() => setShowEmit(true)} disabled={orders.length === 0} className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Emitir NFS-e</Button>
        </div>
      </div>

      {orders.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          Nenhuma ordem de serviço concluída/entregue disponível para emissão de NFS-e.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : nfses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhuma NFS-e gerada</p>
          <p className="text-xs mt-1">Use "Emitir NFS-e" para gerar um RPS a partir de uma OS concluída</p>
        </div>
      ) : (
        <div className="space-y-2">
          {nfses.map((n) => (
            <div key={n.id} className="bg-white rounded-lg border overflow-hidden">
              <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === n.id ? null : n.id)}>
                {expanded === n.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <div className="flex-1 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="font-semibold text-sm">{n.tomador_name || "—"}</p>
                    <p className="text-xs text-gray-500">RPS {n.rps_number} · OS {n.order_number || "—"} · {fmtDate(n.emission_date)}</p>
                  </div>
                  <div className="text-sm"><p className="text-xs text-gray-500">Valor</p><p className="font-bold text-indigo-600">{fmtMoney(n.total_nota)}</p></div>
                  {n.nfse_number && <div className="text-sm"><p className="text-xs text-gray-500">NFS-e</p><p className="font-medium text-xs">{n.nfse_number}</p></div>}
                  {statusBadge(n.status)}
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {n.status === "rascunho" && (
                    <Button size="sm" onClick={() => transmit(n)} disabled={transmitting === n.id} className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                      {transmitting === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} Transmitir
                    </Button>
                  )}
                </div>
              </div>
              {expanded === n.id && (
                <div className="border-t bg-gray-50 p-3 text-xs space-y-1">
                  <p><b>Tomador:</b> {n.tomador_name} — {n.tomador_doc || "sem documento"}</p>
                  <p><b>Serviço:</b> {n.service_code} — {n.service_discriminacao}</p>
                  <p><b>Base cálculo:</b> {fmtMoney(n.base_calculo)} · <b>Alíquota:</b> {(n.aliquota || 0)}% · <b>ISS:</b> {fmtMoney(n.valor_iss)} {n.iss_retido ? "(retido)" : ""}</p>
                  {n.nfse_protocol && <p className="text-emerald-700"><b>Protocolo:</b> {n.nfse_protocol} — {n.nfse_status}</p>}
                  {n.nfse_status && n.status !== "emitida" && <p className="text-amber-700"><b>Status:</b> {n.nfse_status}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showConfig && <NfseConfigModal userEmail={userEmail} onClose={() => setShowConfig(false)} onSaved={load} />}
      {showEmit && <EmitNfseModal userEmail={userEmail} orders={orders} onClose={() => setShowEmit(false)} onSaved={load} />}
    </div>
  );
}