import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import { LogOut, Receipt, Loader2, Building2, AlertTriangle } from "lucide-react";
import WorkshopCaixaPanel from "@/components/workshop/WorkshopCaixaPanel";

export default function CaixaPanel() {
  const navigate = useNavigate();
  const user = getPortalUser();
  const effectiveEmail = user?.owner_email || user?.email;
  const [companyConfig, setCompanyConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/diagnostico");
      return;
    }
    // Redireciona se não for caixa
    if (user.workshop_role !== "caixa") {
      navigate("/diagnostico-oficina");
      return;
    }
    const loadCompany = async () => {
      try {
        const list = await base44.entities.DiagnosticCompanyConfig.filter({ user_email: effectiveEmail });
        setCompanyConfig(list[0] || null);
      } catch { /* ignore */ }
      setLoading(false);
    };
    loadCompany();
  }, []);

  const handleLogout = () => {
    clearPortalUser();
    navigate("/diagnostico");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-900 text-sm truncate block">
                {companyConfig?.nome_fantasia || companyConfig?.razao_social || "Caixa"}
              </span>
              {user && <span className="text-xs text-gray-400">| {user.name}</span>}
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {!companyConfig && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Configuração da empresa incompleta</p>
              <p className="text-xs text-amber-600 mt-0.5">Os dados da empresa aparecerão nos recibos assim que o administrador concluir o cadastro.</p>
            </div>
          </div>
        )}
        <WorkshopCaixaPanel userEmail={effectiveEmail} />
      </div>
    </div>
  );
}