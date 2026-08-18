import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowDownToLine, Keyboard, Plus, Trash2, UserPlus, Wallet, Receipt, Percent } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { gerarContabilDespesa, gerarFinanceiroDespesa } from "@/lib/erpDespesa";
import ErpApportionmentEditor from "@/components/erp/ErpApportionmentEditor";
import { lookupCnpj } from "@/lib/cnpjLookup";
import ErpPartnerFormModal from "@/components/erp/ErpPartnerFormModal";

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
  const [sectors, setSectors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [companyUf, setCompanyUf] = useState("");
  const [poId, setPoId] = useState("");
  const [paramId, setParamId] = useState("");
  const [manualApportionments, setManualApportionments] = useState([]);
  const [retentions, setRetentions] = useState({ irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, iss: 0 });
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierStatus, setSupplierStatus] = useState("");
  const [pfModal, setPfModal] = useState(null);
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
      base44.entities.ErpSector.filter({ user_email: user.email, is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
      base44.entities.ErpCompany.filter({ user_email: user.email, is_active: true }, "razao_social", 50),
    ]).then(([o, s, d, acc, comps]) => { setOrders(o); setSuppliers(s); setSectors(d); setAccounts(acc); setCompanyUf((comps.find(c => c.is_main) || comps[0] || {}).uf || ""); }).catch(() => {});
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
    const depIds = activeParam?.default_sector_ids || [];
    const accIds = activeParam?.default_account_ids || [];
    if (depIds.length === 0 || accIds.length === 0) return;
    const combos = [];
    depIds.forEach((dId, di) => accIds.forEach((aId, ai) => {
      combos.push({
        department_id: dId,
        department_name: activeParam.default_sector_names?.[di] || "",
        account_id: aId,
        account_code: activeParam.default_account_codes?.[ai] || "",
        account_name: activeParam.default_account_names?.[ai] || "",
        rateio_type: "percent", percent: 0, value: 0,
      });
    }));
    if (combos.length === 1) { combos[0].percent = 100; }
    else {
      const base = Math.floor((100 / combos.length) * 100) / 100;
      combos.forEach((c, i) => { c.percent = i === combos.length - 1 ? Math.round((100 - base * (combos.length - 1)) * 100) / 100 : base; });
    }
    setManualApportionments(combos);
  }, [activeParam, poId, manualApportionments.length]);

  useEffect(() => {
    if (mode !== "xml" || !parsed) { setSupplierStatus(""); return; }
    const doc = digits(parsed.supplier.cpf_cnpj);
    const existing = suppliers.find(s => s.document === doc);
    setSupplierStatus(existing ? "exists" : "will_create");
  }, [parsed, mode, suppliers]);

  useEffect(() => {
    if (mode === "xml" && parsed?.retentions) {
      setRetentions({
        irrf: parsed.retentions.irrf || 0,
        pis: parsed.retentions.pis || 0,
        cofins: parsed.retentions.cofins || 0,
        csll: parsed.retentions.csll || 0,
        inss: parsed.retentions.inss || 0,
        iss: parsed.retentions.iss || 0,
      });
    }
  }, [parsed, mode]);

  const resolveCfop = (docModel, supplierUf) => {
    if (!activeParam) return "";
    const dentro = (supplierUf || "").toUpperCase() === companyUf.toUpperCase();
    if (docModel === "NFSe") return dentro ? (activeParam.cfop_nfse_dentro || activeParam.cfop_nfse_fora || "") : (activeParam.cfop_nfse_fora || activeParam.cfop_nfse_dentro || "");
    return dentro ? (activeParam.cfop_nfe_dentro || activeParam.cfop_nfe_fora || "") : (activeParam.cfop_nfe_fora || activeParam.cfop_nfe_dentro || "");
  };

  const paramRetention = (type) => (activeParam?.retentions || []).find(r => r.type === type);

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
    // PJ (CNPJ) — busca na Receita e cadastra completo
    if (doc.length === 14) {
      const data = await lookupCnpj(doc);
      const fail = !!data.error;
      const created = await base44.entities.ErpPartner.create({
        user_email: user.email, partner_type: "fornecedor",
        document_type: "cnpj", document: doc,
        name: fail ? (name || "Fornecedor sem nome") : (data.razao_social || name || "Fornecedor sem nome"),
        nome_fantasia: fail ? undefined : (data.nome_fantasia || undefined),
        cep: fail ? undefined : (data.cep || undefined),
        address: fail ? (address || undefined) : (data.address || undefined),
        number: fail ? undefined : (data.number || undefined),
        district: fail ? undefined : (data.district || undefined),
        city: fail ? (city || undefined) : (data.city || undefined),
        uf: fail ? (uf || undefined) : (data.uf || undefined),
        ibge_code: fail ? undefined : (data.ibge_code || undefined),
        phone: fail ? undefined : (data.phone || undefined),
        email: fail ? undefined : (data.email || undefined),
        is_active: true,
      });
      setSuppliers(p => [...p, created]);
      return created;
    }
    // PF (CPF) — abre modal para cadastro manual
    return new Promise((resolve) => {
      setPfModal({ open: true, doc, name, uf, resolve });
    });
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
    const retList = ["irrf", "pis", "cofins", "csll", "inss", "iss"].map(t => {
      const v = Number(retentions[t] || 0);
      const pr = paramRetention(t.toUpperCase());
      return { type: t.toUpperCase(), value: v, partner_id: pr?.partner_id || "", partner_name: pr?.partner_name || "", account_id: pr?.account_id || "", account_name: pr?.account_name || "", account_code: pr?.account_code || "" };
    }).filter(r => r.value > 0);
    const missing = retList.find(r => !r.partner_id);
    if (missing) { setError(`Retenção ${missing.type} sem fornecedor configurado no parâmetro.`); return; }
    const totalRetido = retList.reduce((s, r) => s + r.value, 0);
    setSaving(true);
    try {
      let payload;
      if (mode === "xml") {
        if (!parsed) { setSaving(false); setError("Importe um XML."); return; }
        const supXml = await ensureSupplier(parsed.supplier.name, parsed.supplier.cpf_cnpj, parsed.supplier.uf, parsed.supplier.address, parsed.supplier.city);
        if (digits(parsed.supplier.cpf_cnpj) && !supXml) { setSaving(false); setError("Cadastro do fornecedor cancelado."); return; }
        const cfop = resolveCfop(parsed.nota.model, parsed.supplier.uf);
        payload = {
          user_email: user.email,
          entry_kind: "despesa",
          nota_model: parsed.nota.model,
          nota_number: parsed.nota.number,
          nota_series: parsed.nota.series,
          chave_acesso: parsed.nota.chave_acesso,
          issue_date: parsed.nota.issue_date ? new Date(parsed.nota.issue_date).toISOString() : new Date().toISOString(),
          entry_date: new Date().toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
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
        if (!manual.supplier_name.trim() && !manual.supplier_cnpj.trim()) { setSaving(false); setError("Informe o fornecedor (nome ou CNPJ/CPF)."); return; }
        if (!manual.total_nota || Number(manual.total_nota) <= 0) { setSaving(false); setError("Informe o total do documento."); return; }
        const supMan = await ensureSupplier(manual.supplier_name, manual.supplier_cnpj, manual.supplier_uf);
        if (digits(manual.supplier_cnpj) && !supMan) { setSaving(false); setError("Cadastro do fornecedor cancelado."); return; }
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
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          supplier_name: supMan?.name || manual.supplier_name,
          supplier_cnpj: supMan?.document || manual.supplier_cnpj,
          supplier_uf: supMan?.uf || manual.supplier_uf,
          nature_operation: manual.nature_operation || "Despesa",
          cfop: resolveCfop("NDF", manual.supplier_uf),
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

      payload.retentions = retList;
      payload.net_value = payload.total_nota - totalRetido;
      const entry = await base44.entities.ErpFiscalEntry.create(payload);
      // Contábil — lançamento contábil (débito nas contas do rateio, crédito em Fornecedores)
      try {
        await gerarContabilDespesa(user, entry, accounts, activeParam);
      } catch (e) {
        setError(`Despesa registrada, mas o lançamento contábil falhou: ${e.message}`);
        setSaving(false); onSaved?.(); onClose(); return;
      }
      // Financeiro — contas a pagar (líquido ao fornecedor + retenções, ou valor total se sem retenções)
      try {
        await gerarFinanceiroDespesa(user, entry);
      } catch (e) {
        setError(`Despesa e contábil gerados, mas falha ao criar contas a pagar: ${e.message}`);
      }
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const ready = mode === "xml" ? parsed : true;

  return (
    <>
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
              {parameters.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {activeParam && (
              <p className="text-[11px] text-indigo-700 mt-1">
                Operação: {activeParam.operation_name || "—"} • NF-e: {activeParam.cfop_nfe_dentro || "—"}/{activeParam.cfop_nfe_fora || "—"} • NFS-e: {activeParam.cfop_nfse_dentro || "—"}/{activeParam.cfop_nfse_fora || "—"}{companyUf ? ` (sua UF: ${companyUf})` : ""}
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
                  <div><span className="text-gray-500">CFOP Parâmetro:</span> <b className="font-mono">{resolveCfop(parsed.nota.model, parsed.supplier.uf) || "—"}</b></div>
                  <div><span className="text-gray-500">Origem:</span> {(parsed.supplier.uf || "").toUpperCase() === companyUf.toUpperCase() ? "Dentro do estado" : `Fora do estado${companyUf ? ` (sua UF: ${companyUf})` : ""}`}</div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Vencimento (financeiro)</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                </div>
              </div>
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
                  setores={sectors}
                  accounts={accounts}
                  accent="indigo"
                  title="Rateio do Lançamento (Setor / Conta Contábil)"
                />
              )}

              {(mode === "manual" || parsed?.nota.model === "NFSe") && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-3 py-2 border-b flex items-center gap-1.5"><Percent className="w-4 h-4 text-amber-700" /><h4 className="text-sm font-semibold">Retenções (serviço)</h4></div>
                  <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {["irrf", "pis", "cofins", "csll", "inss", "iss"].map(t => {
                      const pr = paramRetention(t.toUpperCase());
                      const val = retentions[t] || 0;
                      return (
                        <div key={t} className="border rounded-md p-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-600 uppercase">{t}</label>
                            {pr ? <span className="text-[10px] text-emerald-700 truncate ml-1">→ {pr.partner_name}</span> : val > 0 ? <span className="text-[10px] text-red-600">sem fornecedor</span> : null}
                          </div>
                          <input type="number" step="0.01" value={val} onChange={e => setRetentions(p => ({ ...p, [t]: Number(e.target.value) || 0 }))} className="w-full h-8 rounded border border-input px-2 text-right text-xs mt-1" />
                        </div>
                      );
                    })}
                  </div>
                  <p className="px-3 pb-2 text-[11px] text-gray-500">Valores retidos (lidos do XML ou digitados). Ao lançar, gera contas a pagar: valor líquido ao fornecedor da nota e cada retenção ao seu fornecedor configurado no parâmetro.</p>
                </div>
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
    {pfModal?.open && (
      <ErpPartnerFormModal
        user={user}
        prefill={{ document: pfModal.doc, name: pfModal.name, uf: pfModal.uf }}
        onClose={() => { pfModal.resolve?.(null); setPfModal(null); }}
        onSaved={(partner) => { setSuppliers(p => [...p, partner]); pfModal.resolve?.(partner); setPfModal(null); }}
      />
    )}
    </>
  );
}