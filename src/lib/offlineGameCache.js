// Cache local para dados do jogo (permite funcionamento offline)
const GAME_CACHE_PREFIX = 'softpremier_game_';
const GAME_META_SUFFIX = '_meta';
const GAME_CARDS_SUFFIX = '_cards';
const PENDING_UPDATES_KEY = 'softpremier_pending_updates';

// Cacheia apenas o jogo (payload pequeno) — chamado a cada sorteio/alteração do jogo.
// Escrita leve, não trava a thread.
export function cacheGame(gameId, game) {
  try {
    localStorage.setItem(GAME_CACHE_PREFIX + gameId + GAME_META_SUFFIX, JSON.stringify({
      game,
      cachedAt: Date.now(),
    }));
  } catch (e) {
    // localStorage cheio ou indisponível — ignora silenciosamente
  }
}

// Cacheia as cartelas (payload grande) — chamado apenas quando as cartelas mudam.
// O chamador deve deferir para idle (requestIdleCallback) para evitar travar a UI.
export function cacheCards(gameId, cards) {
  try {
    localStorage.setItem(GAME_CACHE_PREFIX + gameId + GAME_CARDS_SUFFIX, JSON.stringify(cards));
  } catch (e) {
    // ignora
  }
}

export function getCachedGameData(gameId) {
  try {
    const metaRaw = localStorage.getItem(GAME_CACHE_PREFIX + gameId + GAME_META_SUFFIX);
    // Compatibilidade: se não houver meta nova, tenta o formato antigo unificado
    if (!metaRaw) {
      const legacy = localStorage.getItem(GAME_CACHE_PREFIX + gameId);
      if (!legacy) return null;
      return JSON.parse(legacy);
    }
    const meta = JSON.parse(metaRaw);
    const cardsRaw = localStorage.getItem(GAME_CACHE_PREFIX + gameId + GAME_CARDS_SUFFIX);
    return {
      game: meta.game,
      cards: cardsRaw ? JSON.parse(cardsRaw) : null,
      cachedAt: meta.cachedAt,
    };
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
    localStorage.removeItem(GAME_CACHE_PREFIX + gameId + GAME_META_SUFFIX);
    localStorage.removeItem(GAME_CACHE_PREFIX + gameId + GAME_CARDS_SUFFIX);
    // Limpa também o formato antigo unificado (compatibilidade)
    localStorage.removeItem(GAME_CACHE_PREFIX + gameId);
  } catch (e) {
    // ignora
  }
}