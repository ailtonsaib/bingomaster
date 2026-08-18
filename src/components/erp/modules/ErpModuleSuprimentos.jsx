import { useState } from "react";
import { Warehouse, ShoppingCart, ClipboardList, Gavel, Factory, FileStack, Workflow, Package, UserCheck, FileInput, ShieldCheck } from "lucide-react";
import ErpProductManager from "@/components/erp/ErpProductManager";
import ErpPurchasePanel from "@/components/erp/ErpPurchasePanel";
import ErpProductionPanel from "@/components/erp/ErpProductionPanel";
import ErpRequisitionPanel from "@/components/erp/ErpRequisitionPanel";
import ErpQuotationPanel from "@/components/erp/ErpQuotationPanel";
import ErpTechnicalSheetManager from "@/components/erp/ErpTechnicalSheetManager";
import ErpProductionRouteManager from "@/components/erp/ErpProductionRouteManager";
import ErpApproverManager from "@/components/erp/ErpApproverManager";
import ErpFiscalEntryPanel from "@/components/erp/ErpFiscalEntryPanel";
import ErpFiscalApprovalPanel from "@/components/erp/ErpFiscalApprovalPanel";

const SUBTABS = [
  { id: "almoxarifado", label: "Cadastro de Produtos", icon: Package },
  { id: "compras", label: "Compras", icon: ShoppingCart },
  { id: "solicitacao", label: "Solicitação", icon: ClipboardList },
  { id: "tomada", label: "Tomada de Preço", icon: Gavel },
  { id: "entrada_nf", label: "Entrada de NF", icon: FileInput },
  { id: "aprovacao_nf", label: "Aprovação NF x OC", icon: ShieldCheck },
  { id: "aprovadores", label: "Aprovadores", icon: UserCheck },
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
      {sub === "tomada" && <ErpQuotationPanel user={user} />}
      {sub === "entrada_nf" && <ErpFiscalEntryPanel user={user} />}
      {sub === "aprovacao_nf" && <ErpFiscalApprovalPanel user={user} />}
      {sub === "aprovadores" && <ErpApproverManager user={user} />}
      {sub === "manufatura" && (
        <div className="space-y-3">
          <SubNav sub={manSub} setSub={setManSub} tabs={[
            { id: "op", label: "Ordens de Produção", icon: Factory },
            { id: "ficha", label: "Ficha Técnica", icon: FileStack },
            { id: "roteiros", label: "Roteiros de Produção", icon: Workflow },
          ]} color="indigo" />
          {manSub === "op" && <ErpProductionPanel user={user} />}
          {manSub === "ficha" && <ErpTechnicalSheetManager user={user} />}
          {manSub === "roteiros" && <ErpProductionRouteManager user={user} />}
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