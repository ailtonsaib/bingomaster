import { useState } from "react";
import { CreditCard, Banknote, Landmark, BookOpen, PieChart, Building, ScrollText } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpFiscalPanel from "@/components/erp/ErpFiscalPanel";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const SUBTABS = [
  { id: "contasPagar", label: "Contas a Pagar", icon: CreditCard },
  { id: "contasReceber", label: "Contas a Receber", icon: Banknote },
  { id: "caixaBanco", label: "Caixa e Banco", icon: Landmark },
  { id: "contasBancarias", label: "Contas Bancárias", icon: Landmark },
  { id: "contabilidade", label: "Contabilidade", icon: BookOpen },
  { id: "custos", label: "Custos", icon: PieChart },
  { id: "patrimonial", label: "Patrimonial", icon: Building },
  { id: "fiscal", label: "Fiscal", icon: ScrollText },
];

export default function ErpModuleAdministrativo({ user }) {
  const [sub, setSub] = useState("contasPagar");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="amber" />
      {sub === "fiscal" ? <ErpFiscalPanel user={user} /> : (
        <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS[sub]} />
      )}
    </div>
  );
}