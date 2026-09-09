import { useState } from "react";
import { Building, Network, TrendingDown, BadgePercent, BarChart3 } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpFixedAssetManager from "@/components/erp/ErpFixedAssetManager";
import ErpDepreciationPanel from "@/components/erp/ErpDepreciationPanel";
import ErpCiapPanel from "@/components/erp/ErpCiapPanel";
import ErpAssetReportsPanel from "@/components/erp/ErpAssetReportsPanel";
import { SubNav } from "./ErpModuleSuprimentos";

const ESTRUTURA_CONFIG = {
  entityName: "ErpAssetStructure",
  title: "Cadastro de Estrutura Patrimonial",
  fields: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nome da Estrutura (ex: Máquinas, Veículos, Imóveis)", required: true, full: true },
    { key: "depreciation_rate", label: "Depreciação padrão (% a.a.)", type: "number" },
    { key: "useful_life_years", label: "Vida útil padrão (anos)", type: "number" },
    { key: "notes", label: "Observações", full: true },
    { key: "is_active", label: "Ativa", type: "checkbox" },
  ],
  columns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Estrutura" },
    { key: "depreciation_rate", label: "% a.a." },
    { key: "useful_life_years", label: "Vida útil (anos)" },
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