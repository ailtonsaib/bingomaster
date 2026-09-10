import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Truck, Loader2, FileText, Keyboard, Link2 } from "lucide-react";
import { parseFiscalXml } from "@/lib/erpXmlParse";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { aplicarCte } from "@/lib/erpCte";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const noteWeight = (rec) => (rec.items || []).reduce((s, it) => s + (Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)), 0);

// Modal de importação/lançamento de CT-e: importa o XML ou digita manualmente,
// com os impostos completos e o vencimento, e vincula o CT-e a uma ou mais notas
// (entradas do ERP ou vendas). O valor líquido é rateado proporcionalmente ao
// valor dos itens de cada nota compondo o custo dos produtos, e gera uma única
// conta a pagar para a transportadora.
export default function ErpCteModal({ user, onClose, onSaved }) {
  const [mode, setMode] = useState("xml");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);
  const [operations, setOperations] = useState([]);
  const [entries, setEntries] = useState([]);
  const [sales, setSales] = useState([]);
  const [companyUF, setCompanyUF] = useState("");
  const [selEnt, setSelEnt] = useState({});
  const [selVenda, setSelVenda] = useState({});
  const [form, setForm] = useState({
    doc_model: "57",
    doc_number: "",
    doc_series: "",
    chave_acesso: "",
    issue_date: today,
    due_date: today,
    supplier_name: "",
    supplier_cnpj: "",
    supplier_uf: "",
    value: "",
    base_icms: "", aliq_icms: "", icms_value: "",
    base_pis_cofins: "", aliq_pis: "", aliq_cofins: "",
    cst_pis: "", cst_cofins: "",
    pis_value: "", cofins_value: "",
    operation_id: "",
    cfop: "",
  });
  const setF = (patch) => setForm(p => ({ ...p, ...patch }));

  useEffect(() => {
    Promise.all([
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
      base44.entities.ErpFiscalEntry.filter({ user_email: user.email, entry_kind: "nf_entrada" }, "-entry_date", 300),
      base44.entities.ErpSalesOrder.filter({ user_email: user.email, status: { $ne: "cancelado" } }, "-emission_date", 300),
      base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 20),
    ]).then(([op, e, s, c]) => {
      setOperations(op); setEntries(e); setSales(s);
      setCompanyUF((c.find(x => x.is_main) || c[0] || {}).uf || "");
    }).catch(() => {});
  }, [user.email]);

  // CFOP do frete: prioriza os CFOPs cadastrados na operação (dentro/fora/importação);
  // sem operação, sugere pela UF da transportadora (mesma UF → 1, fora → 2, EX → 3)
  const skipCfop = useRef(true);
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

  // XML do CT-e: parseia e preenche o formulário (editável)
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
        value: t.total_nota ?? "",
        icms_value: (Number(t.total_icms) || 0) > 0 ? t.total_icms : "",
        pis_value: (Number(t.total_pis) || 0) > 0 ? t.total_pis : "",
        cofins_value: (Number(t.total_cofins) || 0) > 0 ? t.total_cofins : "",
      }));
      setMode("manual");
    } catch (e) { setError(e.message || "Erro ao processar XML do CT-e."); }
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

  // Valor líquido do frete (deduzidos os impostos a creditar) — base do rateio
  const net = r2((Number(form.value) || 0) - (Number(form.icms_value) || 0) - (Number(form.pis_value) || 0) - (Number(form.cofins_value) || 0));

  const selList = [
    ...entries.filter(e => selEnt[e.id]).map(e => ({ kind: "entrada", rec: e })),
    ...sales.filter(s => selVenda[s.id]).map(s => ({ kind: "venda", rec: s })),
  ];
  const totalSelWeight = selList.reduce((s, x) => s + noteWeight(x.rec), 0);
  const shareOf = (rec) => totalSelWeight > 0 && net > 0 ? r2(net * (noteWeight(rec) / totalSelWeight)) : 0;

  const handleConfirm = async () => {
    setError("");
    if (!form.doc_number.trim()) { setError("Informe o número do CT-e."); return; }
    if (!form.supplier_name.trim()) { setError("Informe a transportadora."); return; }
    if (!form.value || Number(form.value) <= 0) { setError("Informe o valor do frete."); return; }
    if (!form.operation_id) { setError("Selecione a operação do frete — ela define os impostos e o custo."); return; }
    if (!String(form.cfop || "").trim()) { setError("Informe o CFOP do frete."); return; }
    if (!form.due_date) { setError("Informe o vencimento do pagamento do frete."); return; }
    if (selList.length === 0) { setError("Vincule o CT-e a pelo menos uma nota (entrada ou venda)."); return; }
    if (net <= 0) { setError("O valor líquido do frete (valor deduzidos ICMS/PIS/COFINS) deve ser maior que zero."); return; }
    setSaving(true);
    try {
      const op = operations.find(o => o.id === form.operation_id);
      const links = selList.map(({ kind, rec }) => ({
        kind,
        id: rec.id,
        number: kind === "venda" ? rec.number : rec.nota_number,
        name: kind === "venda" ? rec.customer_name : rec.supplier_name,
        total: r2(noteWeight(rec)),
        share_value: shareOf(rec),
      }));
      const created = await base44.entities.ErpCte.create({
        user_email: user.email,
        doc_model: form.doc_model,
        doc_number: form.doc_number.trim(),
        doc_series: form.doc_series.trim(),
        chave_acesso: form.chave_acesso.trim(),
        issue_date: form.issue_date ? new Date(`${form.issue_date}T12:00:00`).toISOString() : undefined,
        due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : undefined,
        supplier_name: form.supplier_name.trim(),
        supplier_cnpj: form.supplier_cnpj.trim(),
        supplier_uf: form.supplier_uf.toUpperCase().slice(0, 2),
        value: r2(form.value),
        base_icms: r2(form.base_icms), aliq_icms: r2(form.aliq_icms), icms_value: r2(form.icms_value),
        base_pis_cofins: r2(form.base_pis_cofins), aliq_pis: r2(form.aliq_pis), aliq_cofins: r2(form.aliq_cofins),
        cst_pis: form.cst_pis, cst_cofins: form.cst_cofins,
        pis_value: r2(form.pis_value), cofins_value: r2(form.cofins_value),
        operation_id: form.operation_id,
        operation_name: op?.name || "",
        cfop: String(form.cfop).trim(),
        net_value: net,
        links,
        financeiro_gerado: false,
      });
      const res = await aplicarCte(user, { ...created, links });
      await base44.entities.ErpCte.update(created.id, { financeiro_gerado: true });
      alert(`CT-e importado: frete líquido de ${fmtMoney(res.net)} rateado entre ${links.length} nota(s), ${res.updatedProducts} produto(s) com custo atualizado e conta a pagar da transportadora gerada no vencimento.`);
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-sky-600" /> Importar CT-e — Frete com Vínculo de Notas</h3>
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
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-10 h-10 animate-spin text-sky-600" /><p className="text-sm text-gray-500">Processando XML do CT-e...</p></div>
              ) : (
                <div className="flex flex-col items-center gap-2"><FileText className="w-10 h-10 text-gray-400" /><p className="text-sm font-medium">Clique para selecionar o XML do CT-e (ou NF-e/NFS-e de frete)</p><p className="text-xs text-gray-400">Os dados preenchem o formulário abaixo e podem ser ajustados</p></div>
              )}
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          ) : (
            <>
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
                <div><label className="text-[10px] font-medium text-gray-500">Número *</label><input value={form.doc_number} onChange={e => setF({ doc_number: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                <div><label className="text-[10px] font-medium text-gray-500">Série</label><input value={form.doc_series} onChange={e => setF({ doc_series: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                <div><label className="text-[10px] font-medium text-gray-500">Emissão</label><input type="date" value={form.issue_date} onChange={e => setF({ issue_date: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                <div className="col-span-2"><label className="text-[10px] font-medium text-gray-500">Transportadora *</label><input value={form.supplier_name} onChange={e => setF({ supplier_name: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                <div><label className="text-[10px] font-medium text-gray-500">CNPJ/CPF</label><input value={form.supplier_cnpj} onChange={e => setF({ supplier_cnpj: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                <div><label className="text-[10px] font-medium text-gray-500">UF</label><input value={form.supplier_uf} onChange={e => setF({ supplier_uf: e.target.value.toUpperCase().slice(0, 2) })} className="w-full h-8 rounded border border-input px-2 text-xs" /></div>
                {numField("value", "Valor do Frete (R$) *")}
                <div>
                  <label className="text-[10px] font-medium text-gray-500">Vencimento do Pagamento *</label>
                  <input type="date" value={form.due_date} onChange={e => setF({ due_date: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" />
                </div>
                <div className="col-span-2 flex items-end">
                  <div className="w-full bg-sky-50 border border-sky-200 rounded px-2 py-1 text-xs text-sky-800">Valor líquido a ratear (deduzidos ICMS/PIS/COFINS): <b>{fmtMoney(net)}</b></div>
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

              {/* Notas vinculadas — o valor líquido é rateado proporcionalmente */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold">Notas Vinculadas *</h4>
                  <span className="text-[10px] text-gray-400">o valor líquido ({fmtMoney(net)}) é dividido proporcionalmente ao valor dos itens de cada nota</span>
                </div>
                <div className="p-2 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-600 mb-1">Notas de Entrada</p>
                    <div className="border rounded max-h-40 overflow-y-auto">
                      {entries.length === 0 && <p className="text-xs text-gray-400 p-2">Nenhuma nota de entrada.</p>}
                      {entries.map(e => (
                        <label key={e.id} className="flex items-center gap-2 p-1.5 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer text-xs">
                          <input type="checkbox" checked={!!selEnt[e.id]} onChange={ev => setSelEnt(p => ({ ...p, [e.id]: ev.target.checked }))} />
                          <span className="font-mono w-28 truncate">{e.nota_number}</span>
                          <span className="flex-1 truncate">{e.supplier_name}</span>
                          {e.freight && <span className="text-[10px] text-amber-600 whitespace-nowrap">frete próprio</span>}
                          <span className="text-gray-400 text-[10px] whitespace-nowrap">{fmtDate(e.issue_date)}</span>
                          <span className="w-24 text-right">{fmtMoney(e.total_nota)}</span>
                          <span className="w-24 text-right text-sky-700 font-medium">{selEnt[e.id] ? fmtMoney(shareOf(e)) : "—"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-600 mb-1">Vendas (Pedidos Faturados)</p>
                    <div className="border rounded max-h-40 overflow-y-auto">
                      {sales.length === 0 && <p className="text-xs text-gray-400 p-2">Nenhuma venda.</p>}
                      {sales.map(s => (
                        <label key={s.id} className="flex items-center gap-2 p-1.5 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer text-xs">
                          <input type="checkbox" checked={!!selVenda[s.id]} onChange={ev => setSelVenda(p => ({ ...p, [s.id]: ev.target.checked }))} />
                          <span className="font-mono w-28 truncate">{s.number}</span>
                          <span className="flex-1 truncate">{s.customer_name}</span>
                          <span className="text-gray-400 text-[10px] whitespace-nowrap">{fmtDate(s.emission_date)}</span>
                          <span className="w-24 text-right">{fmtMoney(s.total)}</span>
                          <span className="w-24 text-right text-sky-700 font-medium">{selVenda[s.id] ? fmtMoney(shareOf(s)) : "—"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {selList.length > 0 && (
                    <p className="text-[11px] text-emerald-700 font-medium text-right">
                      {selList.length} nota(s) selecionada(s) — rateio soma {fmtMoney(selList.reduce((s, x) => s + shareOf(x.rec), 0))}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving} className="bg-sky-600 hover:bg-sky-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Importar e Vincular
          </Button>
        </div>
      </div>
    </div>
  );
}