import { useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Play, Square, RotateCcw, Users, Trophy, Shuffle, Monitor, Timer, Keyboard, Sparkles, Maximize, History, XCircle, CheckCircle2 } from "lucide-react";
import { drawNumber, getCardMaxPoints } from "@/lib/bingoUtils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cacheGameData, getCachedGameData, queuePendingUpdate, getPendingUpdates, clearPendingUpdates, queuePendingCardUpdate, getPendingCardUpdates, clearPendingCardUpdates } from "@/lib/offlineGameCache";
import LastNumberDisplay from "@/components/bingo/LastNumberDisplay";
import OfflineBanner from "@/components/bingo/OfflineBanner";
import DrawnNumbersBoard from "@/components/bingo/DrawnNumbersBoard";
import PrizesPanel from "@/components/bingo/PrizesPanel";
import GameProgressBar from "@/components/bingo/GameProgressBar";
import BingoWinnerAlert from "@/components/bingo/BingoWinnerAlert";
import FullScreenDraw from "@/components/bingo/FullScreenDraw";
import WinnerCardsModal from "@/components/bingo/WinnerCardsModal";
import DrawHistoryModal from "@/components/bingo/DrawHistoryModal";
import TiebreakerModal from "@/components/bingo/TiebreakerModal";
import LeaderboardPanel from "@/components/bingo/LeaderboardPanel";

