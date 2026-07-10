import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Grid3x3, Wallet, FileText, Shield, LogOut, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { APPS } from "@/lib/appRegistry";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import ChangePasswordModal from "@/components/portal/ChangePasswordModal";

const iconMap = { Grid3x3, Wallet, FileText, Shield };

export default function Portal() {
  const navigate = useNavigate();
  const user = getPortalUser();
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/portal-login?next=/');
    }
  }, [user, navigate]);

  if (!user) return null;

  const handleAppClick = async (app) => {
    // Registra qual aplicativo o usuário está acessando
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'trackApp',
        email: user.email,
        app: app.id,
      });
    } catch (_) {}
    navigate(app.url);
  };

  const handleLogout = () => {
    clearPortalUser();
    navigate('/portal-login');
  };

  // Show only apps the user has permission for; admin-only apps require is_admin
  const visibleApps = APPS.filter((app) => {
    if (app.adminOnly) return user?.is_admin;
    return !app.permission || user[app.permission];
  });

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex flex-col items-center justify-center p-6 relative">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={() => setShowChangePassword(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#6B7280] text-sm transition-colors shadow-sm"
          title="Alterar Senha"
        >
          <KeyRound className="w-4 h-4" />
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#6B7280] text-sm transition-colors shadow-sm"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 relative"
      >
        <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-[#1D1D21]">
          SoftPremier
        </h1>
        <p className="mt-3 text-[#6B7280]">
          Olá, {user?.name}! Selecione um aplicativo para começar
        </p>
      </motion.div>

      {/* App grid */}
      {visibleApps.length > 0 ? (
        <div className="flex flex-wrap items-start justify-center gap-6">
          {visibleApps.map((app, idx) => {
            const Icon = iconMap[app.icon] || Grid3x3;
            return (
              <motion.button
                key={app.id}
                onClick={() => handleAppClick(app)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border border-[#F0F0F2] shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all cursor-pointer w-48"
              >
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${app.iconBg}`}>
                  <Icon className={`w-10 h-10 ${app.iconColor}`} />
                </div>
                <span className="font-bold text-sm text-center text-[#1D1D21]">{app.name}</span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-[#9CA3AF] text-center max-w-sm"
        >
          Você ainda não possui acesso a nenhum aplicativo. Contate o administrador para liberar seu acesso.
        </motion.p>
      )}

      {showChangePassword && (
        <ChangePasswordModal
          userEmail={user?.email}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </div>
  );
}