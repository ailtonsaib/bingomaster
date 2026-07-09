import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Grid3x3, Wallet, ExternalLink, LogOut, Settings } from "lucide-react";
import { APPS } from "@/lib/appRegistry";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";

const iconMap = { Grid3x3, Wallet };

export default function Portal() {
  const navigate = useNavigate();
  const user = getPortalUser();

  const visibleApps = APPS.filter((app) => {
    if (app.permission) return user[app.permission];
    return true;
  });

  const handleLogout = () => {
    clearPortalUser();
    navigate('/portal-login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.1),transparent_60%)] pointer-events-none" />

      {/* User info + logout */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {user?.is_admin && (
          <button
            onClick={() => navigate('/portal-admin')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-sm transition-colors"
            title="Gerenciar Usuários"
          >
            <Settings className="w-4 h-4" /> Painel Admin
          </button>
        )}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Sair"
        >
          <LogOut className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative"
      >
        <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-foreground">
          SoftPremier
        </h1>
        <p className="mt-3 text-muted-foreground">
          Olá, {user?.name}! Selecione um aplicativo para começar
        </p>
      </motion.div>

      {/* Test user info panel */}
      {!user?.is_admin && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 max-w-md w-full text-center"
        >
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
            Conta de Teste
          </p>
          <p className="text-sm text-amber-800 font-medium">{user?.email}</p>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-amber-700">
            <span>Plano: {user?.bingo_plan?.toUpperCase()}</span>
            {!user?.finance_full_access && (
              <span>Finanças: {user?.finance_transactions_used}/{user?.finance_transaction_limit}</span>
            )}
            {user?.finance_full_access && <span>Finanças: Completo</span>}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl w-full relative">
        {visibleApps.map((app, idx) => {
          const Icon = iconMap[app.icon] || Grid3x3;
          return (
            <motion.button
              key={app.id}
              onClick={() => navigate(app.url)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
            >
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${app.iconBg}`}>
                <Icon className={`w-10 h-10 ${app.iconColor}`} />
              </div>
              <span className="font-semibold text-sm text-center text-foreground">{app.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}