import { Navigate, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { getPortalUser, clearPortalUser } from '@/lib/portalSession';
import { loginRouteFor, appHomeRoute } from '@/lib/appEntry';

function NoAccess({ user }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-[#FAFAFB] text-center">
      <h1 className="text-xl font-bold text-[#1B1C21]">Sem acesso a este aplicativo</h1>
      <p className="text-sm text-[#71717A] max-w-sm">
        A licença de {user?.name} não inclui acesso a este módulo. Fale com o suporte para liberar.
      </p>
      <button
        onClick={() => { clearPortalUser(); window.location.href = '/'; }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-[#F3F4F6]"
      >
        <LogOut className="w-4 h-4" /> Sair
      </button>
    </div>
  );
}

export default function PortalGuard({ requireAdmin = false, permission = null }) {
  const user = getPortalUser();
  // Sem login: vai para o login do próprio aplicativo
  if (!user) return <Navigate to={loginRouteFor(permission)} replace />;

  // Mecânicos e caixa acessam os painéis do módulo Oficina
  const workshopAccess =
    permission === 'can_access_diagnostic' && (user.is_mechanic || user.workshop_role === 'caixa');

  const hasAccess = requireAdmin
    ? !!user.is_admin
    : !permission || user.is_admin || user[permission] || workshopAccess;

  if (hasAccess) return <Outlet />;

  // Sem permissão: volta para o aplicativo do usuário, sem tela de escolha
  const home = appHomeRoute(user);
  if (home && home !== window.location.pathname) return <Navigate to={home} replace />;
  return <NoAccess user={user} />;
}