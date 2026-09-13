import { useState } from "react";
import { ArrowRightLeft, ScrollText, Eye, BookOpen, Radar } from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpTaxRuleManager from "@/components/erp/ErpTaxRuleManager";
import ErpFiscalPanel from "@/components/erp/ErpFiscalPanel";
import ErpFiscalRadar from "@/components/erp/ErpFiscalRadar";
import ErpOperationAccountingManager from "@/components/erp/ErpOperationAccountingManager";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const TABS = [
  { id: "operacoes", label: "Operações de Entrada/Saída", icon: ArrowRightLeft },
  { id: "regras", label: "Regras Fiscais (ICMS/PIS/COFINS/IPI/IBS/CBS)", icon: ScrollText },
  { id: "contabil", label: "Contabilização da NF por Operação", icon: BookOpen },
  { id: "visao", label: "Visão Consolidada", icon: Eye },
  { id: "radar", label: "Radar Fiscal (Notas contra a Empresa)", icon: Radar },
];

export default function ErpModuleFiscal({ user }) {
  const [sub, setSub] = useState("operacoes");
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={TABS} color="indigo" />
      {sub === "operacoes" && <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS.operacoes} />}
      {sub === "regras" && <ErpTaxRuleManager user={user} />}
      {sub === "contabil" && <ErpOperationAccountingManager user={user} />}
      {sub === "visao" && <ErpFiscalPanel user={user} />}
      {sub === "radar" && <ErpFiscalRadar user={user} />}
    </div>
  );
}