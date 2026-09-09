import { useState } from "react";
import { Target, BarChart3 } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpBudgetComparisonPanel from "@/components/erp/ErpBudgetComparisonPanel";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const TABS = [
  { id: "cadastro", label: "Cadastro de Orçamentos", icon: Target },
  { id: "comparativo", label: "Orçado x Realizado", icon: BarChart3 },
];

export default function ErpModuleOrcamento({ user }) {
  const [sub, setSub] = useState("cadastro");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="emerald" />
      {sub === "cadastro" && <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS.orcamento} />}
      {sub === "comparativo" && <ErpBudgetComparisonPanel user={user} />}
    </div>
  );
}