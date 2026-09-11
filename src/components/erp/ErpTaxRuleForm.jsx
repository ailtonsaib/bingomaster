import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Copy, X, Receipt, Layers, Percent, Building2, MapPin, Calculator, Sparkles } from "lucide-react";
import { ICMS_INTERNAL_RATES, interestadualRate, computeErpFiscalItem, num } from "@/lib/erpTaxCalc";
import ErpCfopPicker from "@/components/erp/ErpCfopPicker";
import ErpNcmPicker from "@/components/erp/ErpNcmPicker";
import { suggestCfop, resolveScope, cfopPrefixesFor } from "@/lib/erpCfopSuggest";

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

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary"><Icon className="w-3.5 h-3.5" /></span>}
      <h4 className="text-sm font-semibold text-foreground">{children}</h4>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
function Field({ label, children, full }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
const numInput = "w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selInput = "w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  );
}

export default function ErpTaxRuleForm({ user, rule, operations, onClose, onSaved }) {
  const blank = {
    operation_id: "", operation_name: "", operation_type: "", cfop: "",
    ncm: "", uf: "", destinatario_tipo: "contribuinte", tax_source: "xml", description: "",
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
  const [companyUF, setCompanyUF] = useState("");
  const [cfopEdited, setCfopEdited] = useState(!!rule?.cfop);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 50)
      .then(list => { const c = list.find(c => c.is_main) || list[0]; if (c) setCompanyUF(c.uf || ""); })
      .catch(() => {});
  }, [user.email]);

  // Sugere automaticamente o CFOP conforme tipo/kind da operação + UF (dentro/fora) + ST.
  useEffect(() => {
    if (cfopEdited) return;
    if (!form.operation_id) return;
    const op = operations.find(o => o.id === form.operation_id);
    if (!op) return;
    const scope = resolveScope(form.uf, companyUF);
    const suggested = suggestCfop({ type: op.type, kind: op.kind, scope, stEnabled: !!form.st_enabled });
    if (suggested) set("cfop", suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.uf, form.st_enabled, form.operation_id, companyUF, cfopEdited]);

  useEffect(() => {
    const op = operations.find(o => o.id === form.operation_id);
    if (!op) return;
    const cfop = String(op.cfop || "");
    const interestadual = cfop.startsWith("6") || cfop.startsWith("1");
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
      // Sem operação selecionada: o tipo (entrada/saída) fica por conta do próprio campo
      const next = { ...prev, operation_id: id, operation_name: op?.name || "", ...(op ? { operation_type: newType } : {}) };
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
    if (!form.ncm) { alert("Informe o NCM da regra fiscal — ela é aplicada pelo NCM do produto."); return; }
    if (!form.operation_id && !form.operation_type) { alert("Selecione a operação ou informe o tipo (entrada/saída) da regra."); return; }
    setSaving(true);
    try {
      const main = buildPayload();
      if (rule?.id) await base44.entities.ErpTaxRule.update(rule.id, main);
      else await base44.entities.ErpTaxRule.create(main);
      if (replicar && replicarUFs.length > 0) {
        const op = operations.find(o => o.id === form.operation_id);
        const copies = replicarUFs
          .filter(uf => uf !== (form.uf || ""))
          .map(uf => {
            const p = buildPayload(uf);
            const scope = resolveScope(uf, companyUF);
            const cfop = suggestCfop({ type: op?.type, kind: op?.kind, scope, stEnabled: !!form.st_enabled });
            if (cfop) p.cfop = cfop;
            return p;
          });
        if (copies.length) await base44.entities.ErpTaxRule.bulkCreate(copies);
      }
      onSaved(); onClose();
    } catch (e) { alert(e.message || "Erro ao salvar regra fiscal"); }
    setSaving(false);
  };

  const toggleReplicateUF = (uf) => setReplicarUFs(prev => prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf]);

  const recomputeCfop = () => {
    const op = operations.find(o => o.id === form.operation_id);
    if (!op) return;
    const scope = resolveScope(form.uf, companyUF);
    const suggested = suggestCfop({ type: op.type, kind: op.kind, scope, stEnabled: !!form.st_enabled });
    setCfopEdited(false);
    if (suggested) set("cfop", suggested);
  };

  const cfopPrefixes = cfopPrefixesFor(form.operation_type);

  const op = operations.find(o => o.id === form.operation_id);
  const destLabel = DESTINATARIO_TIPOS.find(d => d.value === form.destinatario_tipo)?.label || "";
  const isEdit = !!rule?.id;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-primary to-violet-600 text-primary-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15"><Percent className="w-5 h-5" /></span>
            <div>
              <h3 className="font-heading font-semibold leading-tight">{isEdit ? "Editar Regra Fiscal" : "Nova Regra Fiscal"}</h3>
              <p className="text-xs text-primary-foreground/80">Regra de impostos por NCM — aplicada na entrada e na saída</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Info chips */}
        <div className="px-5 py-2.5 bg-muted/50 border-b flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"><Layers className="w-3 h-3" /> {form.operation_name ? `${op?.type === "entrada" ? "Entrada" : "Saída"} · ${form.operation_name}` : (form.operation_type === "entrada" ? "Entrada" : form.operation_type === "saida" ? "Saída" : "Entrada e saída")} {form.cfop && `(${form.cfop})`}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"><Receipt className="w-3 h-3" /> NCM: {form.ncm || "Geral"}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800"><MapPin className="w-3 h-3" /> {form.uf || "Todas UFs"}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"><Building2 className="w-3 h-3" /> {destLabel}</span>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 bg-background">
          <div className="inline-flex gap-1 p-1 bg-muted rounded-lg">
            {[
              { k: "geral", l: "Geral" },
              { k: "impostos", l: "Impostos" },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${tab === t.k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {tab === "geral" && (
            <>
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
                <Field label="NCM * — a regra é aplicada pelo NCM do produto">
                  <ErpNcmPicker value={form.ncm || ""} onChange={code => set("ncm", code)} allowClear />
                </Field>
                <Field label="Tipo de operação (vazio = entrada e saída)">
                  <select value={form.operation_type || ""} onChange={e => set("operation_type", e.target.value)} disabled={!!form.operation_id} className={selInput}>
                    <option value="">Ambas (entrada e saída)</option>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </Field>
                <Field label="Operação (opcional — vazio = todas)">
                  <select value={form.operation_id} onChange={e => onOp(e.target.value)} className={selInput}>
                    <option value="">Todas as operações</option>
                    {operations.map(o => <option key={o.id} value={o.id}>{o.type === "entrada" ? "Entrada" : "Saída"} — {o.name} ({o.cfop})</option>)}
                  </select>
                </Field>
                <Field label="Tipo do destinatário *">
                  <select value={form.destinatario_tipo} onChange={e => set("destinatario_tipo", e.target.value)} className={selInput}>
                    {DESTINATARIO_TIPOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
                <Field label="UF de destino">
                  <select value={form.uf} onChange={e => set("uf", e.target.value)} className={selInput}>
                    <option value="">Todas as UFs</option>
                    {BR_UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="CFOP (sugerido por UF + ST)">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1"><ErpCfopPicker value={form.cfop} onChange={code => { set("cfop", code); setCfopEdited(true); }} prefixes={cfopPrefixes} /></div>
                    <Button type="button" variant="outline" size="sm" onClick={recomputeCfop} title="Sugerir CFOP automaticamente" className="px-2"><Sparkles className="w-4 h-4 text-amber-500" /></Button>
                  </div>
                </Field>
                {form.operation_type === "entrada" && (
                  <Field label="Impostos na Entrada por XML (NF-e)">
                    <select value={form.tax_source || "xml"} onChange={e => set("tax_source", e.target.value)} className={selInput}>
                      <option value="xml">Respeitar o XML — usar os impostos destacados na nota</option>
                      <option value="regra">Respeitar a regra fiscal — recalcular os impostos pela regra</option>
                    </select>
                  </Field>
                )}
                <Field label="Descrição" full>
                  <Input value={form.description} onChange={e => set("description", e.target.value)} className="h-9 text-sm" placeholder="Observação sobre a regra" />
                </Field>
                <div className="col-span-full pt-1">
                  <Toggle label="Regra ativa" checked={!!form.is_active} onChange={v => set("is_active", v)} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600"><Copy className="w-4 h-4" /></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Replicar regra para outras UFs</p>
                    <p className="text-[11px] text-muted-foreground">Cria cópias idênticas, uma por UF selecionada</p>
                  </div>
                  <Toggle label="" checked={replicar} onChange={setReplicar} />
                </div>
                {replicar && (
                  <>
                    <p className="text-[11px] text-muted-foreground mb-2">A UF atual ({form.uf || "—"}) é ignorada:</p>
                    <div className="grid grid-cols-9 gap-1.5">
                      {BR_UFS.map(uf => (
                        <button key={uf} type="button" onClick={() => toggleReplicateUF(uf)}
                          className={`h-8 rounded-md text-[11px] font-medium border transition-all ${replicarUFs.includes(uf) ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:bg-primary/5"}`}>
                          {uf}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {tab === "impostos" && (
            <>
              <div className="rounded-xl border border-border bg-card p-4">
                <SectionTitle icon={Percent}>ICMS</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="CST ICMS"><select value={form.cst_icms} onChange={e => set("cst_icms", e.target.value)} className={selInput}>{CST_ICMS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíquota ICMS (%)"><input type="number" step="0.01" value={form.icms_rate} onChange={e => set("icms_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Redução de Base (%)"><input type="number" step="0.01" value={form.icms_reduction_base} onChange={e => set("icms_reduction_base", e.target.value)} className={numInput} /></Field>
                  <Field label="Alíquota FCP (%)"><input type="number" step="0.01" value={form.fcp_rate} onChange={e => set("fcp_rate", e.target.value)} className={numInput} /></Field>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <SectionTitle icon={Layers}>ICMS-ST — Substituição Tributária</SectionTitle>
                <div className="mb-3"><Toggle label="Aplica Substituição Tributária" checked={!!form.st_enabled} onChange={v => set("st_enabled", v)} /></div>
                {form.st_enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Base ST"><select value={form.st_base_method} onChange={e => set("st_base_method", e.target.value)} className={selInput}><option value="mva">MVA</option><option value="pauta">Pauta</option><option value="agregada">Agregada</option></select></Field>
                    <Field label="CST ICMS-ST"><input type="text" value={form.cst_icms_st} onChange={e => set("cst_icms_st", e.target.value)} className={numInput} /></Field>
                    <Field label="IVA / MVA (%)"><input type="number" step="0.01" value={form.mva_rate} onChange={e => set("mva_rate", e.target.value)} className={numInput} /></Field>
                    <Field label="Alíquota ICMS-ST (%)"><input type="number" step="0.01" value={form.icms_st_rate} onChange={e => set("icms_st_rate", e.target.value)} className={numInput} /></Field>
                    <Field label="Redução Base ST (%)"><input type="number" step="0.01" value={form.icms_st_reduction_base} onChange={e => set("icms_st_reduction_base", e.target.value)} className={numInput} /></Field>
                    <Field label="Pauta (valor/un.)"><input type="number" step="0.01" value={form.pauta_value} onChange={e => set("pauta_value", e.target.value)} className={numInput} /></Field>
                    <Field label="Unidade pauta"><input type="text" value={form.pauta_unit} onChange={e => set("pauta_unit", e.target.value)} className={numInput} /></Field>
                    <Field label="Alíquota FCP-ST (%)"><input type="number" step="0.01" value={form.fcp_st_rate} onChange={e => set("fcp_st_rate", e.target.value)} className={numInput} /></Field>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <SectionTitle icon={MapPin}>DIFAL — Diferencial de Alíquota</SectionTitle>
                <div className="mb-3"><Toggle label="Aplica DIFAL (interestadual a consumidor final)" checked={!!form.difal_enabled} onChange={v => set("difal_enabled", v)} /></div>
                {form.difal_enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Alíq. interna destino (%)"><input type="number" step="0.01" value={form.aliq_interna_destino} onChange={e => set("aliq_interna_destino", e.target.value)} className={numInput} /></Field>
                    <Field label="Alíq. interestadual (%)"><input type="number" step="0.01" value={form.aliq_interestadual} onChange={e => set("aliq_interestadual", e.target.value)} className={numInput} /></Field>
                    <Field label="Alíq. FCP destino (%)"><input type="number" step="0.01" value={form.fcp_destino_rate} onChange={e => set("fcp_destino_rate", e.target.value)} className={numInput} /></Field>
                    <Field label="% DIFAL p/ destino"><input type="number" step="0.01" value={form.difal_percent_destination} onChange={e => set("difal_percent_destination", e.target.value)} className={numInput} /></Field>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <SectionTitle icon={Receipt}>IPI</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="CST IPI"><select value={form.cst_ipi} onChange={e => set("cst_ipi", e.target.value)} className={selInput}>{ipiList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíquota IPI (%)"><input type="number" step="0.01" value={form.ipi_rate} onChange={e => set("ipi_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Redução de Base (%)"><input type="number" step="0.01" value={form.ipi_reduction_base} onChange={e => set("ipi_reduction_base", e.target.value)} className={numInput} /></Field>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <SectionTitle icon={Percent}>PIS / COFINS</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="CST PIS"><select value={form.cst_pis} onChange={e => set("cst_pis", e.target.value)} className={selInput}>{pisCofinsList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíquota PIS (%)"><input type="number" step="0.01" value={form.pis_rate} onChange={e => set("pis_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Redução Base PIS (%)"><input type="number" step="0.01" value={form.pis_reduction_base} onChange={e => set("pis_reduction_base", e.target.value)} className={numInput} /></Field>
                  <Field label="CST COFINS"><select value={form.cst_cofins} onChange={e => set("cst_cofins", e.target.value)} className={selInput}>{pisCofinsList.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíquota COFINS (%)"><input type="number" step="0.01" value={form.cofins_rate} onChange={e => set("cofins_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Redução Base COFINS (%)"><input type="number" step="0.01" value={form.cofins_reduction_base} onChange={e => set("cofins_reduction_base", e.target.value)} className={numInput} /></Field>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <Toggle label="Deduz ICMS da base PIS/COFINS (Tema 69 STJ)" checked={!!form.deduz_icms_pis_cofins} onChange={v => set("deduz_icms_pis_cofins", v)} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <SectionTitle icon={Calculator}>CBS / IBS — Reforma Tributária</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="CST CBS"><select value={form.cst_cbs} onChange={e => set("cst_cbs", e.target.value)} className={selInput}>{CST_CBS_IBS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíquota CBS (%)"><input type="number" step="0.01" value={form.cbs_rate} onChange={e => set("cbs_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Redução Base CBS (%)"><input type="number" step="0.01" value={form.cbs_reduction_base} onChange={e => set("cbs_reduction_base", e.target.value)} className={numInput} /></Field>
                  <Field label="CST IBS"><select value={form.cst_ibs} onChange={e => set("cst_ibs", e.target.value)} className={selInput}>{CST_CBS_IBS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Alíquota IBS (%)"><input type="number" step="0.01" value={form.ibs_rate} onChange={e => set("ibs_rate", e.target.value)} className={numInput} /></Field>
                  <Field label="Redução Base IBS (%)"><input type="number" step="0.01" value={form.ibs_reduction_base} onChange={e => set("ibs_reduction_base", e.target.value)} className={numInput} /></Field>
                </div>
              </div>

              {(form.operation_id || form.operation_type) && <AutoFiscalPreview form={form} operations={operations} />}
            </>
          )}
        </div>

        <div className="p-4 border-t bg-card flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar Regra"}</Button>
        </div>
      </div>
    </div>
  );
}

function computeNotaAt(P, form, op) {
  const res = computeErpFiscalItem(
    { ncm: form.ncm || "", quantity: 1, unit_price: P, sale_price: P },
    { rules: [form], operation: op, customerUF: form.uf, companyUF: "", destinatarioTipo: form.destinatario_tipo }
  );
  return res;
}

function AutoFiscalPreview({ form, operations }) {
  const op = operations.find(o => o.id === form.operation_id);
  const [mode, setMode] = useState("forward"); // forward | reverse
  const [productPrice, setProductPrice] = useState(100);
  const [finalPrice, setFinalPrice] = useState(0);
  const [frete, setFrete] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const fmt = (v) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

  // Resolve o preço do produto: direto (forward) ou reverso a partir do valor da nota.
  const freteN = num(frete), descN = num(desconto);
  let P, res;
  if (mode === "reverse") {
    const V = num(finalPrice);
    // Newton numérico: nota = P - desconto + frete + IPI(P) + ST(P)
    let p = Math.max(0.01, V - freteN + descN);
    for (let i = 0; i < 80; i++) {
      const r = computeNotaAt(p, form, op);
      const st = r.st ? num(r.st.total_st) : 0;
      const nota = p - descN + freteN + num(r.ipi_value) + st;
      const err = nota - V;
      if (Math.abs(err) < 0.001) break;
      const p2 = p * 1.0001 + 0.0001;
      const r2 = computeNotaAt(p2, form, op);
      const st2 = r2.st ? num(r2.st.total_st) : 0;
      const nota2 = p2 - descN + freteN + num(r2.ipi_value) + st2;
      const slope = (nota2 - nota) / (p2 - p);
      if (Math.abs(slope) < 1e-9) break;
      p = p - err / slope;
      if (p < 0.01) p = 0.01;
    }
    P = p;
    res = computeNotaAt(P, form, op);
  } else {
    P = num(productPrice);
    res = computeNotaAt(P, form, op);
  }

  const ipiVal = num(res.ipi_value);
  const stTotal = res.st ? num(res.st.total_st) : 0;
  // Composição da NF-e: produtos + IPI + frete - desconto + ICMS-ST (+ FCP-ST)
  const valorNota = P - descN + freteN + ipiVal + stTotal;

  const CompRow = ({ label, value, op: sign, strong }) => (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <b className={strong ? "text-foreground" : ""}>{sign === "-" ? "− " : ""}{fmt(value)}</b>
    </div>
  );
  const DestRow = ({ label, value, color }) => (
    <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><b className={color}>{fmt(value)}</b></div>
  );

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground"><Calculator className="w-4 h-4" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Simulação fiscal</p>
          <p className="text-[11px] text-muted-foreground">UF {form.uf || "—"} · CFOP {form.cfop || "—"} · {form.destinatario_tipo}</p>
        </div>
        <div className="inline-flex gap-1 p-0.5 bg-muted rounded-md">
          <button onClick={() => setMode("forward")} className={`px-2.5 py-1 text-[11px] font-medium rounded ${mode === "forward" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Preço do produto</button>
          <button onClick={() => setMode("reverse")} className={`px-2.5 py-1 text-[11px] font-medium rounded ${mode === "reverse" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Preço final</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {mode === "forward" ? (
          <Field label="Preço do produto (R$)"><input type="number" step="0.01" value={productPrice} onChange={e => setProductPrice(e.target.value)} className={numInput} /></Field>
        ) : (
          <Field label="Preço final da nota (R$)"><input type="number" step="0.01" value={finalPrice} onChange={e => setFinalPrice(e.target.value)} className={numInput} /></Field>
        )}
        <Field label="Frete (R$)"><input type="number" step="0.01" value={frete} onChange={e => setFrete(e.target.value)} className={numInput} /></Field>
        <Field label="Desconto (R$)"><input type="number" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)} className={numInput} /></Field>
      </div>

      {/* Composição da nota (soma) */}
      <div className="rounded-lg bg-background border border-border p-3 space-y-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Composição da nota (soma)</p>
        <CompRow label="Valor dos produtos" value={P} strong />
        {freteN > 0 && <CompRow label="Frete" value={freteN} />}
        {descN > 0 && <CompRow label="Desconto" value={descN} op="-" />}
        {ipiVal > 0 && <CompRow label="IPI (por fora)" value={ipiVal} />}
        {stTotal > 0 && <CompRow label="ICMS-ST + FCP-ST" value={stTotal} />}
        <div className="border-t border-border my-1" />
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-foreground">Valor total da nota</span>
          <b className="text-primary">{fmt(valorNota)}</b>
        </div>
      </div>

      {/* Impostos destacados (embutidos — não somam à nota) */}
      <div className="rounded-lg bg-background border border-border p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Impostos destacados (embutidos, não somam)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <DestRow label="ICMS próprio" value={res.icms_value} />
          <DestRow label="FCP" value={res.fcp_value} />
          <DestRow label="PIS" value={res.pis_value} color="text-cyan-600" />
          <DestRow label="COFINS" value={res.cofins_value} color="text-teal-600" />
          <DestRow label="CBS" value={res.cbs_value} color="text-purple-600" />
          <DestRow label="IBS" value={res.ibs_value} color="text-fuchsia-600" />
          {res.difal && <DestRow label="DIFAL" value={res.difal.difal_total} color="text-blue-600" />}
        </div>
      </div>

      {mode === "reverse" && (
        <div className="rounded-lg bg-primary/10 p-2.5 flex justify-between text-sm">
          <span className="text-primary/80 font-medium">Preço do produto (reverso)</span>
          <b className="text-primary text-base">{fmt(P)}</b>
        </div>
      )}
    </div>
  );
}