import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Users } from "lucide-react";

export default function WinnerSummary() {
  const { data: allCards = [], isLoading } = useQuery({
    queryKey: ["all-cards-winners"],
    queryFn: () => base44.entities.BingoCard.list(),
  });

  const { data: games = [] } = useQuery({
    queryKey: ["all-games"],
    queryFn: () => base44.entities.BingoGame.list(),
  });

  // Build game name map
  const gameMap = {};
  games.forEach((g) => { gameMap[g.id] = g; });

  // Filter cards marked as winners or with won_prizes
  const winnerCards = allCards
    .filter((c) => c.is_winner || (c.won_prizes && c.won_prizes.length > 0))
    .sort((a, b) => {
      const gA = gameMap[a.game_id]?.name || "";
      const gB = gameMap[b.game_id]?.name || "";
      if (gA !== gB) return gA.localeCompare(gB);
      return (a.card_number || 0) - (b.card_number || 0);
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <Trophy className="w-6 h-6 text-accent" /> Cartelas Premiadas
            </h1>
          </div>
          <Badge variant="outline" className="text-base px-3 py-1.5">
            <Trophy className="w-4 h-4 text-accent mr-1.5" />
            {winnerCards.length} premiada{winnerCards.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : winnerCards.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Trophy className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Nenhuma cartela premiada ainda.</p>
              <p className="text-sm mt-1">As cartelas marcadas como vencedoras aparecerão aqui automaticamente.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Group by game */}
            {(() => {
              const grouped = {};
              winnerCards.forEach((card) => {
                const gameName = gameMap[card.game_id]?.name || "Jogo sem nome";
                if (!grouped[gameName]) grouped[gameName] = [];
                grouped[gameName].push(card);
              });

              return Object.entries(grouped).map(([gameName, cards]) => (
                <Card key={gameName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-heading flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      {gameName}
                      <Badge variant="secondary" className="text-xs">{cards.length} cartela{cards.length !== 1 ? "s" : ""}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Nº Cartela</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Jogador</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Telefone</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cidade</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Prêmio(s)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cards.map((card) => (
                            <tr key={card.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-bold text-primary">
                                {String(card.card_number || "").padStart(3, "0")}
                              </td>
                              <td className="py-2.5 px-4 font-medium">{card.player_name || "—"}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">{card.player_phone || "—"}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {[card.player_city, card.player_state].filter(Boolean).join(" - ") || "—"}
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {card.won_prizes && card.won_prizes.length > 0 ? (
                                    card.won_prizes.map((prize, i) => (
                                      <Badge key={i} className="bg-accent text-accent-foreground text-xs border-0">
                                        🏆 {prize.prize_name}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      Vencedor
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}