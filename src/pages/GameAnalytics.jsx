import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Users, DollarSign, TrendingUp, ArrowLeft, Medal, Star, Package } from "lucide-react";
import { motion } from "framer-motion";

export default function GameAnalytics() {
  const [selectedGame, setSelectedGame] = useState(null);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ["analytics-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["analytics-cards", userId],
    queryFn: () => base44.entities.BingoCard.filter(scope(), "created_date", 100000),
    enabled,
  });

  const { data: sellers = [], isLoading: sellersLoading } = useQuery({
    queryKey: ["analytics-sellers", userId],
    queryFn: () => base44.entities.Seller.filter(scope()),
    enabled,
  });

  const gameStats = useMemo(() => {
    return games.map((game) => {
      const gameCards = cards.filter((c) => c.game_id === game.id);
      const soldCards = gameCards.filter((c) => c.player_phone || c.player_city);
      const totalRevenue = soldCards.length * (parseFloat(game.event_price || "0") || 0);

      return {
        game,
        totalCards: gameCards.length,
        soldCards: soldCards.length,
        unsoldCards: gameCards.length - soldCards.length,
        sellThroughRate: gameCards.length > 0 ? ((soldCards.length / gameCards.length) * 100).toFixed(1) : 0,
        totalRevenue,
        formattedPrice: game.event_price ? `R$ ${parseFloat(game.event_price).toFixed(2)}` : "Grátis",
      };
    });
  }, [games, cards]);

  const sellerStats = useMemo(() => {
    const stats = {};

    sellers.forEach((seller) => {
      stats[seller.id] = {
        seller,
        totalSold: 0,
        totalRevenue: 0,
        gamesParticipated: new Set(),
      };
    });

    cards.forEach((card) => {
      // Só conta cartela vendida (tem comprador) E vinculada ao vendedor via seller_id
      if (!card.player_phone && !card.player_city) return;
      if (!card.seller_id) return;

      const game = games.find((g) => g.id === card.game_id);
      if (!game) return;

      const price = parseFloat(game.event_price || "0") || 0;

      if (stats[card.seller_id]) {
        stats[card.seller_id].totalSold++;
        stats[card.seller_id].totalRevenue += price;
        stats[card.seller_id].gamesParticipated.add(card.game_id);
      }
    });

    return Object.values(stats)
      .filter((s) => s.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [sellers, cards, games]);

  const topSeller = sellerStats.length > 0 ? sellerStats[0] : null;
  const totalRevenue = gameStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
  const totalSold = gameStats.reduce((sum, stat) => stat.soldCards + sum, 0);
  const totalCards = gameStats.reduce((sum, stat) => stat.totalCards + sum, 0);

  const isLoading = gamesLoading || cardsLoading || sellersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" /> Início
          </Link>
          <h1 className="text-2xl font-bold font-heading">Analytics de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe o desempenho de vendas das cartelas e ranking de vendedores
          </p>
        </div>

        {/* Resumo Geral */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Cartelas</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCards}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalSold} vendidas ({totalCards > 0 ? ((totalSold / totalCards) * 100).toFixed(1) : 0}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Arrecadação Total</CardTitle>
              <DollarSign className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">R$ {totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {gameStats.length} eventos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vendedores Ativos</CardTitle>
              <Users className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sellerStats.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {sellers.length} cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Vendedor</CardTitle>
              <Medal className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {topSeller ? topSeller.seller.name : "-"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {topSeller ? `${topSeller.totalSold} vendas` : "-"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ranking de Vendedores */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellerStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma venda registrada ainda</p>
            ) : (
              <div className="space-y-3">
                {sellerStats.slice(0, 10).map((stat, idx) => (
                  <div
                    key={stat.seller.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? "bg-amber-500 text-white" :
                        idx === 1 ? "bg-slate-400 text-white" :
                        idx === 2 ? "bg-amber-700 text-white" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{stat.seller.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.gamesParticipated.size} evento(s) • {stat.seller.city || "Cidade não informada"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{stat.totalSold}</p>
                      <p className="text-xs text-muted-foreground">R$ {stat.totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desempenho por Evento */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Desempenho por Evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gameStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum evento cadastrado</p>
            ) : (
              <div className="space-y-4">
                {gameStats.map((stat) => (
                  <div
                    key={stat.game.id}
                    className="p-4 rounded-lg border bg-muted/40"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{stat.game.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {stat.game.event_location || "Local não informado"} • {stat.formattedPrice} por cartela
                        </p>
                      </div>
                      <Badge variant={stat.game.status === "finished" ? "default" : "secondary"}>
                        {stat.game.status === "finished" ? "Finalizado" : stat.game.status === "in_progress" ? "Em Andamento" : "Aguardando"}
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="text-center p-3 rounded-lg bg-background">
                        <p className="text-2xl font-bold text-primary">{stat.totalCards}</p>
                        <p className="text-xs text-muted-foreground">Total de cartelas</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                        <p className="text-2xl font-bold text-green-600">{stat.soldCards}</p>
                        <p className="text-xs text-muted-foreground">Vendidas</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <p className="text-2xl font-bold text-muted-foreground">{stat.unsoldCards}</p>
                        <p className="text-xs text-muted-foreground">Não vendidas</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                        <p className="text-2xl font-bold text-amber-600">R$ {stat.totalRevenue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Arrecadado</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Taxa de venda</span>
                        <span className="font-semibold">{stat.sellThroughRate}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                          style={{ width: `${stat.sellThroughRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}