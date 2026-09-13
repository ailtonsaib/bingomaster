import { useState } from "react";
import { Factory, FileStack, Workflow, Layers, GitBranch, Activity } from "lucide-react";
import ErpProductionStopsPanel from "@/components/erp/ErpProductionStopsPanel";
import ErpProductionPanel from "@/components/erp/ErpProductionPanel";
import ErpTechnicalSheetManager from "@/components/erp/ErpTechnicalSheetManager";
import ErpProductionRouteManager from "@/components/erp/ErpProductionRouteManager";
import ErpProductionStageManager from "@/components/erp/ErpProductionStageManager";
import ErpProductionLineManager from "@/components/erp/ErpProductionLineManager";
import { SubNav } from "./ErpModuleSuprimentos";

const TABS = [
  { id: "op", label: "Ordens de Produção", icon: Factory },
  { id: "ficha", label: "Ficha Técnica", icon: FileStack },
  { id: "roteiros", label: "Roteiros de Produção", icon: Workflow },
  { id: "etapas", label: "Etapas de Produção", icon: Layers },
  { id: "linhas", label: "Linhas de Produção", icon: GitBranch },
  { id: "paradas", label: "Monitor de Paradas", icon: Activity },
];

export default function ErpModuleManufatura({ user }) {
  const [sub, setSub] = useState("op");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="indigo" />
      {sub === "op" && <ErpProductionPanel user={user} />}
      {sub === "ficha" && <ErpTechnicalSheetManager user={user} />}
      {sub === "roteiros" && <ErpProductionRouteManager user={user} />}
      {sub === "etapas" && <ErpProductionStageManager user={user} />}
      {sub === "linhas" && <ErpProductionLineManager user={user} />}
      {sub === "paradas" && <ErpProductionStopsPanel user={user} />}
    </div>
  );
}