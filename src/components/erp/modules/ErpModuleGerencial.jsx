import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, Building2, Users, ScrollText, Network, GitBranch, Boxes, Layers, ArrowRightLeft } from "lucide-react";
import ErpDashboard from "@/components/erp/ErpDashboard";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpTaxRuleManager from "@/components/erp/ErpTaxRuleManager";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const SUBTABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "departamentos", label: "Departamentos", icon: Network },
  { id: "setores", label: "Setores", icon: GitBranch },
  { id: "grupos", label: "Grupos de Estoque", icon: Boxes },
  { id: "subgrupos", label: "Sub-grupos", icon: Layers },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "operacoes", label: "Operações", icon: ArrowRightLeft },
  { id: "regras", label: "Regras Fiscais", icon: ScrollText },
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
      {sub === "regras" && <ErpTaxRuleManager user={user} />}
      {sub !== "dashboard" && sub !== "regras" && <ErpSimpleCrud key={sub} user={user} {...ERP_CRUD_CONFIGS[sub]} />}
    </div>
  );
}