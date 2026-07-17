import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import { LogOut, Wrench, ClipboardList, Users, Package, Stethoscope, Car, Settings, DollarSign, History, BarChart3, Trophy, Activity, AlertTriangle, Loader2, Building2, ArrowDownToLine } from "lucide-react";
import ServiceOrderList from "@/components/workshop/ServiceOrderList";
import MechanicManager from "@/components/workshop/MechanicManager";
import PartManager from "@/components/workshop/PartManager";
import SupplierManager from "@/components/workshop/SupplierManager";
import EntryManager from "@/components/workshop/EntryManager";
import UserManager from "@/components/workshop/UserManager";
import ClientVehicleManager from "@/components/workshop/ClientVehicleManager";
import ServiceTypeManager from "@/components/workshop/ServiceTypeManager";
import CommissionPanel from "@/components/workshop/CommissionPanel";
import MaintenanceHistoryPanel from "@/components/workshop/MaintenanceHistoryPanel";
import MonthlyReportPanel from "@/components/workshop/MonthlyReportPanel";
import MechanicRankingPanel from "@/components/workshop/MechanicRankingPanel";
import MechanicProductivityPanel from "@/components/workshop/MechanicProductivityPanel";
import DiagnosticBlockedScreen from "@/components/workshop/DiagnosticBlockedScreen";
import WorkshopFinancePanel from "@/components/workshop/WorkshopFinancePanel";
import CompanyConfigModal from "@/components/workshop/CompanyConfigModal";

const TABS = [
  { id: "diagnostic", label: "Diagnóstico IA", icon: Stethoscope, isLink: true },
  { id: "clients", label: "Clientes e Veículos", icon: Car },
  { id: "orders", label: "Ordens de Serviço", icon: ClipboardList },
  { id: "finance", label: "Financeiro", icon: DollarSign },
  { id: "history", label: "Histórico de Manutenção", icon: History },
  { id: "report", label: "Relatório Mensal", icon: BarChart3 },
  { id: "service_types", label: "Tipos de Serviço", icon: Settings },
  { id: "mechanics", label: "Mecânicos", icon: Users },
  { id: "commissions", label: "Comissões", icon: DollarSign },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "productivity", label: "Produtividade", icon: Activity },
  { id: "parts", label: "Peças", icon: Package },
  { id: "suppliers", label: "Fornecedores", icon: Building2 },
  { id: "entries", label: "Entradas", icon: ArrowDownToLine },
  { id: "users", label: "Usuários", icon: Users },
];

export default function Workshop() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = getPortalUser();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "orders");
  const [subStatus, setSubStatus] = useState(null);
  const [checkingSub, setCheckingSub] = useState(true);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const res = await base44.functions.invoke("manageDiagnostic", { operation: "getUsage" });
        if (res?.data) setSubStatus(res.data);
      } catch { /* ignore */ }
      setCheckingSub(false);
    };
    checkSubscription();
  }, []);

  const handleLogout = () => {
    clearPortalUser();
    navigate("/");
  };

  const handleTabClick = (tab) => {
    if (tab.isLink) {
      navigate("/diagnostico-auto");
    } else {
      setActiveTab(tab.id);
    }
  };

  if (checkingSub) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (subStatus?.subscription_status === "blocked") {
    return <DiagnosticBlockedScreen message={subStatus.subscription_message} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#DBEAFE] flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <span className="font-bold text-[#1B1C21] text-sm">Sistema Automotivo</span>
              {user && <span className="text-xs text-[#A1A1AA] ml-2">| {user.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCompanyModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#52525B] hover:bg-gray-100 transition-colors">
              <Building2 className="w-4 h-4" /> Empresa
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#52525B] hover:bg-gray-100 transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Grace period warning */}
        {subStatus?.subscription_status === "grace_period" && (
          <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-5 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Atenção — Mensalidade em atraso</p>
              <p className="text-sm text-amber-700 mt-1">{subStatus.subscription_message}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 p-1 bg-gray-100 rounded-xl max-w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = !tab.isLink && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          {activeTab === "clients" && <ClientVehicleManager userEmail={user?.email} />}
          {activeTab === "orders" && <ServiceOrderList userEmail={user?.email} />}
          {activeTab === "finance" && <WorkshopFinancePanel userEmail={user?.email} />}
          {activeTab === "service_types" && <ServiceTypeManager userEmail={user?.email} />}
          {activeTab === "mechanics" && <MechanicManager userEmail={user?.email} />}
          {activeTab === "commissions" && <CommissionPanel userEmail={user?.email} />}
          {activeTab === "history" && <MaintenanceHistoryPanel userEmail={user?.email} />}
          {activeTab === "report" && <MonthlyReportPanel userEmail={user?.email} />}
          {activeTab === "ranking" && <MechanicRankingPanel userEmail={user?.email} />}
          {activeTab === "productivity" && <MechanicProductivityPanel userEmail={user?.email} />}
          {activeTab === "parts" && <PartManager userEmail={user?.email} />}
          {activeTab === "suppliers" && <SupplierManager userEmail={user?.email} />}
          {activeTab === "entries" && <EntryManager userEmail={user?.email} />}
          {activeTab === "users" && <UserManager userEmail={user?.email} />}
        </div>
      </div>

      <CompanyConfigModal
        userEmail={user?.email}
        open={companyModalOpen}
        onClose={() => setCompanyModalOpen(false)}
      />
    </div>
  );
}