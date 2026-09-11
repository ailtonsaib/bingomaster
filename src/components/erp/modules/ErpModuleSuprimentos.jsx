import { useState } from "react";
import { ShoppingCart, ClipboardList, Gavel, Package, PackagePlus, UserCheck, FileInput, ShieldCheck, Wallet, Receipt, Settings2, Boxes, ArrowLeftRight } from "lucide-react";
import ErpProductManager from "@/components/erp/ErpProductManager";
import ErpPurchasePanel from "@/components/erp/ErpPurchasePanel";
import ErpWarehouseRequisitionPanel from "@/components/erp/ErpWarehouseRequisitionPanel";
import ErpRequisitionPanel from "@/components/erp/ErpRequisitionPanel";
import ErpQuotationPanel from "@/components/erp/ErpQuotationPanel";
import ErpApproverManager from "@/components/erp/ErpApproverManager";
import ErpFiscalEntryPanel from "@/components/erp/ErpFiscalEntryPanel";
import ErpFiscalApprovalPanel from "@/components/erp/ErpFiscalApprovalPanel";
import ErpExpenseEntryPanel from "@/components/erp/ErpExpenseEntryPanel";
import ErpExpenseParameterManager from "@/components/erp/ErpExpenseParameterManager";
import ErpStockInventoryReport from "@/components/erp/ErpStockInventoryReport";
import ErpStockKardexReport from "@/components/erp/ErpStockKardexReport";

const SUBTABS = [
  { id: "almoxarifado", label: "Cadastro de Produtos", icon: Package },
  { id: "compras", label: "Compras", icon: ShoppingCart },
  { id: "solicitacao", label: "Solicitação", icon: ClipboardList },
  { id: "tomada", label: "Tomada de Preço", icon: Gavel },
  { id: "entrada_nf", label: "Entrada de NF", icon: FileInput },
  { id: "aprovacao_nf", label: "Aprovação NF x OC", icon: ShieldCheck },
  { id: "aprovadores", label: "Aprovadores", icon: UserCheck },
  { id: "despesas", label: "Despesas", icon: Wallet },
  { id: "requisicoes_almox", label: "Requisições ao Almoxarifado", icon: PackagePlus },
  { id: "rel_inventario", label: "Rel. Inventário", icon: Boxes },
  { id: "rel_kardex", label: "Movimentação Estoque", icon: ArrowLeftRight },
];

export default function ErpModuleSuprimentos({ user }) {
  const [sub, setSub] = useState("almoxarifado");
  const [despesaSub, setDespesaSub] = useState("entrada");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="indigo" />
      {sub === "almoxarifado" && <ErpProductManager user={user} />}
      {sub === "compras" && <ErpPurchasePanel user={user} />}
      {sub === "solicitacao" && <ErpRequisitionPanel user={user} />}
      {sub === "tomada" && <ErpQuotationPanel user={user} />}
      {sub === "entrada_nf" && <ErpFiscalEntryPanel user={user} onGoToProducts={() => setSub("almoxarifado")} />}
      {sub === "aprovacao_nf" && <ErpFiscalApprovalPanel user={user} />}
      {sub === "aprovadores" && <ErpApproverManager user={user} />}
      {sub === "despesas" && (
        <div className="space-y-3">
          <SubNav sub={despesaSub} setSub={setDespesaSub} tabs={[
            { id: "entrada", label: "Entrada de Despesas", icon: Receipt },
            { id: "parametros", label: "Parâmetros de Despesas", icon: Settings2 },
          ]} color="indigo" />
          {despesaSub === "entrada" && <ErpExpenseEntryPanel user={user} onGoToParams={() => setDespesaSub("parametros")} />}
          {despesaSub === "parametros" && <ErpExpenseParameterManager user={user} />}
        </div>
      )}
      {sub === "requisicoes_almox" && <ErpWarehouseRequisitionPanel user={user} />}
      {sub === "rel_inventario" && <ErpStockInventoryReport user={user} />}
      {sub === "rel_kardex" && <ErpStockKardexReport user={user} />}
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