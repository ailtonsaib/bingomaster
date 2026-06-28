import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trophy, Plus, X, CheckCircle2 } from "lucide-react";

const MAX_PRIZES = 6;

export default function PrizeForm({ prizes, onChange }) {
  const addPrize = () => {
    if (prizes.length >= MAX_PRIZES) return;
    onChange([...prizes, { name: "", description: "", awarded: false }]);
  };

  const removePrize = (idx) => {
    onChange(prizes.filter((_, i) => i !== idx));
  };

  const updatePrize = (idx, field, value) => {
    const updated = [...prizes];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" />
          Prêmios
        </Label>
        <span className="text-xs text-muted-foreground">{prizes.length}/{MAX_PRIZES}</span>
      </div>

      {prizes.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Nenhum prêmio adicionado. Clique em "Adicionar Prêmio" para definir prêmios.
        </p>
      )}

      <div className="space-y-2">
        {prizes.map((prize, idx) => (
          <div key={idx} className="flex gap-2 items-start p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/20 text-accent-foreground font-bold text-xs shrink-0 mt-0.5">
              {idx + 1}
            </div>
            <div className="flex-1 space-y-1.5">
              {prize.awarded && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Premiado
                  {prize.awarded_card_number != null && (
                    <span className="text-muted-foreground">
                      — Cartela #{String(prize.awarded_card_number).padStart(4, "0")}
                    </span>
                  )}
                </div>
              )}
              <Input
                placeholder={`Nome do ${idx + 1}º prêmio`}
                value={prize.name}
                onChange={(e) => updatePrize(idx, "name", e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Descrição (opcional)"
                value={prize.description}
                onChange={(e) => updatePrize(idx, "description", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => removePrize(idx)}
              className="shrink-0 mt-0.5 w-7 h-7 rounded-md border border-input text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors flex items-center justify-center"
              title="Remover prêmio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {prizes.length < MAX_PRIZES && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed"
          onClick={addPrize}
        >
          <Plus className="w-4 h-4" /> Adicionar Prêmio
        </Button>
      )}
    </div>
  );
}