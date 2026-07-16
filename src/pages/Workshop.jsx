import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import { LogOut, Wrench, ClipboardList, Users, Package, Stethoscope } from "lucide-react";
import ServiceOrderList from "@/components/workshop/ServiceOrderList";
import MechanicManager from "@/components/workshop/MechanicManager";
import PartManager from "@/components/workshop/PartManager";

const TABS = [
  { id: "diagnostic", label: "Diagnóstico IA", icon: Stethoscope, isLink: true },
  { id: "orders", label: "Ordens de Serviço", icon: ClipboardList },
  { id: "mechanics", label: "Mecânicos", icon: Users },
  { id: "parts", label: "Peças", icon: Package },
];

export default function Workshop() {
  const navigate = useNavigate();
  const user = getPortalUser();
  const [activeTab, setActiveTab] = useState("orders");

  const handleLogout = () => {
    clearPortalUser();
    navigate("/");
  };

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
            <button
              onClick={() => navigate("/diagnostico-auto")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#52525B] hover:bg-gray-100 transition-colors"
            >
              <Stethoscope className="w-4 h-4" /> Diagnóstico IA
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#52525B] hover:bg-gray-100 transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => tab.isLink ? navigate("/diagnostico-auto") : setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id ? "bg-white text-[#2563EB] shadow-sm" : "text-[#71717A] hover:text-[#52525B]"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          {activeTab === "orders" && <ServiceOrderList userEmail={user?.email} />}
          {activeTab === "mechanics" && <MechanicManager userEmail={user?.email} />}
          {activeTab === "parts" && <PartManager userEmail={user?.email} />}
        </div>
      </div>
    </div>
  );
}