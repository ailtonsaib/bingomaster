import { useState } from "react";
import { Building, Network, TrendingDown, BadgePercent, BarChart3 } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpFixedAssetManager from "@/components/erp/ErpFixedAssetManager";
import ErpDepreciationPanel from "@/components/erp/ErpDepreciationPanel";
import ErpCiapPanel from "@/components/erp/ErpCiapPanel";
import ErpAssetReportsPanel from "@/components/erp/ErpAssetReportsPanel";
import { SubNav } from "./ErpModuleSuprimentos";

// ordena contas contábeis pela estrutura do código (1.1.01.01.0001)
const compareChartCode = (a, b) => {
  const pa = String(a.code || "").split(".").map(Number);
  const pb = String(b.code || "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

const ESTRUTURA_CONFIG = {
  entityName: "ErpAssetStructure",
  title: "Cadastro de Estrutura Patrimonial",
  fields: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nome da Estrutura (ex: Máquinas, Veículos, Imóveis)", required: true, full: true },
    { key: "depreciation_rate", label: "Depreciação padrão (% a.a.)", type: "number" },
    { key: "useful_life_years", label: "Vida útil padrão (anos)", type: "number" },
    { key: "deprec_expense_account_id", label: "Conta Contábil — Despesa de Depreciação (D)", type: "entity-select", entity: "ErpChartAccount", labelKey: "name", cacheKey: "deprec_expense_account_name", prefixKey: "code", prefixCacheKey: "deprec_expense_account_code", full: true, optionsFilter: a => a.accepts_entries !== false, sortOptions: compareChartCode, hierarchical: true },
    { key: "deprec_accum_account_id", label: "Conta Contábil — Depreciação Acumulada (C)", type: "entity-select", entity: "ErpChartAccount", labelKey: "name", cacheKey: "deprec_accum_account_name", prefixKey: "code", prefixCacheKey: "deprec_accum_account_code", full: true, optionsFilter: a => a.accepts_entries !== false, sortOptions: compareChartCode, hierarchical: true },
    { key: "ciap_debit_account_id", label: "Conta Contábil — CIAP: ICMS a Recuperar/Outros Créditos (D)", type: "entity-select", entity: "ErpChartAccount", labelKey: "name", cacheKey: "ciap_debit_account_name", prefixKey: "code", prefixCacheKey: "ciap_debit_account_code", full: true, optionsFilter: a => a.accepts_entries !== false, sortOptions: compareChartCode, hierarchical: true },
    { key: "ciap_credit_account_id", label: "Conta Contábil — CIAP: ICMS do Ativo Permanente (C)", type: "entity-select", entity: "ErpChartAccount", labelKey: "name", cacheKey: "ciap_credit_account_name", prefixKey: "code", prefixCacheKey: "ciap_credit_account_code", full: true, optionsFilter: a => a.accepts_entries !== false, sortOptions: compareChartCode, hierarchical: true },
    { key: "notes", label: "Observações", full: true },
    { key: "is_active", label: "Ativa", type: "checkbox" },
  ],
  columns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Estrutura" },
    { key: "depreciation_rate", label: "% a.a." },
    { key: "useful_life_years", label: "Vida útil (anos)" },
    { key: "deprec_expense_account_code", label: "Despesa Depreciação", render: it => it.deprec_expense_account_code ? `${it.deprec_expense_account_code} — ${it.deprec_expense_account_name || ""}` : "—" },
    { key: "deprec_accum_account_code", label: "Deprec. Acumulada", render: it => it.deprec_accum_account_code ? `${it.deprec_accum_account_code} — ${it.deprec_accum_account_name || ""}` : "—" },
    { key: "ciap_debit_account_code", label: "CIAP (D/C)", render: it => (it.ciap_debit_account_code || it.ciap_credit_account_code) ? `${it.ciap_debit_account_code || "—"} / ${it.ciap_credit_account_code || "—"}` : "—" },
    { key: "is_active", label: "Ativa", type: "bool" },
  ],
  searchKeys: ["name", "code"],
};

const TABS = [
  { id: "estrutura", label: "Estrutura Patrimonial", icon: Network },
  { id: "bens", label: "Cadastro de Bens", icon: Building },
  { id: "depreciacoes", label: "Depreciações", icon: TrendingDown },
  { id: "ciap", label: "CIAP (ICMS do Ativo)", icon: BadgePercent },
  { id: "relatorios", label: "Relatórios Patrimoniais", icon: BarChart3 },
];

export default function ErpModulePatrimonial({ user }) {
  const [sub, setSub] = useState("estrutura");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="amber" />
      {sub === "estrutura" && <ErpSimpleCrud key={sub} user={user} {...ESTRUTURA_CONFIG} />}
      {sub === "bens" && <ErpFixedAssetManager user={user} />}
      {sub === "depreciacoes" && <ErpDepreciationPanel user={user} />}
      {sub === "ciap" && <ErpCiapPanel user={user} />}
      {sub === "relatorios" && <ErpAssetReportsPanel user={user} />}
    </div>
  );
}