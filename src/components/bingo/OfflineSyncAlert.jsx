import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, X, CloudOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getPendingUpdates,
  getPendingCardUpdates,
  clearPendingUpdates,
  clearPendingCardUpdates,
} from "@/lib/offlineGameCache";

export default function OfflineSyncAlert() {
  const isOnline = useOnlineStatus();
  const [pendingGames, setPendingGames] = useState(0);
  const [pendingCards, setPendingCards] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const total = pendingGames + pendingCards;

  const refresh = () => {
    setPendingGames(getPendingUpdates().length);
    setPendingCards(getPendingCardUpdates().length);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  // Reset dismissed quando novas pendências surgem
  useEffect(() => {
    if (total > 0) setDismissed(false);
  }, [total]);

  if (total === 0 || dismissed) return null;

  const handleSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    try {
      // Importa base44 dinamicamente para evitar acoplamento
      const { base44 } = await import("@/api/base44Client");

      // Sincroniza jogos
      const games = getPendingUpdates();
      const byGame = {};
      for (const item of games) {
        if (!byGame[item.gameId]) byGame[item.gameId] = {};
        Object.assign(byGame[item.gameId], item.updates);
      }
      for (const [gId, updates] of Object.entries(byGame)) {
        try {
          const gameData = await base44.entities.BingoGame.filter({ id: gId });
          if (gameData[0]) {
            await base44.entities.BingoGame.update(gameData[0].id, updates);
          }
        } catch (e) {
          // ignora — tentará novamente
        }
      }
      clearPendingUpdates();

      // Sincroniza cartelas
      const cards = getPendingCardUpdates();
      for (const item of cards) {
        try {
          await base44.entities.BingoCard.update(item.cardId, item.updates);
        } catch (e) {
          // ignora
        }
      }
      clearPendingCardUpdates();

      refresh();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          {isOnline
            ? "Resultados offline pendentes de sincronização"
            : "Resultados offline aguardando conexão"}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {pendingGames > 0 && `${pendingGames} jogo(s) com sorteio pendente. `}
          {pendingCards > 0 && `${pendingCards} cartela(s) vencedora(s) pendente(s). `}
          {isOnline
            ? "Clique em sincronizar para enviar ao servidor."
            : "Os dados serão enviados automaticamente quando a conexão voltar."}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isOnline ? (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-100"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
          </Button>
        ) : (
          <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-100"
          onClick={() => setDismissed(true)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}