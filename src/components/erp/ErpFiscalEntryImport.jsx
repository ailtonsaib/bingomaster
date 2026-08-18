import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowDownToLine, Keyboard, Plus, Trash2 } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

// Modal de entrada de documento (NF-e/NFS-e por XML ou digitação manual p/ documento não fiscal).
// Se o total fechar com a OC → aprovada automaticamente (pode lançar). Se divergir → aguarda aprovação.
export default function ErpFiscalEntryImport({ user, onClose, onSaved }) {
  const [mode, setMode] = useState("xml");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [poId, setPoId] = useState("");
  const [opId, setOpId] = useState("");
  const fileRef = useRef(null);

  // Digitação manual (documento não fiscal)
  const [manual, setManual] = useState({
    nota_number: "", supplier_name: "", supplier_cnpj: "", supplier_uf: "",
    issue_date: new Date().toISOString().slice(0, 10), nature_operation: "", cfop: "", total_nota: "",
  });
  const [manualItems, setManualItems] = useState([{ product_name: "", quantity: 1, unit_price: 0 }]);
  const setM = (k, v) => setManual(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      base44.entities.ErpPurchaseOrder.filter({ user_email: user.email, status: { $ne: "cancelada" } }, "-emission_date", 200),
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
    ]).then(([o, op]) => { setOrders(o); setOperations(op); }).catch(() => {});
  }, [user.email]);

  const selectedPo = orders.find(o => o.id === poId);
  const nfTotal = mode === "xml" ? parsed?.totals.total_nota : Number(manual.total_nota || 0);
  const diff = selectedPo ? nfTotal - (selectedPo.total_value || 0) : 0;
  const match = selectedPo ? Math.abs(diff) < 0.01 : false;

  const handleFile = async (file) => {
    setError(""); setParsed(null); setParsing(true);
    try { setParsed(parseFiscalXml(await file.text())); }
    catch (e) { setError(e.message || "Erro ao processar XML."); }
    setParsing(false);
  };

  const handleSave = async () => {
    setError("");
    if (!poId) { setError("Selecione a ordem de compra."); return; }
    const po = selectedPo;
    const op = operations.find(o => o.id === opId);

    let payload;
    if (mode === "xml") {
      if (!parsed) { setError("Importe um XML."); return; }
      const valueDiff = parsed.totals.total_nota - (po.total_value || 0);
      const valuesMatch = Math.abs(valueDiff) < 0.01;
      payload = {
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
      };
    } else {
      if (!manual.nota_number.trim()) { setError("Informe o número do documento."); return; }
      if (!manual.supplier_name.trim()) { setError("Informe o fornecedor."); return; }
      if (!manual.total_nota || Number(manual.total_nota) <= 0) { setError("Informe o total do documento."); return; }
      const total = Number(manual.total_nota);
      const items = manualItems.filter(it => it.product_name.trim() && it.quantity > 0).map(it => ({
        product_name: it.product_name, quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
        ncm: "", cfop: "", unit: "UN",
      }));
      const valueDiff = total - (po.total_value || 0);
      const valuesMatch = Math.abs(valueDiff) < 0.01;
      payload = {
        user_email: user.email,
        nota_model: "NDF",
        nota_number: manual.nota_number,
        nota_series: "",
        chave_acesso: "",
        issue_date: manual.issue_date ? new Date(manual.issue_date).toISOString() : new Date().toISOString(),
        entry_date: new Date().toISOString(),
        supplier_name: manual.supplier_name,
        supplier_cnpj: manual.supplier_cnpj,
        supplier_uf: manual.supplier_uf,
        nature_operation: manual.nature_operation || "Documento Não Fiscal",
        cfop: manual.cfop,
        total_products: items.reduce((a, it) => a + it.total, 0),
        total_nota: total,
        total_icms: 0, total_ipi: 0, total_pis: 0, total_cofins: 0,
        items,
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
      };
    }

    setSaving(true);
    try {
      await base44.entities.ErpFiscalEntry.create(payload);
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-indigo-600" /> Entrada de Documento Fiscal</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Alternância XML / Manual */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => { setMode("xml"); setError(""); }} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "xml" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}><FileText className="w-4 h-4" /> Importar XML</button>
            <button onClick={() => { setMode("manual"); setError(""); }} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "manual" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}><Keyboard className="w-4 h-4" /> Digitação Manual</button>
          </div>

          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4" /> {error}</div>}

          {/* === MODO XML === */}
          {mode === "xml" && !parsed && (
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
              {parsing ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /><p className="text-sm text-gray-500">Processando XML...</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2"><FileText className="w-10 h-10 text-gray-400" /><p className="text-sm font-medium">Clique para selecionar o XML da NF-e ou NFS-e</p><p className="text-xs text-gray-400">Formatos: .xml (NF-e modelo 55, NFC-e 65 ou NFS-e ABRASF)</p></div>
              )}
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {mode === "xml" && parsed && (
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

          {/* === MODO MANUAL === */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">Use este modo para documentos não fiscais (recibo, cupom, fatura manual, etc.).</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Número do Doc. *</label><input value={manual.nota_number} onChange={e => setM("nota_number", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Data de Emissão</label><input type="date" value={manual.issue_date} onChange={e => setM("issue_date", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Total (R$) *</label><input type="number" step="0.01" value={manual.total_nota} onChange={e => setM("total_nota", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Natureza/CFOP</label><input value={manual.nature_operation} onChange={e => setM("nature_operation", e.target.value)} placeholder="Operação" className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div className="col-span-2"><label className="text-xs font-medium text-gray-600">Fornecedor *</label><input value={manual.supplier_name} onChange={e => setM("supplier_name", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">CNPJ/CPF</label><input value={manual.supplier_cnpj} onChange={e => setM("supplier_cnpj", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">UF</label><input value={manual.supplier_uf} onChange={e => setM("supplier_uf", e.target.value.toUpperCase().slice(0, 2))} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Itens</h4>
                  <Button type="button" variant="outline" size="sm" onClick={() => setManualItems(p => [...p, { product_name: "", quantity: 1, unit_price: 0 }])} className="gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b"><tr><th className="p-2 text-left">Descrição</th><th className="p-2 text-right w-20">Qtd</th><th className="p-2 text-right w-28">V. Unit.</th><th className="p-2 text-right w-24">Total</th><th className="p-2 w-10"></th></tr></thead>
                  <tbody>
                    {manualItems.map((it, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2"><input value={it.product_name} onChange={e => setManualItems(p => p.map((x, idx) => idx === i ? { ...x, product_name: e.target.value } : x))} className="w-full h-8 rounded border border-input px-2 text-xs" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.quantity} onChange={e => setManualItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} className="w-16 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                        <td className="p-2"><input type="number" step="0.01" value={it.unit_price} onChange={e => setManualItems(p => p.map((x, idx) => idx === i ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} className="w-24 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                        <td className="p-2 text-right font-medium">{fmtMoney((it.quantity || 0) * (it.unit_price || 0))}</td>
                        <td className="p-2 text-center">{manualItems.length > 1 && <button type="button" onClick={() => setManualItems(p => p.filter((_, idx) => idx !== i))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === OC e Conferência (comum) === */}
          {(mode === "xml" ? parsed : mode === "manual") && (
            <div className="space-y-3">
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
                    <option value="">Usar dados do documento</option>
                    {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>

              {selectedPo && (
                <div className={`rounded-lg p-3 border ${match ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {match ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <h4 className="text-sm font-semibold">Conferência Documento x OC</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-xs text-gray-500">Total da OC</p><p className="font-medium">{fmtMoney(selectedPo.total_value)}</p></div>
                    <div><p className="text-xs text-gray-500">Total do Doc.</p><p className="font-medium">{fmtMoney(nfTotal)}</p></div>
                    <div><p className="text-xs text-gray-500">Diferença</p><p className={`font-medium ${match ? "text-emerald-700" : "text-amber-700"}`}>{fmtMoney(diff)}</p></div>
                  </div>
                  <p className={`text-xs mt-2 ${match ? "text-emerald-700" : "text-amber-700"}`}>
                    {match ? "Valores conferem — a entrada será aprovada automaticamente e poderá ser lançada." : "Valores divergem — a entrada ficará aguardando aprovação do administrador."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {(mode === "xml" ? parsed : true) && (
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />} Dar Entrada
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}