import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, CheckCircle2 } from "lucide-react";

export default function SellCardModal({ card, onClose, onSaved }) {
  const [name, setName] = useState(card.player_name || "");
  const [phone, setPhone] = useState(card.player_phone || "");
  const [address, setAddress] = useState(card.player_city || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Indica se a cartela já tem comprador
  const isSold = !!(card.player_phone || card.player_city);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.BingoCard.update(card.id, {
      player_name: name.trim(),
      player_phone: phone.trim(),
      player_city: address.trim(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      onSaved();
      onClose();
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-base font-heading">
              Cartela #{String(card.card_number || "").padStart(3, "0")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSold ? "Atualizar dados do comprador" : "Registrar venda da cartela"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do Comprador</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Telefone / WhatsApp</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Endereço / Cidade</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, cidade..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={!name.trim() || saving || saved}
            >
              {saved ? (
                <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
              ) : saving ? (
                "Salvando..."
              ) : (
                "Confirmar Venda"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}