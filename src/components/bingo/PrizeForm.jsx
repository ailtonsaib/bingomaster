import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trophy } from "lucide-react";

export default function PrizeForm({ prizes, onChange }) {
  const setCount = (count) => {
    const newPrizes = Array.from({ length: count }, (_, i) =>
      prizes[i] || { name: "", description: "", awarded: false }
    );
    onChange(newPrizes);
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Quantidade:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`w-7 h-7 rounded-md text-xs font-bold border transition-colors ${
                prizes.length === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {prizes.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Nenhum prêmio adicionado. Clique em "Adicionar" para definir prêmios.
        </p>
      )}

      <div className="space-y-2">
        {prizes.map((prize, idx) => (
          <div key={idx} className="flex gap-2 items-start p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/20 text-accent-foreground font-bold text-xs shrink-0 mt-0.5">
              {idx + 1}
            </div>
            <div className="flex-1 space-y-1.5">
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
          </div>
        ))}
      </div>
    </div>
  );
}