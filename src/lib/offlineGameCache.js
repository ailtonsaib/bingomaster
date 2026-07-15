// Cache local para dados do jogo (permite funcionamento offline)
const GAME_CACHE_PREFIX = 'softpremier_game_';
const PENDING_UPDATES_KEY = 'softpremier_pending_updates';

export function cacheGameData(gameId, game, cards) {
  try {
    localStorage.setItem(GAME_CACHE_PREFIX + gameId, JSON.stringify({
      game,
      cards,
      cachedAt: Date.now(),
    }));
  } catch (e) {
    // localStorage cheio ou indisponível — ignora silenciosamente
  }
}

export function getCachedGameData(gameId) {
  try {
    const raw = localStorage.getItem(GAME_CACHE_PREFIX + gameId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Fila de atualizações de jogo pendentes para sincronizar quando voltar online
export function queuePendingUpdate(gameId, updates) {
  try {
    const queue = JSON.parse(localStorage.getItem(PENDING_UPDATES_KEY) || '[]');
    queue.push({ gameId, updates, queuedAt: Date.now() });
    localStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(queue));
  } catch (e) {
    // ignora
  }
}

const PENDING_CARD_UPDATES_KEY = 'softpremier_pending_card_updates';

// Fila de atualizações de cartelas vencedoras pendentes
export function queuePendingCardUpdate(cardId, updates) {
  try {
    const queue = JSON.parse(localStorage.getItem(PENDING_CARD_UPDATES_KEY) || '[]');
    // Acumula atualizações por cartela (merge)
    const existing = queue.find((q) => q.cardId === cardId);
    if (existing) {
      Object.assign(existing.updates, updates);
      existing.queuedAt = Date.now();
    } else {
      queue.push({ cardId, updates, queuedAt: Date.now() });
    }
    localStorage.setItem(PENDING_CARD_UPDATES_KEY, JSON.stringify(queue));
  } catch (e) {
    // ignora
  }
}

export function getPendingCardUpdates() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_CARD_UPDATES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function clearPendingCardUpdates() {
  try {
    localStorage.removeItem(PENDING_CARD_UPDATES_KEY);
  } catch (e) {
    // ignora
  }
}

export function getPendingUpdates() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_UPDATES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function clearPendingUpdates() {
  try {
    localStorage.removeItem(PENDING_UPDATES_KEY);
  } catch (e) {
    // ignora
  }
}

export function clearGameCache(gameId) {
  try {
    localStorage.removeItem(GAME_CACHE_PREFIX + gameId);
  } catch (e) {
    // ignora
  }
}