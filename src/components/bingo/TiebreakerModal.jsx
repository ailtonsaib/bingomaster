import { useState } from "react";
import { Trophy, Shuffle, Keyboard, Crown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import BingoNumberBall from "./BingoNumberBall";

export default function TiebreakerModal({ winners, drawnNumbers, maxNumber, prizeName, onAward, onClose }) {
  const [pedras, setPedras] = useState({});
  const [drawOrder, setDrawOrder] = useState([]);
  const [manualInputs, setManualInputs] = useState({});
  const [spinning, setSpinning] = useState(null);
  const [error, setError] = useState({});

  const drawnSet = new Set(drawnNumbers);
  // Pedras já sorteadas neste desempate (saíram do globo)
  const usedPedras = new Set(Object.values(pedras));
  // Pool: números ainda não sorteados no jogo principal E não sorteados neste desempate
  const availableNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1)
    .filter(n => !drawnSet.has(n) && !usedPedras.has(n));

  const handleSortear = (cardId) => {
    if (availableNumbers.length === 0 || spinning !== null) return;
    setSpinning(cardId);
    setError(prev => ({ ...prev, [cardId]: undefined }));
    setTimeout(() => {
      const pool = availableNumbers;
      const num = pool[Math.floor(Math.random() * pool.length)];
      setPedras(prev => ({ ...prev, [cardId]: num }));
      setDrawOrder(prev => [...prev, cardId]);
      setSpinning(null);
    }, 700);
  };

  const handleSortearTodos = () => {
    // Sorteio automático sequencial de todas as cartelas restantes
    if (spinning !== null) return;
    const remaining = winners.filter(w => pedras[w.id] === undefined);
    if (remaining.length === 0) return;
    sortearProximo(remaining, 0);
  };

  const sortearProximo = (remaining, index) => {
    if (index >= remaining.length) return;
    const cardId = remaining[index].id;
    setSpinning(cardId);
    setTimeout(() => {
      // Recalcula o pool disponível no momento do sorteio
      const currentUsed = new Set(Object.values(pedras));
      const pool = Array.from({ length: maxNumber }, (_, i) => i + 1)
        .filter(n => !drawnSet.has(n) && !currentUsed.has(n));
      if (pool.length === 0) {
        setSpinning(null);
        return;
      }
      const num = pool[Math.floor(Math.random() * pool.length)];
      setPedras(prev => {
        const updated = { ...prev, [cardId]: num };
        // Continua para a próxima cartela
        setTimeout(() => {
          setDrawOrder(prevOrder => [...prevOrder, cardId]);
          setSpinning(null);
          if (index + 1 < remaining.length) {
            sortearProximo(remaining, index + 1);
          }
        }, 400);
        return updated;
      });
    }, 700);
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

  // Com pool decrescente, cada pedra é única — empate impossível
  const handleConfirm = () => {
    if (!allHavePedra || !winnerCard) return;
    onAward(winnerCard, winnerPedra);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Desempate — Pedra Maior
          </DialogTitle>
          <DialogDescription>
            Prêmio: <strong className="text-foreground">{prizeName}</strong>
            <br />
            {winners.length} cartelas atingiram 20 pontos. Escolha qual cartela gira primeiro — cada pedra sorteada sai do globo (sem repetir). A maior pedra vence.
          </DialogDescription>
        </DialogHeader>

        {/* Globe status */}
        <div className="flex items-center gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
          <Layers className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {availableNumbers.length} pedras restantes no globo
            </span>
            {remainingCount > 0 && (
              <span className="text-muted-foreground ml-2">· {remainingCount} cartela(s) pendente(s)</span>
            )}
          </div>
          {remainingCount > 1 && spinning === null && (
            <Button
              size="sm"
              className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleSortearTodos}
            >
              <Shuffle className="w-4 h-4" /> Sortear Todas (Auto)
            </Button>
          )}
        </div>

        <div className="space-y-3 py-2">
          {winners.map((w) => {
            const pedra = pedras[w.id];
            const isWinner = allHavePedra && winnerCard?.id === w.id;
            const orderIndex = drawOrder.indexOf(w.id);
            const hasDrawn = pedra !== undefined;
            return (
              <div
                key={w.id}
                className={`rounded-xl p-4 border-2 transition-all ${
                  isWinner
                    ? "bg-emerald-500/20 border-emerald-500"
                    : hasDrawn
                      ? "bg-white/10 border-white/20"
                      : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {hasDrawn && orderIndex >= 0 && (
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                        {orderIndex + 1}º
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{String(w.card_number || "").padStart(4, "0")}</span>
                        {isWinner && <Crown className="w-5 h-5 text-amber-500" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{w.player_name || "Sem nome"}</p>
                    </div>
                  </div>
                  {hasDrawn && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Pedra maior:</span>
                      <BingoNumberBall number={pedra} size="md" />
                      {!allHavePedra && (
                        <button
                          onClick={() => handleResetPedra(w.id)}
                          className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                        >
                          Refazer
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!hasDrawn && (
                  <div className="flex flex-wrap gap-2 items-start">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => handleSortear(w.id)}
                      disabled={spinning !== null || availableNumbers.length === 0}
                    >
                      <Shuffle className="w-4 h-4" />
                      {spinning === w.id ? "Girando..." : "Sortear Pedra"}
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
                          className="w-24 text-center font-bold"
                          disabled={spinning !== null}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManualSet(w.id)}
                          disabled={spinning !== null || !manualInputs[w.id]}
                        >
                          <Keyboard className="w-4 h-4" />
                        </Button>
                      </div>
                      {error[w.id] && (
                        <span className="text-xs text-red-500">{error[w.id]}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {allHavePedra && winnerCard && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
            <Crown className="w-8 h-8 text-amber-500 mx-auto mb-1" />
            <p className="font-bold text-lg">
              Vencedor: #{String(winnerCard.card_number || "").padStart(4, "0")} — {winnerCard.player_name || "Sem nome"}
            </p>
            <p className="text-sm text-muted-foreground">Pedra maior: {winnerPedra}</p>
          </div>
        )}

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