import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowDownToLine, Keyboard, Plus, Trash2, UserPlus, Wallet, Receipt } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { gerarLancamentoEntrada } from "@/lib/erpJournal";
import ErpApportionmentEditor from "@/components/erp/ErpApportionmentEditor";

const digits = (v) => String(v || "").replace(/\D/g, "");

// Modal de entrada de despesa (sem controle de estoque).
// XML: usa o CFOP de entrada definido no Parâmetro de Despesas.
// Opcionalmente puxa de uma ordem de compra (traz setor + conta do rateio da OC).
// Ao salvar, já gera o lançamento contábil (débito nas contas do rateio, crédito em Fornecedores).
export default function ErpExpenseEntryModal({ user, parameters, onClose, onSaved }) {
  const [mode, setMode] = useState("xml");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [poId, setPoId] = useState("");
  const [paramId, setParamId] = useState("");
  const [manualApportionments, setManualApportionments] = useState([]);
  const [supplierStatus, setSupplierStatus] = useState("");
  const fileRef = useRef(null);

  const [manual, setManual] = useState({
    nota_number: "", supplier_name: "", supplier_cnpj: "", supplier_uf: "",
    issue_date: new Date().toISOString().slice(0, 10), nature_operation: "", total_nota: "",
  });
  const [manualItems, setManualItems] = useState([{ product_name: "", quantity: 1, unit_price: 0 }]);
  const setM = (k, v) => setManual(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      base44.entities.ErpPurchaseOrder.filter({ user_email: user.email, status: { $ne: "cancelada" } }, "-emission_date", 200),
      base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500),
      base44.entities.ErpDepartment.filter({ user_email: user.email, is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
    ]).then(([o, s, d, acc]) => { setOrders(o); setSuppliers(s); setDepartments(d); setAccounts(acc); }).catch(() => {});
  }, [user.email]);

  useEffect(() => {
    if (parameters.length && !paramId) setParamId(parameters[0].id);
  }, [parameters, paramId]);

  const activeParam = parameters.find(p => p.id === paramId);
  const selectedPo = orders.find(o => o.id === poId);
  const nfTotal = mode === "xml" ? parsed?.totals.total_nota : Number(manual.total_nota || 0);
  const diff = selectedPo ? nfTotal - (selectedPo.total_value || 0) : 0;
  const match = selectedPo ? Math.abs(diff) < 0.01 : false;

  // Pré-preenche o rateio manual com os defaults do parâmetro
  useEffect(() => {
    if (poId) return;
    if (manualApportionments.length > 0) return;
    if (activeParam && activeParam.default_department_id && activeParam.default_account_id) {
      setManualApportionments([{
        department_id: activeParam.default_department_id,
        department_name: activeParam.default_department_name,
        account_id: activeParam.default_account_id,
        account_code: activeParam.default_account_code,
        account_name: activeParam.default_account_name,
        rateio_type: "percent", percent: 100, value: 0,
      }]);
    }
  }, [activeParam, poId, manualApportionments.length]);

  useEffect(() => {
    if (mode !== "xml" || !parsed) { setSupplierStatus(""); return; }
    const doc = digits(parsed.supplier.cpf_cnpj);
    const existing = suppliers.find(s => s.document === doc);
    setSupplierStatus(existing ? "exists" : "will_create");
  }, [parsed, mode, suppliers]);

  const resolveCfop = (docModel) => {
    if (!activeParam) return "";
    if (docModel === "NFSe") return activeParam.cfop_entrada_servico || activeParam.cfop_entrada || "";
    return activeParam.cfop_entrada || "";
  };

  const handleFile = async (file) => {
    setError(""); setParsed(null); setParsing(true);
    try { setParsed(parseFiscalXml(await file.text())); }
    catch (e) { setError(e.message || "Erro ao processar XML."); }
    setParsing(false);
  };

  const ensureSupplier = async (name, docRaw, uf, address, city) => {
    const doc = digits(docRaw);
    if (!doc) return null;
    const existing = suppliers.find(s => s.document === doc);
    if (existing) return existing;
    const created = await base44.entities.ErpPartner.create({
      user_email: user.email, partner_type: "fornecedor",
      document_type: doc.length <= 11 ? "cpf" : "cnpj",
      document: doc, name: name || "Fornecedor sem nome",
      uf: uf || undefined, address: address || undefined, city: city || undefined, is_active: true,
    });
    setSuppliers(p => [...p, created]);
    return created;
  };

  const handleSave = async () => {
    setError("");
    if (!activeParam) { setError("Cadastre um Parâmetro de Despesas antes de lançar."); return; }
    const hasPo = !!poId;
    const apportionments = hasPo ? (selectedPo?.apportionments || []) : manualApportionments;
    if (!hasPo) {
      const aps = apportionments.filter(a => a.department_id && a.account_id);
      if (aps.length === 0) { setError("Informe o setor e a conta contábil do rateio."); return; }
      const pctSum = aps.reduce((s, a) => s + (Number(a.percent) || 0), 0);
      if (Math.abs(pctSum - 100) > 0.01) { setError(`A soma do rateio (${pctSum.toFixed(2)}%) deve ser 100%.`); return; }
    } else if (!apportionments.length) {
      setError("A ordem de compra selecionada não possui rateio (setor/conta)."); return;
    }
    setSaving(true);
    try {
      let payload;
      if (mode === "xml") {
        if (!parsed) { setSaving(false); setError("Importe um XML."); return; }
        await ensureSupplier(parsed.supplier.name, parsed.supplier.cpf_cnpj, parsed.supplier.uf, parsed.supplier.address, parsed.supplier.city);
        const cfop = resolveCfop(parsed.nota.model);
        payload = {
          user_email: user.email,
          entry_kind: "despesa",
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
          cfop,
          total_products: parsed.totals.total_products,
          total_nota: parsed.totals.total_nota,
          total_icms: parsed.totals.total_icms,
          total_ipi: parsed.totals.total_ipi,
          total_pis: parsed.totals.total_pis,
          total_cofins: parsed.totals.total_cofins,
          items: parsed.items,
          purchase_order_id: hasPo ? selectedPo.id : undefined,
          purchase_order_number: hasPo ? selectedPo.order_number : undefined,
          po_total_value: hasPo ? (selectedPo.total_value || 0) : 0,
          value_diff: hasPo ? diff : 0,
          values_match: hasPo ? match : true,
          operation_id: activeParam.operation_id || undefined,
          operation_name: activeParam.operation_name || undefined,
          apportionments,
          status: "lancada",
          approval_status: "nao_aplica",
        };
      } else {
        if (!manual.nota_number.trim()) { setSaving(false); setError("Informe o número do documento."); return; }
        if (!manual.supplier_name.trim()) { setSaving(false); setError("Informe o fornecedor."); return; }
        if (!manual.total_nota || Number(manual.total_nota) <= 0) { setSaving(false); setError("Informe o total do documento."); return; }
        await ensureSupplier(manual.supplier_name, manual.supplier_cnpj, manual.supplier_uf);
        const total = Number(manual.total_nota);
        const items = manualItems.filter(it => it.product_name.trim() && it.quantity > 0).map(it => ({
          product_name: it.product_name, quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
          ncm: "", cfop: "", unit: "UN",
        }));
        payload = {
          user_email: user.email,
          entry_kind: "despesa",
          nota_model: "NDF",
          nota_number: manual.nota_number,
          issue_date: manual.issue_date ? new Date(manual.issue_date).toISOString() : new Date().toISOString(),
          entry_date: new Date().toISOString(),
          supplier_name: manual.supplier_name,
          supplier_cnpj: manual.supplier_cnpj,
          supplier_uf: manual.supplier_uf,
          nature_operation: manual.nature_operation || "Despesa",
          cfop: resolveCfop("NDF"),
          total_products: items.reduce((a, it) => a + it.total, 0),
          total_nota: total,
          total_icms: 0, total_ipi: 0, total_pis: 0, total_cofins: 0,
          items,
          purchase_order_id: hasPo ? selectedPo.id : undefined,
          purchase_order_number: hasPo ? selectedPo.order_number : undefined,
          po_total_value: hasPo ? (selectedPo.total_value || 0) : 0,
          value_diff: hasPo ? diff : 0,
          values_match: hasPo ? match : true,
          operation_id: activeParam.operation_id || undefined,
          operation_name: activeParam.operation_name || undefined,
          apportionments,
          status: "lancada",
          approval_status: "nao_aplica",
        };
      }

      const entry = await base44.entities.ErpFiscalEntry.create(payload);
      // Já gera o lançamento contábil (débito nas contas do rateio, crédito em Fornecedores)
      try {
        const je = await gerarLancamentoEntrada(user, { ...entry, apportionments }, accounts, {
          history: `Despesa ${entry.nota_number} - ${entry.supplier_name || ""}${hasPo ? ` (OC ${selectedPo.order_number})` : ""}`,
          complement: `Despesa ${entry.nota_number}`,
        });
        await base44.entities.ErpFiscalEntry.update(entry.id, { journal_entry_id: je.id, journal_entry_number: je.number });
      } catch (e) {
        setError(`Despesa registrada, mas o lançamento contábil falhou: ${e.message}`);
        setSaving(false); onSaved?.(); onClose(); return;
      }
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const ready = mode === "xml" ? parsed : true;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Wallet className="w-5 h-5 text-indigo-600" /> Entrada de Despesa</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Parâmetro de Despesas */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <label className="text-xs font-medium text-indigo-700 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Parâmetro de Despesas</label>
            <select value={paramId} onChange={e => setParamId(e.target.value)} className="w-full h-9 rounded-md border border-indigo-200 bg-white px-3 text-sm mt-1">
              {parameters.length === 0 && <option value="">Nenhum parâmetro cadastrado</option>}
              {parameters.map(p => <option key={p.id} value={p.id}>{p.name}{p.cfop_entrada ? ` — CFOP ${p.cfop_entrada}` : ""}</option>)}
            </select>
            {activeParam && (
              <p className="text-[11px] text-indigo-700 mt-1">
                Operação: {activeParam.operation_name || "—"} • CFOP NF-e: {activeParam.cfop_entrada || "—"} • CFOP NFS-e: {activeParam.cfop_entrada_servico || "—"}
              </p>
            )}
          </div>

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
                <div className="flex flex-col items-center gap-2"><FileText className="w-10 h-10 text-gray-400" /><p className="text-sm font-medium">Clique para selecionar o XML da NF-e ou NFS-e</p><p className="text-xs text-gray-400">Despesa sem controle de estoque — o CFOP de entrada vem do parâmetro selecionado.</p></div>
              )}
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {mode === "xml" && parsed && (
            <div className="space-y-3">
              <div className={`rounded-lg p-2.5 border flex items-center gap-2 text-xs ${supplierStatus === "exists" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : supplierStatus === "will_create" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                {supplierStatus === "exists" ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {supplierStatus === "exists" ? `Fornecedor já cadastrado: ${parsed.supplier.name}` : supplierStatus === "will_create" ? `Fornecedor será criado automaticamente: ${parsed.supplier.name} (CNPJ ${parsed.supplier.cpf_cnpj})` : "Analisando fornecedor..."}
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><h4 className="text-sm font-semibold">Dados da Nota ({parsed.nota.model === "NFSe" ? "NFS-e" : `NF-e mod ${parsed.nota.model}`})</h4></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-500">Número:</span> <b>{parsed.nota.number}</b></div>
                  <div><span className="text-gray-500">Emissão:</span> {fmtDate(parsed.nota.issue_date)}</div>
                  <div><span className="text-gray-500">Total:</span> <b className="text-indigo-700">{fmtMoney(parsed.totals.total_nota)}</b></div>
                  <div><span className="text-gray-500">CFOP Parâmetro:</span> <b className="font-mono">{resolveCfop(parsed.nota.model) || "—"}</b></div>
                  <div className="col-span-2"><span className="text-gray-500">Emitente:</span> {parsed.supplier.name}</div>
                  <div><span className="text-gray-500">CNPJ:</span> {parsed.supplier.cpf_cnpj}</div>
                  <div><span className="text-gray-500">UF:</span> {parsed.supplier.uf}</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b"><h4 className="text-sm font-semibold">Itens ({parsed.items.length}) — sem controle de estoque</h4></div>
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0"><tr><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">NCM</th><th className="p-2 text-right">Qtd</th><th className="p-2 text-right">V. Unit.</th><th className="p-2 text-right">Total</th></tr></thead>
                    <tbody>
                      {parsed.items.map((it, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2"><div className="font-mono text-[11px] text-gray-500">{it.product_code}</div>{it.product_name}</td>
                          <td className="p-2 text-gray-500">{it.ncm}</td>
                          <td className="p-2 text-right">{it.quantity}</td>
                          <td className="p-2 text-right">{fmtMoney(it.unit_price)}</td>
                          <td className="p-2 text-right font-medium">{fmtMoney(it.total)}</td>
                        </tr>
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">Use para documentos não fiscais (recibo, fatura, cupom manual). O fornecedor será cadastrado automaticamente se não existir.</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Número do Doc. *</label><input value={manual.nota_number} onChange={e => setM("nota_number", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Data de Emissão</label><input type="date" value={manual.issue_date} onChange={e => setM("issue_date", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Total (R$) *</label><input type="number" step="0.01" value={manual.total_nota} onChange={e => setM("total_nota", e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Natureza</label><input value={manual.nature_operation} onChange={e => setM("nature_operation", e.target.value)} placeholder="Despesa" className="w-full h-9 rounded-md border border-input px-3 text-sm" /></div>
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

          {/* === OC e Rateio (comum) === */}
          {ready && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Ordem de Compra (opcional)</label>
                <select value={poId} onChange={e => setPoId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Sem ordem de compra (despesa avulsa)</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.supplier_name || "—"} ({fmtMoney(o.total_value)})</option>)}
                </select>
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
                  <p className="text-xs text-emerald-700 mt-2">Rateio (setor + conta contábil) herdado da ordem de compra.</p>
                </div>
              )}

              {!poId && (
                <ErpApportionmentEditor
                  apportionments={manualApportionments}
                  onChange={setManualApportionments}
                  setores={departments}
                  accounts={accounts}
                  accent="indigo"
                  title="Rateio do Lançamento (Setor / Conta Contábil)"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {ready && (
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />} Lançar Despesa
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}