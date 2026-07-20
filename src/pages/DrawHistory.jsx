import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Trophy, Calendar, Hash, User, Shuffle,
  ChevronDown, ChevronUp, Crown, History, MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DrawHistory() {
  const [expandedGame, setExpandedGame] = useState(null);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["draw-history-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  // Busca cartelas vencedoras do jogo expandido
  const { data: winnerCards = [] } = useQuery({
    queryKey: ["draw-history-cards", expandedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter(
      scope({ game_id: String(expandedGame.id), is_winner: true }),
      "card_number"
    ),
    enabled: !!expandedGame,
  });

  const toggleGame = (game) => {
    setExpandedGame(expandedGame?.id === game.id ? null : game);
  };

  // Filtra apenas jogos que tiveram pelo menos 1 prêmio concedido
  const gamesWithPrizes = games.filter(
    (g) => (g.prizes || []).some((p) => p.awarded)
  );

  // Conta total de prêmios concedidos e sorteios
  const totalPrizes = gamesWithPrizes.reduce(
    (sum, g) => sum + (g.prizes || []).filter((p) => p.awarded).length,
    0
  );
  const totalDraws = gamesWithPrizes.reduce(
    (sum, g) => sum + (g.drawn_numbers || []).length,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-violet-300 hover:text-white mb-1 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Início
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold font-heading flex items-center gap-2">
              <History className="w-7 h-7 text-amber-400" /> Histórico de Sorteios
            </h1>
            <p className="text-sm text-violet-300 mt-1">
              Relatório completo de todos os sorteios realizados
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <div className="text-3xl font-bold font-heading text-amber-400">{gamesWithPrizes.length}</div>
            <div className="text-xs text-violet-300 mt-1">Jogos com Sorteios</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <div className="text-3xl font-bold font-heading text-emerald-400">{totalPrizes}</div>
            <div className="text-xs text-violet-300 mt-1">Prêmios Concedidos</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
            <div className="text-3xl font-bold font-heading text-blue-400">{totalDraws}</div>
            <div className="text-xs text-violet-300 mt-1">Números Sorteados</div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-white/20 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && gamesWithPrizes.length === 0 && (
          <Card className="bg-white/10 border-white/10 text-white">
            <CardContent className="py-16 text-center">
              <Trophy className="w-12 h-12 text-violet-400 mx-auto mb-3" />
              <p className="text-violet-200">Nenhum sorteio realizado ainda.</p>
            </CardContent>
          </Card>
        )}

        {/* Lista de jogos */}
        <div className="space-y-3">
          {gamesWithPrizes.map((game) => {
            const awardedPrizes = (game.prizes || []).filter((p) => p.awarded);
            const isExpanded = expandedGame?.id === game.id;
            return (
              <motion.div
                key={game.id}
                layout
                className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 overflow-hidden"
              >
                {/* Cabeçalho do jogo */}
                <button
                  onClick={() => toggleGame(game)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-lg font-heading">{game.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-violet-300">
                      {game.event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(game.event_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {game.event_location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {game.event_location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {awardedPrizes.length} prêmio(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {(game.drawn_numbers || []).length} sorteados
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-violet-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-violet-300" />
                  )}
                </button>

                {/* Detalhes expandidos */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/10 p-4 space-y-3">
                        {awardedPrizes.map((prize, idx) => {
                          // Encontra a cartela vencedora deste prêmio
                          const winnerCard = winnerCards.find(
                            (c) => c.won_prizes && c.won_prizes.some((wp) => wp.prize_index === (game.prizes || []).indexOf(prize))
                          );
                          const prizeIdx = (game.prizes || []).indexOf(prize);

                          return (
                            <div
                              key={idx}
                              className="bg-white/5 rounded-xl border border-white/10 p-4"
                            >
                              <div className="flex items-start gap-3">
                                {/* Ícone do prêmio */}
                                <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
                                  <Crown className="w-5 h-5 text-amber-400" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-bold text-white">{prize.name}</h4>
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs">
                                      Concedido
                                    </Badge>
                                  </div>

                                  {prize.description && (
                                    <p className="text-xs text-violet-300 mb-2">{prize.description}</p>
                                  )}

                                  {/* Grid de informações */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                                    {/* Número sorteado (pedra que fechou o bingo) */}
                                    <div className="bg-blue-500/10 rounded-lg p-2.5 border border-blue-400/20">
                                      <div className="text-[10px] uppercase tracking-wider text-blue-300 mb-1 flex items-center gap-1">
                                        <Shuffle className="w-3 h-3" /> Número Sorteado
                                      </div>
                                      <div className="text-xl font-bold font-heading text-blue-400">
                                        {prize.awarded_won_at_draw != null
                                          ? prize.awarded_won_at_draw
                                          : "—"}
                                      </div>
                                    </div>

                                    {/* Número da cartela */}
                                    <div className="bg-violet-500/10 rounded-lg p-2.5 border border-violet-400/20">
                                      <div className="text-[10px] uppercase tracking-wider text-violet-300 mb-1 flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> Cartela
                                      </div>
                                      <div className="text-xl font-bold font-heading text-violet-300">
                                        {prize.awarded_card_number != null
                                          ? `#${String(prize.awarded_card_number).padStart(4, "0")}`
                                          : "—"}
                                      </div>
                                    </div>

                                    {/* Ganhador */}
                                    <div className="bg-emerald-500/10 rounded-lg p-2.5 border border-emerald-400/20">
                                      <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1">
                                        <User className="w-3 h-3" /> Ganhador
                                      </div>
                                      <div className="text-sm font-semibold text-emerald-300 truncate">
                                        {prize.awarded_player_name || "—"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Pedra maior (se houve desempate) */}
                                  {prize.pedra_maior != null && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-400/10 rounded-lg px-3 py-1.5 border border-amber-400/20">
                                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                      <span className="text-xs text-amber-300 font-medium">
                                        Pedra Maior (desempate): {prize.pedra_maior}
                                      </span>
                                    </div>
                                  )}

                                  {/* Telefone do ganhador (se disponível) */}
                                  {winnerCard?.player_phone && (
                                    <p className="text-xs text-violet-400 mt-2">
                                      📞 {winnerCard.player_phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}