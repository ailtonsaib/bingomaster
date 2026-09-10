import { CheckCircle2, Landmark } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

// Capa dos impostos da nota — os valores (bases e DIFAL) devem fechar com a
// soma dos itens. Campos vazios usam automaticamente a soma dos itens;
// preencher divergindo dos itens bloqueia a entrada.
// sums: { base_icms, icms_value, base_pis_cofins, pis_value, cofins_value, difal_value }
export default function ErpFiscalCapaTaxes({ capa, onChange, sums }) {
  const cmp = (k) => {
    const v = Number(capa[k]) || 0;
    if (!(v > 0)) return null;
    const ok = Math.abs(v - (sums?.[k] || 0)) < 0.01;
    return { ok, diff: v - (sums?.[k] || 0) };
  };
  const field = (key, label, sumKey) => {
    const c = sumKey ? cmp(sumKey) : null;
    return (
      <div>
        <label className="text-[10px] font-medium text-gray-500">{label}</label>
        <input type="number" step="0.01" value={capa[key] ?? ""} onChange={e => onChange(key, e.target.value)} className={`w-full h-8 rounded border px-2 text-xs text-right ${c ? (c.ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50") : "border-input"}`} />
        {c && !c.ok && <p className="text-[10px] text-red-600 mt-0.5">Itens: {fmtMoney(sums[sumKey])} (dif. {fmtMoney(c.diff)})</p>}
        {c && c.ok && <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> fecha com os itens</p>}
      </div>
    );
  };
  const readOnly = (label, value) => (
    <div>
      <label className="text-[10px] font-medium text-gray-500">{label}</label>
      <p className="h-8 flex items-center justify-end px-2 text-xs font-medium bg-gray-50 rounded border border-input">{fmtMoney(value)}</p>
    </div>
  );
  return (
    <div className="border rounded-lg p-2 bg-indigo-50/40">
      <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5 mb-2"><Landmark className="w-3.5 h-3.5" /> Impostos da Nota (Capa)</p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {field("base_icms", "Base Cálculo ICMS", "base_icms")}
        {field("aliq_icms", "Alíq. ICMS %")}
        {field("aliq_reducao_icms", "Alíq. Redução ICMS %")}
        {field("difal_value", "DIFAL", "difal_value")}
        {field("base_pis_cofins", "Base PIS/COFINS", "base_pis_cofins")}
        {readOnly("Vlr ICMS (itens)", sums?.icms_value || 0)}
        {readOnly("Vlr PIS (itens)", sums?.pis_value || 0)}
        {readOnly("Vlr COFINS (itens)", sums?.cofins_value || 0)}
        {readOnly("Vlr CBS (itens)", sums?.cbs_value || 0)}
        {readOnly("Vlr IBS (itens)", sums?.ibs_value || 0)}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5">Campos vazios usam a soma dos itens automaticamente — preencher divergindo dos itens bloqueia a entrada.</p>
    </div>
  );
}