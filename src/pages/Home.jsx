import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, Trash2, Trophy, Users } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const statusLabels = {
  waiting: { label: "Aguardando", class: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "Em Andamento", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finished: { label: "Finalizado", class: "bg-muted text-muted-foreground border-border" },
};

export default function Home() {
  const { data: games = [], isLoading, refetch } = useQuery({
    queryKey: ["bingo-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const handleDelete = async (id) => {
    // Delete cards first, then game
    const cards = await base44.entities.BingoCard.filter({ game_id: String(id) });
    for (const card of cards) {
      await base44.entities.BingoCard.delete(card.id);
    }
    await base44.entities.BingoGame.delete(id);
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="relative max-w-5xl mx-auto px-4 py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight text-foreground">
              Bingo
              <span className="text-primary"> Eletrônico</span>
            </h1>
            <p className="mt-3 text-lg text-muted-foreground max-w-lg mx-auto">
              Crie jogos, gere cartelas e sorteie números com um sistema completo e elegante.
            </p>
            <Link to="/new-game">
              <Button size="lg" className="mt-6 gap-2 text-base px-8">
                <Plus className="w-5 h-5" /> Novo Jogo
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Games list */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-xl font-bold font-heading mb-6">Seus Jogos</h2>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Nenhum jogo criado</h3>
              <p className="text-muted-foreground text-sm mt-1">Crie seu primeiro jogo de bingo!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {games.map((game, idx) => {
              const status = statusLabels[game.status] || statusLabels.waiting;
              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="font-heading text-lg">{game.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(game.created_date), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                        <Badge variant="outline" className={status.class}>
                          {status.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" />
                          {game.prizes?.length || 0} prêmios
                        </span>
                        <span className="flex items-center gap-1">
                          <Play className="w-3.5 h-3.5" />
                          {game.drawn_numbers?.length || 0} sorteados
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/game/${game.id}`} className="flex-1">
                          <Button variant="outline" className="w-full gap-1.5" size="sm">
                            {game.status === "waiting" ? (
                              <><Play className="w-3.5 h-3.5" /> Iniciar</>
                            ) : (
                              <><Eye className="w-3.5 h-3.5" /> Abrir</>
                            )}
                          </Button>
                        </Link>
                        <Link to={`/cards/${game.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Users className="w-3.5 h-3.5" /> Cartelas
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(game.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}