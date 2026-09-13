import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Factory, LogOut, Boxes, ShoppingCart, Landmark, Settings, Wrench, Warehouse, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { maskCpfCnpj } from "@/lib/brMasks";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import ErpModuleSuprimentos from "@/components/erp/modules/ErpModuleSuprimentos";
import ErpModuleComercial from "@/components/erp/modules/ErpModuleComercial";
import ErpModuleAdministrativo from "@/components/erp/modules/ErpModuleAdministrativo";
import ErpModuleGerencial from "@/components/erp/modules/ErpModuleGerencial";
import ErpModuleManufatura from "@/components/erp/modules/ErpModuleManufatura";
import ErpModuleWms from "@/components/erp/modules/ErpModuleWms";
import ErpModuleManutencao from "@/components/erp/modules/ErpModuleManutencao";
import ErpModuleLogistica from "@/components/erp/modules/ErpModuleLogistica";

export default function Erp() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [activeModule, setActiveModule] = useState("wms");
  const [company, setCompany] = useState(null);

  // Razão social e CNPJ da empresa (matriz) — cabeçalho do painel
  useEffect(() => {
    if (!user?.email) return;
    base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 20)
      .then(list => setCompany(list.find(c => c.is_main) || list[0] || null))
      .catch(() => setCompany(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  if (!user) { navigate("/erp"); return null; }

  const handleLogout = () => { clearPortalUser(); navigate("/erp"); };

  const modules = [
    { id: "wms", label: "WMS", icon: Warehouse, color: "border-blue-500 text-blue-600" },
    { id: "suprimentos", label: "Suprimentos e Materiais", icon: Boxes, color: "border-indigo-500 text-indigo-600" },
    { id: "manufatura", label: "Manufatura", icon: Factory, color: "border-indigo-500 text-indigo-600" },
    { id: "manutencao", label: "Manutenção", icon: Wrench, color: "border-rose-500 text-rose-600" },
    { id: "comercial", label: "Comercial", icon: ShoppingCart, color: "border-emerald-500 text-emerald-600" },
    { id: "logistica", label: "Logística", icon: Truck, color: "border-cyan-500 text-cyan-600" },
    { id: "administrativo", label: "Administrativo", icon: Landmark, color: "border-amber-500 text-amber-600" },
    { id: "gerencial", label: "Gerencial", icon: Settings, color: "border-purple-500 text-purple-600" },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/portal")} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Factory className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <h1 className="font-bold text-lg leading-tight">
              {company?.razao_social || "ERP — Indústria & Comércio"}
              {company?.cnpj && <span className="font-normal text-sm text-gray-500"> • CNPJ {maskCpfCnpj(String(company.cnpj))}</span>}
            </h1>
            <p className="text-xs text-gray-500">{user.name} • Plano {user.erp_plan || "free"}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500"><LogOut className="w-4 h-4" /> Sair</button>
      </header>

      <div className="bg-white border-b px-4 flex gap-1 flex-shrink-0 overflow-x-auto">
        {modules.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.id} onClick={() => setActiveModule(m.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModule === m.id ? m.color : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-4 h-4" /> {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeModule === "suprimentos" && <ErpModuleSuprimentos user={user} />}
        {activeModule === "comercial" && <ErpModuleComercial user={user} />}
        {activeModule === "administrativo" && <ErpModuleAdministrativo user={user} />}
        {activeModule === "gerencial" && <ErpModuleGerencial user={user} />}
        {activeModule === "manufatura" && <ErpModuleManufatura user={user} />}
        {activeModule === "wms" && <ErpModuleWms user={user} />}
        {activeModule === "manutencao" && <ErpModuleManutencao user={user} />}
        {activeModule === "logistica" && <ErpModuleLogistica user={user} />}
      </div>
    </div>
  );
}