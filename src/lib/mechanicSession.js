const MECHANIC_SESSION_KEY = 'mechanic_session';

export function getMechanicSession() {
  try {
    const raw = localStorage.getItem(MECHANIC_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setMechanicSession(mechanic) {
  localStorage.setItem(MECHANIC_SESSION_KEY, JSON.stringify(mechanic));
}

export function clearMechanicSession() {
  localStorage.removeItem(MECHANIC_SESSION_KEY);
}

export function isMechanicLoggedIn() {
  return !!getMechanicSession();
}