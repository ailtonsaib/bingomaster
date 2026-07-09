import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Grid3x3, Wallet, FileText, Settings, LogOut, KeyRound } from "lucide-react";
import { APPS } from "@/lib/appRegistry";
import { getPortalUser, clearPortalUser, isPortalLoggedIn } from "@/lib/portalSession";
import ChangePasswordModal from "@/components/portal/ChangePasswordModal";
import SpedAccessModal from "@/components/portal/SpedAccessModal";

const iconMap = { Grid3x3, Wallet, FileText };

export default function Portal() {
  const navigate = useNavigate();
  const user = getPortalUser();
  const loggedIn = isPortalLoggedIn();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSpedModal, setShowSpedModal] = useState(false);

  const handleAppClick = (app) => {
    if (app.customModal === "sped") {
      setShowSpedModal(true);
      return;
    }
    if (!loggedIn) {
      navigate(`/portal-login?next=${app.url}`);
      return;
    }
    if (app.permission && user && !user[app.permission]) {
      navigate(`/portal-login?next=${app.url}`);
      return;
    }
    navigate(app.url);
  };

  const handleLogout = () => {
    clearPortalUser();
    navigate('/');
  };

  // Show all apps on public portal; filter by permission only when logged in
  const visibleApps = loggedIn
    ? APPS.filter((app) => !app.permission || user[app.permission])
    : APPS;

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex flex-col items-center justify-center p-6 relative">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {loggedIn && user?.is_admin && (
          <button
            onClick={() => navigate('/portal-admin')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#6B7280] text-sm transition-colors shadow-sm"
            title="Painel Admin"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
        {loggedIn && (
          <button
            onClick={() => setShowChangePassword(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#6B7280] text-sm transition-colors shadow-sm"
            title="Alterar Senha"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}
        {loggedIn && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#6B7280] text-sm transition-colors shadow-sm"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
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
          {loggedIn
            ? `Olá, ${user?.name}! Selecione um aplicativo para começar`
            : "Selecione um aplicativo para começar"}
        </p>
      </motion.div>

      {/* App grid */}
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

      {/* Login hint when not logged in */}
      {!loggedIn && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-xs text-[#9CA3AF]"
        >
          Faça login ao selecionar um aplicativo para acessá-lo
        </motion.p>
      )}

      {showChangePassword && (
        <ChangePasswordModal
          userEmail={user?.email}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {showSpedModal && (
        <SpedAccessModal onClose={() => setShowSpedModal(false)} />
      )}
    </div>
  );
}