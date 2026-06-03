import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Square, RotateCcw, Users, Trophy, Shuffle, Monitor } from "lucide-react";
import { drawNumber } from "@/lib/bingoUtils";
import LastNumberDisplay from "@/components/bingo/LastNumberDisplay";
import DrawnNumbersBoard from "@/components/bingo/DrawnNumbersBoard";
import PrizesPanel from "@/components/bingo/PrizesPanel";
import GameProgressBar from "@/components/bingo/GameProgressBar";

export default function GamePlay() {
  const { gameId } = useParams();
  const queryClient = useQueryClient();
  const [drawing, setDrawing] = useState(false);

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

  const handleDraw = async () => {
    if (!game || drawing) return;
    setDrawing(true);
    const num = drawNumber(game.drawn_numbers || [], game.max_number || 75);
    if (num !== null) {
      await updateGame({ drawn_numbers: [...(game.drawn_numbers || []), num] });
    }
    setTimeout(() => setDrawing(false), 800);
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

              {/* Control buttons */}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {isWaiting && (
                  <Button size="lg" className="gap-2 px-10 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-lg font-bold" onClick={handleStart}>
                    <Play className="w-5 h-5" /> Iniciar Jogo
                  </Button>
                )}
                {isPlaying && (
                  <>
                    <Button
                      size="lg"
                      className="gap-2 px-10 bg-accent hover:bg-accent/90 text-accent-foreground border-0 text-lg font-bold min-w-52"
                      onClick={handleDraw}
                      disabled={drawing || allDrawn}
                    >
                      <Shuffle className="w-5 h-5" />
                      {drawing ? "Sorteando..." : allDrawn ? "Esgotado!" : "Sortear Número"}
                    </Button>
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

            {/* Stats */}
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 space-y-3">
              <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2">
                📊 Estatísticas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Sorteados" value={drawnNumbers.length} />
                <StatBox label="Restantes" value={maxNumber - drawnNumbers.length} />
                <StatBox label="Cartelas" value={cards.length} />
                <StatBox label="Prêmios Restantes" value={(game.prizes || []).filter(p => !p.awarded).length} />
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