import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Ticket, Trophy, CheckSquare, Users, TrendingUp, Radio } from "lucide-react";
import { motion } from "framer-motion";

const REFRESH_MS = 5000;

export default function LiveStatsPanel() {
  const { userId, scope, enabled } = useUserScope();
  const { data: games = [] } = useQuery({
    queryKey: ["live-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const { data: allCards = [] } = useQuery({
    queryKey: ["live-cards", userId],
    queryFn: () => base44.entities.BingoCard.filter(scope(), "created_date", 100000),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["live-sellers", userId],
    queryFn: () => base44.entities.Seller.filter(scope()),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const stats = useMemo(() => {
    const activeGames = games.filter((g) => g.status === "in_progress");
    const waitingGames = games.filter((g) => g.status === "waiting");
    const finishedGames = games.filter((g) => g.status === "finished");

    const activeGameIds = new Set(
      [...activeGames, ...finishedGames].map((g) => g.id)
    );
    const totalCards = allCards.length;
    const soldCards = allCards.filter((c) => c.player_phone || c.player_city).length;
    const validatedCards = allCards.filter((c) => c.is_validated).length;
    const winnerCards = allCards.filter(
      (c) => c.is_winner && activeGameIds.has(c.game_id)
    ).length;

    const totalDrawn = games.reduce((sum, g) => sum + (g.drawn_numbers?.length || 0), 0);
    const totalPrizes = games.reduce((sum, g) => sum + (g.prizes?.length || 0), 0);
    const awardedPrizes = games.reduce(
      (sum, g) => sum + (g.prizes?.filter((p) => p.awarded).length || 0),
      0
    );

    const activeSellers = sellers.filter((s) => s.is_active).length;

    return {
      activeGames,
      waitingGames,
      finishedGames,
      totalCards,
      soldCards,
      validatedCards,
      winnerCards,
      totalDrawn,
      totalPrizes,
      awardedPrizes,
      activeSellers,
      sellRate: totalCards > 0 ? ((soldCards / totalCards) * 100).toFixed(1) : 0,
      validationRate: totalCards > 0 ? ((validatedCards / totalCards) * 100).toFixed(1) : 0,
    };
  }, [games, allCards, sellers]);

  const summaryCards = [
    {
      label: "Jogos Ativos",
      value: stats.activeGames.length,
      sub: `${stats.waitingGames.length} aguardando • ${stats.finishedGames.length} finalizados`,
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Cartelas Vendidas",
      value: stats.soldCards,
      sub: `${stats.sellRate}% de ${stats.totalCards} geradas`,
      icon: Ticket,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Cartelas Validadas",
      value: stats.validatedCards,
      sub: `${stats.validationRate}% do total`,
      icon: CheckSquare,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Prêmios Entregues",
      value: `${stats.awardedPrizes}/${stats.totalPrizes}`,
      sub: `${stats.winnerCards} cartelas vencedoras`,
      icon: Trophy,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary animate-pulse" />
            Estatísticas em Tempo Real
          </CardTitle>
          <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Ao vivo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg}`}>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold font-heading">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Active games progress */}
        {stats.activeGames.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Progresso dos Jogos Ativos
            </h4>
            <div className="space-y-3">
              {stats.activeGames.map((game) => {
                const drawn = game.drawn_numbers?.length || 0;
                const max = game.max_number || 75;
                const pct = Math.round((drawn / max) * 100);
                const gameCards = allCards.filter((c) => c.game_id === game.id);
                const gameSold = gameCards.filter((c) => c.player_phone || c.player_city).length;
                const awarded = game.prizes?.filter((p) => p.awarded).length || 0;

                return (
                  <div key={game.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{game.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {drawn}/{max} números • {gameSold} cartelas vendidas • {awarded}/{game.prizes?.length || 0} prêmios
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        {pct}%
                      </Badge>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {stats.activeSellers} vendedores ativos
          </span>
          <span>Atualiza a cada {REFRESH_MS / 1000}s</span>
        </div>
      </CardContent>
    </Card>
  );
}