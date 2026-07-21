import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, Trash2, Trophy, Users, Pencil, UserCheck, ShoppingCart, Layers, CheckSquare, RotateCcw, BarChart3, Ticket, Shuffle, Monitor, Smartphone, Grid3x3, FileBarChart2, ClipboardList, DollarSign, ArrowLeft, KeyRound, Receipt, FileText, Mail, History, Wallet } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useUserScope } from "@/hooks/useUserScope";
import ChangePasswordModal from "@/components/portal/ChangePasswordModal";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import EditGameModal from "@/components/bingo/EditGameModal";
import DistributeCardsModal from "@/components/bingo/DistributeCardsModal";
import LiveStatsPanel from "@/components/bingo/LiveStatsPanel";
import GameManagementModal from "@/components/bingo/GameManagementModal";
import BingoInvitationCard from "@/components/bingo/BingoInvitationCard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useBrandName } from "@/hooks/useBrandName";
import { BRAND_OPTIONS } from "@/lib/brandConfig";
import OfflineSyncAlert from "@/components/bingo/OfflineSyncAlert";

const statusLabels = {
  waiting: { label: "Aguardando", class: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "Em Andamento", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finished: { label: "Finalizado", class: "bg-muted text-muted-foreground border-border" },
};

export default function Home() {
  const queryClient = useQueryClient();
  const { brandName, setBrandName } = useBrandName();
  const { user: authUser } = useAuth();
  const { userId, scope, enabled } = useUserScope();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { data: games = [], isLoading, refetch } = useQuery({
    queryKey: ["bingo-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers-stats", userId],
    queryFn: () => base44.entities.Seller.filter(scope()),
    enabled,
  });
  const { data: allCards = [] } = useQuery({
    queryKey: ["all-cards-stats", userId],
    queryFn: () => base44.entities.BingoCard.filter(scope(), "created_date", 100000),
    enabled,
  });
  const { data: distributions = [] } = useQuery({
    queryKey: ["all-distributions", userId],
    queryFn: () => base44.entities.SellerDistribution.filter(scope()),
    enabled,
  });
  const [editingGame, setEditingGame] = useState(null);
  const [showDistribute, setShowDistribute] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showCleanDialog, setShowCleanDialog] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Games that were cancelled/restarted (waiting status) with leftover winner data — memoizado
  const { cleanableCards, cleanableGames } = useMemo(() => {
    const cancelledGames = games.filter(g => g.status === "waiting");
    const gameMap = new Map(games.map(g => [String(g.id), g]));
    const orphanCards = allCards.filter(c => {
      const game = gameMap.get(String(c.game_id));
      return !game || game.status === "waiting";
    });
    return {
      cleanableCards: orphanCards.filter(c => c.is_winner || (c.won_prizes && c.won_prizes.length > 0)),
      cleanableGames: cancelledGames.filter(g => g.prizes && g.prizes.some(p => p.awarded)),
    };
  }, [games, allCards]);
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

  const handleCleanCancelledGames = async () => {
    setCleaning(true);
    try {
      // 1. Reset winner data on cards in batch (avoid sequential loop)
      if (cleanableCards.length > 0) {
        const cardIds = cleanableCards.map(c => c.id);
        await base44.entities.BingoCard.updateMany(
          { id: { $in: cardIds } },
          { $set: { is_winner: false, won_prizes: [] } }
        );
      }

      // 2. Reset prize awards on cancelled/restarted games (sequential — few games)
      for (const game of cleanableGames) {
        try {
          const resetPrizes = (game.prizes || []).map(p => ({
            name: p.name,
            description: p.description,
            awarded: false,
          }));
          await base44.entities.BingoGame.update(game.id, { prizes: resetPrizes });
        } catch (e) {
          console.warn(`Erro ao limpar prêmios do jogo ${game.id}:`, e);
        }
      }

      await queryClient.invalidateQueries();
      refetch();
      setShowCleanDialog(false);
      alert(`Limpeza concluída! ${cleanableCards.length} cartela(s) e ${cleanableGames.length} jogo(s) limpos.`);
    } catch (error) {
      console.error("Erro na limpeza:", error);
      alert("Erro ao limpar dados. Tente novamente.");
    } finally {
      setCleaning(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      // Delete all cards of this game in batch, then the game
      await base44.entities.BingoCard.deleteMany({ game_id: String(id) });
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
      // Delete all cards in batch (avoid sequential loop that freezes UI)
      const allCards = await base44.entities.BingoCard.filter(scope(), "created_date", 100000);
      if (allCards.length > 0) {
        await base44.entities.BingoCard.deleteMany(scope());
      }
      // Delete all games in batch
      const allGames = await base44.entities.BingoGame.filter(scope(), "created_date", 10000);
      if (allGames.length > 0) {
        await base44.entities.BingoGame.deleteMany(scope());
      }
      await queryClient.invalidateQueries();
      refetch();
      setShowResetDialog(false);
      alert(`Reset concluído! ${allCards.length} cartela(s) e ${allGames.length} jogo(s) removidos.`);
    } catch (error) {
      console.error("Erro ao resetar:", error);
      alert("Erro ao resetar. Tente novamente.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top controls */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="bg-card/80 backdrop-blur shadow-sm" onClick={() => window.location.href = '/bingo'}>
          Sair
        </Button>
        <Button variant="ghost" size="sm" className="bg-card/80 backdrop-blur shadow-sm" onClick={() => setShowChangePassword(true)}>
          Alterar Senha
        </Button>
      </div>
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <OfflineSyncAlert />
      </div>
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
                className="text-base px-8"
                onClick={() => setShowGameManager(true)}
              >
                Novo Jogo
              </Button>
              <Link to="/sellers">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Vendedores
                </Button>
              </Link>
              <a href="/sell" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8 border-green-300 text-green-700 hover:bg-green-50">
                  App do Vendedor
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setShowDistribute(true)}
              >
                Distribuir Cartelas
              </Button>
              <Link to="/validate">
                <Button size="lg" variant="outline" className="text-base px-8 border-blue-300 text-blue-700 hover:bg-blue-50">
                  Validar Cartelas
                </Button>
              </Link>
              <Link to="/painel-validacao">
                <Button size="lg" variant="outline" className="text-base px-8 border-cyan-300 text-cyan-700 hover:bg-cyan-50">
                  Painel de Conferência
                </Button>
              </Link>
              <Link to="/winners">
                <Button size="lg" variant="outline" className="text-base px-8 border-amber-300 text-amber-700 hover:bg-amber-50">
                  Prêmios & Vencedores
                </Button>
              </Link>
              <Link to="/monitor">
                <Button size="lg" variant="outline" className="text-base px-8 border-teal-300 text-teal-700 hover:bg-teal-50">
                  Monitor de Jogos
                </Button>
              </Link>
              <Link to="/bingo-financeiro">
                <Button size="lg" variant="outline" className="text-base px-8 border-green-400 text-green-700 hover:bg-green-50 font-semibold">
                  Movimentações do Evento
                </Button>
              </Link>

              <Link to="/sales-dashboard">
                <Button size="lg" variant="outline" className="text-base px-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  Dashboard de Vendas
                </Button>
              </Link>
              <Link to="/seller-report">
                <Button size="lg" variant="outline" className="text-base px-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  Relatório de Vendas
                </Button>
              </Link>
              <Link to="/final-report">
                <Button size="lg" variant="outline" className="text-base px-8 border-rose-300 text-rose-700 hover:bg-rose-50">
                  Relatório Final
                </Button>
              </Link>
              <Link to="/financial-report">
                <Button size="lg" variant="outline" className="text-base px-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  Relatório Financeiro
                </Button>
              </Link>
              <Link to="/past-games">
                <Button size="lg" variant="outline" className="text-base px-8 border-slate-300 text-slate-700 hover:bg-slate-50">
                  Jogos Anteriores
                </Button>
              </Link>
              <Link to="/draw-history">
                <Button size="lg" variant="outline" className="text-base px-8 border-violet-300 text-violet-700 hover:bg-violet-50">
                  Histórico de Sorteios
                </Button>
              </Link>
              <Link to="/game-analytics">
                <Button size="lg" variant="outline" className="text-base px-8 border-blue-300 text-blue-700 hover:bg-blue-50">
                  Analytics
                </Button>
              </Link>
              <Link to="/rifas">
                <Button size="lg" variant="outline" className="text-base px-8 border-pink-300 text-pink-700 hover:bg-pink-50">
                  Gerador de Rifas
                </Button>
              </Link>
              <a href="/buyer" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8 border-cyan-300 text-cyan-700 hover:bg-cyan-50">
                  App do Comprador
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={() => setShowGamePicker(true)}
              >
                Sorteio
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => setShowCardsPicker(true)}
              >
                Cartelas
              </Button>
              <Link to="/convite">
                <Button size="lg" variant="outline" className="text-base px-8 border-pink-300 text-pink-700 hover:bg-pink-50">
                  Convite do Bingo
                </Button>
              </Link>
              <Link to="/info-planos">
                <Button size="lg" variant="outline" className="text-base px-8 border-violet-300 text-violet-700 hover:bg-violet-50">
                  Planos & Info
                </Button>
              </Link>


            </div>
          </motion.div>
        </div>
      </div>

      {showChangePassword && authUser?.email && (
        <ChangePasswordModal userEmail={authUser.email} onClose={() => setShowChangePassword(false)} />
      )}

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

      {/* Invitation Cards */}
      {games.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-pink-600" />
            <h2 className="font-heading font-bold text-lg">Convites dos Eventos</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.filter(g => g.status !== "finished").map((game) => (
              <BingoInvitationCard key={game.id} game={game} />
            ))}
          </div>
        </div>
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
              {games.filter(g => g.status !== "finished").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum jogo encontrado.</p>
              ) : (
                games.filter(g => g.status !== "finished").map((game) => (
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
      <AlertDialog open={showCleanDialog} onOpenChange={setShowCleanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Limpar Dados de Jogos Cancelados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>remover permanentemente</strong> os registros de prêmios e vencedores
              de jogos que foram cancelados ou reiniciados (status "Aguardando").
              <br /><br />
              <strong>{cleanableCards.length}</strong> cartela(s) com dados de premiação serão limpas.
              <br />
              <strong>{cleanableGames.length}</strong> jogo(s) com prêmios entregues terão os prêmios resetados.
              <br /><br />
              As cartelas e jogos em si <strong>não serão excluídos</strong>, apenas os dados de premiação residuais.
              <br /><br />
              <strong>Tem certeza que deseja continuar?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanCancelledGames}
              disabled={cleaning}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {cleaning ? "Limpando..." : "Sim, Limpar Dados"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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