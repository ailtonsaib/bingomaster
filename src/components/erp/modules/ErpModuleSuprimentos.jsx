import { useState } from "react";
import { Warehouse, ShoppingCart, ClipboardList, Gavel, Factory, FileStack } from "lucide-react";
import ErpProductManager from "@/components/erp/ErpProductManager";
import ErpPurchasePanel from "@/components/erp/ErpPurchasePanel";
import ErpProductionPanel from "@/components/erp/ErpProductionPanel";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpRequisitionPanel from "@/components/erp/ErpRequisitionPanel";
import ErpTechnicalSheetManager from "@/components/erp/ErpTechnicalSheetManager";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";

const SUBTABS = [
  { id: "almoxarifado", label: "Almoxarifado", icon: Warehouse },
  { id: "compras", label: "Compras", icon: ShoppingCart },
  { id: "solicitacao", label: "Solicitação", icon: ClipboardList },
  { id: "tomada", label: "Tomada de Preço", icon: Gavel },
  { id: "manufatura", label: "Manufatura", icon: Factory },
];

export default function ErpModuleSuprimentos({ user }) {
  const [sub, setSub] = useState("almoxarifado");
  const [manSub, setManSub] = useState("op");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="indigo" />
      {sub === "almoxarifado" && <ErpProductManager user={user} />}
      {sub === "compras" && <ErpPurchasePanel user={user} />}
      {sub === "solicitacao" && <ErpRequisitionPanel user={user} />}
      {sub === "tomada" && <ErpSimpleCrud key="cotacoes" user={user} {...ERP_CRUD_CONFIGS.cotacoes} />}
      {sub === "manufatura" && (
        <div className="space-y-3">
          <SubNav sub={manSub} setSub={setManSub} tabs={[
            { id: "op", label: "Ordens de Produção", icon: Factory },
            { id: "ficha", label: "Ficha Técnica", icon: FileStack },
          ]} color="indigo" />
          {manSub === "op" && <ErpProductionPanel user={user} />}
          {manSub === "ficha" && <ErpTechnicalSheetManager user={user} />}
        </div>
      )}
    </div>
  );
}

export function SubNav({ sub, setSub, tabs, color = "indigo" }) {
  const colorMap = { indigo: "bg-indigo-600", emerald: "bg-emerald-600", amber: "bg-amber-600", purple: "bg-purple-600" };
  return (
    <div className="flex gap-1 flex-wrap bg-white rounded-xl border p-1">
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => setSub(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${sub === t.id ? `${colorMap[color]} text-white` : "text-gray-600 hover:bg-gray-100"}`}>
            <Icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        );
      })}
    </div>
  );
}