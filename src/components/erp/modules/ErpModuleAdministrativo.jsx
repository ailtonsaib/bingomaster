import { useState } from "react";
import {
  CreditCard, Banknote, Landmark, BookOpen, Building, ScrollText, PieChart, Target,
  ListTree, ArrowLeftRight, BarChart3, FileText, BookCheck, Layers,
  Users, Network, Receipt,
} from "lucide-react";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpChartAccountManager from "@/components/erp/ErpChartAccountManager";
import ErpChartAccountReferentialManager from "@/components/erp/ErpChartAccountReferentialManager";
import ErpDreStructureManager from "@/components/erp/ErpDreStructureManager";
import ErpJournalEntryManager from "@/components/erp/ErpJournalEntryManager";
import ErpAccountingReports from "@/components/erp/ErpAccountingReports";
import ErpAccountingSped from "@/components/erp/ErpAccountingSped";
import ErpFinanceReports from "@/components/erp/ErpFinanceReports";
import ErpEmployeeManager from "@/components/erp/ErpEmployeeManager";
import ErpPayrollRubricManager from "@/components/erp/ErpPayrollRubricManager";
import ErpPayrollTaxTableManager from "@/components/erp/ErpPayrollTaxTableManager";
import ErpPayrollPanel from "@/components/erp/ErpPayrollPanel";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";
import ErpModulePatrimonial from "./ErpModulePatrimonial";
import ErpModuleCusto from "./ErpModuleCusto";
import ErpModuleOrcamento from "./ErpModuleOrcamento";
import ErpModuleFiscal from "./ErpModuleFiscal";

const SUBMODULES = [
  {
    id: "financeiro", label: "Financeiro", icon: Landmark, color: "blue",
    items: [
      { id: "contasPagar", label: "Contas a Pagar", icon: CreditCard },
      { id: "contasReceber", label: "Contas a Receber", icon: Banknote },
      { id: "contasBancarias", label: "Contas Bancárias", icon: Landmark },
      { id: "caixaBanco", label: "Caixa e Banco", icon: ArrowLeftRight },
      { id: "relatoriosFinanceiro", label: "Relatórios do Financeiro", icon: BarChart3 },
    ],
  },
  {
    id: "contabil", label: "Contábil", icon: BookOpen, color: "amber",
    items: [
      { id: "planoContas", label: "Plano de Contas", icon: ListTree },
      { id: "planoReferencial", label: "Plano Referencial (Receita)", icon: BookCheck },
      { id: "movimentos", label: "Lançamentos Contábeis", icon: ArrowLeftRight },
      { id: "estruturaDre", label: "Estrutura de DRE", icon: Layers },
      { id: "relatoriosContabeis", label: "Relatórios Contábeis", icon: BarChart3 },
      { id: "spedContabil", label: "SPED ECD", icon: FileText },
    ],
  },
  {
    id: "patrimonial", label: "Patrimonial", icon: Building, color: "amber",
    items: [],
  },
  {
    id: "custos", label: "Custo de Produção", icon: PieChart, color: "purple",
    items: [],
  },
  {
    id: "orcamento", label: "Orçamento", icon: Target, color: "emerald",
    items: [],
  },
  {
    id: "fiscal", label: "Fiscal", icon: ScrollText, color: "indigo",
    items: [],
  },
  {
    id: "rh", label: "RH", icon: Users, color: "emerald",
    items: [
      { id: "funcionariosFolha", label: "Funcionários (Folha)", icon: Users },
      { id: "rubricas", label: "Rubricas (Proventos/Descontos)", icon: Receipt },
      { id: "tabelasImpostos", label: "Tabelas de Impostos", icon: ScrollText },
      { id: "folhaPagamento", label: "Folha de Pagamento", icon: Receipt },
      { id: "funcionarios", label: "Usuários do Sistema", icon: Users },
      { id: "departamentos", label: "Departamentos", icon: Building },
      { id: "setores", label: "Setores", icon: Network },
    ],
  },
];

export default function ErpModuleAdministrativo({ user }) {
  const [mod, setMod] = useState("financeiro");
  const [sub, setSub] = useState("contasPagar");
  const active = SUBMODULES.find(s => s.id === mod) || SUBMODULES[0];

  const selectModule = (id) => {
    setMod(id);
    setSub((SUBMODULES.find(s => s.id === id).items[0] || {}).id);
  };

  const renderSub = () => {
    // Grupos com sub-módulos próprios (navegação interna do próprio grupo)
    if (active.id === "patrimonial") return <ErpModulePatrimonial user={user} />;
    if (active.id === "custos") return <ErpModuleCusto user={user} />;
    if (active.id === "orcamento") return <ErpModuleOrcamento user={user} />;
    if (active.id === "fiscal") return <ErpModuleFiscal user={user} />;
    switch (sub) {
      case "planoReferencial": return <ErpChartAccountReferentialManager user={user} />;
      case "estruturaDre": return <ErpDreStructureManager user={user} />;
      case "planoContas": return <ErpChartAccountManager user={user} />;
      case "movimentos": return <ErpJournalEntryManager user={user} />;
      case "relatoriosContabeis": return <ErpAccountingReports user={user} />;
      case "spedContabil": return <ErpAccountingSped user={user} />;
      case "relatoriosFinanceiro": return <ErpFinanceReports user={user} />;
      case "funcionariosFolha": return <ErpEmployeeManager user={user} />;
      case "rubricas": return <ErpPayrollRubricManager user={user} />;
      case "tabelasImpostos": return <ErpPayrollTaxTableManager user={user} />;
      case "folhaPagamento": return <ErpPayrollPanel user={user} />;
      case "funcionarios": return <ErpSimpleCrud key="usuarios" user={user} {...ERP_CRUD_CONFIGS.usuarios} />;
      default: return <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS[sub]} />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {SUBMODULES.map(m => (
          <button key={m.id} onClick={() => selectModule(m.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${mod === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-muted"}`}>
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>
      {active.items.length > 0 && <SubNav sub={sub} setSub={setSub} tabs={active.items} color={active.color} />}
      {renderSub()}
    </div>
  );
}