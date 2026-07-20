import { useState } from "react";
import { Trophy, Shuffle, Keyboard, Crown, Layers, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import BingoNumberBall from "./BingoNumberBall";
import BingoGlobe from "./BingoGlobe";

export default function TiebreakerModal({ winners, drawnNumbers, maxNumber, prizeName, onAward, onClose }) {
  const [pedras, setPedras] = useState({});
  const [drawOrder, setDrawOrder] = useState([]);
  const [manualInputs, setManualInputs] = useState({});
  const [spinning, setSpinning] = useState(null);
  const [error, setError] = useState({});
  const [autoSpinning, setAutoSpinning] = useState(false);

  const drawnSet = new Set(drawnNumbers);
  // Pedras já sorteadas neste desempate (saíram do globo)
  const usedPedras = new Set(Object.values(pedras));
  // Pool: números ainda não sorteados no jogo principal E não sorteados neste desempate
  const availableNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1)
    .filter(n => !drawnSet.has(n) && !usedPedras.has(n));

  const allHavePedra = winners.length > 0 && winners.every(w => pedras[w.id] !== undefined);
  const remainingCount = winners.filter(w => pedras[w.id] === undefined).length;

  let winnerCard = null;
  let winnerPedra = -1;
  if (allHavePedra) {
    winners.forEach(w => {
      if (pedras[w.id] > winnerPedra) {
        winnerPedra = pedras[w.id];
        winnerCard = w;
      }
    });
  }

  const handleSortear = (cardId) => {
    if (availableNumbers.length === 0 || spinning !== null) return;
    setSpinning(cardId);
    setError(prev => ({ ...prev, [cardId]: undefined }));
    // 3 segundos de giro do globo
    setTimeout(() => {
      const currentUsed = new Set(Object.values(pedras));
      const pool = Array.from({ length: maxNumber }, (_, i) => i + 1)
        .filter(n => !drawnSet.has(n) && !currentUsed.has(n));
      if (pool.length === 0) {
        setSpinning(null);
        return;
      }
      const num = pool[Math.floor(Math.random() * pool.length)];
      setPedras(prev => ({ ...prev, [cardId]: num }));
      setDrawOrder(prev => [...prev, cardId]);
      setSpinning(null);
    }, 3000);
  };

  const handleSortearTodos = () => {
    if (spinning !== null) return;
    const remaining = winners.filter(w => pedras[w.id] === undefined);
    if (remaining.length === 0) return;
    setAutoSpinning(true);
    sortearProximo(remaining, 0);
  };

  const sortearProximo = (remaining, index) => {
    if (index >= remaining.length) {
      setAutoSpinning(false);
      return;
    }
    const cardId = remaining[index].id;
    setSpinning(cardId);
    setTimeout(() => {
      const currentUsed = new Set(Object.values(pedras));
      const pool = Array.from({ length: maxNumber }, (_, i) => i + 1)
        .filter(n => !drawnSet.has(n) && !currentUsed.has(n));
      if (pool.length === 0) {
        setSpinning(null);
        setAutoSpinning(false);
        return;
      }
      const num = pool[Math.floor(Math.random() * pool.length)];
      setPedras(prev => {
        const updated = { ...prev, [cardId]: num };
        setDrawOrder(prevOrder => [...prevOrder, cardId]);
        setSpinning(null);
        if (index + 1 < remaining.length) {
          setTimeout(() => sortearProximo(remaining, index + 1), 1000);
        } else {
          setAutoSpinning(false);
        }
        return updated;
      });
    }, 3000);
  };

  const handleManualSet = (cardId) => {
    const val = parseInt(manualInputs[cardId]);
    if (isNaN(val) || val < 1 || val > maxNumber) {
      setError(prev => ({ ...prev, [cardId]: `Digite um número entre 1 e ${maxNumber}` }));
      return;
    }
    if (drawnSet.has(val)) {
      setError(prev => ({ ...prev, [cardId]: "Esta pedra já foi sorteada no jogo principal" }));
      return;
    }
    if (usedPedras.has(val)) {
      setError(prev => ({ ...prev, [cardId]: "Esta pedra já foi sorteada no desempate" }));
      return;
    }
    setPedras(prev => ({ ...prev, [cardId]: val }));
    setDrawOrder(prev => [...prev, cardId]);
    setManualInputs(prev => ({ ...prev, [cardId]: "" }));
    setError(prev => ({ ...prev, [cardId]: undefined }));
  };

  const handleResetPedra = (cardId) => {
    setPedras(prev => {
      const updated = { ...prev };
      delete updated[cardId];
      return updated;
    });
    setDrawOrder(prev => prev.filter(id => id !== cardId));
    setError(prev => ({ ...prev, [cardId]: undefined }));
  };

  const handleResetAll = () => {
    setPedras({});
    setDrawOrder([]);
    setError({});
    setManualInputs({});
  };

  const handleConfirm = () => {
    if (!allHavePedra || !winnerCard) return;
    onAward(winnerCard, winnerPedra);
  };

  // Mostra na bola grande o número sorteado da cartela ativa.
  // Durante o giro (spinning !== null e sem pedra ainda) a bola mostra a animação.
  // Após o giro, exibe o número sorteado da última cartela que girou.
  const lastSpunCardId = drawOrder.length > 0 ? drawOrder[drawOrder.length - 1] : null;
  const currentSpinningResult = spinning !== null
    ? pedras[spinning] ?? null
    : (lastSpunCardId ? pedras[lastSpunCardId] ?? null : null);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Desempate — Pedra Maior
          </DialogTitle>
          <DialogDescription>
            Prêmio: <strong className="text-foreground">{prizeName}</strong>
            <br />
            {winners.length} cartelas atingiram 20 pontos. Selecione qual cartela gira o globo primeiro — a maior pedra vence o prêmio.
          </DialogDescription>
        </DialogHeader>

        {/* Globe + status */}
        <div className="grid md:grid-cols-[auto_1fr] gap-4 items-center bg-gradient-to-br from-violet-900/40 to-indigo-900/40 rounded-2xl p-4 border border-white/10">
          <div className="flex justify-center">
            <BingoGlobe
              spinning={spinning !== null}
              result={currentSpinningResult}
              availableCount={availableNumbers.length}
              maxNumber={maxNumber}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-blue-300">
                {availableNumbers.length} pedras restantes no globo
              </span>
            </div>
            {remainingCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {remainingCount} cartela(s) pendente(s) de sorteio
              </p>
            )}
            {allHavePedra && winnerCard && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Crown className="w-4 h-4" /> Vencedor do Desempate
                </div>
                <p className="text-sm mt-1">
                  Cartela #{String(winnerCard.card_number || "").padStart(4, "0")} — {winnerCard.player_name || "Sem nome"}
                </p>
                <p className="text-xs text-muted-foreground">Pedra maior: {winnerPedra}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cartelas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Cartelas Contempladas</h4>
            <div className="flex gap-2">
              {remainingCount > 1 && spinning === null && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={handleSortearTodos}
                  disabled={autoSpinning}
                >
                  <Play className="w-3.5 h-3.5" /> Sortear Todas (Auto)
                </Button>
              )}
              {Object.keys(pedras).length > 0 && spinning === null && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleResetAll}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refazer Tudo
                </Button>
              )}
            </div>
          </div>

          {winners.map((w) => {
            const pedra = pedras[w.id];
            const isWinner = allHavePedra && winnerCard?.id === w.id;
            const orderIndex = drawOrder.indexOf(w.id);
            const hasDrawn = pedra !== undefined;
            const isCurrentlySpinning = spinning === w.id;
            return (
              <div
                key={w.id}
                className={`rounded-xl p-3 border-2 transition-all ${
                  isWinner
                    ? "bg-emerald-500/15 border-emerald-500"
                    : isCurrentlySpinning
                      ? "bg-amber-500/15 border-amber-500 animate-pulse"
                      : hasDrawn
                        ? "bg-white/5 border-white/20"
                        : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {hasDrawn && orderIndex >= 0 && (
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                        {orderIndex + 1}º
                      </span>
                    )}
                    {!hasDrawn && !isCurrentlySpinning && (
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-muted-foreground text-xs font-bold flex-shrink-0">
                        ?
                      </span>
                    )}
                    {isCurrentlySpinning && (
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex-shrink-0 animate-spin">
                        🎲
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">#{String(w.card_number || "").padStart(4, "0")}</span>
                        {isWinner && <Crown className="w-4 h-4 text-amber-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{w.player_name || "Sem nome"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasDrawn ? (
                      <>
                        <BingoNumberBall number={pedra} size="md" />
                        {!allHavePedra && (
                          <button
                            onClick={() => handleResetPedra(w.id)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Refazer
                          </button>
                        )}
                      </>
                    ) : isCurrentlySpinning ? (
                      <span className="text-sm font-bold text-amber-500 animate-pulse">Girando...</span>
                    ) : (
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => handleSortear(w.id)}
                          disabled={spinning !== null || availableNumbers.length === 0}
                        >
                          <Shuffle className="w-3.5 h-3.5" /> Girar Globo
                        </Button>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min="1"
                              max={maxNumber}
                              value={manualInputs[w.id] || ""}
                              onChange={(e) => setManualInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handleManualSet(w.id)}
                              placeholder="Manual"
                              className="w-20 h-8 text-center font-bold"
                              disabled={spinning !== null}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => handleManualSet(w.id)}
                              disabled={spinning !== null || !manualInputs[w.id]}
                            >
                              <Keyboard className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          {error[w.id] && (
                            <span className="text-[10px] text-red-500">{error[w.id]}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            onClick={handleConfirm}
            disabled={!allHavePedra}
          >
            <Trophy className="w-4 h-4" /> Confirmar Vencedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}