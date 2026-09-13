import { useState } from "react";
import { Users, ClipboardCheck, Monitor, BarChart3, Network, Tags, Briefcase, Share2, Target, CircleDollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErpSimpleCrud from "@/components/erp/ErpSimpleCrud";
import ErpSalesOrderPanel from "@/components/erp/ErpSalesOrderPanel";
import ErpSalesReport from "@/components/erp/ErpSalesReport";
import ErpSalesTeamManager from "@/components/erp/ErpSalesTeamManager";
import ErpSalesGoalManager from "@/components/erp/ErpSalesGoalManager";
import ErpPriceTableManager from "@/components/erp/ErpPriceTableManager";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";
import { SubNav } from "./ErpModuleSuprimentos";

const SUBTABS = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "equipe", label: "Equipe de Vendas", icon: Network },
  { id: "canais", label: "Canais", icon: Tags },
  { id: "redes", label: "Redes", icon: Share2 },
  { id: "objetivos", label: "Objetivos de Vendas", icon: Target },
  { id: "tabelas", label: "Tabelas de Preço", icon: CircleDollarSign },
  { id: "ramos", label: "Ramos de Atividade", icon: Briefcase },
  { id: "pedidos", label: "Pedidos e Faturamento", icon: ClipboardCheck },
  { id: "pdv", label: "PDV", icon: Monitor },
  { id: "relatorios", label: "Relatórios de Vendas", icon: BarChart3 },
];

export default function ErpModuleComercial({ user }) {
  const [sub, setSub] = useState("clientes");
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <SubNav sub={sub} setSub={setSub} tabs={SUBTABS} color="emerald" />
      {sub === "clientes" && <ErpSimpleCrud key="clientes" user={user} {...ERP_CRUD_CONFIGS.clientes} />}
      {sub === "equipe" && <ErpSalesTeamManager user={user} />}
      {sub === "canais" && <ErpSimpleCrud key="canais" user={user} {...ERP_CRUD_CONFIGS.canais} />}
      {sub === "redes" && <ErpSimpleCrud key="redes" user={user} {...ERP_CRUD_CONFIGS.redes} />}
      {sub === "objetivos" && <ErpSalesGoalManager user={user} />}
      {sub === "tabelas" && <ErpPriceTableManager user={user} />}
      {sub === "ramos" && <ErpSimpleCrud key="ramos" user={user} {...ERP_CRUD_CONFIGS.ramos} />}
      {sub === "pedidos" && <ErpSalesOrderPanel user={user} />}
      {sub === "pdv" && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Monitor className="w-12 h-12 mx-auto mb-3 text-emerald-600 opacity-40" />
          <h3 className="font-semibold mb-1">Frente de Caixa (PDV)</h3>
          <p className="text-sm text-gray-500 mb-4">O módulo completo de PDV (cupom fiscal NFC-e, estoque, caixa) é gerenciado em seu próprio painel.</p>
          <button onClick={() => navigate("/pdv-caixa")} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">Abrir PDV</button>
        </div>
      )}
      {sub === "relatorios" && <ErpSalesReport user={user} />}
    </div>
  );
}