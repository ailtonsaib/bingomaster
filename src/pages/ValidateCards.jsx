import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, ChevronDown, User, Phone, CheckCircle2,
  XCircle, ArrowLeft, Eye, EyeOff, ShoppingCart, Undo2, X
} from "lucide-react";
import { Link } from "react-router-dom";

// Modal para registrar/editar venda
function SellModal({ card, onClose, onSaved }) {
  // Não pré-preenche com nome da cartela — começa em branco
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!buyerPhone.trim()) return;
    setSaving(true);
    await base44.entities.BingoCard.update(card.id, {
      player_name: buyerName.trim() || "",
      player_phone: buyerPhone.trim(),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl w-full max-w-md p-5 pb-10 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg font-heading">
              Cartela #{String(card.card_number || "").padStart(4, "0")}
            </h2>
            <p className="text-xs text-muted-foreground">Registrar venda</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome do Comprador</label>
            <Input
              className="h-12 text-base"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Nome completo (opcional)"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Telefone / WhatsApp *</label>
            <Input
              className="h-12 text-base"
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <Button
          className="w-full h-12 text-base gap-2"
          onClick={handleSave}
          disabled={!buyerPhone.trim() || saving}
        >
          <ShoppingCart className="w-5 h-5" />
          {saving ? "Registrando..." : "Confirmar Venda"}
        </Button>
      </div>
    </div>
  );
}

export default function ValidateCards() {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [sellCard, setSellCard] = useState(null);
  const [quickSelling, setQuickSelling] = useState(null);

  const { data: games = [] } = useQuery({
    queryKey: ["validate-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["validate-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(selectedGame.id) }, "card_number"),
    enabled: !!selectedGame,
  });

  // "vendida" = tem player_phone preenchido
  const isSold = (card) => !!card.player_phone;

  const sold = cards.filter(isSold);
  const available = cards.filter((c) => !isSold(c));

  const filtered = cards.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(c.card_number).padStart(4, "0").includes(q) ||
      c.player_name?.toLowerCase().includes(q) ||
      c.player_phone?.includes(q)
    );
  });

  const handleQuickSell = async (card) => {
    setQuickSelling(card.id);
    await base44.entities.BingoCard.update(card.id, {
      player_phone: "vendida",
    });
    queryClient.invalidateQueries({ queryKey: ["validate-cards", selectedGame?.id] });
    setQuickSelling(null);
  };

  const handleUnmark = async (card) => {
    await base44.entities.BingoCard.update(card.id, {
      player_phone: "",
      player_city: "",
    });
    queryClient.invalidateQueries({ queryKey: ["validate-cards", selectedGame?.id] });
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["validate-cards", selectedGame?.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-heading">Validação de Cartelas</h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Consulte e gerencie as cartelas do jogo
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Game selector */}
        <div className="relative">
          <button
            className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-input bg-card text-sm hover:bg-accent transition-colors shadow-sm"
            onClick={() => setShowGamePicker((v) => !v)}
          >
            <span className={selectedGame ? "text-foreground font-medium" : "text-muted-foreground"}>
              {selectedGame?.name || "Selecione um jogo..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showGamePicker && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-52 overflow-auto">
              {games.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Nenhum jogo encontrado</div>
              ) : (
                games.map((g) => (
                  <button
                    key={g.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted text-sm"
                    onClick={() => { setSelectedGame(g); setShowGamePicker(false); setSearch(""); }}
                  >
                    {g.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedGame && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border rounded-xl p-3 text-center">
                <div className="text-2xl font-bold font-heading text-foreground">{cards.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold font-heading text-green-700">{sold.length}</div>
                <div className="text-xs text-green-600 mt-0.5">Vendidas</div>
              </div>
              <div className="bg-muted border rounded-xl p-3 text-center">
                <div className="text-2xl font-bold font-heading text-muted-foreground">{available.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Disponíveis</div>
              </div>
            </div>

            {/* Search + toggle details */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-11"
                  placeholder="Buscar por nº, nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant={showDetails ? "default" : "outline"}
                className="h-11 gap-2 shrink-0"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showDetails ? "Ocultar" : "Dados"}</span>
              </Button>
            </div>

            {/* Cards list */}
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma cartela encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((card) => {
                  const sold = isSold(card);
                  return (
                    <Card
                      key={card.id}
                      className={`border transition-all ${sold ? "border-green-200 bg-green-50/50" : "border-border bg-card"}`}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        {/* Status icon */}
                        {sold
                          ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                        }

                        {/* Card number */}
                        <span className={`font-bold font-heading text-base shrink-0 ${sold ? "text-green-800" : "text-foreground"}`}>
                          {String(card.card_number || "").padStart(4, "0")}
                        </span>

                        {/* Status badge */}
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${sold
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "text-muted-foreground"
                          }`}
                        >
                          {sold ? "Vendida" : "Disponível"}
                        </Badge>

                        {/* Buyer info */}
                        {showDetails && sold && (
                          <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-0.5">
                            <span className="flex items-center gap-1 text-sm text-green-800 truncate">
                              <User className="w-3.5 h-3.5 shrink-0" />
                              {card.player_name || <span className="italic text-muted-foreground">—</span>}
                            </span>
                            {card.player_phone && card.player_phone !== "vendida" && (
                              <span className="flex items-center gap-1 text-sm text-green-700">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                {card.player_phone}
                              </span>
                            )}
                          </div>
                        )}

                        {!showDetails && sold && (
                          <span className="flex-1 text-xs text-muted-foreground italic">
                            Ative "Dados" para ver o comprador
                          </span>
                        )}

                        {!sold && <div className="flex-1" />}

                        {/* Action buttons */}
                        {sold ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 gap-1 text-xs"
                            onClick={() => handleUnmark(card)}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            Desmarcar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-green-700 border-green-300 hover:bg-green-50 gap-1 text-xs"
                            disabled={quickSelling === card.id}
                            onClick={() => showDetails ? setSellCard(card) : handleQuickSell(card)}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            {quickSelling === card.id ? "..." : "Vender"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {sellCard && (
        <SellModal
          card={sellCard}
          onClose={() => setSellCard(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}