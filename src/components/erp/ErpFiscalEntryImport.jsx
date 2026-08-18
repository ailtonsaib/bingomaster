import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowDownToLine } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

// Modal de entrada de nota fiscal por XML (NF-e/NFS-e) vinculada a uma ordem de compra.
// Se o total da nota fechar com a OC → aprovada automaticamente (pode lançar).
// Se divergir → fica aguardando aprovação do admin.
export default function ErpFiscalEntryImport({ user, onClose, onSaved }) {
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [poId, setPoId] = useState("");
  const [opId, setOpId] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpPurchaseOrder.filter({ user_email: user.email, status: { $ne: "cancelada" } }, "-emission_date", 200),
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
    ]).then(([o, op]) => { setOrders(o); setOperations(op); }).catch(() => {});
  }, [user.email]);

  const selectedPo = orders.find(o => o.id === poId);
  const diff = parsed && selectedPo ? parsed.totals.total_nota - (selectedPo.total_value || 0) : 0;
  const match = parsed && selectedPo ? Math.abs(diff) < 0.01 : false;

  const handleFile = async (file) => {
    setError(""); setParsed(null); setParsing(true);
    try { setParsed(parseFiscalXml(await file.text())); }
    catch (e) { setError(e.message || "Erro ao processar XML."); }
    setParsing(false);
  };

  const handleSave = async () => {
    if (!parsed) { setError("Importe um XML."); return; }
    if (!poId) { setError("Selecione a ordem de compra."); return; }
    setSaving(true);
    try {
      const po = selectedPo;
      const valueDiff = parsed.totals.total_nota - (po.total_value || 0);
      const valuesMatch = Math.abs(valueDiff) < 0.01;
      const op = operations.find(o => o.id === opId);
      await base44.entities.ErpFiscalEntry.create({
        user_email: user.email,
        nota_model: parsed.nota.model,
        nota_number: parsed.nota.number,
        nota_series: parsed.nota.series,
        chave_acesso: parsed.nota.chave_acesso,
        issue_date: parsed.nota.issue_date ? new Date(parsed.nota.issue_date).toISOString() : new Date().toISOString(),
        entry_date: new Date().toISOString(),
        supplier_name: parsed.supplier.name,
        supplier_cnpj: parsed.supplier.cpf_cnpj,
        supplier_uf: parsed.supplier.uf,
        nature_operation: parsed.nota.nature_operation,
        cfop: parsed.nota.cfop,
        total_products: parsed.totals.total_products,
        total_nota: parsed.totals.total_nota,
        total_icms: parsed.totals.total_icms,
        total_ipi: parsed.totals.total_ipi,
        total_pis: parsed.totals.total_pis,
        total_cofins: parsed.totals.total_cofins,
        items: parsed.items,
        purchase_order_id: po.id,
        purchase_order_number: po.order_number,
        po_total_value: po.total_value || 0,
        value_diff: valueDiff,
        values_match: valuesMatch,
        operation_id: op?.id || undefined,
        operation_name: op?.name || undefined,
        apportionments: po.apportionments || [],
        status: valuesMatch ? "aprovada" : "pendente",
        approval_status: valuesMatch ? "nao_aplica" : "aguardando_aprovacao",
      });
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-indigo-600" /> Entrada de Nota Fiscal (XML)</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {!parsed && (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /><p className="text-sm text-gray-500">Processando XML...</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2"><FileText className="w-10 h-10 text-gray-400" /><p className="text-sm font-medium">Clique para selecionar o XML da NF-e ou NFS-e</p><p className="text-xs text-gray-400">Formatos: .xml (NF-e modelo 55, NFC-e 65 ou NFS-e ABRASF)</p></div>
              )}
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4" /> {error}</div>}

          {parsed && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><h4 className="text-sm font-semibold">Dados da Nota ({parsed.nota.model === "NFSe" ? "NFS-e" : `NF-e mod ${parsed.nota.model}`})</h4></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-500">Número:</span> <b>{parsed.nota.number}</b></div>
                  <div><span className="text-gray-500">Série:</span> {parsed.nota.series || "—"}</div>
                  <div><span className="text-gray-500">Emissão:</span> {fmtDate(parsed.nota.issue_date)}</div>
                  <div><span className="text-gray-500">Total NF:</span> <b className="text-indigo-700">{fmtMoney(parsed.totals.total_nota)}</b></div>
                  <div className="col-span-2"><span className="text-gray-500">Emitente:</span> {parsed.supplier.name}</div>
                  <div><span className="text-gray-500">CNPJ:</span> {parsed.supplier.cpf_cnpj}</div>
                  <div><span className="text-gray-500">UF:</span> {parsed.supplier.uf}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Ordem de Compra *</label>
                  <select value={poId} onChange={e => setPoId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Selecione...</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.supplier_name || "—"} ({fmtMoney(o.total_value)})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Operação de Entrada (opcional)</label>
                  <select value={opId} onChange={e => setOpId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Usar dados do XML</option>
                    {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>

              {selectedPo && (
                <div className={`rounded-lg p-3 border ${match ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {match ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <h4 className="text-sm font-semibold">Conferência NF x OC</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs text-gray-500">Total da OC</p><p className="font-medium">{fmtMoney(selectedPo.total_value)}</p></div>
                    <div><p className="text-xs text-gray-500">Total da NF</p><p className="font-medium">{fmtMoney(parsed.totals.total_nota)}</p></div>
                    <div><p className="text-xs text-gray-500">Diferença</p><p className={`font-medium ${match ? "text-emerald-700" : "text-amber-700"}`}>{fmtMoney(diff)}</p></div>
                  </div>
                  <p className={`text-xs mt-2 ${match ? "text-emerald-700" : "text-amber-700"}`}>
                    {match ? "Valores conferem — a entrada será aprovada automaticamente e poderá ser lançada." : "Valores divergem — a entrada ficará aguardando aprovação do administrador."}
                  </p>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b"><h4 className="text-sm font-semibold">Itens ({parsed.items.length})</h4></div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0"><tr><th className="p-2 text-left">Produto/Serviço</th><th className="p-2 text-center">NCM</th><th className="p-2 text-center">CFOP</th><th className="p-2 text-right">Qtd</th><th className="p-2 text-right">V. Unit.</th><th className="p-2 text-right">Total</th></tr></thead>
                    <tbody>
                      {parsed.items.map((it, i) => (
                        <tr key={i} className="border-b"><td className="p-2">{it.product_name}</td><td className="p-2 text-center font-mono">{it.ncm}</td><td className="p-2 text-center">{it.cfop}</td><td className="p-2 text-right">{it.quantity}</td><td className="p-2 text-right">{it.unit_price.toFixed(2)}</td><td className="p-2 text-right font-medium">{it.total.toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {parsed && (
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />} Dar Entrada na Nota
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}