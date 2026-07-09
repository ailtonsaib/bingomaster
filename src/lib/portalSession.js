const SESSION_KEY = 'portal_session';

export function getPortalUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPortalUser(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearPortalUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function isPortalLoggedIn() {
  return !!getPortalUser();
}