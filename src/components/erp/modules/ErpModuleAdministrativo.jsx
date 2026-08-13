import { useState } from "react";
import { CreditCard, Banknote, Landmark, BookOpen, PieChart, Building, ScrollText, ListTree, ArrowLeftRight, BarChart3, FileText, BookCheck, Layers } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpFiscalPanel from "@/components/erp/ErpFiscalPanel";
import ErpChartAccountManager from "@/components/erp/ErpChartAccountManager";
import ErpChartAccountReferentialManager from "@/components/erp/ErpChartAccountReferentialManager";
import ErpDreStructureManager from "@/components/erp/ErpDreStructureManager";
import ErpJournalEntryManager from "@/components/erp/ErpJournalEntryManager";
import ErpAccountingReports from "@/components/erp/ErpAccountingReports";
import ErpAccountingSped from "@/components/erp/ErpAccountingSped";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const SUBTABS = [
  { id: "contasPagar", label: "Contas a Pagar", icon: CreditCard },
  { id: "contasReceber", label: "Contas a Receber", icon: Banknote },
  { id: "caixaBanco", label: "Caixa e Banco", icon: Landmark },
  { id: "contasBancarias", label: "Contas Bancárias", icon: Landmark },
  { id: "planoReferencial", label: "Plano Referencial (Receita)", icon: BookCheck },
  { id: "planoContas", label: "Plano de Contas", icon: ListTree },
  { id: "movimentos", label: "Lançamentos Contábeis", icon: ArrowLeftRight },
  { id: "estruturaDre", label: "Estrutura de DRE", icon: Layers },
  { id: "relatoriosContabeis", label: "Relatórios Contábeis", icon: BarChart3 },
  { id: "spedContabil", label: "SPED ECD", icon: FileText },
  { id: "contabilidade", label: "Contabilidade (antigo)", icon: BookOpen },
  { id: "custos", label: "Custos", icon: PieChart },
  { id: "patrimonial", label: "Patrimonial", icon: Building },
  { id: "fiscal", label: "Fiscal", icon: ScrollText },
];

export default function ErpModuleAdministrativo({ user }) {
  const [sub, setSub] = useState("contasPagar");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="amber" />
      {sub === "fiscal" ? <ErpFiscalPanel user={user} />
        : sub === "planoReferencial" ? <ErpChartAccountReferentialManager user={user} />
        : sub === "estruturaDre" ? <ErpDreStructureManager user={user} />
        : sub === "planoContas" ? <ErpChartAccountManager user={user} />
        : sub === "movimentos" ? <ErpJournalEntryManager user={user} />
        : sub === "relatoriosContabeis" ? <ErpAccountingReports user={user} />
        : sub === "spedContabil" ? <ErpAccountingSped user={user} />
        : <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS[sub]} />}
    </div>
  );
}