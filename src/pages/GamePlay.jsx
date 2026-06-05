import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Square, RotateCcw, Users, Trophy, Shuffle, Monitor, Timer, Keyboard, Sparkles, Maximize } from "lucide-react";
import { drawNumber, checkAllCardsForBingo } from "@/lib/bingoUtils";
import LastNumberDisplay from "@/components/bingo/LastNumberDisplay";
import DrawnNumbersBoard from "@/components/bingo/DrawnNumbersBoard";
import PrizesPanel from "@/components/bingo/PrizesPanel";
import GameProgressBar from "@/components/bingo/GameProgressBar";
import BingoWinnerAlert from "@/components/bingo/BingoWinnerAlert";
import DrawStatistics from "@/components/bingo/DrawStatistics";
import FullScreenDraw from "@/components/bingo/FullScreenDraw";
import WinnerCardsModal from "@/components/bingo/WinnerCardsModal";

export default function GamePlay() {
  const { gameId } = useParams();
  const queryClient = useQueryClient();
  const [drawing, setDrawing] = useState(false);
  const [winners, setWinners] = useState([]);
  const [drawType, setDrawType] = useState("horizontal");
  const [cardFilter, setCardFilter] = useState("all"); // "all" ou "sold"
  const [drawMode, setDrawMode] = useState("manual"); // "manual", "auto", "normal"
  const [manualNumber, setManualNumber] = useState("");
  const manualInputRef = useRef(null);
  const [autoInterval, setAutoInterval] = useState(5); // segundos
  const [autoDrawing, setAutoDrawing] = useState(false);
  const [autoTimer, setAutoTimer] = useState(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showWinnerCards, setShowWinnerCards] = useState(false);

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", gameId],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(gameId) }),
  });

  const updateGame = useCallback(async (updates) => {
    if (!game) return;
    await base44.entities.BingoGame.update(game.id, updates);
    queryClient.invalidateQueries({ queryKey: ["game", gameId] });
  }, [game, gameId, queryClient]);

  const handleStart = () => updateGame({ status: "in_progress" });

  const handleDraw = async (number = null) => {
    if (!game || drawing) return;
    setDrawing(true);
    
    let num;
    if (number !== null) {
      // Manual mode: use provided number
      num = parseInt(number);
      if (isNaN(num) || num < 1 || num > maxNumber) {
        setDrawing(false);
        return;
      }
      if (drawnNumbers.includes(num)) {
        setDrawing(false);
        return;
      }
    } else {
      // Normal mode: random draw
      num = drawNumber(game.drawn_numbers || [], game.max_number || 75);
    }
    
    if (num !== null) {
      const newDrawn = [...(game.drawn_numbers || []), num];
      await updateGame({ drawn_numbers: newDrawn });

      // Check all cards for bingo after the new number (apply filter)
      const filteredCards = cardFilter === "sold"
        ? cards.filter((c) => c.player_phone || c.player_city)
        : cards;
      const found = checkAllCardsForBingo(filteredCards, newDrawn, game.prizes || [], drawType);
      if (found.length > 0) {
        setWinners(found);
      }
    }
    setTimeout(() => setDrawing(false), 800);
  };

  const handleManualDraw = () => {
    if (!manualNumber.trim()) return;
    handleDraw(manualNumber);
    setManualNumber("");
    setTimeout(() => manualInputRef.current?.focus(), 100);
  };

  const toggleAutoDraw = () => {
    if (autoDrawing) {
      if (autoTimer) {
        clearInterval(autoTimer);
        setAutoTimer(null);
      }
      setAutoDrawing(false);
      setDrawMode("normal");
    } else {
      setAutoDrawing(true);
      setDrawMode("auto");
      const timer = setInterval(() => {
        handleDraw();
      }, autoInterval * 1000);
      setAutoTimer(timer);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoTimer) {
        clearInterval(autoTimer);
      }
    };
  }, [autoTimer]);

  const handleConfirmWinners = async () => {
    if (winners.length === 0) return;
    const { prizeIndex, prizeName } = winners[0];
    const now = new Date().toISOString();
    const lastDrawn = (game.drawn_numbers || []).slice(-1)[0];

    // Mark prize as awarded in game
    const prizes = [...(game.prizes || [])];
    prizes[prizeIndex] = { ...prizes[prizeIndex], awarded: true };
    await updateGame({ prizes });

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

  const handleFinish = () => updateGame({ status: "finished" });

  const handleReset = () =>
    updateGame({ status: "waiting", drawn_numbers: [], prizes: (game.prizes || []).map(p => ({ ...p, awarded: false })) });

  const handleAwardPrize = async (idx) => {
    const prizes = [...(game.prizes || [])];
    prizes[idx] = { ...prizes[idx], awarded: true };
    await updateGame({ prizes });
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 text-white">
      <BingoWinnerAlert
        winners={winners.map(w => ({
          ...w,
          gameName: game.name,
          drawnNumbers: (game.drawn_numbers || []).length
        }))}
        onClose={() => setWinners([])}
        onConfirm={handleConfirmWinners}
      />
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
      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-violet-300 hover:text-white mb-1 transition-colors">
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
                      onClick={() => !isPlaying && setDrawType(opt.value)}
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
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "all", label: "Todas as Cartelas", count: cards.length, icon: "📋" },
                    { value: "sold", label: "Apenas Vendidas", count: cards.filter((c) => c.player_phone || c.player_city).length, icon: "✅" },
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
                    { value: "auto", label: "Automático", icon: Timer, desc: `${autoInterval}s` },
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
                      <div className="flex gap-2 items-center w-full max-w-xs">
                        <Input
                          type="number"
                          min="1"
                          max="60"
                          value={autoInterval}
                          onChange={(e) => setAutoInterval(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
                          className="h-12 w-20 text-center text-lg font-bold bg-white/10 border-white/20 text-white"
                          disabled={autoDrawing || drawing}
                        />
                        <span className="text-sm text-violet-300">segundos</span>
                        <Button
                          size="lg"
                          className={`gap-2 px-6 border-0 text-lg font-bold ${
                            autoDrawing
                              ? "bg-red-500 hover:bg-red-600 text-white"
                              : "bg-accent hover:bg-accent/90 text-accent-foreground"
                          }`}
                          onClick={toggleAutoDraw}
                          disabled={drawing || allDrawn}
                        >
                          <Timer className="w-5 h-5" />
                          {autoDrawing ? "Parar" : "Iniciar"}
                        </Button>
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
                    <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10" onClick={handleFinish}>
                      <Square className="w-4 h-4" /> Encerrar
                    </Button>
                  </>
                )}
                {isFinished && (
                  <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" /> Novo Jogo
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
            />

            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2">
                📊 Estatísticas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Sorteados" value={drawnNumbers.length} />
                <StatBox label="Restantes" value={maxNumber - drawnNumbers.length} />
                <StatBox
                  label={cardFilter === "sold" ? "Cartelas (Vendidas)" : "Cartelas (Todas)"}
                  value={cardFilter === "sold" ? cards.filter((c) => c.player_phone || c.player_city).length : cards.length}
                />
                <StatBox label="Prêmios Restantes" value={(game.prizes || []).filter(p => !p.awarded).length} />
                <button
                  onClick={() => setShowWinnerCards(true)}
                  className="bg-white/10 rounded-xl p-3 text-center hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <div className="text-2xl font-bold font-heading text-green-400">
                    {cards.filter((c) => {
                      const allNums = new Set([...(c.grid_1 || []), ...(c.grid_2 || []), ...(c.grid_1a || []), ...(c.grid_1b || []), ...(c.grid_1c || []), ...(c.grid_2a || []), ...(c.grid_2b || []), ...(c.grid_2c || [])].filter(n => n !== 0));
                      return Array.from(allNums).filter(n => drawnNumbers.includes(n)).length === 20;
                    }).length}
                  </div>
                  <div className="text-xs text-violet-300 mt-0.5">Vencedoras</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-white/10 rounded-xl p-3 text-center">
      <div className="text-2xl font-bold font-heading text-accent">{value}</div>
      <div className="text-xs text-violet-300 mt-0.5">{label}</div>
    </div>
  );
}