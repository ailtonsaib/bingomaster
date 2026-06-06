import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, Trash2, Trophy, Users, Pencil, UserCheck, ShoppingCart, Layers, CheckSquare, RotateCcw, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import EditGameModal from "@/components/bingo/EditGameModal";
import DistributeCardsModal from "@/components/bingo/DistributeCardsModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const statusLabels = {
  waiting: { label: "Aguardando", class: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "Em Andamento", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finished: { label: "Finalizado", class: "bg-muted text-muted-foreground border-border" },
};

export default function Home() {
  const queryClient = useQueryClient();
  const { data: games = [], isLoading, refetch } = useQuery({
    queryKey: ["bingo-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers-stats"],
    queryFn: () => base44.entities.Seller.list(),
  });
  const { data: allCards = [] } = useQuery({
    queryKey: ["all-cards-stats"],
    queryFn: () => base44.functions.invoke("getAllCards", {}).then(r => r.data.cards),
  });
  const [editingGame, setEditingGame] = useState(null);
  const [showDistribute, setShowDistribute] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sellerStats = useMemo(() => {
    const stats = sellers.map((seller) => {
      const soldCards = allCards.filter((c) => {
        // Só conta cartela vendida (tem comprador) com vendedor vinculado via seller_id
        const isSold = !!(c.player_phone || c.player_city);
        return isSold && c.seller_id === seller.id;
      });
      return {
        name: seller.name,
        vendidas: soldCards.length,
      };
    }).sort((a, b) => b.vendidas - a.vendidas);
    return stats;
  }, [sellers, allCards]);

  const handleDelete = async (id) => {
    try {
      // Delete cards first, then game
      const res = await base44.functions.invoke("getGameCards", { game_id: String(id) });
      const cards = res.data.cards;
      for (const card of cards) {
        await base44.entities.BingoCard.delete(card.id);
      }
      await base44.entities.BingoGame.delete(id);
      refetch();
    } catch (error) {
      if (error.message?.includes("not found")) {
        refetch();
      } else {
        console.error("Erro ao deletar jogo:", error);
        alert("Erro ao deletar jogo. Tente novamente.");
      }
    }
  };

  const handleResetAll = async () => {
    setResetting(true);
    try {
      // Delete all cards first
      const allCardsRes = await base44.functions.invoke("getAllCards", {});
      const allCards = allCardsRes.data.cards;
      if (allCards.length > 0) {
        for (const card of allCards) {
          try {
            await base44.entities.BingoCard.delete(card.id);
          } catch (e) {
            console.warn(`Erro ao deletar cartela ${card.id}:`, e);
          }
        }
      }
      // Delete all games
      const allGamesRes = await base44.functions.invoke("getAllGames", {});
      const allGames = allGamesRes.data.games;
      if (allGames.length > 0) {
        for (const game of allGames) {
          try {
            await base44.entities.BingoGame.delete(game.id);
          } catch (e) {
            console.warn(`Erro ao deletar jogo ${game.id}:`, e);
          }
        }
      }
      await queryClient.invalidateQueries();
      refetch();
      setShowResetDialog(false);
      alert("Reset concluído com sucesso!");
    } catch (error) {
      console.error("Erro ao resetar:", error);
      alert("Erro ao resetar. Tente novamente.");
    } finally {
      setResetting(false);
    }
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
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <Link to="/new-game">
                <Button size="lg" className="gap-2 text-base px-8">
                  <Plus className="w-5 h-5" /> Novo Jogo
                </Button>
              </Link>
              <Link to="/sellers">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                  <UserCheck className="w-5 h-5" /> Vendedores
                </Button>
              </Link>
              <Link to="/sell">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-green-300 text-green-700 hover:bg-green-50">
                  <ShoppingCart className="w-5 h-5" /> App de Vendas
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-base px-8 border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setShowDistribute(true)}
              >
                <Layers className="w-5 h-5" /> Distribuir Cartelas
              </Button>
              <Link to="/validate">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <CheckSquare className="w-5 h-5" /> Validar Cartelas
                </Button>
              </Link>
              <Link to="/winners">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Trophy className="w-5 h-5" /> Cartelas Premiadas
                </Button>
              </Link>
              <Link to="/past-games">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-slate-300 text-slate-700 hover:bg-slate-50">
                  <Trophy className="w-5 h-5" /> Jogos Anteriores
                </Button>
              </Link>
              <Link to="/game-analytics">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Trophy className="w-5 h-5" /> Analytics
                </Button>
              </Link>
              <Button
                size="lg"
                variant="destructive"
                className="gap-2 text-base px-8 bg-red-500 hover:bg-red-600 text-white border-0"
                onClick={() => setShowResetDialog(true)}
              >
                <RotateCcw className="w-5 h-5" /> Resetar Tudo
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Chart */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Cartelas Vendidas por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellerStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor cadastrado</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sellerStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'hsl(var(--muted))' }}
                  />
                  <Bar dataKey="vendidas" radius={[6, 6, 0, 0]}>
                    {sellerStats.map((entry, index) => (
                      <Cell key={index} fill={entry.vendidas > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <h2 className="text-xl font-bold font-heading mb-6 mt-10">Seus Jogos</h2>

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
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingGame(game)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
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
      {showDistribute && (
        <DistributeCardsModal onClose={() => setShowDistribute(false)} />
      )}
      {editingGame && (
        <EditGameModal
          game={editingGame}
          onClose={() => setEditingGame(null)}
          onSaved={refetch}
        />
      )}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Resetar Aplicativo Completo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>deletar TODOS os jogos e cartelas</strong> permanentemente. 
              Não será possível recuperar os dados após o reset.
              <br /><br />
              <strong>Tem certeza que deseja continuar?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAll}
              disabled={resetting}
              className="bg-red-500 hover:bg-red-600"
            >
              {resetting ? "Resetando..." : "Sim, Resetar Tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}