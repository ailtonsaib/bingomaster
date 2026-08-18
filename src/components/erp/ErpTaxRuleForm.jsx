import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Copy, X } from "lucide-react";
import { ICMS_INTERNAL_RATES, interestadualRate, computeErpFiscalItem, num } from "@/lib/erpTaxCalc";

const BR_UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const CST_ICMS = [
  { value: "00", label: "00 - Tributada integralmente" },
  { value: "10", label: "10 - Tributada (cobrança por dentro)" },
  { value: "20", label: "20 - Com redução de base" },
  { value: "30", label: "30 - Isenta/não trib. e cobrança por substituição" },
  { value: "40", label: "40 - Isenta" },
  { value: "41", label: "41 - Não tributada" },
  { value: "50", label: "50 - Suspensão" },
  { value: "51", label: "51 - Diferimento" },
  { value: "60", label: "60 - Cobrado anteriormente" },
  { value: "70", label: "70 - Redução base e substituição" },
  { value: "90", label: "90 - Outros" },
];
const CST_PIS_COFINS_SAIDA = [
  { value: "01", label: "01 - Operação Tributável c/ Alíquota Básica" },
  { value: "02", label: "02 - Operação Tributável c/ Alíquota Diferenciada" },
  { value: "03", label: "03 - Operação Tributável c/ Alíquota por Unidade de Medida" },
  { value: "04", label: "04 - Operação Tributável Monofásica (Combustíveis)" },
  { value: "05", label: "05 - Operação Tributável por Substituição Tributária" },
  { value: "06", label: "06 - Operação Tributável a Alíquota Zero" },
  { value: "07", label: "07 - Operação Isenta da Contribuição" },
  { value: "08", label: "08 - Operação sem Incidência da Contribuição" },
  { value: "09", label: "09 - Operação c/ Suspensão da Contribuição" },
  { value: "49", label: "49 - Outras Operações de Saída" },
];
const CST_PIS_COFINS_ENTRADA = [
  { value: "50", label: "50 - Crédito - Vinc. Exclusivamente a Receita Tributada MI" },
  { value: "51", label: "51 - Crédito - Vinc. Exclusivamente a Receita Não Tributada MI" },
  { value: "52", label: "52 - Crédito - Vinc. Exclusivamente a Receita de Exportação" },
  { value: "53", label: "53 - Crédito - Vinc. a Receitas Tributadas e Não Tributadas MI" },
  { value: "54", label: "54 - Crédito - Vinc. a Receitas Trib. MI e Exportação" },
  { value: "55", label: "55 - Crédito - Vinc. a Receitas Não Trib. MI e Exportação" },
  { value: "56", label: "56 - Crédito - Vinc. a Receitas Trib./Não Trib. MI e Export." },
  { value: "60", label: "60 - Crédito Presumido - Aquisição Vinc. Exclusiv. Receita Trib. MI" },
  { value: "61", label: "61 - Crédito Presumido - Aquisição Vinc. Exclusiv. Receita Não Trib. MI" },
  { value: "62", label: "62 - Crédito Presumido - Aquisição Vinc. Exclusiv. Receita Exportação" },
  { value: "63", label: "63 - Crédito Presumido - Aquisição Vinc. Receitas Trib. e Não Trib. MI" },
  { value: "64", label: "64 - Crédito Presumido - Aquisição Vinc. Receitas Trib. MI e Export." },
  { value: "65", label: "65 - Crédito Presumido - Aquisição Vinc. Receitas Não Trib. MI e Export." },
  { value: "66", label: "66 - Crédito Presumido - Aquisição Vinc. Receitas Trib./Não Trib. MI e Export." },
  { value: "67", label: "67 - Crédito Presumido - Aquisição Vinc. Exclusiv. Receita Tributada MI" },
  { value: "70", label: "70 - Operação de Aquisição sem Direito a Crédito" },
  { value: "71", label: "71 - Operação de Aquisição com Isenção" },
  { value: "72", label: "72 - Operação de Aquisição com Suspensão" },
  { value: "73", label: "73 - Operação de Aquisição a Alíquota Zero" },
  { value: "74", label: "74 - Operação de Aquisição sem Incidência" },
  { value: "75", label: "75 - Operação de Aquisição por Substituição Tributária" },
  { value: "98", label: "98 - Outras Operações de Entrada" },
  { value: "99", label: "99 - Outras Operações" },
];
const CST_IPI_ENTRADA = [
  { value: "00", label: "00 - Entrada com Recuperação de Crédito" },
  { value: "01", label: "01 - Entrada Tributada com Alíquota Zero" },
  { value: "02", label: "02 - Entrada Isenta" },
  { value: "03", label: "03 - Entrada Não-Tributada" },
  { value: "04", label: "04 - Entrada Imune" },
  { value: "05", label: "05 - Entrada com Suspensão" },
  { value: "49", label: "49 - Outras Entradas" },
];
const CST_IPI_SAIDA = [
  { value: "50", label: "50 - Saída Tributada" },
  { value: "51", label: "51 - Saída Tributada com Alíquota Zero" },
  { value: "52", label: "52 - Saída Isenta" },
  { value: "53", label: "53 - Saída Não-Tributada" },
  { value: "54", label: "54 - Saída Imune" },
  { value: "55", label: "55 - Saída com Suspensão" },
  { value: "99", label: "99 - Outras Saídas" },
];
const CST_CBS_IBS = [
  { value: "00", label: "00 - Tributada" },
  { value: "01", label: "01 - Monofásica" },
  { value: "02", label: "02 - Isenta" },
  { value: "03", label: "03 - Não tributada" },
  { value: "04", label: "04 - Imune" },
  { value: "05", label: "05 - Suspensão" },
  { value: "90", label: "90 - Outros" },
];
const DESTINATARIO_TIPOS = [
  { value: "contribuinte", label: "Contribuinte (ICMS normal)" },
  { value: "nao_contribuinte", label: "Não contribuinte (DIFAL interestadual)" },
  { value: "pessoa_fisica", label: "Pessoa física (consumidor final — DIFAL)" },
];

