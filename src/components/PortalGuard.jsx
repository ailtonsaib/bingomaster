import { Navigate, Outlet } from 'react-router-dom';
import { getPortalUser } from '@/lib/portalSession';

export default function PortalGuard({ requireAdmin = false }) {
  const user = getPortalUser();
  if (!user) return <Navigate to="/portal-login" replace />;
  if (requireAdmin && !user.is_admin) return <Navigate to="/" replace />;
  return <Outlet />;
}