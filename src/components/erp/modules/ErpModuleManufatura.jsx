import { useState } from "react";
import { Factory, FileStack, Workflow } from "lucide-react";
import ErpProductionPanel from "@/components/erp/ErpProductionPanel";
import ErpTechnicalSheetManager from "@/components/erp/ErpTechnicalSheetManager";
import ErpProductionRouteManager from "@/components/erp/ErpProductionRouteManager";
import { SubNav } from "./ErpModuleSuprimentos";

const TABS = [
  { id: "op", label: "Ordens de Produção", icon: Factory },
  { id: "ficha", label: "Ficha Técnica", icon: FileStack },
  { id: "roteiros", label: "Roteiros de Produção", icon: Workflow },
];

export default function ErpModuleManufatura({ user }) {
  const [sub, setSub] = useState("op");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="indigo" />
      {sub === "op" && <ErpProductionPanel user={user} />}
      {sub === "ficha" && <ErpTechnicalSheetManager user={user} />}
      {sub === "roteiros" && <ErpProductionRouteManager user={user} />}
    </div>
  );
}