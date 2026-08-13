import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, ScrollText } from "lucide-react";

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
const CST_PIS_COFINS = [
  { value: "01", label: "01 - Tributável" },
  { value: "02", label: "02 - Tributável alíq. diferenciada" },
  { value: "04", label: "04 - Tributável monofásica" },
  { value: "05", label: "05 - Tributável por substituição" },
  { value: "06", label: "06 - Alíquota zero" },
  { value: "07", label: "07 - Isenta" },
  { value: "08", label: "08 - Sem incidência" },
  { value: "09", label: "09 - Suspensão" },
  { value: "49", label: "49 - Outras saídas" },
  { value: "98", label: "98 - Outras entradas" },
  { value: "99", label: "99 - Outras" },
];
const CST_IPI = [
  { value: "00", label: "00 - Entrada c/ recuperação" },
  { value: "01", label: "01 - Entrada tributada alíq. zero" },
  { value: "02", label: "02 - Entrada isenta" },
  { value: "03", label: "03 - Entrada não tributada" },
  { value: "04", label: "04 - Entrada imune" },
  { value: "05", label: "05 - Entrada c/ suspensão" },
  { value: "49", label: "49 - Outras entradas" },
  { value: "50", label: "50 - Saída tributada" },
  { value: "51", label: "51 - Saída trib. alíq. zero" },
  { value: "52", label: "52 - Saída isenta" },
  { value: "53", label: "53 - Saída não tributada" },
  { value: "54", label: "54 - Saída imune" },
  { value: "55", label: "55 - Saída c/ suspensão" },
  { value: "99", label: "99 - Outras saídas" },
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

const TAX_GROUPS = [
  { key: "icms", label: "ICMS", color: "border-indigo-200 bg-indigo-50", fields: [
    { key: "cst_icms", label: "CST", options: CST_ICMS },
    { key: "icms_rate", label: "Alíquota (%)", num: true },
    { key: "icms_reduction_base", label: "Base (%)", num: true },
    { key: "fcp_rate", label: "FCP (%)", num: true },
  ] },
  { key: "pis", label: "PIS", color: "border-cyan-200 bg-cyan-50", fields: [
    { key: "cst_pis", label: "CST", options: CST_PIS_COFINS },
    { key: "pis_rate", label: "Alíquota (%)", num: true },
    { key: "pis_reduction_base", label: "Base (%)", num: true },
  ] },
  { key: "cofins", label: "COFINS", color: "border-teal-200 bg-teal-50", fields: [
    { key: "cst_cofins", label: "CST", options: CST_PIS_COFINS },
    { key: "cofins_rate", label: "Alíquota (%)", num: true },
    { key: "cofins_reduction_base", label: "Base (%)", num: true },
  ] },
  { key: "ipi", label: "IPI", color: "border-amber-200 bg-amber-50", fields: [
    { key: "cst_ipi", label: "CST", options: CST_IPI },
    { key: "ipi_rate", label: "Alíquota (%)", num: true },
    { key: "ipi_reduction_base", label: "Base (%)", num: true },
  ] },
  { key: "cbs", label: "CBS (Reforma Tributária)", color: "border-purple-200 bg-purple-50", fields: [
    { key: "cst_cbs", label: "CST", options: CST_CBS_IBS },
    { key: "cbs_rate", label: "Alíquota (%)", num: true },
    { key: "cbs_reduction_base", label: "Base (%)", num: true },
  ] },
  { key: "ibs", label: "IBS (Reforma Tributária)", color: "border-fuchsia-200 bg-fuchsia-50", fields: [
    { key: "cst_ibs", label: "CST", options: CST_CBS_IBS },
    { key: "ibs_rate", label: "Alíquota (%)", num: true },
    { key: "ibs_reduction_base", label: "Base (%)", num: true },
  ] },
];

export default function ErpTaxRuleManager({ user }) {
  const [rules, setRules] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([
        base44.entities.ErpTaxRule.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpOperation.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setRules(r); setOperations(o);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = rules.filter(r => {
    const t = (r.operation_name + " " + (r.ncm || "") + " " + (r.cfop || "") + " " + (r.uf || "")).toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (r) => {
    if (!confirm("Excluir esta regra fiscal?")) return;
    await base44.entities.ErpTaxRule.delete(r.id);
    load();
  };

  const opBadge = (type) => type === "entrada"
    ? "text-blue-700 bg-blue-100"
    : "text-emerald-700 bg-emerald-100";

  return (
    <div className="space-y-3">
      <div><h2 className="font-semibold text-base">Regras Fiscais por Operação</h2>
        <p className="text-xs text-gray-500">ICMS, PIS, COFINS, IPI, CBS e IBS — conforme legislação brasileira</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por operação, CFOP ou NCM..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Regra</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Operação</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">CFOP</th>
                <th className="p-2 text-left">NCM</th>
                <th className="p-2 text-left">UF</th>
                <th className="p-2 text-left">ICMS</th>
                <th className="p-2 text-left">PIS/COFINS</th>
                <th className="p-2 text-left">IPI</th>
                <th className="p-2 text-left">CBS/IBS</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-gray-400">
                  <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma regra fiscal cadastrada.
                </td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{r.operation_name || "—"}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${opBadge(r.operation_type)}`}>{r.operation_type}</span></td>
                  <td className="p-2 font-mono text-xs">{r.cfop || "—"}</td>
                  <td className="p-2 font-mono text-xs">{r.ncm || "Geral"}</td>
                  <td className="p-2 font-mono text-xs">{r.uf || "Todas"}{r.difal_enabled ? <span className="ml-1 text-blue-600" title="Aplica DIFAL">⚡</span> : ""}</td>
                  <td className="p-2 text-xs">{r.cst_icms} · {r.icms_rate}%</td>
                  <td className="p-2 text-xs">{r.cst_pis}/{r.cst_cofins} · {r.pis_rate}%/{r.cofins_rate}%</td>
                  <td className="p-2 text-xs">{r.cst_ipi} · {r.ipi_rate}%</td>
                  <td className="p-2 text-xs">{r.cbs_rate}% / {r.ibs_rate}%</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(r)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpTaxRuleForm user={user} rule={editing} operations={operations} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}

function DifalCalculator({ form, set }) {
  const [base, setBase] = useState(100);
  const aliqInt = Number(form.aliq_interna_destino) || 0;
  const aliqInte = Number(form.aliq_interestadual) || 0;
  const fcpDest = Number(form.fcp_destino_rate) || 0;
  const pctDest = Number(form.difal_percent_destination) || 100;
  const b = Number(base) || 0;
  const icmsOrigin = b * aliqInte / 100;
  const difalTotal = b * (aliqInt - aliqInte) / 100;
  const difalDest = difalTotal * pctDest / 100;
  const difalOrigin = difalTotal - difalDest;
  const fcpValue = b * fcpDest / 100;
  const totalDest = difalDest + fcpValue;
  const fmt = (v) => "R$ " + (v || 0).toFixed(2).replace(".", ",");
  const numInput = (label, key, hint) => (
    <div>
      <label className="text-[10px] font-medium text-gray-600">{label}</label>
      <input type="number" step="0.01" value={form[key]} onChange={e => set(key, e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs mt-0.5" />
      {hint && <span className="text-[9px] text-gray-400">{hint}</span>}
    </div>
  );
  return (
    <div className="border rounded-lg p-3 border-blue-300 bg-blue-50">
      <p className="text-sm font-semibold text-blue-800 mb-2">DIFAL — Diferencial de Alíquota (EC 87/2015)</p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {numInput("Alíq. interna destino (%)", "aliq_interna_destino", "ICMS do estado destinatário")}
        {numInput("Alíq. interestadual (%)", "aliq_interestadual", "4%, 7% ou 12%")}
        {numInput("FCP destino (%)", "fcp_destino_rate")}
        {numInput("% DIFAL p/ destino", "difal_percent_destination", "Após 2019 = 100")}
      </div>
      <div className="bg-white rounded p-2 border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-600">Valor da base para simulação:</label>
          <input type="number" step="0.01" value={base} onChange={e => setBase(e.target.value)} className="h-8 w-32 rounded border border-input px-2 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">ICMS origem (alíq. interestadual):</span><b>{fmt(icmsOrigin)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">DIFAL total:</span><b>{fmt(difalTotal)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">DIFAL origem:</span><b className="text-blue-700">{fmt(difalOrigin)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">DIFAL destino:</span><b className="text-emerald-700">{fmt(difalDest)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">FCP destino:</span><b>{fmt(fcpValue)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">Total destinado ao destino:</span><b className="text-emerald-800">{fmt(totalDest)}</b></div>
        </div>
      </div>
    </div>
  );
}

function ErpTaxRuleForm({ user, rule, operations, onClose, onSaved }) {
  const blank = {
    operation_id: "", operation_name: "", operation_type: "", cfop: "",
    ncm: "", description: "",
    cst_icms: "00", icms_rate: 0, icms_reduction_base: 100, fcp_rate: 0,
    cst_pis: "01", pis_rate: 0, pis_reduction_base: 100,
    cst_cofins: "01", cofins_rate: 0, cofins_reduction_base: 100,
    cst_ipi: "50", ipi_rate: 0, ipi_reduction_base: 100,
    cst_cbs: "00", cbs_rate: 0, cbs_reduction_base: 100,
    cst_ibs: "00", ibs_rate: 0, ibs_reduction_base: 100,
    uf: "", difal_enabled: false, aliq_interna_destino: 0, aliq_interestadual: 0, fcp_destino_rate: 0, difal_percent_destination: 100,
    is_active: true,
  };
  const [form, setForm] = useState({ ...blank, ...(rule || {}) });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const onOp = (id) => {
    const op = operations.find(o => o.id === id);
    setForm(prev => ({ ...prev, operation_id: id, operation_name: op?.name || "", operation_type: op?.type || "", cfop: op?.cfop || "" }));
  };

  const handleSave = async () => {
    if (!form.operation_id) { alert("Selecione uma operação."); return; }
    setSaving(true);
    const payload = { user_email: user.email, ...form };
    Object.keys(payload).forEach(k => { if (typeof payload[k] === "number") payload[k] = Number(payload[k]) || 0; });
    ["aliq_interna_destino", "aliq_interestadual", "fcp_destino_rate", "difal_percent_destination"].forEach(k => payload[k] = Number(payload[k]) || 0);
    payload.difal_enabled = !!payload.difal_enabled;
    if (!payload.ncm) delete payload.ncm;
    if (!payload.uf) delete payload.uf;
    try {
      if (rule?.id) await base44.entities.ErpTaxRule.update(rule.id, payload);
      else await base44.entities.ErpTaxRule.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{rule ? "Editar Regra Fiscal" : "Nova Regra Fiscal"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Operação *</label>
              <select value={form.operation_id} onChange={e => onOp(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                <option value="">Selecione...</option>
                {operations.map(o => <option key={o.id} value={o.id}>{o.type === "entrada" ? "Entrada" : "Saída"} — {o.name} ({o.cfop})</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-600">NCM específico (opcional)</label>
              <Input value={form.ncm} onChange={e => set("ncm", e.target.value)} placeholder="Geral se vazio" className="mt-1" /></div>
            <div><label className="text-xs font-medium text-gray-600">UF de destino</label>
              <select value={form.uf} onChange={e => set("uf", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                <option value="">Todas as UFs</option>
                {BR_UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select></div>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <input type="checkbox" id="difal" checked={!!form.difal_enabled} onChange={e => set("difal_enabled", e.target.checked)} className="w-4 h-4" />
            <label htmlFor="difal" className="text-sm font-medium text-blue-800">Aplica DIFAL (interestadual a consumidor final não contribuinte)</label>
          </div>
          <div><label className="text-xs font-medium text-gray-600">Descrição</label>
            <Input value={form.description} onChange={e => set("description", e.target.value)} /></div>

          {TAX_GROUPS.map(g => (
            <div key={g.key} className={`border rounded-lg p-3 ${g.color}`}>
              <p className="text-sm font-semibold mb-2">{g.label}</p>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-600">CST</label>
                  <select value={form[g.fields[0].key]} onChange={e => set(g.fields[0].key, e.target.value)} className="w-full h-8 rounded border border-input px-1 text-xs mt-0.5">
                    {g.fields[0].options.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                </div>
                {g.fields.slice(1).map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-medium text-gray-600">{f.label}</label>
                    <input type="number" step="0.01" value={form[f.key]} onChange={e => set(f.key, e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {form.difal_enabled && (
            <DifalCalculator form={form} set={set} />
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Regra ativa</label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Regra"}</Button>
        </div>
      </div>
    </div>
  );
}