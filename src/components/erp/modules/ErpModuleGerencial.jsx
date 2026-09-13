import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, Building2, Building, Users, ScrollText, Network, GitBranch, Boxes, Layers, ArrowRightLeft, Handshake, SlidersHorizontal, ListChecks, History, MonitorSmartphone, BarChart3 } from "lucide-react";
import ErpAppsColetoresPanel from "@/components/erp/ErpAppsColetoresPanel";
import ErpBipReportPanel from "@/components/erp/ErpBipReportPanel";
import ErpDashboard from "@/components/erp/ErpDashboard";
import ErpAccountingEventManager from "@/components/erp/ErpAccountingEventManager";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpTaxRuleManager from "@/components/erp/ErpTaxRuleManager";
import ErpUserManager from "@/components/erp/ErpUserManager";
import ErpUserParameterManager from "@/components/erp/ErpUserParameterManager";
import ErpPartnerManager from "@/components/erp/ErpPartnerManager";
import ErpOperationManager from "@/components/erp/ErpOperationManager";
import ErpCompanyManager from "@/components/erp/ErpCompanyManager";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const SUBTABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "coletores", label: "Aplicativos Coletores", icon: MonitorSmartphone },
  { id: "relatorio_bipagem", label: "Relatório Bipagem", icon: BarChart3 },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "filiais", label: "Filiais", icon: Building },
  { id: "departamentos", label: "Departamentos", icon: Network },
  { id: "setores", label: "Setores", icon: GitBranch },
  { id: "grupos", label: "Grupos de Estoque", icon: Boxes },
  { id: "subgrupos", label: "Sub-grupos", icon: Layers },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "parametros_usuario", label: "Parâmetros de Usuário", icon: SlidersHorizontal },
  { id: "parceiros", label: "Clientes / Fornecedores", icon: Handshake },
  { id: "operacoes", label: "Operações", icon: ArrowRightLeft },
  { id: "regras", label: "Regras Fiscais", icon: ScrollText },
  { id: "eventos", label: "Eventos Contábeis", icon: ListChecks },
  { id: "historicos", label: "Históricos Padrão", icon: History },
];

export default function ErpModuleGerencial({ user }) {
  const [sub, setSub] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [productions, setProductions] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [p, pc, op] = await Promise.all([
          base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpPurchaseOrder.filter({ user_email: user.email }, "-emission_date", 500),
          base44.entities.ErpProductionOrder.filter({ user_email: user.email }, "-emission_date", 500),
        ]);
        setProducts(p); setPurchases(pc); setProductions(op);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="purple" />
      {sub === "dashboard" && (loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" /></div> : <ErpDashboard products={products} purchases={purchases} productions={productions} />)}
      {sub === "coletores" && <ErpAppsColetoresPanel user={user} />}
      {sub === "relatorio_bipagem" && <ErpBipReportPanel user={user} />}
      {sub === "regras" && <ErpTaxRuleManager user={user} />}
      {sub === "usuarios" && <ErpUserManager user={user} />}
      {sub === "parametros_usuario" && <ErpUserParameterManager user={user} />}
      {sub === "parceiros" && <ErpPartnerManager user={user} />}
      {sub === "operacoes" && <ErpOperationManager user={user} />}
      {sub === "eventos" && <ErpAccountingEventManager user={user} />}
      {sub === "empresas" && <ErpCompanyManager user={user} />}
      {sub !== "dashboard" && sub !== "coletores" && sub !== "relatorio_bipagem" && sub !== "regras" && sub !== "usuarios" && sub !== "parametros_usuario" && sub !== "parceiros" && sub !== "operacoes" && sub !== "eventos" && sub !== "empresas" && <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS[sub]} />}
    </div>
  );
}