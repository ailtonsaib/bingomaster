import { useState } from "react";
import { PieChart, Crosshair } from "lucide-react";
import ErpProductionCostPanel from "@/components/erp/ErpProductionCostPanel";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const TABS = [
  { id: "custo", label: "Custo de Produção", icon: PieChart },
  { id: "centros", label: "Centros de Custo", icon: Crosshair },
];

export default function ErpModuleCusto({ user }) {
  const [sub, setSub] = useState("custo");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="purple" />
      {sub === "custo" && <ErpProductionCostPanel user={user} />}
      {sub === "centros" && <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS.custos} />}
    </div>
  );
}