function SectionTitle({ children, color = "text-slate-700" }) {
  return (
    <div className={`text-center font-semibold tracking-wide uppercase text-xs ${color} border-b border-slate-300 pb-1 mb-2`}>
      {children}
    </div>
  );
}
function Field({ label, children, full }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      {children}
    </div>
  );
}
const numInput = "w-full h-8 rounded border border-slate-300 px-2 text-xs";
const selInput = "w-full h-8 rounded border border-slate-300 px-2 text-xs bg-white";

function RadioSimNao({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs whitespace-nowrap">
      <span className="text-gray-600">{label}</span>
      <button type="button" onClick={() => onChange(false)} className={`px-1.5 py-0.5 rounded border text-[10px] ${!checked ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-600 border-slate-300"}`}>Não</button>
      <button type="button" onClick={() => onChange(true)} className={`px-1.5 py-0.5 rounded border text-[10px] ${checked ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-600 border-slate-300"}`}>Sim</button>
    </label>
  );
}

export default function ErpTaxRuleForm({ user, rule, operations, onClose, onSaved }) {
  const blank = {
    operation_id: "", operation_name: "", operation_type: "", cfop: "",
    ncm: "", uf: "", destinatario_tipo: "contribuinte", description: "",
    cst_icms: "00", icms_rate: 0, icms_reduction_base: 100, fcp_rate: 0,
    cst_pis: "01", pis_rate: 0, pis_reduction_base: 100,
    cst_cofins: "01", cofins_rate: 0, cofins_reduction_base: 100,
    deduz_icms_pis_cofins: false,
    cst_ipi: "99", ipi_rate: 0, ipi_reduction_base: 100,
    cst_cbs: "00", cbs_rate: 0, cbs_reduction_base: 100,
    cst_ibs: "00", ibs_rate: 0, ibs_reduction_base: 100,
    difal_enabled: false, aliq_interna_destino: 0, aliq_interestadual: 0, fcp_destino_rate: 0, difal_percent_destination: 100,
    st_enabled: false, cst_icms_st: "10", st_base_method: "mva", mva_rate: 0, mva_ajusted_rate: 0, icms_st_rate: 0, icms_st_reduction_base: 100, pauta_value: 0, pauta_unit: "UN", fcp_st_rate: 0,
    is_active: true,
  };
  const [form, setForm] = useState({ ...blank, ...(rule || {}) });
  const [tab, setTab] = useState("geral");
  const [saving, setSaving] = useState(false);
  const [replicar, setReplicar] = useState(false);
  const [replicarUFs, setReplicarUFs] = useState([]);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Auto-preenchimento das alíquotas do DIFAL conforme UF/destinatário.
  useEffect(() => {
    const op = operations.find(o => o.id === form.operation_id);
    if (!op) return;
    const cfop = String(op.cfop || "");
    const interestadual = cfop.startsWith("6") || cfop.startsWith("1");
    // Não contribuinte / pessoa física em operação interestadual -> habilita DIFAL automaticamente
    if (interestadual && (form.destinatario_tipo === "nao_contribuinte" || form.destinatario_tipo === "pessoa_fisica")) {
      setForm(prev => prev.difal_enabled ? prev : { ...prev, difal_enabled: true });
    }
    if (form.uf && (!form.aliq_interna_destino || Number(form.aliq_interna_destino) === 0)) {
      set("aliq_interna_destino", ICMS_INTERNAL_RATES[form.uf] || 0);
    }
    if (form.uf && interestadual && (!form.aliq_interestadual || Number(form.aliq_interestadual) === 0)) {
      set("aliq_interestadual", interestadualRate(form.uf));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.uf, form.operation_id, form.destinatario_tipo]);

  // Corrige CST legado ao editar (conforme tipo da operação)
  useEffect(() => {
    if (!form.operation_type) return;
    const list = form.operation_type === "entrada" ? CST_PIS_COFINS_ENTRADA : CST_PIS_COFINS_SAIDA;
    const listIpi = form.operation_type === "entrada" ? CST_IPI_ENTRADA : CST_IPI_SAIDA;
    setForm(prev => {
      const next = { ...prev };
      if (!list.some(o => o.value === next.cst_pis)) next.cst_pis = list[0]?.value || "";
      if (!list.some(o => o.value === next.cst_cofins)) next.cst_cofins = list[0]?.value || "";
      if (!listIpi.some(o => o.value === next.cst_ipi)) next.cst_ipi = listIpi[0]?.value || "";
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onOp = (id) => {
    const op = operations.find(o => o.id === id);
    const newType = op?.type || "";
    setForm(prev => {
      const next = { ...prev, operation_id: id, operation_name: op?.name || "", operation_type: newType, cfop: op?.cfop || "" };
      const list = newType === "entrada" ? CST_PIS_COFINS_ENTRADA : CST_PIS_COFINS_SAIDA;
      if (!list.some(o => o.value === next.cst_pis)) next.cst_pis = list[0]?.value || "";
      if (!list.some(o => o.value === next.cst_cofins)) next.cst_cofins = list[0]?.value || "";
      const listIpi = newType === "entrada" ? CST_IPI_ENTRADA : CST_IPI_SAIDA;
      if (!listIpi.some(o => o.value === next.cst_ipi)) next.cst_ipi = listIpi[0]?.value || "";
      return next;
    });
  };

  const pisCofinsList = form.operation_type === "entrada" ? CST_PIS_COFINS_ENTRADA : CST_PIS_COFINS_SAIDA;
  const ipiList = form.operation_type === "entrada" ? CST_IPI_ENTRADA : CST_IPI_SAIDA;

  const buildPayload = (uf) => {
    const payload = { user_email: user.email, ...form, uf: uf || form.uf };
    Object.keys(payload).forEach(k => { if (typeof payload[k] === "number") payload[k] = Number(payload[k]) || 0; });
    ["aliq_interna_destino", "aliq_interestadual", "fcp_destino_rate", "difal_percent_destination", "mva_rate", "mva_ajusted_rate", "icms_st_rate", "icms_st_reduction_base", "pauta_value", "fcp_st_rate"].forEach(k => payload[k] = Number(payload[k]) || 0);
    payload.difal_enabled = !!payload.difal_enabled;
    payload.st_enabled = !!payload.st_enabled;
    payload.deduz_icms_pis_cofins = !!payload.deduz_icms_pis_cofins;
    if (!payload.ncm) delete payload.ncm;
    if (!payload.uf) delete payload.uf;
    return payload;
  };

  const handleSave = async () => {
    if (!form.operation_id) { alert("Selecione uma operação."); return; }
    setSaving(true);
    try {
      const main = buildPayload();
      if (rule?.id) await base44.entities.ErpTaxRule.update(rule.id, main);
      else await base44.entities.ErpTaxRule.create(main);
      // Replicar para outras UFs
      if (replicar && replicarUFs.length > 0) {
        const copies = replicarUFs
          .filter(uf => uf !== (form.uf || ""))
          .map(uf => buildPayload(uf));
        if (copies.length) await base44.entities.ErpTaxRule.bulkCreate(copies);
      }
      onSaved(); onClose();
    } catch (e) { alert(e.message || "Erro ao salvar regra fiscal"); }
    setSaving(false);
  };

  const toggleReplicateUF = (uf) => setReplicarUFs(prev => prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf]);

  const op = operations.find(o => o.id === form.operation_id);
  const destLabel = DESTINATARIO_TIPOS.find(d => d.value === form.destinatario_tipo)?.label || "";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#F0F0F0] rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">
        {/* Cabeçalho estilo SAIBWEB */}
        <div className="bg-slate-800 text-white px-4 py-2 rounded-t-xl flex items-center justify-between">
          <span className="text-xs font-mono">:: SoftPremier — Cadastro Parâmetro de Alíquota ::</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-white"><X className="w-4 h-4" /></button>
        </div>
        {/* Info operacional em vermelho */}
        <div className="px-4 py-1.5 bg-white border-b text-[11px] text-red-600 font-medium flex flex-wrap gap-x-4 gap-y-0.5">
          <span>Operação: {form.operation_name ? `${op?.type === "entrada" ? "Entrada" : "Saída"} — ${form.operation_name} (${form.cfop})` : "—"}</span>
          <span>NCM: {form.ncm || "Geral"}</span>
          <span>UF: {form.uf || "Todas"}</span>
          <span>Destinatário: {destLabel}</span>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2 bg-white border-b">
          {["geral", "impostos"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-xs font-medium rounded-t border-b-2 ${tab === t ? "border-slate-700 text-slate-800" : "border-transparent text-gray-400"}`}>
              {t === "geral" ? "Geral" : "Impostos"}
            </button>
          ))}
          <div className="ml-auto pb-1">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {tab === "geral" && (
            <>
              <div className="grid grid-cols-3 gap-3 bg-white rounded-lg border p-3">
                <Field label="Operação *">
                  <select value={form.operation_id} onChange={e => onOp(e.target.value)} className={selInput}>
                    <option value="">Selecione...</option>
                    {operations.map(o => <option key={o.id} value={o.id}>{o.type === "entrada" ? "Entrada" : "Saída"} — {o.name} ({o.cfop})</option>)}
                  </select>
                </Field>
                <Field label="NCM específico (opcional)">
                  <Input value={form.ncm} onChange={e => set("ncm", e.target.value)} placeholder="Geral se vazio" className="h-8 text-xs" />
                </Field>
                <Field label="UF de destino">
                  <select value={form.uf} onChange={e => set("uf", e.target.value)} className={selInput}>
                    <option value="">Todas as UFs</option>
                    {BR_UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Tipo do destinatário *" full>
                  <select value={form.destinatario_tipo} onChange={e => set("destinatario_tipo", e.target.value)} className={selInput}>
                    {DESTINATARIO_TIPOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
                <Field label="Descrição" full>
                  <Input value={form.description} onChange={e => set("description", e.target.value)} className="h-8 text-xs" />
                </Field>
                <label className="flex items-center gap-2 text-xs col-span-3"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Regra ativa</label>
              </div>

              {/* Replicar regra */}
              <div className="bg-white rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-700">Replicar esta regra</span>
                  <RadioSimNao label="" checked={replicar} onChange={setReplicar} />
                </div>
                {replicar && (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1.5">Selecione as UFs para criar cópias idênticas desta regra (a UF atual {form.uf || "—"} é ignorada):</p>
                    <div className="grid grid-cols-9 gap-1">
                      {BR_UFS.map(uf => (
                        <label key={uf} className={`flex items-center justify-center h-7 rounded border text-[11px] cursor-pointer ${replicarUFs.includes(uf) ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-600 border-slate-300 hover:bg-slate-50"}`}>
                          <input type="checkbox" checked={replicarUFs.includes(uf)} onChange={() => toggleReplicateUF(uf)} className="sr-only" />
                          {uf}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "impostos" && (
            <>
              {/* ICMS */}
              <div className="bg-white rounded-lg border p-3">
                <SectionTitle>ICMS</SectionTitle>
                <div className="grid grid-cols-4 gap-2">
                  <Field label="CST ICMS"><select value={form.cst_icms} onChange={e => set("cst_icms", e.target.value)} className={selInput}>{CST_ICMS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíq. ICMS (%)"><input type="number" step="0.01" value={form.icms_rate} onChange={e => set("icms_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. Red. Base ICMS (%)"><input type="number" step="0.01" value={form.icms_reduction_base} onChange={e => set("icms_reduction_base", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. FCP (%)"><input type="number" step="0.01" value={form.fcp_rate} onChange={e => set("fcp_rate", e.target.value)} className={numInput} /></Field>
                </div>
              </div>

              {/* ICMS ST */}
              <div className="bg-white rounded-lg border p-3">
                <SectionTitle>ICMS ST — Substituição Tributária</SectionTitle>
                <div className="flex items-center gap-2 mb-2">
                  <RadioSimNao label="Aplica ST" checked={!!form.st_enabled} onChange={v => set("st_enabled", v)} />
                </div>
                {form.st_enabled && (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      <Field label="Base ST"><select value={form.st_base_method} onChange={e => set("st_base_method", e.target.value)} className={selInput}><option value="mva">MVA</option><option value="pauta">Pauta</option><option value="agregada">Agregada</option></select></Field>
                      <Field label="CST ICMS-ST"><input type="text" value={form.cst_icms_st} onChange={e => set("cst_icms_st", e.target.value)} className={numInput} /></Field>
                      <Field label="Alíquota IVA/MVA (%)"><input type="number" step="0.01" value={form.mva_rate} onChange={e => set("mva_rate", e.target.value)} className={numInput} /></Field>
                      <Field label="Alíq. ICMS ST (%)"><input type="number" step="0.01" value={form.icms_st_rate} onChange={e => set("icms_st_rate", e.target.value)} className={numInput} /></Field>
                      <Field label="Alíq. Red. Cálculo ST (%)"><input type="number" step="0.01" value={form.icms_st_reduction_base} onChange={e => set("icms_st_reduction_base", e.target.value)} className={numInput} /></Field>
                      <Field label="Pauta ST (valor/un.)"><input type="number" step="0.01" value={form.pauta_value} onChange={e => set("pauta_value", e.target.value)} className={numInput} /></Field>
                      <Field label="Unidade pauta"><input type="text" value={form.pauta_unit} onChange={e => set("pauta_unit", e.target.value)} className={numInput} /></Field>
                      <Field label="Alíq. FCP-ST (%)"><input type="number" step="0.01" value={form.fcp_st_rate} onChange={e => set("fcp_st_rate", e.target.value)} className={numInput} /></Field>
                    </div>
                  </>
                )}
              </div>

              {/* DIFAL */}
              <div className="bg-white rounded-lg border p-3">
                <SectionTitle>DIFAL — Diferencial de Alíquota</SectionTitle>
                <div className="flex items-center gap-2 mb-2">
                  <RadioSimNao label="Aplica DIFAL" checked={!!form.difal_enabled} onChange={v => set("difal_enabled", v)} />
                </div>
                {form.difal_enabled && (
                  <div className="grid grid-cols-4 gap-2">
                    <Field label="Alíq. ICMS Destino (%)"><input type="number" step="0.01" value={form.aliq_interna_destino} onChange={e => set("aliq_interna_destino", e.target.value)} className={numInput} /></Field>
                    <Field label="Alíq. Interestadual (%)"><input type="number" step="0.01" value={form.aliq_interestadual} onChange={e => set("aliq_interestadual", e.target.value)} className={numInput} /></Field>
                    <Field label="Alíq. FCP Destino (%)"><input type="number" step="0.01" value={form.fcp_destino_rate} onChange={e => set("fcp_destino_rate", e.target.value)} className={numInput} /></Field>
                    <Field label="% DIFAL p/ destino"><input type="number" step="0.01" value={form.difal_percent_destination} onChange={e => set("difal_percent_destination", e.target.value)} className={numInput} /></Field>
                  </div>
                )}
              </div>

              {/* IPI */}
              <div className="bg-white rounded-lg border p-3">
                <SectionTitle>IPI</SectionTitle>
                <div className="grid grid-cols-4 gap-2">
                  <Field label="CST IPI"><select value={form.cst_ipi} onChange={e => set("cst_ipi", e.target.value)} className={selInput}>{ipiList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíq. IPI (%)"><input type="number" step="0.01" value={form.ipi_rate} onChange={e => set("ipi_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. Red. Base IPI (%)"><input type="number" step="0.01" value={form.ipi_reduction_base} onChange={e => set("ipi_reduction_base", e.target.value)} className={numInput} /></Field>
                </div>
              </div>

              {/* PIS / COFINS */}
              <div className="bg-white rounded-lg border p-3">
                <SectionTitle>PIS / COFINS</SectionTitle>
                <div className="grid grid-cols-4 gap-2">
                  <Field label="CST PIS"><select value={form.cst_pis} onChange={e => set("cst_pis", e.target.value)} className={selInput}>{pisCofinsList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíq. PIS (%)"><input type="number" step="0.01" value={form.pis_rate} onChange={e => set("pis_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. Red. Base PIS (%)"><input type="number" step="0.01" value={form.pis_reduction_base} onChange={e => set("pis_reduction_base", e.target.value)} className={numInput} /></Field>
                  <Field label="CST COFINS"><select value={form.cst_cofins} onChange={e => set("cst_cofins", e.target.value)} className={selInput}>{pisCofinsList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíq. COFINS (%)"><input type="number" step="0.01" value={form.cofins_rate} onChange={e => set("cofins_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. Red. Base COFINS (%)"><input type="number" step="0.01" value={form.cofins_reduction_base} onChange={e => set("cofins_reduction_base", e.target.value)} className={numInput} /></Field>
                </div>
                <div className="flex flex-wrap gap-4 mt-2">
                  <RadioSimNao label="Deduz ICMS da base PIS/COFINS (Tema 69 STJ)" checked={!!form.deduz_icms_pis_cofins} onChange={v => set("deduz_icms_pis_cofins", v)} />
                </div>
              </div>

              {/* CBS / IBS (Reforma Tributária) */}
              <div className="bg-white rounded-lg border p-3">
                <SectionTitle>CBS / IBS — Reforma Tributária</SectionTitle>
                <div className="grid grid-cols-4 gap-2">
                  <Field label="CST CBS"><select value={form.cst_cbs} onChange={e => set("cst_cbs", e.target.value)} className={selInput}>{CST_CBS_IBS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíq. CBS (%)"><input type="number" step="0.01" value={form.cbs_rate} onChange={e => set("cbs_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. Red. Base CBS (%)"><input type="number" step="0.01" value={form.cbs_reduction_base} onChange={e => set("cbs_reduction_base", e.target.value)} className={numInput} /></Field>
                  <Field label="CST IBS"><select value={form.cst_ibs} onChange={e => set("cst_ibs", e.target.value)} className={selInput}>{CST_CBS_IBS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíq. IBS (%)"><input type="number" step="0.01" value={form.ibs_rate} onChange={e => set("ibs_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíq. Red. Base IBS (%)"><input type="number" step="0.01" value={form.ibs_reduction_base} onChange={e => set("ibs_reduction_base", e.target.value)} className={numInput} /></Field>
                </div>
              </div>

              {/* Preview automático */}
              {form.operation_id && <AutoFiscalPreview form={form} operations={operations} />}
            </>
          )}
        </div>

        <div className="p-3 border-t bg-white flex gap-2 justify-end rounded-b-xl">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar Regra"}</Button>
        </div>
      </div>
    </div>
  );
}

function AutoFiscalPreview({ form, operations }) {
  const op = operations.find(o => o.id === form.operation_id);
  const result = computeErpFiscalItem(
    { ncm: form.ncm || "", quantity: 1, unit_price: 100, sale_price: 100 },
    { rules: [form], operation: op, customerUF: form.uf, companyUF: "", destinatarioTipo: form.destinatario_tipo }
  );
  const fmt = (v) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");
  const totalImpostos =
    num(result.ipi_value) + num(result.icms_value) + num(result.fcp_value) +
    num(result.pis_value) + num(result.cofins_value) +
    num(result.cbs_value) + num(result.ibs_value) +
    (result.difal ? num(result.difal.difal_total) : 0) +
    (result.st ? num(result.st.total_st) : 0);
  const valorFinal = num(result.total) + totalImpostos;
  return (
    <div className="border rounded-lg p-3 border-violet-200 bg-violet-50">
      <p className="text-sm font-semibold text-violet-800 mb-1">Resultado automático (base R$ 100,00) — UF {form.uf || "—"} • CFOP {op?.cfop || "—"} • {form.destinatario_tipo}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Valor produtos:</span><b>{fmt(result.total)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">IPI:</span><b className="text-indigo-700">{fmt(result.ipi_value)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">ICMS próprio:</span><b>{fmt(result.icms_value)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">FCP:</span><b>{fmt(result.fcp_value)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">PIS valor:</span><b className="text-cyan-700">{fmt(result.pis_value)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">COFINS valor:</span><b className="text-teal-700">{fmt(result.cofins_value)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">CBS valor:</span><b className="text-purple-700">{fmt(result.cbs_value)}</b></div>
        <div className="flex justify-between"><span className="text-gray-500">IBS valor:</span><b className="text-fuchsia-700">{fmt(result.ibs_value)}</b></div>
        {result.difal && <div className="flex justify-between"><span className="text-gray-500">DIFAL total:</span><b className="text-blue-700">{fmt(result.difal.difal_total)}</b></div>}
        {result.st && <div className="flex justify-between"><span className="text-gray-500">Total ST:</span><b className="text-amber-900">{fmt(result.st.total_st)}</b></div>}
      </div>
      <div className="mt-2 pt-2 border-t border-violet-200 bg-violet-100 rounded p-2 space-y-1">
        <div className="flex justify-between text-xs"><span className="text-violet-700 font-medium">Total de impostos:</span><b className="text-violet-900">{fmt(totalImpostos)}</b></div>
        <div className="flex justify-between text-sm"><span className="text-violet-800 font-semibold">Valor final (produtos + impostos):</span><b className="text-violet-900">{fmt(valorFinal)}</b></div>
      </div>
    </div>
  );
}