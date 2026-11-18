import { APPS } from "@/lib/appRegistry";
import { getPortalUser } from "@/lib/portalSession";

// Aplicativos com login próprio, permissão e endereço de entrada
const APP_ENTRIES = APPS.filter((a) => !a.adminOnly && a.permission && a.url);

// Rota de login do aplicativo dono da permissão
export function loginRouteFor(permission) {
  const app = APPS.find((a) => a.permission && a.permission === permission);
  return app?.entryRoute || "/portal-login";
}

// Aplicativos liberados para o usuário
export function accessibleApps(user) {
  if (!user) return [];
  return APP_ENTRIES.filter((a) => user.is_admin || user[a.permission]);
}

// Endereço do aplicativo do usuário (prefere o último utilizado)
export function appHomeRoute(user) {
  const apps = accessibleApps(user);
  if (!apps.length) return null;
  return (apps.find((a) => a.id === user.current_app) || apps[0]).url;
}

// Endereço principal: entra direto no aplicativo do usuário.
// Sem sessão, abre o login do BingoPremier.
export function entryRoute() {
  const user = getPortalUser();
  if (!user) return "/bingo";
  return appHomeRoute(user) || "/portal-login";
}