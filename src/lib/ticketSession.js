const KEY = 'ticket_session';

export function getTicketUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTicketUser(user) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearTicketUser() {
  localStorage.removeItem(KEY);
}