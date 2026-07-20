import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, ImagePlus, X } from "lucide-react";
import { Link } from "react-router-dom";
import PrizeForm from "@/components/bingo/PrizeForm";

export default function NewGame() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [prizes, setPrizes] = useState([{ name: "", description: "", awarded: false }]);
  const [saving, setSaving] = useState(false);
  const [eventLocation, setEventLocation] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventPrice, setEventPrice] = useState("");
  const [cardImageUrl, setCardImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const result = await base44.integrations.Core.UploadFile({ file });
    setCardImageUrl(result.file_url);
    setUploadingImage(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const game = await base44.entities.BingoGame.create({
      name: name.trim(),
      status: "waiting",
      drawn_numbers: [],
      max_number: 75,
      draw_type: "horizontal",
      prizes: prizes.filter((p) => p.name.trim()),
      event_location: eventLocation.trim() || undefined,
      event_address: eventAddress.trim() || undefined,
      event_date: eventDate || undefined,
      event_price: eventPrice.trim() || undefined,
      card_image_url: cardImageUrl || undefined,
    });
    navigate(`/game/${game.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
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
                  placeholder="Ex: Salão Paroquial"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Ex: Rua das Flores, 123 - Centro"
                  value={eventAddress}
                  onChange={(e) => setEventAddress(e.target.value)}
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

            <div className="space-y-2">
              <Label>Imagem da Cartela (opcional)</Label>
              {cardImageUrl ? (
                <div className="relative inline-block">
                  <img src={cardImageUrl} alt="Imagem da cartela" className="h-24 rounded-lg border object-contain" />
                  <button
                    onClick={() => setCardImageUrl("")}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-lg p-4 hover:bg-muted/50 transition-colors w-full">
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploadingImage ? "Enviando..." : "Clique para anexar uma imagem"}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              )}
            </div>

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