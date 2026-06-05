import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trophy, Hash, Calendar, MapPin, Users, Eye } from "lucide-react";
import { motion } from "framer-motion";

export default function PastGames() {
  const [selectedGame, setSelectedGame] = useState(null);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["past-games"],
    queryFn: () => base44.entities.BingoGame.filter({ status: "finished" }, "-created_date"),
  });

  const { data: selectedGameData } = useQuery({
    queryKey: ["past-game-detail", selectedGame?.id],
    queryFn: () => base44.entities.BingoGame.get(selectedGame?.id),
    enabled: !!selectedGame?.id,
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["past-game-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(selectedGame?.id) }),
    enabled: !!selectedGame?.id,
  });

  const winnerCards = cards.filter((c) => c.won_prizes && c.won_prizes.length > 0);

  const formatDate = (dateString) => {
    if (!dateString) return "Não informada";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const columns = ["B", "I", "N", "G", "O"];
  const columnRanges = [
    { min: 1, max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 },
  ];

  if (selectedGame) {
    const drawnNumbers = selectedGameData?.drawn_numbers || [];
    const maxNumber = selectedGameData?.max_number || 75;

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link to="/past-games" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Voltar para Jogos Anteriores
            </Link>
            <h1 className="text-2xl font-bold font-heading">{selectedGameData?.name}</h1>
          </div>

          {/* Resumo do jogo */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Resultado Final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Números Sorteados</p>
                    <p className="text-2xl font-bold">{drawnNumbers.length}/{maxNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cartelas Vencedoras</p>
                    <p className="text-2xl font-bold">{winnerCards.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Cartelas</p>
                    <p className="text-2xl font-bold">{cards.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data do Evento</p>
                    <p className="text-sm font-semibold">{formatDate(selectedGameData?.event_date)}</p>
                  </div>
                </div>
              </div>

              {selectedGameData?.event_location && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {selectedGameData.event_location} {selectedGameData.event_address && `- ${selectedGameData.event_address}`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Números sorteados */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" />
                Números Sorteados ({drawnNumbers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {columns.map((letter, idx) => (
                  <div key={letter} className="space-y-2">
                    <div className="text-center font-bold text-primary py-2 rounded-lg bg-primary/10">
                      {letter}
                    </div>
                    <div className="space-y-1">
                      {Array.from(
                        { length: columnRanges[idx].max - columnRanges[idx].min + 1 },
                        (_, i) => columnRanges[idx].min + i
                      ).map((num) => {
                        const isDrawn = drawnNumbers.includes(num);
                        return (
                          <div
                            key={num}
                            className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isDrawn
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground opacity-40"
                            }`}
                          >
                            {num}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cartelas vencedoras */}
          {winnerCards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-green-500" />
                  Cartelas Vencedoras ({winnerCards.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {winnerCards.map((card, idx) => (
                    <div key={card.id} className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-500 text-white border-0">
                          🏆 #{idx + 1}
                        </Badge>
                        <span className="font-bold">
                          Cartela #{String(card.card_number || "").padStart(4, "0")}
                        </span>
                      </div>
                      {card.player_name && (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{card.player_name}</p>
                          {card.player_phone && (
                            <p className="text-muted-foreground">{card.player_phone}</p>
                          )}
                          {card.player_city && (
                            <p className="text-muted-foreground">{card.player_city}</p>
                          )}
                        </div>
                      )}
                      {card.won_prizes && card.won_prizes.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground font-medium">Prêmios:</p>
                          {card.won_prizes.map((prize, pIdx) => (
                            <p key={pIdx} className="text-xs text-green-600 dark:text-green-400">
                              {prize.prize_name} ({prize.won_at_draw}º número)
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-6 flex justify-center">
            <Button onClick={() => setSelectedGame(null)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para lista
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" /> Início
          </Link>
          <h1 className="text-2xl font-bold font-heading">Jogos Anteriores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulte os resultados e números sorteados de eventos passados
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum jogo finalizado ainda</p>
          </div>
        ) : (
          <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" layout>
            {games.map((game) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                layout
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedGame(game)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-heading text-lg">{game.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-500 text-white border-0">
                        Finalizado
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {game.drawn_numbers?.length || 0} números
                      </span>
                    </div>
                    {game.event_location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{game.event_location}</span>
                      </div>
                    )}
                    {game.event_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(game.event_date)}</span>
                      </div>
                    )}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {game.prizes?.filter((p) => p.awarded)?.length || 0} prêmios entregues
                      </span>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Eye className="w-3 h-3" /> Ver detalhes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}