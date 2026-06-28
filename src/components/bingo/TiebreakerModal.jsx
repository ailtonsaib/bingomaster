import { useState } from "react";
import { Trophy, Shuffle, Keyboard, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import BingoNumberBall from "./BingoNumberBall";

export default function TiebreakerModal({ winners, drawnNumbers, maxNumber, prizeName, onAward, onClose }) {
  const [pedras, setPedras] = useState({});
  const [manualInputs, setManualInputs] = useState({});
  const [spinning, setSpinning] = useState(null);

  const drawnSet = new Set(drawnNumbers);
  // Pool: números ainda não sorteados no jogo principal (a pedra maior é sorteada deste pool)
  const availableNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1)
    .filter(n => !drawnSet.has(n));

  const handleSortear = (cardId) => {
    if (availableNumbers.length === 0) return;
    setSpinning(cardId);
    setTimeout(() => {
      const num = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      setPedras(prev => ({ ...prev, [cardId]: num }));
      setSpinning(null);
    }, 600);
  };

  const handleManualSet = (cardId) => {
    const val = parseInt(manualInputs[cardId]);
    if (isNaN(val) || val < 1 || val > maxNumber) return;
    setPedras(prev => ({ ...prev, [cardId]: val }));
    setManualInputs(prev => ({ ...prev, [cardId]: "" }));
  };

  const allHavePedra = winners.length > 0 && winners.every(w => pedras[w.id] !== undefined);

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

  const hasTie = allHavePedra && winners.filter(w => pedras[w.id] === winnerPedra).length > 1;

  const handleConfirm = () => {
    if (!allHavePedra || hasTie || !winnerCard) return;
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
            {winners.length} cartelas atingiram 20 pontos. Sorteeie ou informe a "pedra maior" para cada cartela. A maior pedra vence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {winners.map((w) => {
            const pedra = pedras[w.id];
            const isWinner = allHavePedra && winnerCard?.id === w.id;
            return (
              <div
                key={w.id}
                className={`rounded-xl p-4 border-2 transition-all ${
                  isWinner
                    ? "bg-emerald-500/20 border-emerald-500"
                    : pedra !== undefined
                      ? "bg-white/10 border-white/20"
                      : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">#{String(w.card_number || "").padStart(4, "0")}</span>
                      {isWinner && <Crown className="w-5 h-5 text-amber-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{w.player_name || "Sem nome"}</p>
                  </div>
                  {pedra !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Pedra maior:</span>
                      <BingoNumberBall number={pedra} size="md" />
                    </div>
                  )}
                </div>

                {pedra === undefined && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => handleSortear(w.id)}
                      disabled={spinning !== null}
                    >
                      <Shuffle className="w-4 h-4" />
                      {spinning === w.id ? "Sorteando..." : "Sortear Pedra Maior"}
                    </Button>
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
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasTie && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
            ⚠️ Há empate! Sorteeie novamente ou informe um número diferente para desempatar.
          </div>
        )}

        {allHavePedra && !hasTie && winnerCard && (
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
            disabled={!allHavePedra || hasTie}
          >
            <Trophy className="w-4 h-4" /> Confirmar Vencedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}