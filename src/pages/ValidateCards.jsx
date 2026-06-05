import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, ChevronDown, Hash, User, Phone, CheckCircle2,
  XCircle, ArrowLeft, Eye, EyeOff
} from "lucide-react";
import { Link } from "react-router-dom";

export default function ValidateCards() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const { data: games = [] } = useQuery({
    queryKey: ["validate-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["validate-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(selectedGame.id) }, "card_number"),
    enabled: !!selectedGame,
  });

  const filtered = cards.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(c.card_number).padStart(4, "0").includes(q) ||
      c.player_name?.toLowerCase().includes(q) ||
      c.player_phone?.includes(q)
    );
  });

  const sold = cards.filter((c) => c.player_name);
  const available = cards.filter((c) => !c.player_name);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-heading">Validação de Cartelas</h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Consulte todas as cartelas geradas e seus compradores
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
                {showDetails ? "Ocultar dados" : "Dados do comprador"}
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
                  const isSold = !!card.player_name;
                  return (
                    <Card
                      key={card.id}
                      className={`border transition-all ${isSold ? "border-green-200 bg-green-50/50" : "border-border bg-card"}`}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        {/* Card number */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSold
                            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                            : <XCircle className="w-4 h-4 text-muted-foreground" />
                          }
                          <span className={`font-bold font-heading text-base ${isSold ? "text-green-800" : "text-foreground"}`}>
                            {String(card.card_number || "").padStart(4, "0")}
                          </span>
                        </div>

                        {/* Status badge */}
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${isSold
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "text-muted-foreground"
                          }`}
                        >
                          {isSold ? "Vendida" : "Disponível"}
                        </Badge>

                        {/* Buyer info — only shown when toggle is ON and card is sold */}
                        {showDetails && isSold && (
                          <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-0.5">
                            {card.player_name && (
                              <span className="flex items-center gap-1 text-sm text-green-800 truncate">
                                <User className="w-3.5 h-3.5 shrink-0" />
                                {card.player_name}
                              </span>
                            )}
                            {card.player_phone && (
                              <span className="flex items-center gap-1 text-sm text-green-700">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                {card.player_phone}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Placeholder when details hidden */}
                        {!showDetails && isSold && (
                          <span className="flex-1 text-xs text-muted-foreground italic">
                            Dados ocultos — clique em "Dados do comprador" para ver
                          </span>
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
    </div>
  );
}