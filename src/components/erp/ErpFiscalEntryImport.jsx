import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, ArrowDownToLine, Keyboard, Plus, Trash2, Link2, UserPlus, Package } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import ErpApportionmentEditor from "@/components/erp/ErpApportionmentEditor";

const digits = (v) => String(v || "").replace(/\D/g, "");

// Modal de entrada de documento (NF-e/NFS-e por XML ou digitação manual).
// XML: cadastra o fornecedor automaticamente se não existir, e vincula cada item
// ao produto meu através do código do fornecedor (cProd). Se não houver vínculo
// e o usuário não informar um produto destino, cria o produto e o vínculo.
export default function ErpFiscalEntryImport({ user, onClose, onSaved, onGoToProducts }) {
  const [mode, setMode] = useState("xml");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [operations, setOperations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [links, setLinks] = useState([]);
  const [poId, setPoId] = useState("");
  const [opId, setOpId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [manualApportionments, setManualApportionments] = useState([]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  // Vínculo por item (XML): product_id selecionado, "new" para criar novo, ou "" (auto = cria novo)
  const [itemChoices, setItemChoices] = useState([]);
  const [supplierStatus, setSupplierStatus] = useState(""); // "exists" | "will_create" | ""
  const fileRef = useRef(null);

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
      base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500),
      base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpProductSupplier.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpDepartment.filter({ user_email: user.email, is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true }, "code", 500),
    ]).then(([o, op, s, p, l, d, acc]) => { setOrders(o); setOperations(op); setSuppliers(s); setProducts(p); setLinks(l); setDepartments(d); setAccounts(acc); }).catch(() => {});
  }, [user.email]);

  const selectedPo = orders.find(o => o.id === poId);
  const nfTotal = mode === "xml" ? parsed?.totals.total_nota : Number(manual.total_nota || 0);
  const diff = selectedPo ? nfTotal - (selectedPo.total_value || 0) : 0;
  const match = selectedPo ? Math.abs(diff) < 0.01 : false;

  // Resolve fornecedor e vínculos por item quando o XML é parseado
  useEffect(() => {
    if (mode !== "xml" || !parsed) { setSupplierStatus(""); setItemChoices([]); return; }
    const doc = digits(parsed.supplier.cpf_cnpj);
    const existing = suppliers.find(s => s.document === doc);
    setSupplierStatus(existing ? "exists" : "will_create");
    // Pré-vincula itens que já tenham link (supplier_document + supplier_product_code)
    const docLinks = links.filter(l => digits(l.supplier_document) === doc);
    setItemChoices(parsed.items.map(it => {
      const lk = docLinks.find(l => l.supplier_product_code === it.product_code);
      return lk?.product_id || "new";
    }));
  }, [parsed, mode, suppliers, links]);

  const supplierDoc = parsed ? digits(parsed.supplier.cpf_cnpj) : digits(manual.supplier_cnpj);

  const handleFile = async (file) => {
    setError(""); setParsed(null); setParsing(true);
    try { setParsed(parseFiscalXml(await file.text())); }
    catch (e) { setError(e.message || "Erro ao processar XML."); }
    setParsing(false);
  };

  // Cria/atualiza fornecedor a partir do documento; retorna o registro ErpPartner
  const ensureSupplier = async (name, docRaw, uf, address, city) => {
    const doc = digits(docRaw);
    if (!doc) return null;
    const existing = suppliers.find(s => s.document === doc);
    if (existing) return existing;
    const created = await base44.entities.ErpPartner.create({
      user_email: user.email,
      partner_type: "fornecedor",
      document_type: doc.length <= 11 ? "cpf" : "cnpj",
      document: doc,
      name: name || "Fornecedor sem nome",
      uf: uf || undefined,
      address: address || undefined,
      city: city || undefined,
      is_active: true,
    });
    setSuppliers(p => [...p, created]);
    return created;
  };

  // Cria um novo produto a partir do item da NF
  const createProductFromItem = async (it) => {
    const code = it.product_code || `NF${Date.now().toString().slice(-6)}`;
    const barcode = it.barcode && /^\d+$/.test(it.barcode) ? it.barcode : undefined;
    const created = await base44.entities.ErpProduct.create({
      user_email: user.email,
      code, barcode,
      name: it.product_name || "Produto sem descrição",
      product_type: "mercadoria",
      ncm: it.ncm || undefined,
      unit: it.unit || "UN",
      cost_price: it.unit_price || 0,
      sale_price: 0,
      is_active: true,
      notes: "Cadastrado automaticamente na entrada de NF — ajuste categoria e contas.",
    });
    setProducts(p => [...p, created]);
    return created;
  };

  // Cria/atualiza o vínculo fornecedor↔produto (cProd)
  const ensureLink = async (supplier, product, item) => {
    const doc = digits(supplier.document);
    const existing = links.find(l => digits(l.supplier_document) === doc && l.product_id === product.id);
    if (existing) {
      const updated = await base44.entities.ErpProductSupplier.update(existing.id, {
        supplier_product_code: item.product_code || existing.supplier_product_code,
        supplier_product_name: item.product_name || existing.supplier_product_name,
        unit: item.unit || existing.unit,
        last_unit_cost: item.unit_price || existing.last_unit_cost,
        last_purchased_date: new Date().toISOString(),
      });
      setLinks(p => p.map(l => l.id === updated.id ? updated : l));
      return updated;
    }
    const created = await base44.entities.ErpProductSupplier.create({
      user_email: user.email,
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      supplier_document: supplier.document,
      supplier_product_code: item.product_code || "",
      supplier_product_name: item.product_name || "",
      unit: item.unit || "UN",
      last_unit_cost: item.unit_price || 0,
      last_purchased_date: new Date().toISOString(),
    });
    setLinks(p => [...p, created]);
    return created;
  };

  const handleSave = async () => {
    setError("");
    const hasPo = !!poId;
    const po = selectedPo;
    const op = operations.find(o => o.id === opId);
    // Entrada sem OC: exige rateio (setor + conta) preenchido e soma 100%
    if (!hasPo) {
      const aps = manualApportionments.filter(a => a.department_id && a.account_id);
      if (aps.length === 0) { setError("Informe o setor e a conta contábil do rateio — entrada sem ordem de compra."); return; }
      const pctSum = aps.reduce((s, a) => s + (Number(a.percent) || 0), 0);
      if (Math.abs(pctSum - 100) > 0.01) { setError(`A soma do rateio (${pctSum.toFixed(2)}%) deve ser 100%.`); return; }
    }
    setSaving(true);
    try {
      // 1. Garante o fornecedor (XML ou manual)
      let supplier = null;
      if (mode === "xml" && parsed) {
        supplier = await ensureSupplier(parsed.supplier.name, parsed.supplier.cpf_cnpj, parsed.supplier.uf, parsed.supplier.address, parsed.supplier.city);
      } else if (mode === "manual" && manual.supplier_name.trim()) {
        supplier = await ensureSupplier(manual.supplier_name, manual.supplier_cnpj, manual.supplier_uf);
      }

      let payload;
      let newProductsCount = 0;

      if (mode === "xml") {
        if (!parsed) { setSaving(false); setError("Importe um XML."); return; }
        // 2. Resolve cada item → produto meu + vínculo
        const resolvedItems = [];
        for (let i = 0; i < parsed.items.length; i++) {
          const it = parsed.items[i];
          const choice = itemChoices[i] || "new";
          let product = null;
          if (choice === "new") {
            product = await createProductFromItem(it);
            newProductsCount++;
          } else {
            product = products.find(p => p.id === choice) || null;
          }
          if (supplier && product) {
            await ensureLink(supplier, product, it);
          }
          resolvedItems.push({ ...it, product_id: product?.id || undefined, product_code: product?.code || it.product_code });
        }
        const valueDiff = parsed.totals.total_nota - (po?.total_value || 0);
        const valuesMatch = Math.abs(valueDiff) < 0.01;
        payload = {
          user_email: user.email,
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
          cfop: parsed.nota.cfop,
          total_products: parsed.totals.total_products,
          total_nota: parsed.totals.total_nota,
          total_icms: parsed.totals.total_icms,
          total_ipi: parsed.totals.total_ipi,
          total_pis: parsed.totals.total_pis,
          total_cofins: parsed.totals.total_cofins,
          items: resolvedItems,
          purchase_order_id: hasPo ? po.id : undefined,
          purchase_order_number: hasPo ? po.order_number : undefined,
          po_total_value: hasPo ? (po.total_value || 0) : 0,
          value_diff: hasPo ? valueDiff : 0,
          values_match: hasPo ? valuesMatch : true,
          operation_id: op?.id || undefined,
          operation_name: op?.name || undefined,
          apportionments: hasPo ? (po.apportionments || []) : manualApportionments,
          status: !hasPo || valuesMatch ? "aprovada" : "pendente",
          approval_status: !hasPo || valuesMatch ? "nao_aplica" : "aguardando_aprovacao",
        };
      } else {
        if (!manual.nota_number.trim()) { setSaving(false); setError("Informe o número do documento."); return; }
        if (!manual.supplier_name.trim()) { setSaving(false); setError("Informe o fornecedor."); return; }
        if (!manual.total_nota || Number(manual.total_nota) <= 0) { setSaving(false); setError("Informe o total do documento."); return; }
        const total = Number(manual.total_nota);
        const items = manualItems.filter(it => it.product_name.trim() && it.quantity > 0).map(it => ({
          product_name: it.product_name, quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
          ncm: "", cfop: "", unit: "UN",
        }));
        const valueDiff = total - (po?.total_value || 0);
        const valuesMatch = Math.abs(valueDiff) < 0.01;
        payload = {
          user_email: user.email,
          nota_model: "NDF",
          nota_number: manual.nota_number,
          nota_series: "",
          chave_acesso: "",
          issue_date: manual.issue_date ? new Date(manual.issue_date).toISOString() : new Date().toISOString(),
          entry_date: new Date().toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          supplier_name: manual.supplier_name,
          supplier_cnpj: manual.supplier_cnpj,
          supplier_uf: manual.supplier_uf,
          nature_operation: manual.nature_operation || "Documento Não Fiscal",
          cfop: manual.cfop,
          total_products: items.reduce((a, it) => a + it.total, 0),
          total_nota: total,
          total_icms: 0, total_ipi: 0, total_pis: 0, total_cofins: 0,
          items,
          purchase_order_id: hasPo ? po.id : undefined,
          purchase_order_number: hasPo ? po.order_number : undefined,
          po_total_value: hasPo ? (po.total_value || 0) : 0,
          value_diff: hasPo ? valueDiff : 0,
          values_match: hasPo ? valuesMatch : true,
          operation_id: op?.id || undefined,
          operation_name: op?.name || undefined,
          apportionments: hasPo ? (po.apportionments || []) : manualApportionments,
          status: !hasPo || valuesMatch ? "aprovada" : "pendente",
          approval_status: !hasPo || valuesMatch ? "nao_aplica" : "aguardando_aprovacao",
        };
      }

      await base44.entities.ErpFiscalEntry.create(payload);
      onSaved?.();
      onClose();
      if (newProductsCount > 0 && onGoToProducts) {
        alert(`${newProductsCount} produto(s) cadastrado(s) automaticamente a partir da NF. Abrindo o Cadastro de Produtos para ajustes.`);
        onGoToProducts();
      }
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
              {/* Status do fornecedor */}
              <div className={`rounded-lg p-2.5 border flex items-center gap-2 text-xs ${supplierStatus === "exists" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : supplierStatus === "will_create" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                {supplierStatus === "exists" ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {supplierStatus === "exists" ? `Fornecedor já cadastrado: ${parsed.supplier.name}` : supplierStatus === "will_create" ? `Fornecedor não cadastrado — será criado automaticamente: ${parsed.supplier.name} (CNPJ ${parsed.supplier.cpf_cnpj})` : "Analisando fornecedor..."}
              </div>

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

              {/* Itens com vínculo de produto destino */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b flex items-center gap-2"><Link2 className="w-4 h-4 text-indigo-600" /><h4 className="text-sm font-semibold">Itens ({parsed.items.length}) — Vínculo de Produto</h4></div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0"><tr><th className="p-2 text-left">Produto do Fornecedor (cProd)</th><th className="p-2 text-left w-56">Produto Meu (destino)</th><th className="p-2 text-right">Qtd</th><th className="p-2 text-right">Total</th></tr></thead>
                    <tbody>
                      {parsed.items.map((it, i) => {
                        const choice = itemChoices[i] || "new";
                        const matched = choice !== "new" && choice !== "";
                        return (
                          <tr key={i} className="border-b">
                            <td className="p-2">
                              <div className="font-mono text-[11px] text-gray-500">{it.product_code}</div>
                              <div className="text-gray-800">{it.product_name}</div>
                              <div className="text-[10px] text-gray-400">NCM {it.ncm} • CFOP {it.cfop}</div>
                            </td>
                            <td className="p-2">
                              <select value={choice} onChange={e => setItemChoices(p => p.map((c, idx) => idx === i ? e.target.value : c))} className={`w-full h-9 rounded-md border px-2 text-xs ${matched ? "border-emerald-300 bg-emerald-50" : "border-input"}`}>
                                <option value="new">+ Criar novo produto</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
                              </select>
                              {matched && <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5"><Link2 className="w-3 h-3" /> vinculado</span>}
                            </td>
                            <td className="p-2 text-right">{it.quantity}</td>
                            <td className="p-2 text-right font-medium">{it.total.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 px-3 py-2 border-t text-[11px] text-gray-500 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Itens sem vínculo criarão um novo produto automaticamente vinculado ao código do fornecedor. Na próxima NF deste fornecedor, o sistema reconhecerá o produto pelo cProd.</div>
              </div>
            </div>
          )}

          {/* === MODO MANUAL === */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">Use este modo para documentos não fiscais (recibo, cupom, fatura manual, etc.). Se o fornecedor não existir, será cadastrado automaticamente.</div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Vencimento (financeiro)</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-9 rounded-md border border-input px-3 text-sm" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Ordem de Compra (opcional)</label>
                  <select value={poId} onChange={e => setPoId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Sem ordem de compra (despesa/serviço)</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.supplier_name || "—"} ({fmtMoney(o.total_value)})</option>)}
                  </select>
                  {!poId && <p className="text-[11px] text-amber-600 mt-1">Entrada avulsa: informe abaixo o setor e a conta contábil para o lançamento.</p>}
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

              {!poId && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <AlertTriangle className="w-4 h-4" />
                    Entrada sem ordem de compra — despesa/serviço sem controle de estoque. Informe o rateio (setor + conta contábil) para o lançamento contábil.
                  </div>
                  <ErpApportionmentEditor
                    apportionments={manualApportionments}
                    onChange={setManualApportionments}
                    setores={departments}
                    accounts={accounts}
                    accent="amber"
                    title="Rateio do Lançamento (Setor / Conta Contábil)"
                  />
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