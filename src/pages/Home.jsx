import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, Trash2, Trophy, Users, Pencil, UserCheck, ShoppingCart, Layers, CheckSquare, RotateCcw, BarChart3, Ticket, Shuffle, Monitor, Smartphone, Grid3x3, FileBarChart2, ClipboardList, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import EditGameModal from "@/components/bingo/EditGameModal";
import DistributeCardsModal from "@/components/bingo/DistributeCardsModal";
import LiveStatsPanel from "@/components/bingo/LiveStatsPanel";
import GameManagementModal from "@/components/bingo/GameManagementModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useBrandName } from "@/hooks/useBrandName";
import { BRAND_OPTIONS } from "@/lib/brandConfig";

const statusLabels = {
  waiting: { label: "Aguardando", class: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "Em Andamento", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finished: { label: "Finalizado", class: "bg-muted text-muted-foreground border-border" },
};

export default function Home() {
  const queryClient = useQueryClient();
  const { brandName, setBrandName } = useBrandName();
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
  const { data: distributions = [] } = useQuery({
    queryKey: ["all-distributions"],
    queryFn: () => base44.entities.SellerDistribution.list(),
  });
  const [editingGame, setEditingGame] = useState(null);
  const [showDistribute, setShowDistribute] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [showCardsPicker, setShowCardsPicker] = useState(false);
  const [showGameManager, setShowGameManager] = useState(false);

  const sellerStats = useMemo(() => {
    const stats = sellers.map((seller) => {
      const soldCards = allCards.filter((c) => {
        const isSold = !!(c.player_phone || c.player_city);
        return isSold && c.seller_id === seller.id;
      });
      const sellerDists = distributions.filter((d) => d.seller_id === seller.id);
      const distributed = sellerDists.reduce((acc, d) => acc + (d.range_to - d.range_from + 1), 0);
      if (soldCards.length === 0 && distributed === 0) return null;
      return {
        name: seller.name,
        distribuídas: distributed,
        vendidas: soldCards.length,
      };
    }).filter(Boolean).sort((a, b) => b.distribuídas - a.distribuídas);
    return stats;
  }, [sellers, allCards, distributions]);

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
              {brandName}
              <span className="text-primary"> Eletrônico</span>
            </h1>
            <p className="mt-3 text-lg text-muted-foreground max-w-lg mx-auto">
              Crie jogos, gere cartelas e sorteie números com um sistema completo e elegante.
            </p>
            {/* Brand selector */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground font-medium">Nome exibido:</span>
              {BRAND_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBrandName(opt)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    brandName === opt
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 border border-border"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <Button
                size="lg"
                className="gap-2 text-base px-8"
                onClick={() => setShowGameManager(true)}
              >
                <Plus className="w-5 h-5" /> Novo Jogo
              </Button>
              <Link to="/sellers">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                  <UserCheck className="w-5 h-5" /> Vendedores
                </Button>
              </Link>
              <a href="/sell" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-green-300 text-green-700 hover:bg-green-50">
                  <ShoppingCart className="w-5 h-5" /> App do Vendedor
                </Button>
              </a>
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
                  <Trophy className="w-5 h-5" /> Prêmios & Vencedores
                </Button>
              </Link>
              <Link to="/sales-dashboard">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <BarChart3 className="w-5 h-5" /> Dashboard de Vendas
                </Button>
              </Link>
              <Link to="/seller-report">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  <FileBarChart2 className="w-5 h-5" /> Relatório de Vendas
                </Button>
              </Link>
              <Link to="/final-report">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-rose-300 text-rose-700 hover:bg-rose-50">
                  <ClipboardList className="w-5 h-5" /> Relatório Final
                </Button>
              </Link>
              <Link to="/financial-report">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <DollarSign className="w-5 h-5" /> Relatório Financeiro
                </Button>
              </Link>
              <Link to="/past-games">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-slate-300 text-slate-700 hover:bg-slate-50">
                  <Monitor className="w-5 h-5" /> Jogos Anteriores
                </Button>
              </Link>
              <Link to="/game-analytics">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <BarChart3 className="w-5 h-5" /> Analytics
                </Button>
              </Link>
              <Link to="/rifas">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-pink-300 text-pink-700 hover:bg-pink-50">
                  <Ticket className="w-5 h-5" /> Gerador de Rifas
                </Button>
              </Link>
              <a href="/buyer" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-cyan-300 text-cyan-700 hover:bg-cyan-50">
                  <Smartphone className="w-5 h-5" /> App do Comprador
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-base px-8 border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={() => setShowGamePicker(true)}
              >
                <Shuffle className="w-5 h-5" /> Sorteio
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-base px-8 border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => setShowCardsPicker(true)}
              >
                <Grid3x3 className="w-5 h-5" /> Cartelas
              </Button>
              <Link to="/info-planos">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-violet-300 text-violet-700 hover:bg-violet-50">
                  <Layers className="w-5 h-5" /> Planos & Info
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

      {/* Live Stats Panel */}
      <div className="max-w-5xl mx-auto px-4 pt-8">
        <LiveStatsPanel />
      </div>

      {/* Stats Chart */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> Cartelas: Distribuídas vs Vendidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sellerStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor com dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={sellerStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                    />
                    <Bar dataKey="distribuídas" name="Distribuídas" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="vendidas" name="Vendidas" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>
      </div>
      {showDistribute && (
        <DistributeCardsModal onClose={() => setShowDistribute(false)} />
      )}

      {/* Game picker modal for Sorteio */}
      {showGamePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowGamePicker(false)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-teal-600" /> Iniciar Sorteio
              </h2>
              <button onClick={() => setShowGamePicker(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Escolha um jogo para abrir o painel de sorteio:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {games.filter(g => g.status !== "finished").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum jogo ativo no momento.</p>
              ) : (
                games.filter(g => g.status !== "finished").map((game) => (
                  <Link key={game.id} to={`/game/${game.id}`} onClick={() => setShowGamePicker(false)}>
                    <div className="flex items-center justify-between p-3 rounded-xl border hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer group">
                      <div>
                        <p className="font-semibold text-sm">{game.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.status === "waiting" ? "Aguardando início" : "Em andamento"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 group-hover:border-teal-500 group-hover:text-teal-700">
                        <Eye className="w-3.5 h-3.5" /> Abrir
                      </Button>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Game picker modal for Cartelas */}
      {showCardsPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCardsPicker(false)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading flex items-center gap-2">
                <Grid3x3 className="w-5 h-5 text-slate-600" /> Gerenciar Cartelas
              </h2>
              <button onClick={() => setShowCardsPicker(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-sm text-muted-foreground">Escolha um jogo para gerenciar as cartelas:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {games.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum jogo encontrado.</p>
              ) : (
                games.map((game) => (
                  <Link key={game.id} to={`/cards/${game.id}`} onClick={() => setShowCardsPicker(false)}>
                    <div className="flex items-center justify-between p-3 rounded-xl border hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer group">
                      <div>
                        <p className="font-semibold text-sm">{game.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.status === "waiting" ? "Aguardando início" : game.status === "finished" ? "Finalizado" : "Em andamento"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 group-hover:border-slate-500 group-hover:text-slate-700">
                        <Eye className="w-3.5 h-3.5" /> Abrir
                      </Button>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editingGame && (
        <EditGameModal
          game={editingGame}
          onClose={() => setEditingGame(null)}
          onSaved={refetch}
        />
      )}
      {showGameManager && (
        <GameManagementModal
          games={games}
          onClose={() => setShowGameManager(false)}
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