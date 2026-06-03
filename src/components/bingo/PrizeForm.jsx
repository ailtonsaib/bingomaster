import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Trophy } from "lucide-react";

export default function PrizeForm({ prizes, onChange }) {
  const addPrize = () => {
    if (prizes.length >= 5) return;
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
          Prêmios (até 5)
        </Label>
        {prizes.length < 5 && (
          <Button type="button" variant="outline" size="sm" onClick={addPrize}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        )}
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive h-7 w-7"
              onClick={() => removePrize(idx)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}