import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Trophy, ChevronDown, User, Phone, MapPin,
  CheckCircle2, Clock, CreditCard, ShieldCheck, Medal
} from "lucide-react";

export default function WinnerSummary() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [] } = useQuery({
    queryKey: ["winner-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["winner-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter(
      scope({ game_id: String(selectedGame.id), is_winner: true }),
      "card_number"
    ),
    enabled: !!selectedGame,
  });

  // Organiza prêmios: para cada prêmio do jogo, encontra a(s) cartela(s) vencedora(s)
  const prizes = selectedGame?.prizes || [];

  const prizeRows = prizes.map((prize, idx) => {
    const winners = cards.filter(
      (c) => c.won_prizes && c.won_prizes.some((wp) => wp.prize_index === idx)
    );
    return { prize, idx, winners };
  });

  const paymentLabel = (card) => {
    if (card.payment_status === "pending") return { label: "Pgto pendente", className: "bg-orange-100 text-orange-700 border-orange-200", icon: <Clock className="w-3 h-3" /> };
    return { label: "Pago", className: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> };
  };

  const totalWinners = cards.length;
  const awardedCount = prizeRows.filter((r) => r.winners.length > 0).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-300" /> Resumo de Prêmios
        </h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Veja quais cartelas ganharam cada prêmio e o status de pagamento
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Game picker */}
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
                    onClick={() => { setSelectedGame(g); setShowGamePicker(false); }}
                  >
                    <span className="font-medium">{g.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {g.status === "finished" ? "✅ Finalizado" : g.status === "in_progress" ? "🎯 Em andamento" : "⏳ Aguardando"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedGame && (
          <>
            {/* Stats */}
            {!isLoading && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold font-heading text-primary">{prizes.length}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Prêmios no jogo</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold font-heading text-amber-700">{awardedCount}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Prêmios entregues</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold font-heading text-green-700">{totalWinners}</div>
                  <div className="text-xs text-green-600 mt-0.5">Cartelas premiadas</div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : prizes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Trophy className="w-12 h-12 mb-3 opacity-20" />
                  <p>Este jogo não possui prêmios cadastrados.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {prizeRows.map(({ prize, idx, winners }) => (
                  <Card key={idx} className={`border-2 transition-all ${
                    winners.length > 0
                      ? "border-amber-300 bg-amber-50/30"
                      : "border-border bg-card"
                  }`}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-base font-heading flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          winners.length > 0
                            ? "bg-amber-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="flex-1">{prize.name || `Prêmio ${idx + 1}`}</span>
                        {winners.length > 0 ? (
                          <Badge className="bg-amber-500 text-white border-0 gap-1">
                            <Trophy className="w-3 h-3" /> Entregue
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Não entregue
                          </Badge>
                        )}
                      </CardTitle>
                      {prize.description && (
                        <p className="text-xs text-muted-foreground ml-9">{prize.description}</p>
                      )}
                    </CardHeader>

                    <CardContent className="px-4 pb-4">
                      {winners.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 ml-1">
                          <Medal className="w-4 h-4 opacity-40" />
                          Nenhuma cartela vencedora registrada para este prêmio
                        </div>
                      ) : (
                        <div className="space-y-2 mt-1">
                          {winners.map((card) => {
                            const payment = paymentLabel(card);
                            const wonPrize = card.won_prizes?.find((wp) => wp.prize_index === idx);
                            return (
                              <div key={card.id} className="flex items-start gap-3 bg-white border border-amber-200 rounded-lg p-3">
                                <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold font-heading text-primary">
                                      #{String(card.card_number || "").padStart(4, "0")}
                                    </span>
                                    <Badge variant="outline" className={`text-xs gap-1 ${payment.className}`}>
                                      {payment.icon} {payment.label}
                                    </Badge>
                                    {wonPrize?.won_at_draw && (
                                      <span className="text-xs text-muted-foreground">
                                        (pedra {wonPrize.won_at_draw})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                    {card.player_name && (
                                      <span className="flex items-center gap-1 text-sm text-foreground">
                                        <User className="w-3 h-3 text-muted-foreground" /> {card.player_name}
                                      </span>
                                    )}
                                    {card.player_phone && (
                                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Phone className="w-3 h-3" /> {card.player_phone}
                                      </span>
                                    )}
                                    {card.player_city && (
                                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin className="w-3 h-3" />
                                        {[card.player_city, card.player_state].filter(Boolean).join(" - ")}
                                      </span>
                                    )}
                                    {card.seller_name && (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        Vendedor: {card.seller_name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {!selectedGame && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Trophy className="w-16 h-16 mb-4 opacity-15" />
              <p className="text-base font-medium">Selecione um jogo acima</p>
              <p className="text-sm mt-1">para ver o resumo dos prêmios e vencedores</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}