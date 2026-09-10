import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Truck, Loader2, FileText, Keyboard } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Modal de importação/lançamento do frete (CT-e, NF-e ou NFS-e) com os campos
// completos de impostos (bases, alíquotas, CST e valores) e o vencimento do
// pagamento. O valor líquido (deduzidos os impostos) compõe o custo dos produtos
// e o vencimento gera a conta a pagar da transportadora no financeiro.
export default function ErpFreteModal({ operations, companyUF, initial, onClose, onConfirm }) {
  const [mode, setMode] = useState(initial ? "manual" : "xml");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    doc_model: initial?.doc_model || "57",
    doc_number: initial?.doc_number || "",
    doc_series: initial?.doc_series || "",
    chave_acesso: initial?.chave_acesso || "",
    issue_date: (initial?.issue_date || "").slice(0, 10) || today,
    due_date: (initial?.due_date || "").slice(0, 10) || today,
    supplier_name: initial?.supplier_name || "",
    supplier_cnpj: initial?.supplier_cnpj || "",
    supplier_uf: initial?.supplier_uf || "",
    address: initial?.address || "",
    city: initial?.city || "",
    value: initial?.value ?? "",
    base_icms: initial?.base_icms ?? "",
    aliq_icms: initial?.aliq_icms ?? "",
    icms_value: initial?.icms_value ?? "",
    base_pis_cofins: initial?.base_pis_cofins ?? "",
    aliq_pis: initial?.aliq_pis ?? "",
    aliq_cofins: initial?.aliq_cofins ?? "",
    cst_pis: initial?.cst_pis || "",
    cst_cofins: initial?.cst_cofins || "",
    pis_value: initial?.pis_value ?? "",
    cofins_value: initial?.cofins_value ?? "",
    operation_id: initial?.operation_id || "",
    cfop: initial?.cfop || "",
  });
  const setF = (patch) => setForm(p => ({ ...p, ...patch }));

  // CFOP do frete: prioriza os CFOPs cadastrados na operação (dentro/fora/importação);
  // sem operação, sugere pela UF da transportadora (mesma UF → 1, fora → 2, EX → 3)
  const skipCfop = useRef(!!initial);
  useEffect(() => {
    if (skipCfop.current) { skipCfop.current = false; return; }
    const uf = form.supplier_uf || "";
    const op = operations.find(o => o.id === form.operation_id);
    const dentro = uf && companyUF && uf === companyUF;
    const importacao = !uf || uf === "EX";
    const fromOp = op
      ? (importacao ? op.cfop_importacao : dentro ? op.cfop_dentro_estado : op.cfop_fora_estado) || (dentro ? op.cfop_fora_estado : op.cfop_dentro_estado) || ""
      : "";
    setF({ cfop: fromOp || (importacao ? "3351" : dentro ? "1351" : "2351") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.operation_id, form.supplier_uf, companyUF, operations]);

  // XML do frete (CT-e/NF-e/NFS-e): parseia e preenche o formulário (editável)
  const handleFile = async (file) => {
    setError(""); setParsing(true);
    try {
      const p = parseFiscalXml(await file.text());
      const t = p.totals || {};
      setForm(f => ({
        ...f,
        doc_model: p.nota.model || "57",
        doc_number: p.nota.number || "",
        doc_series: p.nota.series || "",
        chave_acesso: p.nota.chave_acesso || "",
        issue_date: (p.nota.issue_date || "").slice(0, 10) || f.issue_date,
        supplier_name: p.supplier.name || "",
        supplier_cnpj: p.supplier.cpf_cnpj || "",
        supplier_uf: p.supplier.uf || "",
        address: p.supplier.address || "",
        city: p.supplier.city || "",
        value: t.total_nota ?? "",
        icms_value: (Number(t.total_icms) || 0) > 0 ? t.total_icms : "",
        pis_value: (Number(t.total_pis) || 0) > 0 ? t.total_pis : "",
        cofins_value: (Number(t.total_cofins) || 0) > 0 ? t.total_cofins : "",
      }));
      setMode("manual");
    } catch (e) { setError(e.message || "Erro ao processar XML do frete."); }
    setParsing(false);
  };

  // Base/alíquota alteradas → recalcula o valor do imposto (valor continua editável)
  const onTax = (field, raw) => {
    const v = raw === "" ? "" : Number(raw);
    const next = { ...form, [field]: v };
    if (["base_icms", "aliq_icms"].includes(field)) next.icms_value = r2((Number(next.base_icms) || 0) * (Number(next.aliq_icms) || 0) / 100);
    if (["base_pis_cofins", "aliq_pis"].includes(field)) next.pis_value = r2((Number(next.base_pis_cofins) || 0) * (Number(next.aliq_pis) || 0) / 100);
    if (["base_pis_cofins", "aliq_cofins"].includes(field)) next.cofins_value = r2((Number(next.base_pis_cofins) || 0) * (Number(next.aliq_cofins) || 0) / 100);
    setForm(next);
  };

  const numField = (key, label, tax = false) => (
    <div>
      <label className="text-[10px] font-medium text-gray-500">{label}</label>
      <input type="number" step="0.01" value={form[key] ?? ""} onChange={e => tax ? onTax(key, e.target.value) : setF({ [key]: e.target.value === "" ? "" : Number(e.target.value) })} className="w-full h-8 rounded border border-input px-2 text-xs text-right" />
    </div>
  );
  const cstField = (key, label) => (
    <div>
      <label className="text-[10px] font-medium text-gray-500">{label}</label>
      <input value={form[key] ?? ""} onChange={e => setF({ [key]: String(e.target.value).toUpperCase().replace(/[^0-9]/g, "").slice(0, 3) })} placeholder="000" className="w-full h-8 rounded border border-input px-2 text-xs" />
    </div>
  );

  const handleConfirm = () => {
    setError("");
    if (!form.supplier_name.trim()) { setError("Informe a transportadora (fornecedor do frete)."); return; }
    if (!form.value || Number(form.value) <= 0) { setError("Informe o valor do frete."); return; }
    if (!form.operation_id) { setError("Selecione a operação do frete — ela define os impostos e o custo."); return; }
    if (!String(form.cfop || "").trim()) { setError("Informe o CFOP do frete."); return; }
    if (!form.due_date) { setError("Informe o vencimento do pagamento do frete."); return; }
    onConfirm({
      doc_model: form.doc_model,
      doc_number: form.doc_number.trim(),
      doc_series: form.doc_series.trim(),
      chave_acesso: form.chave_acesso.trim(),
      issue_date: form.issue_date ? new Date(`${form.issue_date}T12:00:00`).toISOString() : undefined,
      due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : undefined,
      supplier_name: form.supplier_name.trim(),
      supplier_cnpj: form.supplier_cnpj.trim(),
      supplier_uf: form.supplier_uf.toUpperCase().slice(0, 2),
      address: form.address,
      city: form.city,
      value: r2(form.value),
      base_icms: r2(form.base_icms), aliq_icms: r2(form.aliq_icms), icms_value: r2(form.icms_value),
      base_pis_cofins: r2(form.base_pis_cofins), aliq_pis: r2(form.aliq_pis), aliq_cofins: r2(form.aliq_cofins),
      cst_pis: form.cst_pis, cst_cofins: form.cst_cofins,
      pis_value: r2(form.pis_value), cofins_value: r2(form.cofins_value),
      operation_id: form.operation_id,
      operation_name: operations.find(o => o.id === form.operation_id)?.name || "",
      cfop: String(form.cfop).trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-sky-600" /> Frete — Importação / Lançamento (CT-e)</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button type="button" onClick={() => setMode("xml")} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "xml" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500"}`}><FileText className="w-4 h-4" /> Importar XML</button>
            <button type="button" onClick={() => setMode("manual")} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === "manual" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500"}`}><Keyboard className="w-4 h-4" /> Digitação Manual</button>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

          {mode === "xml" ? (
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-sky-300 rounded-xl p-8 text-center cursor-pointer hover:border-sky-500 hover:bg-sky-50/50 transition-colors">
              {parsing ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-10 h-10 animate-spin text-sky-600" /><p className="text-sm text-gray-500">Processando XML do frete...</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2"><FileText className="w-10 h-10 text-gray-400" /><p className="text-sm font-medium">Clique para selecionar o XML do Frete (CT-e, NF-e ou NFS-e)</p><p className="text-xs text-gray-400">Os dados preenchem o formulário abaixo e podem ser ajustados</p></div>
              )}
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Documento do Frete</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-500">Modelo *</label>
                    <select value={form.doc_model} onChange={e => setF({ doc_model: e.target.value })} className="w-full h-8 rounded border border-input bg-white px-2 text-xs">
                      <option value="57">CT-e</option>
                      <option value="55">NF-e</option>
                      <option value="NFSe">NFS-e</option>
                      <option value="OUT">Outro</option>
                    </select>
                  </div>
                  <div><label className="text-[10px] font-medium text-gray-500">Número</label><input value={form.doc_number} onChange={e => setF({ doc_number: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                  <div><label className="text-[10px] font-medium text-gray-500">Série</label><input value={form.doc_series} onChange={e => setF({ doc_series: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                  <div><label className="text-[10px] font-medium text-gray-500">Emissão</label><input type="date" value={form.issue_date} onChange={e => setF({ issue_date: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                  <div className="col-span-2"><label className="text-[10px] font-medium text-gray-500">Chave de Acesso</label><input value={form.chave_acesso} onChange={e => setF({ chave_acesso: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs font-mono" /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Transportadora (fornecedor do frete)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="col-span-2"><label className="text-[10px] font-medium text-gray-500">Fornecedor *</label><input value={form.supplier_name} onChange={e => setF({ supplier_name: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                  <div><label className="text-[10px] font-medium text-gray-500">CNPJ/CPF</label><input value={form.supplier_cnpj} onChange={e => setF({ supplier_cnpj: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                  <div><label className="text-[10px] font-medium text-gray-500">UF</label><input value={form.supplier_uf} onChange={e => setF({ supplier_uf: e.target.value.toUpperCase().slice(0, 2) })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Valor e Vencimento</p>
                <div className="grid grid-cols-2 gap-2">
                  {numField("value", "Valor do Frete (R$) *")}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500">Vencimento do Pagamento *</label>
                    <input type="date" value={form.due_date} onChange={e => setF({ due_date: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-2 bg-sky-50/40">
                <p className="text-xs font-semibold text-sky-900 mb-2">Impostos do Frete</p>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {numField("base_icms", "Base Cálculo ICMS", true)}
                  {numField("aliq_icms", "Alíq. ICMS %", true)}
                  {numField("icms_value", "Vlr ICMS")}
                  {numField("base_pis_cofins", "Base PIS/COFINS", true)}
                  {cstField("cst_pis", "CST PIS")}
                  {numField("aliq_pis", "Alíq. PIS %", true)}
                  {numField("pis_value", "Vlr PIS")}
                  {cstField("cst_cofins", "CST COFINS")}
                  {numField("aliq_cofins", "Alíq. COFINS %", true)}
                  {numField("cofins_value", "Vlr COFINS")}
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Ao alterar base/alíquota o valor é recalculado; os valores também podem ser digitados.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500">Operação do Frete *</label>
                  <select value={form.operation_id} onChange={e => setF({ operation_id: e.target.value })} className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs mt-1">
                    <option value="">Selecione a operação...</option>
                    {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500">CFOP do Frete *</label>
                  <input value={form.cfop} onChange={e => { setF({ cfop: e.target.value.replace(/\D/g, "").slice(0, 4) }); skipCfop.current = true; }} className="w-full h-8 rounded-md border border-input px-2 text-xs mt-1" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Mesma UF da empresa ({companyUF || "não cadastrada"}) → inicia com 1 (ex: 1351); fora da UF → inicia com 2 (ex: 2351).</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} className="bg-sky-600 hover:bg-sky-700 gap-1.5"><Truck className="w-4 h-4" /> Confirmar Frete</Button>
        </div>
      </div>
    </div>
  );
}