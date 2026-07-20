import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Pencil, Trash2, ImagePlus, Calendar, MapPin, Trophy, ChevronLeft } from "lucide-react";
import PrizeForm from "@/components/bingo/PrizeForm";

const statusLabels = {
  waiting: { label: "Aguardando", class: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "Em Andamento", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finished: { label: "Finalizado", class: "bg-muted text-muted-foreground border-border" },
};

export default function GameManagementModal({ games, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState("list"); // "list" | "form"
  const [editingGame, setEditingGame] = useState(null); // null = creating new
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventPrice, setEventPrice] = useState("");
  const [maxNumber, setMaxNumber] = useState(75);
  const [drawType, setDrawType] = useState("horizontal");
  const [cardFilter, setCardFilter] = useState("validated");
  const [prizes, setPrizes] = useState([{ name: "", description: "", awarded: false }]);
  const [cardImageUrl, setCardImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cardBgImageUrl, setCardBgImageUrl] = useState("");
  const [uploadingBgImage, setUploadingBgImage] = useState(false);

  const openNewGame = () => {
    setEditingGame(null);
    setName("");
    setEventLocation("");
    setEventAddress("");
    setEventDate("");
    setEventPrice("");
    setMaxNumber(75);
    setDrawType("horizontal");
    setCardFilter("validated");
    setPrizes([{ name: "", description: "", awarded: false }]);
    setCardImageUrl("");
    setCardBgImageUrl("");
    setView("form");
  };

  const openEditGame = (game) => {
    setEditingGame(game);
    setName(game.name || "");
    setEventLocation(game.event_location || "");
    setEventAddress(game.event_address || "");
    setEventDate(game.event_date ? game.event_date.slice(0, 16) : "");
    setEventPrice(game.event_price || "");
    setMaxNumber(game.max_number || 75);
    setDrawType(game.draw_type || "horizontal");
    setCardFilter(game.card_filter || "validated");
    setPrizes(game.prizes?.length > 0 ? game.prizes : [{ name: "", description: "", awarded: false }]);
    setCardImageUrl(game.card_image_url || "");
    setCardBgImageUrl(game.card_bg_image_url || "");
    setView("form");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const result = await base44.integrations.Core.UploadFile({ file });
    setCardImageUrl(result.file_url);
    setUploadingImage(false);
  };

  const handleBgImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBgImage(true);
    const result = await base44.integrations.Core.UploadFile({ file });
    setCardBgImageUrl(result.file_url);
    setUploadingBgImage(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      event_location: eventLocation.trim() || undefined,
      event_address: eventAddress.trim() || undefined,
      event_date: eventDate || undefined,
      event_price: eventPrice.trim() || undefined,
      max_number: Number(maxNumber) || 75,
      draw_type: drawType,
      card_filter: cardFilter,
      prizes: prizes.filter((p) => p.name.trim()),
      card_image_url: cardImageUrl || undefined,
      card_bg_image_url: cardBgImageUrl || undefined,
    };

    if (editingGame) {
      await base44.entities.BingoGame.update(editingGame.id, payload);
    } else {
      await base44.entities.BingoGame.create({
        ...payload,
        status: "waiting",
        drawn_numbers: [],
      });
    }

    setSaving(false);
    await queryClient.invalidateQueries({ queryKey: ["bingo-games"] });
    await queryClient.invalidateQueries({ queryKey: ["live-games"] });
    onSaved?.();
    setView("list");
  };

  const handleDelete = async (game) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("getGameCards", { game_id: String(game.id) });
      const cards = res.data.cards;
      for (const card of cards) {
        await base44.entities.BingoCard.delete(card.id);
      }
      await base44.entities.BingoGame.delete(game.id);
      await queryClient.invalidateQueries({ queryKey: ["bingo-games"] });
      await queryClient.invalidateQueries({ queryKey: ["live-games"] });
      onSaved?.();
    } catch (error) {
      console.error("Erro ao deletar jogo:", error);
      alert("Erro ao excluir jogo. Tente novamente.");
    } finally {
      setSaving(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "list" ? (
          <>
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
              <h2 className="text-lg font-bold font-heading">Gerenciar Jogos</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <Button className="w-full gap-2" onClick={openNewGame}>
                <Plus className="w-4 h-4" /> Criar Novo Jogo
              </Button>

              {games.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum jogo criado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {games.map((game) => {
                    const status = statusLabels[game.status] || statusLabels.waiting;
                    return (
                      <div
                        key={game.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{game.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={status.class}>
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {game.drawn_numbers?.length || 0} sorteados
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditGame(game)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(game)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView("list")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold font-heading">
                  {editingGame ? "Editar Jogo" : "Novo Jogo"}
                </h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Label>Nome do Jogo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do jogo"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Dados do Evento
                </h3>
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
                <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-2">
                  <Label>Número Máximo (75 ou 90)</Label>
                  <Input
                    type="number"
                    value={maxNumber}
                    onChange={(e) => setMaxNumber(e.target.value)}
                    placeholder="75"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Sorteio</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "horizontal", label: "Horizontal", icon: "↔" },
                    { value: "vertical",   label: "Vertical",   icon: "↕" },
                    { value: "diagonal",   label: "Diagonal",   icon: "⤢" },
                    { value: "full",       label: "Cartela Cheia", icon: "▦" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDrawType(opt.value)}
                      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all border ${
                        drawType === opt.value
                          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="text-base mr-1">{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cartelas no Sorteio</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "all", label: "Todas as Cartelas", icon: "📋" },
                    { value: "validated", label: "Apenas Validadas", icon: "✅" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCardFilter(opt.value)}
                      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all border ${
                        cardFilter === opt.value
                          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="text-base mr-1">{opt.icon}</span> {opt.label}
                    </button>
                  ))}
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

              <div className="space-y-2">
                <Label>Imagem de Fundo da Cartela (opcional)</Label>
                {cardBgImageUrl ? (
                  <div className="relative inline-block">
                    <img src={cardBgImageUrl} alt="Fundo da cartela" className="h-24 rounded-lg border object-contain" />
                    <button
                      onClick={() => setCardBgImageUrl("")}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-lg p-4 hover:bg-muted/50 transition-colors w-full">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploadingBgImage ? "Enviando..." : "Clique para anexar imagem de fundo"}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} disabled={uploadingBgImage} />
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setView("list")}>
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                >
                  {saving ? "Salvando..." : editingGame ? "Salvar Alterações" : "Criar Jogo"}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-xl"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="bg-background rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-bold">Excluir jogo?</h3>
                  <p className="text-sm text-muted-foreground">
                    "{deleteConfirm.name}" e todas as suas cartelas serão removidos permanentemente.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={saving}
                >
                  {saving ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}