export default function GamePlay() {
  const { gameId } = useParams();
  const queryClient = useQueryClient();
  const [drawing, setDrawing] = useState(false);
  const [winners, setWinners] = useState([]);
  const [drawType, setDrawType] = useState("horizontal");
  const drawTypeInitialized = useRef(false);
  const [cardFilter, setCardFilter] = useState("all"); // "all" ou "sold"
  const [drawMode, setDrawMode] = useState("manual"); // "manual", "auto", "normal"
  const [manualNumber, setManualNumber] = useState("");
  const manualInputRef = useRef(null);
  const [autoInterval, setAutoInterval] = useState(10); // segundos
  const [autoDrawing, setAutoDrawing] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState(null);
  const autoDrawRef = useRef(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showWinnerCards, setShowWinnerCards] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingWinners, setPendingWinners] = useState([]);
  const [tiebreakerPrizeIndex, setTiebreakerPrizeIndex] = useState(-1);
  const [showTiebreaker, setShowTiebreaker] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const isOnline = useOnlineStatus();
  const [hasPendingSync, setHasPendingSync] = useState(() => getPendingUpdates().length > 0 || getPendingCardUpdates().length > 0);

  const [cachedData] = useState(() => getCachedGameData(gameId));

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
    initialData: cachedData ? [cachedData.game] : undefined,
    retry: false,
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", gameId],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(gameId) }),
    initialData: cachedData ? cachedData.cards : undefined,
    retry: false,
  });

  // Inicializa o drawType a partir dos dados persistidos no jogo
  useEffect(() => {
    if (game?.draw_type && !drawTypeInitialized.current) {
      setDrawType(game.draw_type);
      drawTypeInitialized.current = true;
    }
  }, [game?.draw_type]);

  // Cacheia dados do jogo para funcionamento offline — debounce para não
  // bloquear o thread a cada sorteio (JSON.stringify de 100+ cartelas é pesado)
  const cacheTimerRef = useRef(null);
  useEffect(() => {
    if (!game || !cards) return;
    if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
    cacheTimerRef.current = setTimeout(() => {
      cacheGameData(gameId, game, cards);
    }, 1500);
    return () => { if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current); };
  }, [game, cards, gameId]);

  // Sincroniza atualizações pendentes quando volta online
  useEffect(() => {
    if (!isOnline) return;
    const pendingGames = getPendingUpdates();
    const pendingCards = getPendingCardUpdates();
    if (pendingGames.length === 0 && pendingCards.length === 0) return;
    (async () => {
      // Sincroniza atualizações do jogo (números sorteados, prêmios)
      const byGame = {};
      for (const item of pendingGames) {
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
          // falha silenciosa — tentará novamente
        }
      }
      clearPendingUpdates();

      // Sincroniza atualizações de cartelas (vencedores)
      for (const item of pendingCards) {
        try {
          await base44.entities.BingoCard.update(item.cardId, item.updates);
        } catch (e) {
          // falha silenciosa — tentará novamente
        }
      }
      clearPendingCardUpdates();

      setHasPendingSync(false);
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
    })();
  }, [isOnline, gameId, queryClient]);

  const updateGame = useCallback(async (updates) => {
    if (!game) return;
    // Optimistic update — reflete no UI imediatamente (síncrono)
    const newGameData = (() => {
      const arr = Array.isArray(queryClient.getQueryData(["game", gameId])) ? queryClient.getQueryData(["game", gameId]) : [];
      const current = arr[0] || game;
      return { ...current, ...updates };
    })();
    queryClient.setQueryData(["game", gameId], [newGameData]);

    // Modo offline: enfileira atualização para sincronizar depois
    if (!isOnline) {
      queuePendingUpdate(gameId, updates);
      setHasPendingSync(true);
      return;
    }

    await base44.entities.BingoGame.update(game.id, updates);
    queryClient.invalidateQueries({ queryKey: ["game", gameId] });
  }, [game, gameId, queryClient, isOnline]);

  const handleStart = () => updateGame({ status: "in_progress" });

  const handleDraw = async (number = null) => {
    if (!game || drawing || game.status === "finished") return;
    setDrawing(true);
    
    // Usa game.drawn_numbers/max_number diretamente (drawnNumbers/maxNumber
    // são definidos mais abaixo no componente — referenciá-los aqui causa
    // ReferenceError de zona morta temporal quando o auto-draw dispara)
    const currentDrawnArr = game.drawn_numbers || [];
    const currentMax = game.max_number || 75;
    let num;
    if (number !== null) {
      // Manual mode: use provided number
      num = parseInt(number);
      if (isNaN(num) || num < 1 || num > currentMax) {
        setDrawing(false);
        return;
      }
      if (currentDrawnArr.includes(num)) {
        setDrawing(false);
        return;
      }
    } else {
      // Normal mode: random draw
      num = drawNumber(currentDrawnArr, currentMax);
    }
    
    const currentDrawn = num !== null
      ? [...(game.drawn_numbers || []), num]
      : (game.drawn_numbers || []);

    if (num !== null) {
      await updateGame({ drawn_numbers: currentDrawn });
    }

    // Detecção de vencedores — roda mesmo quando num === null (todas as pedras já sorteadas)
    if (currentDrawn.length > 0) {
      const filteredCards = cardFilter === "validated"
        ? cards.filter((c) => c.is_validated)
        : cardFilter === "sold"
        ? cards.filter((c) => c.player_phone || c.player_city)
        : cards;

      const drawnSet = new Set(currentDrawn);
      const newWinners = filteredCards.filter((c) => {
        if (c.is_winner) return false;
        return getCardMaxPoints(c, drawnSet) >= 20;
      });

      if (newWinners.length > 0) {
        if (autoDrawing) stopAutoDraw();
        const prizeIdx = (game.prizes || []).findIndex(p => !p.awarded);
        if (prizeIdx >= 0) {
          if (newWinners.length === 1) {
            await awardPrize(prizeIdx, newWinners[0]);
          } else {
            setPendingWinners(newWinners);
            setTiebreakerPrizeIndex(prizeIdx);
            setShowTiebreaker(true);
          }
        } else {
          updateGame({ status: "finished" });
        }
      }
    }
    setDrawing(false);
  };

  const handleManualDraw = () => {
    if (!manualNumber.trim()) return;
    handleDraw(manualNumber);
    setManualNumber("");
    setTimeout(() => manualInputRef.current?.focus(), 100);
  };

  // Keep handleDraw ref up-to-date to avoid stale closure in timers
  useEffect(() => {
    autoDrawRef.current = handleDraw;
  }, [handleDraw]);

  const autoTimerRef = useRef(null);

  const stopAutoDraw = useCallback(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoDrawing(false);
    setAutoCountdown(null);
  }, []);

  const startAutoDraw = () => {
    const secs = autoInterval;
    setAutoDrawing(true);
    setAutoCountdown(secs);

    // Countdown tick every second
    const countTimer = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev <= 1) {
          autoDrawRef.current(); // draw
          return secs; // reset
        }
        return prev - 1;
      });
    }, 1000);

    autoTimerRef.current = countTimer;
  };

  const toggleAutoDraw = () => {
    if (autoDrawing) {
      stopAutoDraw();
      setDrawMode("normal");
    } else {
      setDrawMode("auto");
      startAutoDraw();
    }
  };

  // Para o sorteio automático quando o jogo é encerrado ou reiniciado
  useEffect(() => {
    if ((game?.status === "finished" || game?.status === "waiting") && autoDrawing) {
      stopAutoDraw();
      setDrawMode("normal");
    }
  }, [game?.status, autoDrawing, stopAutoDraw]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, []);

  const handleConfirmWinners = async () => {
    if (winners.length === 0) return;
    const { prizeIndex, prizeName } = winners[0];
    const now = new Date().toISOString();
    const lastDrawn = (game.drawn_numbers || []).slice(-1)[0];

    // Mark prize as awarded in game
    const prizes = [...(game.prizes || [])];
    prizes[prizeIndex] = { ...prizes[prizeIndex], awarded: true };
    await updateGame({ prizes });

    if (!isOnline) {
      // Offline: atualiza cartelas localmente e enfileira para sincronizar depois
      queryClient.setQueryData(["cards", gameId], (old) => {
        const arr = Array.isArray(old) ? old : [];
        return arr.map((c) => {
          if (winners.some((w) => w.card.id === c.id)) {
            const newWonPrizes = [...(c.won_prizes || []), { prize_index: prizeIndex, prize_name: prizeName, won_at_draw: lastDrawn, won_at: now }];
            queuePendingCardUpdate(c.id, { is_winner: true, won_prizes: newWonPrizes });
            return { ...c, is_winner: true, won_prizes: newWonPrizes };
          }
          return c;
        });
      });
      setWinners([]);
      return;
    }

    // Mark each winning card
    for (const { card } of winners) {
      const wonPrizes = [...(card.won_prizes || []), {
        prize_index: prizeIndex,
        prize_name: prizeName,
        won_at_draw: lastDrawn,
        won_at: now,
      }];
      await base44.entities.BingoCard.update(card.id, { is_winner: true, won_prizes: wonPrizes });
    }

    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
    setWinners([]);
  };

  // Limpeza automática: zera números sorteados, histórico do globo e estado local
  // sempre que uma nova rodada de prêmio começa
  const cleanupForNewRound = useCallback(async () => {
    stopAutoDraw();
    setDrawMode("normal");
    setWinners([]);
    setPendingWinners([]);
    setShowTiebreaker(false);
    setTiebreakerPrizeIndex(-1);
    setDrawing(false);
    await updateGame({ drawn_numbers: [] });
  }, [stopAutoDraw, updateGame]);

  const awardPrize = async (prizeIndex, card, pedraMaior = null) => {
    if (prizeIndex < 0 || prizeIndex >= (game.prizes || []).length) return;
    const prizes = [...(game.prizes || [])];
    const now = new Date().toISOString();
    const lastDrawn = (game.drawn_numbers || []).slice(-1)[0];

    prizes[prizeIndex] = {
      ...prizes[prizeIndex],
      awarded: true,
      awarded_card_id: card.id,
      awarded_card_number: card.card_number,
      awarded_player_name: card.player_name,
      pedra_maior: pedraMaior,
      awarded_won_at_draw: lastDrawn,
    };

    const hasMorePrizes = prizes.slice(prizeIndex + 1).some(p => !p.awarded);
    const updates = { prizes };
    if (!hasMorePrizes) {
      updates.status = "finished";
    } else {
      // Limpeza automática: zera tudo para a próxima rodada
      updates.drawn_numbers = [];
    }
    await updateGame(updates);

    // Limpa estado local para a nova rodada
    if (hasMorePrizes) {
      stopAutoDraw();
      setDrawMode("normal");
      setWinners([]);
      setPendingWinners([]);
      setShowTiebreaker(false);
      setTiebreakerPrizeIndex(-1);
    }

    // Offline: atualiza cartela localmente e enfileira para sincronizar depois
    if (!isOnline) {
      const wonPrizeEntry = { prize_index: prizeIndex, prize_name: prizes[prizeIndex].name, won_at_draw: lastDrawn, won_at: now };
      const newWonPrizes = [...(card.won_prizes || []), wonPrizeEntry];
      queryClient.setQueryData(["cards", gameId], (old) => {
        const arr = Array.isArray(old) ? old : [];
        return arr.map((c) => c.id === card.id
          ? { ...c, is_winner: true, won_prizes: newWonPrizes }
          : c);
      });
      queuePendingCardUpdate(card.id, { is_winner: true, won_prizes: newWonPrizes });
      return;
    }

    const wonPrizes = [...(card.won_prizes || []), {
      prize_index: prizeIndex,
      prize_name: prizes[prizeIndex].name,
      won_at_draw: lastDrawn,
      won_at: now,
    }];
    await base44.entities.BingoCard.update(card.id, { is_winner: true, won_prizes: wonPrizes });
    queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
  };

  const handleTiebreakerAward = async (card, pedraMaior) => {
    setShowTiebreaker(false);
    setPendingWinners([]);
    await awardPrize(tiebreakerPrizeIndex, card, pedraMaior);
    setTiebreakerPrizeIndex(-1);
  };

  const handleFinish = () => updateGame({ status: "finished" });

  const [resetting, setResetting] = useState(false);

  // Zera apenas a rodada atual: limpa números sorteados, mantém prêmios já concedidos
  const handleClearCurrentRound = async () => {
    stopAutoDraw();
    setDrawMode("normal");
    setWinners([]);
    setPendingWinners([]);
    setShowTiebreaker(false);
    setTiebreakerPrizeIndex(-1);
    setShowCancelDialog(false);
    setResetting(true);
    try {
      await updateGame({ drawn_numbers: [] });
    } finally {
      setResetting(false);
    }
  };

  // Zera tudo: números sorteados, prêmios, cartelas vencedoras — volta ao estado inicial
  const handleResetAll = async () => {
    stopAutoDraw();
    setDrawMode("normal");
    setWinners([]);
    setPendingWinners([]);
    setShowTiebreaker(false);
    setTiebreakerPrizeIndex(-1);
    setShowCancelDialog(false);
    setShowRestartDialog(false);
    setResetting(true);
    try {
      const resetPrizes = (game.prizes || []).map(p => ({
        name: p.name,
        description: p.description,
        awarded: false,
      }));
      await updateGame({ status: "waiting", drawn_numbers: [], prizes: resetPrizes });

      // Reseta todas as cartelas vencedoras deste jogo em lote
      await base44.entities.BingoCard.updateMany(
        { game_id: String(gameId), is_winner: true },
        { $set: { is_winner: false, won_prizes: [] } }
      );
      queryClient.invalidateQueries({ queryKey: ["cards", gameId] });
    } catch (e) {
      // erro silencioso — optimistic update já aplicado
    } finally {
      setResetting(false);
    }
  };

  const handleAwardPrize = async (idx) => {
    // Sem números sorteados → não há vencedor possível
    const dn = game.drawn_numbers || [];
    if (!Array.isArray(dn) || dn.length === 0) return;
    // Detecta cartelas que atingiram bingo (20+ pontos) e ainda não foram premiadas
    const drawnSet = new Set(dn);
    const filteredCards = cardFilter === "validated"
      ? cards.filter((c) => c.is_validated)
      : cardFilter === "sold"
      ? cards.filter((c) => c.player_phone || c.player_city)
      : cards;
    const currentWinners = filteredCards.filter((c) => {
      if (c.is_winner) return false;
      return getCardMaxPoints(c, drawnSet) >= 20;
    });

    if (currentWinners.length === 0) {
      // Sem vencedor — não pode conceder
      return;
    }

    if (currentWinners.length === 1) {
      // Cartela única — marcar diretamente
      await awardPrize(idx, currentWinners[0]);
    } else {
      // 2+ vencedores — exige sorteio de pedra maior
      setPendingWinners(currentWinners);
      setTiebreakerPrizeIndex(idx);
      setShowTiebreaker(true);
    }
  };

  // Conta cartelas vencedoras — memoizado para evitar recomputação pesada em todo render
  const { currentWinnersCount, totalWinnersCount } = useMemo(() => {
    const dn = game?.drawn_numbers || [];
    const filtered = cardFilter === "validated"
      ? cards.filter((c) => c.is_validated)
      : cardFilter === "sold"
      ? cards.filter((c) => c.player_phone || c.player_city)
      : cards;

    // Sem números sorteados: conta apenas cartelas já premiadas (is_winner)
    if (!Array.isArray(dn) || dn.length === 0) {
      return {
        currentWinnersCount: 0,
        totalWinnersCount: filtered.filter((c) => c.is_winner).length,
      };
    }

    const drawnSet = new Set(dn);
    let current = 0;
    let total = 0;
    const countedIds = new Set();
    for (const c of filtered) {
      // Cartelas já premiadas contam como vencedoras
      if (c.is_winner && !countedIds.has(c.id)) {
        total++;
        countedIds.add(c.id);
        continue;
      }
      const pts = getCardMaxPoints(c, drawnSet);
      if (pts >= 20 && !countedIds.has(c.id)) {
        total++;
        countedIds.add(c.id);
        if (!c.is_winner) current++;
      }
    }
    return { currentWinnersCount: current, totalWinnersCount: total };
  }, [cards, cardFilter, game?.drawn_numbers]);

  // Conta cartelas próximas de bingo (17-19 pontos) — memoizado
  const closeToBingoCount = useMemo(() => {
    const dn = game?.drawn_numbers || [];
    if (!Array.isArray(dn) || dn.length === 0) return 0;
    const drawnSet = new Set(dn);
    const filtered = cardFilter === "validated"
      ? cards.filter((c) => c.is_validated)
      : cardFilter === "sold"
      ? cards.filter((c) => c.player_phone || c.player_city)
      : cards;
    let count = 0;
    for (const c of filtered) {
      if (c.is_winner) continue;
      const pts = getCardMaxPoints(c, drawnSet);
      if (pts >= 17 && pts < 20) count++;
    }
    return count;
  }, [cards, cardFilter, game?.drawn_numbers]);

  // Conta cartelas a 1 número de completar bingo (19 pts)
  const oneAwayCount = useMemo(() => {
    const dn = game?.drawn_numbers || [];
    if (!Array.isArray(dn) || dn.length === 0) return 0;
    const drawnSet = new Set(dn);
    const filtered = cardFilter === "validated"
      ? cards.filter((c) => c.is_validated)
      : cardFilter === "sold"
      ? cards.filter((c) => c.player_phone || c.player_city)
      : cards;
    let count = 0;
    for (const c of filtered) {
      if (c.is_winner) continue;
      const pts = getCardMaxPoints(c, drawnSet);
      if (pts === 19) count++;
    }
    return count;
  }, [cards, cardFilter, game?.drawn_numbers]);

  // Toca alerta sonoro quando uma cartela chega perto de bingo (17+ pts)
  const prevCloseCountRef = useRef(0);
  useEffect(() => {
    if (closeToBingoCount > prevCloseCountRef.current && closeToBingoCount > 0) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Bip crescente de alerta — 3 notas ascendentes
        const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
        notes.forEach((freq, index) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = "triangle";
          const start = audioContext.currentTime + index * 0.12;
          gain.gain.setValueAtTime(0.3, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.18);
          osc.start(start);
          osc.stop(start + 0.18);
        });
      } catch (e) {
        // falha silenciosa — navegador sem Audio API
      }
    }
    prevCloseCountRef.current = closeToBingoCount;
  }, [closeToBingoCount]);

  // Alerta sonoro urgente: cartela a 1 número do bingo (19 pts)
  const prevOneAwayRef = useRef(0);
  useEffect(() => {
    if (oneAwayCount > prevOneAwayRef.current && oneAwayCount > 0) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // 3 bipes urgentes repetidos em tom alto
        for (let rep = 0; rep < 3; rep++) {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = 1046.50; // C6 — agudo e chamativo
          osc.type = "square";
          const start = audioContext.currentTime + rep * 0.22;
          gain.gain.setValueAtTime(0.35, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
          osc.start(start);
          osc.stop(start + 0.15);
        }
      } catch (e) {
        // falha silenciosa — navegador sem Audio API
      }
    }
    prevOneAwayRef.current = oneAwayCount;
  }, [oneAwayCount]);

  // Memoiza o prop winners do BingoWinnerAlert — NÃO depende de drawn_numbers
  // para evitar retrigger do useEffect de confetti/áudio a cada sorteio
  const alertWinners = useMemo(() => winners.map(w => ({
    ...w,
    gameName: game?.name,
  })), [winners, game?.name]);

  // Contagens de cartelas por filtro — memoizado para evitar recompute em todo render
  const cardCounts = useMemo(() => ({
    all: cards.length,
    sold: cards.filter((c) => c.player_phone || c.player_city).length,
    validated: cards.filter((c) => c.is_validated).length,
  }), [cards]);

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const drawnNumbers = game.drawn_numbers || [];
  const maxNumber = game.max_number || 75;
  const isWaiting = game.status === "waiting";
  const isPlaying = game.status === "in_progress";
  const isFinished = game.status === "finished";
  const allDrawn = drawnNumbers.length >= maxNumber;
  const awardedPrizesCount = (game.prizes || []).filter(p => p.awarded).length;
  const remainingPrizes = (game.prizes || []).filter(p => !p.awarded).length;
  const allPrizesAwarded = (game.prizes || []).length > 0 && (game.prizes || []).every(p => p.awarded);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 text-white">
      {resetting && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white/10 rounded-2xl p-8 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white font-semibold text-sm">Processando...</p>
          </div>
        </div>
      )}
      {!isOnline && <OfflineBanner hasPendingSync={hasPendingSync} />}
      {winners.length > 0 && (
        <BingoWinnerAlert
          winners={alertWinners}
          drawnCount={drawnNumbers.length}
          onClose={() => setWinners([])}
          onConfirm={handleConfirmWinners}
        />
      )}
      {showWinnerCards && (
        <WinnerCardsModal
          game={game}
          cards={cards}
          drawnNumbers={drawnNumbers}
          onClose={() => setShowWinnerCards(false)}
        />
      )}
      {showFullScreen && (
        <FullScreenDraw
          game={game}
          cards={cards}
          onClose={() => setShowFullScreen(false)}
          updateGame={updateGame}
          autoDrawing={autoDrawing}
          setAutoDrawing={setAutoDrawing}
          autoInterval={autoInterval}
          setAutoInterval={setAutoInterval}
        />
      )}
      {showTiebreaker && (
        <TiebreakerModal
          winners={pendingWinners}
          drawnNumbers={drawnNumbers}
          maxNumber={maxNumber}
          prizeName={(game.prizes || [])[tiebreakerPrizeIndex]?.name || ""}
          onAward={handleTiebreakerAward}
          onClose={() => { setShowTiebreaker(false); setPendingWinners([]); setTiebreakerPrizeIndex(-1); }}
        />
      )}
      {showHistory && (
        <DrawHistoryModal
          drawnNumbers={drawnNumbers}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Restart finished game dialog — zera tudo */}
      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Reiniciar Sorteio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>zerar todos os números sorteados, os prêmios concedidos e as cartelas vencedoras</strong>, voltando o jogo para o estado inicial. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              disabled={resetting}
              onClick={() => handleResetAll()}
            >
              {resetting ? "Reiniciando..." : "Sim, Reiniciar Tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel draw dialog — duas opções: zerar rodada atual ou zerar tudo */}
      <AlertDialog open={showCancelDialog} onOpenChange={(open) => !resetting && setShowCancelDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Cancelar Sorteio</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o que deseja cancelar:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <button
              disabled={resetting}
              onClick={() => handleClearCurrentRound()}
              className="w-full text-left rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              <div className="font-bold text-amber-300 mb-1">🔄 Zerar Rodada Atual</div>
              <p className="text-sm text-violet-200">
                Limpa apenas os números sorteados desta rodada. Os prêmios já concedidos e as cartelas vencedoras são mantidos.
              </p>
            </button>
            <button
              disabled={resetting}
              onClick={() => handleResetAll()}
              className="w-full text-left rounded-xl border border-red-400/40 bg-red-500/10 p-4 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <div className="font-bold text-red-300 mb-1">🗑️ Zerar Tudo</div>
              <p className="text-sm text-violet-200">
                Zera números sorteados, prêmios concedidos e cartelas vencedoras. O jogo volta ao estado inicial.
              </p>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Voltar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish event dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Encerrar Evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os prêmios foram sorteados. Deseja <strong>encerrar oficialmente o evento</strong>? O jogo será marcado como finalizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={() => { handleFinish(); setShowFinishDialog(false); }}
            >
              Sim, Encerrar Evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-violet-300 hover:text-white mb-1 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold font-heading">{game.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/cards/${game.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Users className="w-4 h-4" /> {cards.length} Cartelas
              </Button>
            </Link>
            <Link to={`/telao/${game.id}`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5 border-amber-400/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">
                <Monitor className="w-4 h-4" /> Telão
              </Button>
            </Link>
            <Link to={`/display/${game.id}`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Monitor className="w-4 h-4" /> Painel
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullScreen(true)}
              className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Maximize className="w-4 h-4" /> Tela Cheia
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20"
              disabled={drawnNumbers.length === 0}
            >
              <History className="w-4 h-4" /> Histórico
            </Button>
            <Badge
              className={
                isPlaying
                  ? "bg-emerald-500 text-white border-0"
                  : isFinished
                    ? "bg-white/20 text-white border-0"
                    : "bg-amber-500 text-white border-0"
              }
            >
              {isPlaying ? "● Em Andamento" : isFinished ? "Finalizado" : "Aguardando"}
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <GameProgressBar drawn={drawnNumbers.length} total={maxNumber} />

        <div className="grid gap-6 lg:grid-cols-3 mt-6">

          {/* Left: Draw area */}
          <div className="lg:col-span-2 space-y-5">

            {/* Last drawn number - big display */}
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-6 flex flex-col items-center gap-4">
              <LastNumberDisplay number={drawnNumbers[drawnNumbers.length - 1]} drawing={drawing} />

              {/* Draw type selector */}
              <div className="w-full">
                <p className="text-xs text-violet-300 uppercase tracking-wider text-center mb-2 font-semibold">Tipo de Sorteio</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "horizontal", label: "Horizontal", icon: "↔" },
                    { value: "vertical",   label: "Vertical",   icon: "↕" },
                    { value: "diagonal",   label: "Diagonal",   icon: "⤢" },
                    { value: "full",       label: "Cartela Cheia", icon: "▦" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => !isPlaying && updateGame({ draw_type: opt.value }).then(() => setDrawType(opt.value))}
                      disabled={isPlaying}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all border ${
                        drawType === opt.value
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                          : "bg-white/10 border-white/10 text-violet-300 hover:bg-white/20"
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span className="text-base mr-1">{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
                {isPlaying && (
                  <p className="text-xs text-violet-400 text-center mt-1">
                    Encerre o jogo para alterar o tipo de sorteio.
                  </p>
                )}
              </div>

              {/* Card filter selector */}
              <div className="w-full mt-3">
                <p className="text-xs text-violet-300 uppercase tracking-wider text-center mb-2 font-semibold">Cartelas no Sorteio</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "all", label: "Todas", count: cardCounts.all, icon: "📋" },
                    { value: "sold", label: "Vendidas", count: cardCounts.sold, icon: "🛒" },
                    { value: "validated", label: "Validadas", count: cardCounts.validated, icon: "✅" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => !isPlaying && setCardFilter(opt.value)}
                      disabled={isPlaying}
                      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all border ${
                        cardFilter === opt.value
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                          : "bg-white/10 border-white/10 text-violet-300 hover:bg-white/20"
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span className="text-base mr-1">{opt.icon}</span> {opt.label} ({opt.count})
                    </button>
                  ))}
                </div>
                {isPlaying && (
                  <p className="text-xs text-violet-400 text-center mt-1">
                    Encerre o jogo para alterar o filtro.
                  </p>
                )}
              </div>

              {/* Draw mode selector */}
              <div className="w-full">
                <p className="text-xs text-violet-300 uppercase tracking-wider text-center mb-2 font-semibold">Modo de Sorteio</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "manual", label: "Manual", icon: Keyboard, desc: "Digite o número" },
                    { value: "auto", label: "Automático", icon: Timer, desc: autoDrawing ? `⏱ ${autoCountdown ?? autoInterval}s` : `${autoInterval}s` },
                    { value: "normal", label: "Normal", icon: Sparkles, desc: "Clique para sortear" },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          if (!isPlaying) return;
                          setDrawMode(opt.value);
                          if (autoDrawing && opt.value !== "auto") {
                            toggleAutoDraw();
                          }
                        }}
                        disabled={!isPlaying}
                        className={`rounded-xl px-2 py-3 text-xs font-semibold transition-all border flex flex-col items-center gap-1 ${
                          drawMode === opt.value
                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                            : "bg-white/10 border-white/10 text-violet-300 hover:bg-white/20"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                        <span className="text-[10px] opacity-80">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {isWaiting && (
                  <Button size="lg" className="gap-2 px-10 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-lg font-bold" onClick={handleStart}>
                    <Play className="w-5 h-5" /> Iniciar Jogo
                  </Button>
                )}

                {isPlaying && (
                  <>
                    {drawMode === "manual" && (
                      <div className="flex gap-2 w-full max-w-xs">
                        <Input
                          ref={manualInputRef}
                          type="number"
                          min="1"
                          max={maxNumber}
                          value={manualNumber}
                          onChange={(e) => setManualNumber(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleManualDraw()}
                          placeholder="Nº"
                          className="h-12 text-center text-lg font-bold bg-white/10 border-white/20 text-white placeholder:text-violet-400"
                          disabled={drawing || allDrawn}
                        />
                        <Button
                          size="lg"
                          className="gap-2 px-6 bg-accent hover:bg-accent/90 text-accent-foreground border-0 text-lg font-bold"
                          onClick={handleManualDraw}
                          disabled={drawing || allDrawn || !manualNumber}
                        >
                          <Keyboard className="w-5 h-5" />
                        </Button>
                      </div>
                    )}
                    {drawMode === "auto" && (
                      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                        {/* Countdown ring */}
                        {autoDrawing && autoCountdown !== null && (
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative w-20 h-20">
                              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                                <circle
                                  cx="40" cy="40" r="34" fill="none"
                                  stroke="hsl(var(--accent))" strokeWidth="6"
                                  strokeDasharray={`${2 * Math.PI * 34}`}
                                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - autoCountdown / autoInterval)}`}
                                  strokeLinecap="round"
                                  style={{ transition: "stroke-dashoffset 0.9s linear" }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold text-white font-heading">{autoCountdown}</span>
                              </div>
                            </div>
                            <span className="text-xs text-violet-300">próximo sorteio</span>
                          </div>
                        )}
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="3"
                            max="60"
                            value={autoInterval}
                            onChange={(e) => setAutoInterval(Math.max(3, Math.min(60, parseInt(e.target.value) || 10)))}
                            className="h-11 w-20 text-center text-lg font-bold bg-white/10 border-white/20 text-white"
                            disabled={autoDrawing}
                          />
                          <span className="text-sm text-violet-300">segundos</span>
                          <Button
                            size="lg"
                            className={`gap-2 px-6 border-0 font-bold ${
                              autoDrawing
                                ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : "bg-accent hover:bg-accent/90 text-accent-foreground"
                            }`}
                            onClick={toggleAutoDraw}
                            disabled={allDrawn}
                          >
                            <Timer className="w-5 h-5" />
                            {autoDrawing ? "Pausar" : "Iniciar"}
                          </Button>
                          {autoDrawing && (
                            <Button
                              size="lg"
                              variant="outline"
                              className="gap-2 border-white/30 text-white hover:bg-white/10 font-bold"
                              onClick={() => { stopAutoDraw(); startAutoDraw(); }}
                            >
                              <RotateCcw className="w-4 h-4" /> Reiniciar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {drawMode === "normal" && (
                      <Button
                        size="lg"
                        className="gap-2 px-10 bg-accent hover:bg-accent/90 text-accent-foreground border-0 text-lg font-bold min-w-52"
                        onClick={() => handleDraw()}
                        disabled={drawing || allDrawn}
                      >
                        <Shuffle className="w-5 h-5" />
                        {drawing ? "Sorteando..." : allDrawn ? "Esgotado!" : "Sortear Número"}
                      </Button>
                    )}
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 border-red-400/50 text-red-300 hover:bg-red-500/20"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <XCircle className="w-4 h-4" /> Cancelar Sorteio
                    </Button>
                    {allPrizesAwarded && (
                      <Button
                        size="lg"
                        className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0 font-bold"
                        onClick={() => setShowFinishDialog(true)}
                      >
                        <CheckCircle2 className="w-5 h-5" /> Encerrar Evento
                      </Button>
                    )}
                  </>
                )}
                {isFinished && (
                  <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10" onClick={() => setShowRestartDialog(true)}>
                    <RotateCcw className="w-4 h-4" /> Reiniciar Sorteio
                  </Button>
                )}
              </div>

              {isWaiting && (
                <p className="text-violet-300 text-sm text-center">
                  Clique em "Iniciar Jogo" para começar o sorteio.
                </p>
              )}
              {isFinished && (
                <p className="text-violet-300 text-sm text-center">
                  Jogo encerrado. {drawnNumbers.length} números foram sorteados.
                </p>
              )}
              
              {isPlaying && drawnNumbers.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-white/30 text-white hover:bg-white/10 mt-2"
                  onClick={() => setShowWinnerCards(true)}
                >
                  <Trophy className="w-5 h-5" /> Verificar Cartelas Próximas
                </Button>
              )}
            </div>

            {/* Full number board */}
            <DrawnNumbersBoard drawnNumbers={drawnNumbers} maxNumber={maxNumber} />
          </div>

          {/* Right: Prizes + Stats */}
          <div className="space-y-5">
            <PrizesPanel
              prizes={game.prizes || []}
              isPlaying={isPlaying}
              onAwardPrize={handleAwardPrize}
              activePrizeIndex={(game.prizes || []).findIndex(p => !p.awarded)}
              winnersCount={currentWinnersCount}
            />

            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2">
                📊 Estatísticas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Sorteados" value={drawnNumbers.length} />
                <StatBox label="Restantes" value={maxNumber - drawnNumbers.length} />
                <StatBox
                  label={cardFilter === "validated" ? "Cartelas (Validadas)" : cardFilter === "sold" ? "Cartelas (Vendidas)" : "Cartelas (Todas)"}
                  value={cardFilter === "validated" ? cardCounts.validated : cardFilter === "sold" ? cardCounts.sold : cardCounts.all}
                />
                <StatBox label="Prêmios Restantes" value={(game.prizes || []).filter(p => !p.awarded).length} />
                <button
                  onClick={() => setShowWinnerCards(true)}
                  className="bg-white/10 rounded-xl p-3 text-center hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <div className="text-2xl font-bold font-heading text-green-400">
                    {totalWinnersCount}
                  </div>
                  <div className="text-xs text-violet-300 mt-0.5">Vencedoras</div>
                </button>
              </div>
            </div>

            {/* Painel de líderes em tempo real */}
            <LeaderboardPanel
              cards={cards}
              drawnNumbers={drawnNumbers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const StatBox = memo(function StatBox({ label, value }) {
  return (
    <div className="bg-white/10 rounded-xl p-3 text-center">
      <div className="text-2xl font-bold font-heading text-accent">{value}</div>
      <div className="text-xs text-violet-300 mt-0.5">{label}</div>
    </div>
  );
});