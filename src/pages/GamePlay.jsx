import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Square, RotateCcw, Users, Trophy, CheckCircle2 } from "lucide-react";
import { drawNumber } from "@/lib/bingoUtils";
import DrawnNumbersPanel from "@/components/bingo/DrawnNumbersPanel";
import { motion } from "framer-motion";

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
    setTimeout(() => setDrawing(false), 500);
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
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const drawnNumbers = game.drawn_numbers || [];
  const isWaiting = game.status === "waiting";
  const isPlaying = game.status === "in_progress";
  const isFinished = game.status === "finished";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-1">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold font-heading">{game.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/cards/${game.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Users className="w-4 h-4" /> {cards.length} Cartelas
              </Button>
            </Link>
            <Badge
              variant="outline"
              className={
                isPlaying
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : isFinished
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-100 text-amber-700 border-amber-200"
              }
            >
              {isPlaying ? "Em Andamento" : isFinished ? "Finalizado" : "Aguardando"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Controls */}
            <Card>
              <CardContent className="py-6">
                <div className="flex flex-wrap gap-3 justify-center">
                  {isWaiting && (
                    <Button size="lg" className="gap-2 px-8" onClick={handleStart}>
                      <Play className="w-5 h-5" /> Iniciar Jogo
                    </Button>
                  )}
                  {isPlaying && (
                    <>
                      <Button
                        size="lg"
                        className="gap-2 px-8 text-lg"
                        onClick={handleDraw}
                        disabled={drawing || drawnNumbers.length >= (game.max_number || 75)}
                      >
                        <Play className="w-5 h-5" />
                        {drawing ? "Sorteando..." : "Sortear Número"}
                      </Button>
                      <Button size="lg" variant="outline" className="gap-2" onClick={handleFinish}>
                        <Square className="w-4 h-4" /> Encerrar
                      </Button>
                    </>
                  )}
                  {isFinished && (
                    <Button size="lg" variant="outline" className="gap-2" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4" /> Reiniciar Jogo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Numbers panel */}
            <Card>
              <CardContent className="py-6">
                <DrawnNumbersPanel drawnNumbers={drawnNumbers} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Prizes */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent" /> Prêmios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(!game.prizes || game.prizes.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum prêmio definido.</p>
                ) : (
                  game.prizes.map((prize, idx) => (
                    <motion.div
                      key={idx}
                      className={`p-3 rounded-lg border transition-all ${
                        prize.awarded
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            prize.awarded
                              ? "bg-emerald-500 text-white"
                              : "bg-accent/20 text-accent-foreground"
                          }`}>
                            {prize.awarded ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${prize.awarded ? "line-through text-muted-foreground" : ""}`}>
                              {prize.name}
                            </p>
                            {prize.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{prize.description}</p>
                            )}
                          </div>
                        </div>
                        {isPlaying && !prize.awarded && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-xs h-7"
                            onClick={() => handleAwardPrize(idx)}
                          >
                            Premiar
                          </Button>
                        )}
                      </div>
                      {prize.awarded && (
                        <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                          Premiado ✓
                        </Badge>
                      )}
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Game info */}
            <Card>
              <CardContent className="py-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Números sorteados</span>
                  <span className="font-semibold">{drawnNumbers.length} / {game.max_number || 75}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cartelas</span>
                  <span className="font-semibold">{cards.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prêmios restantes</span>
                  <span className="font-semibold">
                    {(game.prizes || []).filter((p) => !p.awarded).length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}