import { useState } from "react";
import { Warehouse, ShoppingCart, ClipboardList, Gavel, Factory } from "lucide-react";
import ErpProductManager from "@/components/erp/ErpProductManager";
import ErpPurchasePanel from "@/components/erp/ErpPurchasePanel";
import ErpProductionPanel from "@/components/erp/ErpProductionPanel";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
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
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="indigo" />
      {sub === "almoxarifado" && <ErpProductManager user={user} />}
      {sub === "compras" && <ErpPurchasePanel user={user} />}
      {sub === "solicitacao" && <ErpSimpleCrud key="requisicoes" user={user} {...ERP_CRUD_CONFIGS.requisicoes} />}
      {sub === "tomada" && <ErpSimpleCrud key="cotacoes" user={user} {...ERP_CRUD_CONFIGS.cotacoes} />}
      {sub === "manufatura" && <ErpProductionPanel user={user} />}
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