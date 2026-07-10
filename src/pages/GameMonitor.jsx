import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity, Eye, Search, Trophy, Ticket, Radio, Play, MapPin, Calendar,
  Hash, Monitor, CheckSquare, Filter, Pencil,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import EditGameModal from "@/components/bingo/EditGameModal";

const REFRESH_MS = 5000;

const statusConfig = {
  waiting: {
    label: "Aguardando",
    icon: Activity,
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    bar: "from-amber-400 to-amber-500",
  },
  in_progress: {
    label: "Em Andamento",
    icon: Radio,
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500 animate-pulse",
    bar: "from-emerald-400 to-emerald-500",
  },
  finished: {
    label: "Finalizado",
    icon: Trophy,
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-slate-400",
    bar: "from-slate-300 to-slate-400",
  },
};

const filters = [
  { key: "all", label: "Todos" },
  { key: "waiting", label: "Aguardando" },
  { key: "in_progress", label: "Em Andamento" },
  { key: "finished", label: "Finalizados" },
];

function GameCard({ game, allCards, onEdit }) {
  const cfg = statusConfig[game.status] || statusConfig.waiting;
  const StatusIcon = cfg.icon;
  const drawn = game.drawn_numbers?.length || 0;
  const max = game.max_number || 75;
  const pct = Math.round((drawn / max) * 100);
  const prizes = game.prizes || [];
  const awarded = prizes.filter((p) => p.awarded).length;
  const gameCards = allCards.filter((c) => String(c.game_id) === String(game.id));
  const soldCards = gameCards.filter((c) => c.player_phone || c.player_city).length;
  const validatedCards = gameCards.filter((c) => c.is_validated).length;
  const winnerCards = gameCards.filter((c) => c.is_winner).length;

  const lastNumbers = (game.drawn_numbers || []).slice(-5).reverse();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover:shadow-lg transition-shadow border-border/60 overflow-hidden">
        {/* Status bar */}
        <div className={`h-1.5 bg-gradient-to-r ${cfg.bar}`} />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <Badge variant="outline" className={cfg.badge}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {cfg.label}
                </Badge>
              </div>
              <CardTitle className="font-heading text-base truncate">{game.name}</CardTitle>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold font-heading text-foreground">{pct}%</div>
              <p className="text-xs text-muted-foreground">{drawn}/{max} números</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${cfg.bar}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Event info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {game.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(game.event_date), "dd/MM/yyyy HH:mm")}
              </span>
            )}
            {game.event_location && (
              <span className="flex items-center gap-1 truncate max-w-[180px]">
                <MapPin className="w-3 h-3" />
                {game.event_location}
              </span>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/40">
              <Ticket className="w-3.5 h-3.5 mx-auto text-primary mb-0.5" />
              <div className="text-sm font-bold">{soldCards}</div>
              <div className="text-[10px] text-muted-foreground">Vendidas</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/40">
              <CheckSquare className="w-3.5 h-3.5 mx-auto text-blue-600 mb-0.5" />
              <div className="text-sm font-bold">{validatedCards}</div>
              <div className="text-[10px] text-muted-foreground">Validadas</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/40">
              <Trophy className="w-3.5 h-3.5 mx-auto text-amber-600 mb-0.5" />
              <div className="text-sm font-bold">{awarded}/{prizes.length}</div>
              <div className="text-[10px] text-muted-foreground">Prêmios</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/40">
              <Activity className="w-3.5 h-3.5 mx-auto text-emerald-600 mb-0.5" />
              <div className="text-sm font-bold">{winnerCards}</div>
              <div className="text-[10px] text-muted-foreground">Vencedores</div>
            </div>
          </div>

          {/* Last drawn numbers */}
          {game.status === "in_progress" && lastNumbers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="w-3 h-3" /> Últimos:
              </span>
              {lastNumbers.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to={`/game/${game.id}`} className="flex-1 min-w-[120px]">
              <Button size="sm" className="w-full gap-1.5">
                <Play className="w-3.5 h-3.5" /> Sorteio
              </Button>
            </Link>
            <Link to={`/telao/${game.id}`} target="_blank">
              <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
                <Monitor className="w-3.5 h-3.5" /> Telão
              </Button>
            </Link>
            <Link to={`/cards/${game.id}`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Cartelas
              </Button>
            </Link>
            {game.status !== "finished" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
                onClick={() => onEdit(game)}
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function GameMonitor() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingGame, setEditingGame] = useState(null);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["monitor-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const { data: allCards = [] } = useQuery({
    queryKey: ["monitor-cards", userId],
    queryFn: () => base44.entities.BingoCard.filter(scope(), "created_date", 100000),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      const matchesFilter = filter === "all" || g.status === filter;
      const matchesSearch = !search || g.name.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [games, filter, search]);

  const counts = useMemo(() => ({
    all: games.length,
    waiting: games.filter((g) => g.status === "waiting").length,
    in_progress: games.filter((g) => g.status === "in_progress").length,
    finished: games.filter((g) => g.status === "finished").length,
  }), [games]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
                <Monitor className="w-6 h-6 text-primary" />
                Monitor de Jogos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Acompanhe todos os jogos em tempo real • atualiza a cada {REFRESH_MS / 1000}s
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-1.5">
                ← Voltar
              </Button>
            </Link>
          </div>

          {/* Filters + Search */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    filter === f.key
                      ? "bg-primary text-primary-foreground shadow"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 border border-border"
                  }`}
                >
                  {f.label}
                  <span className={`text-xs px-1.5 rounded-full ${
                    filter === f.key ? "bg-primary-foreground/20" : "bg-background"
                  }`}>
                    {counts[f.key] || 0}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar jogo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20">
            <Monitor className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {games.length === 0
                ? "Nenhum jogo criado ainda."
                : "Nenhum jogo encontrado com os filtros aplicados."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGames.map((game) => (
              <GameCard key={game.id} game={game} allCards={allCards} onEdit={setEditingGame} />
            ))}
            </div>
            )}
            </div>

            {editingGame && (
            <EditGameModal
            game={editingGame}
            onClose={() => setEditingGame(null)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["monitor-games"] })}
            />
            )}
            </div>
            );
            }