import { useState } from "react";
import { Target, BarChart3 } from "lucide-react";
import ErpBudgetManager from "@/components/erp/ErpBudgetManager";
import ErpBudgetComparisonPanel from "@/components/erp/ErpBudgetComparisonPanel";
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
      {sub === "cadastro" && <ErpBudgetManager user={user} />}
      {sub === "comparativo" && <ErpBudgetComparisonPanel user={user} />}
    </div>
  );
}