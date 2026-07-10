import { Navigate, Outlet } from 'react-router-dom';
import { getPortalUser } from '@/lib/portalSession';

export default function PortalGuard({ requireAdmin = false, permission = null }) {
  const user = getPortalUser();
  if (!user) return <Navigate to="/portal-login" replace />;
  if (requireAdmin && !user.is_admin) return <Navigate to="/portal" replace />;
  if (permission && !user[permission]) return <Navigate to="/portal" replace />;
  return <Outlet />;
}