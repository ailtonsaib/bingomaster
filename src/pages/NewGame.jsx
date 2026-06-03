import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import PrizeForm from "@/components/bingo/PrizeForm";

export default function NewGame() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [prizes, setPrizes] = useState([{ name: "", description: "", awarded: false }]);
  const [saving, setSaving] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventPrice, setEventPrice] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const game = await base44.entities.BingoGame.create({
      name: name.trim(),
      status: "waiting",
      drawn_numbers: [],
      max_number: 75,
      prizes: prizes.filter((p) => p.name.trim()),
      event_location: eventLocation.trim() || undefined,
      event_date: eventDate || undefined,
      event_price: eventPrice.trim() || undefined,
    });
    navigate(`/game/${game.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Novo Jogo de Bingo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Jogo</Label>
              <Input
                id="name"
                placeholder="Ex: Bingo da Festa Junina"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Evento</h3>
              <div className="space-y-2">
                <Label htmlFor="location">Local do Evento</Label>
                <Input
                  id="location"
                  placeholder="Ex: Salão Paroquial, Rua das Flores 123"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventDate">Data e Hora do Evento</Label>
                <Input
                  id="eventDate"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Valor da Cartela (R$)</Label>
                <Input
                  id="price"
                  placeholder="Ex: 10,00"
                  value={eventPrice}
                  onChange={(e) => setEventPrice(e.target.value)}
                />
              </div>
            </div>

            <PrizeForm prizes={prizes} onChange={setPrizes} />

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              className="w-full gap-2"
              size="lg"
            >
              {saving ? "Criando..." : "Criar Jogo"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}