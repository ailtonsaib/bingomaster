import { Landmark } from "lucide-react";

// Impostos por item (CST, base, alíquota, redução, pauta e valores) — editável.
// Ao alterar base/alíquota/pauta o valor do imposto é recalculado; os valores
// permanecem editáveis para ajuste manual. A soma dos itens deve fechar com a capa.
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

function recompute(item, field) {
  const n = (k) => Number(item[k]) || 0;
  if (["base_icms", "icms_rate", "aliq_reducao_icms"].includes(field)) {
    return { icms_value: r2((n("base_icms") * n("icms_rate") / 100) * (1 - n("aliq_reducao_icms") / 100)) };
  }
  if (["base_pis_cofins", "aliq_pis_cofins"].includes(field)) {
    const v = r2(n("base_pis_cofins") * n("aliq_pis_cofins") / 100);
    return { pis_value: v, cofins_value: v };
  }
  if (field === "pauta_pis_cofins") {
    const v = r2(n("pauta_pis_cofins") * (Number(item.quantity) || 0));
    return { pis_value: v, cofins_value: v };
  }
  return {};
}

export default function ErpFiscalItemTaxes({ items, onChange }) {
  if (!items?.length) return null;
  const upd = (i, field, raw) => {
    const isCst = ["cst_icms", "cst_pis", "cst_cofins"].includes(field);
    const value = isCst ? String(raw || "").toUpperCase().replace(/[^0-9]/g, "").slice(0, 3) : (raw === "" ? "" : Number(raw));
    const next = { ...items[i], [field]: value };
    onChange(i, { [field]: value, ...recompute(next, field), _taxEdited: true });
  };
  const numInput = (i, field, label, cls = "") => (
    <div>
      <label className="text-[10px] font-medium text-gray-500">{label}</label>
      <input type="number" step="0.01" value={items[i][field] ?? ""} onChange={e => upd(i, field, e.target.value)} className={`w-full h-8 rounded border border-input px-2 text-xs text-right ${cls}`} />
    </div>
  );
  const cstInput = (i, field, label) => (
    <div>
      <label className="text-[10px] font-medium text-gray-500">{label}</label>
      <input value={items[i][field] ?? ""} onChange={e => upd(i, field, e.target.value)} placeholder="000" className="w-full h-8 rounded border border-input px-2 text-xs" />
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-indigo-600" /> Impostos por Item — CST, Base, Alíquota e Valores</p>
      <p className="text-[11px] text-gray-400">Ao alterar base/alíquota/pauta o valor é recalculado; os valores também podem ser digitados. A soma dos itens deve fechar com os valores da capa.</p>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-2">
          <p className="text-xs font-medium text-gray-700 mb-1.5">{i + 1}. {it.product_name || "Item sem descrição"}</p>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5">
            {cstInput(i, "cst_icms", "CST ICMS")}
            {numInput(i, "base_icms", "Base ICMS")}
            {numInput(i, "icms_rate", "Alíq. ICMS %")}
            {numInput(i, "aliq_reducao_icms", "Alíq. Redução %")}
            {numInput(i, "icms_value", "Vlr ICMS", "font-medium")}
            {numInput(i, "difal_value", "DIFAL")}
            {cstInput(i, "cst_pis", "CST PIS")}
            {cstInput(i, "cst_cofins", "CST COFINS")}
            {numInput(i, "base_pis_cofins", "Base PIS/COFINS")}
            {numInput(i, "aliq_pis_cofins", "Alíq. PIS/COFINS %")}
            {numInput(i, "pauta_pis_cofins", "Pauta R$/un")}
            {numInput(i, "pis_value", "Vlr PIS", "font-medium")}
            {numInput(i, "cofins_value", "Vlr COFINS", "font-medium")}
          </div>
        </div>
      ))}
    </div>
  );
}