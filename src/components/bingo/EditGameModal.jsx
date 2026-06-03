import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import PrizeForm from "@/components/bingo/PrizeForm";

export default function EditGameModal({ game, onClose, onSaved }) {
  const [name, setName] = useState(game.name || "");
  const [eventLocation, setEventLocation] = useState(game.event_location || "");
  const [eventAddress, setEventAddress] = useState(game.event_address || "");
  const [eventDate, setEventDate] = useState(
    game.event_date ? game.event_date.slice(0, 16) : ""
  );
  const [eventPrice, setEventPrice] = useState(game.event_price || "");
  const [prizes, setPrizes] = useState(
    game.prizes?.length > 0
      ? game.prizes
      : [{ name: "", description: "", awarded: false }]
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await base44.entities.BingoGame.update(game.id, {
      name: name.trim(),
      event_location: eventLocation.trim() || undefined,
      event_address: eventAddress.trim() || undefined,
      event_date: eventDate || undefined,
      event_price: eventPrice.trim() || undefined,
      prizes: prizes.filter((p) => p.name.trim()),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold font-heading">Editar Evento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Nome do Jogo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do jogo"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Evento</h3>
            <div className="space-y-2">
              <Label>Local do Evento</Label>
              <Input
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Ex: Salão Paroquial"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={eventAddress}
                onChange={(e) => setEventAddress(e.target.value)}
                placeholder="Ex: Rua das Flores, 123 - Centro"
              />
            </div>
            <div className="space-y-2">
              <Label>Data e Hora</Label>
              <Input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor da Cartela (R$)</Label>
              <Input
                value={eventPrice}
                onChange={(e) => setEventPrice(e.target.value)}
                placeholder="Ex: 10,00"
              />
            </div>
          </div>

          <PrizeForm prizes={prizes} onChange={setPrizes} />

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}