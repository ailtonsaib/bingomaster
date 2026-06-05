import { useState, useEffect } from "react";
import { Minimize, Trophy, Users, Hash, Play, Square, Shuffle, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BingoNumberBall from "./BingoNumberBall";
import BingoGrid from "./BingoGrid";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function FullScreenDraw({ game, cards, onClose }) {
  const queryClient = useQueryClient();
  const [winnerCards, setWinnerCards] = useState([]);
  const [cardStats, setCardStats] = useState({});
  const [drawing, setDrawing] = useState(false);
  const [showWinningCardsModal, setShowWinningCardsModal] = useState(false);

  const updateGame = async (updates) => {
    if (!game) return;
    await base44.entities.BingoGame.update(game.id, updates);
    queryClient.invalidateQueries({ queryKey: ["game", game.id] });
  };

  const handleDraw = async () => {
    if (!game || drawing) return;
    setDrawing(true);
    
    // Sortear número aleatório não sorteado
    const available = Array.from({ length: maxNumber }, (_, i) => i + 1)
      .filter(n => !drawnNumbers.includes(n));
    
    if (available.length === 0) {
      setDrawing(false);
      return;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const num = available[randomIndex];
    
    const newDrawn = [...drawnNumbers, num];
    await updateGame({ drawn_numbers: newDrawn });
    
    setTimeout(() => setDrawing(false), 800);
  };

  const handleStart = () => updateGame({ status: "in_progress" });
  const handleFinish = () => updateGame({ status: "finished" });
  const handleReset = () =>
    updateGame({
      status: "waiting",
      drawn_numbers: [],
      prizes: (game.prizes || []).map(p => ({ ...p, awarded: false }))
    });

  useEffect(() => {
    if (!game?.drawn_numbers) return;

    const drawnSet = new Set(game.drawn_numbers);
    const stats = {};
    const winners = [];

    cards.forEach((card) => {
      const allNumbers = new Set([
        ...(card.grid_1 || []),
        ...(card.grid_2 || []),
        ...(card.grid_1a || []),
        ...(card.grid_1b || []),
        ...(card.grid_1c || []),
        ...(card.grid_2a || []),
        ...(card.grid_2b || []),
        ...(card.grid_2c || []),
      ].filter(n => n !== 0));

      const points = Array.from(allNumbers).filter(n => drawnSet.has(n)).length;
      
      if (!stats[points]) stats[points] = 0;
      stats[points]++;

      if (points === 20) {
        winners.push({
          card,
          points,
          cardNumber: card.card_number,
          playerName: card.player_name,
          playerPhone: card.player_phone,
        });
      }
    });

    setCardStats(stats);
    setWinnerCards(winners);
  }, [game?.drawn_numbers, cards]);

  const formatPhone = (phone) => {
    if (!phone) return "";
    const clean = phone.replace(/\D/g, "");
    if (clean.length >= 4) {
      return "****" + clean.slice(-4);
    }
    return phone;
  };

  const maxNumber = game?.max_number || 75;
  const drawnNumbers = game?.drawn_numbers || [];
  const lastNumber = drawnNumbers[drawnNumbers.length - 1];
  const isPlaying = game?.status === "in_progress";
  const isWaiting = game?.status === "waiting";
  const isFinished = game?.status === "finished";
  const allDrawn = drawnNumbers.length >= maxNumber;

  // Gerar colunas B-I-N-G-O
  const columns = {
    B: { range: [1, 15], numbers: [] },
    I: { range: [16, 30], numbers: [] },
    N: { range: [31, 45], numbers: [] },
    G: { range: [46, 60], numbers: [] },
    O: { range: [61, 75], numbers: [] },
  };

  drawnNumbers.forEach((num) => {
    if (num <= 15) columns.B.numbers.push(num);
    else if (num <= 30) columns.I.numbers.push(num);
    else if (num <= 45) columns.N.numbers.push(num);
    else if (num <= 60) columns.G.numbers.push(num);
    else if (num <= 75) columns.O.numbers.push(num);
  });

  const columnColors = {
    B: "bg-blue-500",
    I: "bg-purple-500",
    N: "bg-pink-500",
    G: "bg-green-500",
    O: "bg-yellow-500",
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-violet-950/90 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold font-heading text-white">{game?.name}</h1>
          <Badge className="bg-emerald-500 text-white border-0">
            {drawnNumbers.length}/{maxNumber} Números
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          <Minimize className="w-4 h-4" /> Sair Tela Cheia
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Último número sorteado + Controles */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-violet-300 text-sm uppercase tracking-wider mb-2">Último Número</p>
            {lastNumber ? (
              <div className="inline-block animate-in zoom-in duration-300">
                <BingoNumberBall number={lastNumber} size="xl" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                <span className="text-4xl text-violet-400">-</span>
              </div>
            )}
          </div>

          {/* Controles de Sorteio */}
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {isWaiting && (
              <Button
                size="lg"
                className="gap-2 px-10 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-lg font-bold"
                onClick={handleStart}
              >
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
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-white/30 text-white hover:bg-white/10"
                  onClick={handleFinish}
                >
                  <Square className="w-4 h-4" /> Encerrar
                </Button>
              </>
            )}
            {isFinished && (
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/30 text-white hover:bg-white/10"
                onClick={handleReset}
              >
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
          {winnerCards.length > 0 && isPlaying && (
            <Button
              size="lg"
              className="gap-2 mt-2 bg-green-500 hover:bg-green-600 text-white border-0 text-lg font-bold"
              onClick={() => setShowWinningCardsModal(true)}
            >
              <Eye className="w-5 h-5" /> Ver Cartelas Vencedoras ({winnerCards.length})
            </Button>
          )}
        </div>

        {/* Estatísticas principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <Hash className="w-6 h-6 text-accent mx-auto mb-2" />
            <div className="text-3xl font-bold font-heading text-accent">{drawnNumbers.length}</div>
            <div className="text-xs text-violet-300 mt-1">Sorteados</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <Users className="w-6 h-6 text-accent mx-auto mb-2" />
            <div className="text-3xl font-bold font-heading text-accent">{cards.length}</div>
            <div className="text-xs text-violet-300 mt-1">Cartelas</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <Trophy className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <div className="text-3xl font-bold font-heading text-green-400">{winnerCards.length}</div>
            <div className="text-xs text-violet-300 mt-1">Vencedoras (20)</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <Hash className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <div className="text-3xl font-bold font-heading text-amber-400">{cardStats[19] || 0}</div>
            <div className="text-xs text-violet-300 mt-1">Quase (19)</div>
          </div>
        </div>

        {/* Cartelas vencedoras (20 pontos) */}
        {winnerCards.length > 0 && (
          <div className="bg-green-500/20 backdrop-blur rounded-2xl border-2 border-green-500/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-green-400" />
                <h2 className="text-2xl font-bold font-heading text-white">🎉 CARTELAS VENCEDORAS!</h2>
              </div>
              <Button
                size="lg"
                className="gap-2 bg-green-500 hover:bg-green-600 text-white border-0"
                onClick={() => setShowWinningCardsModal(true)}
              >
                <Eye className="w-5 h-5" /> Ver Detalhes ({winnerCards.length})
              </Button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {winnerCards.map((w) => (
                <div
                  key={w.card.id}
                  className="bg-green-500/30 rounded-xl p-4 border border-green-500/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-500 text-white border-0">
                      🏆 VENCEDORA
                    </Badge>
                    <span className="font-bold text-lg text-white">
                      #{String(w.cardNumber || "").padStart(4, "0")}
                    </span>
                  </div>
                  {w.playerName ? (
                    <div className="space-y-1 text-sm text-white/90">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="font-medium">{w.playerName}</span>
                      </div>
                      {w.playerPhone && (
                        <div className="flex items-center gap-2 text-white/70">
                          <Users className="w-4 h-4" />
                          <span>{formatPhone(w.playerPhone)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-white/70">Sem informações do comprador</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribuição de pontos */}
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold font-heading text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Cartelas por Quantidade de Pontos
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {Array.from({ length: 21 }, (_, i) => i).reverse().map((points) => {
              const count = cardStats[points] || 0;
              const isWinner = points === 20;
              const isNear = points === 19;
              
              return (
                <div
                  key={points}
                  className={`rounded-xl p-3 text-center border ${
                    isWinner
                      ? "bg-green-500/30 border-green-500/50"
                      : isNear
                        ? "bg-amber-500/30 border-amber-500/50"
                        : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className={`text-2xl font-bold font-heading ${
                    isWinner ? "text-green-400" : isNear ? "text-amber-400" : "text-white"
                  }`}>
                    {count}
                  </div>
                  <div className="text-xs text-violet-300 mt-1">{points} pts</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel de números */}
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold font-heading text-white mb-4">Números Sorteados</h3>
          <div className="grid grid-cols-5 md:grid-cols-15 gap-2">
            {Object.entries(columns).map(([letter, { range, numbers }]) => (
              <div key={letter} className="space-y-2">
                <div className={`${columnColors[letter]} rounded-lg py-2 text-center font-bold text-white text-sm`}>
                  {letter}
                </div>
                <div className="space-y-1">
                  {Array.from({ length: 15 }, (_, i) => range[0] + i).map((num) => {
                    const isDrawn = numbers.includes(num);
                    const isLast = num === lastNumber;
                    
                    return (
                      <div
                        key={num}
                        className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isLast
                            ? "bg-accent text-accent-foreground scale-110 shadow-lg shadow-accent/50 animate-pulse"
                            : isDrawn
                              ? "bg-white text-violet-900"
                              : "bg-white/10 text-violet-400"
                        }`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Cartelas Vencedoras */}
      <Dialog open={showWinningCardsModal} onOpenChange={setShowWinningCardsModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-heading flex items-center gap-2">
              <Trophy className="w-8 h-8 text-green-500" />
              🎉 Cartelas Vencedoras - {game?.name}
            </DialogTitle>
            <DialogDescription className="text-base">
              {winnerCards.length} cartela(s) completou(aram) todos os 20 pontos!
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Números sorteados: {drawnNumbers.length} | Total de cartelas: {cards.length}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {winnerCards.map((w, idx) => (
              <div key={w.card.id} className="border rounded-xl p-6 bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500 text-white border-0 text-sm">
                        🏆 VENCEDORA #{idx + 1}
                      </Badge>
                      <span className="font-bold text-xl">
                        Cartela #{String(w.cardNumber || "").padStart(4, "0")}
                      </span>
                    </div>
                    {w.playerName ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">{w.playerName}</span>
                        </div>
                        {w.playerPhone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-4 h-4" />
                            <span>{formatPhone(w.playerPhone)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem informações do comprador</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-500">20/20</div>
                    <div className="text-xs text-muted-foreground">pontos</div>
                  </div>
                </div>

                {/* Grid da cartela vencedora */}
                <div className="flex justify-center">
                  <BingoGrid
                    numbers={w.card.grid_1 || []}
                    drawnNumbers={drawnNumbers}
                    compact={false}
                  />
                </div>

                {w.card.chances === 2 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Segunda Chance:</h4>
                    <div className="flex justify-center">
                      <BingoGrid
                        numbers={w.card.grid_2 || []}
                        drawnNumbers={drawnNumbers}
                        compact={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWinningCardsModal(false)}
            >
              Fechar
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                setShowWinningCardsModal(false);
                handleFinish();
              }}
            >
              <Square className="w-4 h-4" /> Finalizar Sorteio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}