import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronDown, ArrowLeft, ShieldCheck, Grid3x3, CheckCircle2,
  XCircle, RefreshCw, Search, Layers
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const PAGE_SIZE = 500;

export default function CardValidationPanel() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all"); // all | validated | pending
  const [search, setSearch] = useState("");

  const { data: games = [] } = useQuery({
    queryKey: ["panel-games"],
    queryFn: () => base44.entities.BingoGame.filter({}, "-created_date"),
  });

  // Fetch cards via backend function (service-role, no user scoping)
  const { data: allCards = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["panel-cards", selectedGame?.id],
    queryFn: async () => {
      if (!selectedGame) return [];
      const res = await base44.functions.invoke("getGameCards", {
        game_id: String(selectedGame.id),
      });
      return res.data.cards || [];
    },
    enabled: !!selectedGame,
  });

  const validatedCards = useMemo(() => allCards.filter(c => c.is_validated), [allCards]);
  const pendingCards = useMemo(() => allCards.filter(c => !c.is_validated), [allCards]);

  const validationRate = allCards.length > 0
    ? Math.round((validatedCards.length / allCards.length) * 100)
    : 0;

  // Build a lookup map for quick status check by card_number
  const cardMap = useMemo(() => {
    const map = new Map();
    allCards.forEach(c => {
      if (c.card_number != null) map.set(c.card_number, c);
    });
    return map;
  }, [allCards]);

  // Determine the range of card numbers to display
  const { minNum, maxNum } = useMemo(() => {
    if (allCards.length === 0) return { minNum: 1, maxNum: 1 };
    let min = Infinity, max = 0;
    allCards.forEach(c => {
      if (c.card_number != null) {
        if (c.card_number < min) min = c.card_number;
        if (c.card_number > max) max = c.card_number;
      }
    });
    return { minNum: min === Infinity ? 1 : min, maxNum: max };
  }, [allCards]);

  // Filtered list based on search + filter mode (for the detailed list view)
  const filteredCards = useMemo(() => {
    let result = allCards;
    if (filter === "validated") result = validatedCards;
    if (filter === "pending") result = pendingCards;

    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(c =>
      String(c.card_number).includes(q) ||
      c.player_name?.toLowerCase().includes(q)
    );
  }, [allCards, validatedCards, pendingCards, filter, search]);

  // Paginated grid view
  const totalNumbers = maxNum - minNum + 1;
  const totalPages = Math.max(1, Math.ceil(totalNumbers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const startNum = minNum + currentPage * PAGE_SIZE;
  const endNum = Math.min(maxNum, startNum + PAGE_SIZE - 1);

  const gridNumbers = [];
  for (let n = startNum; n <= endNum; n++) gridNumbers.push(n);

  const getCardStatus = (num) => {
    const card = cardMap.get(num);
    if (!card) return "missing";
    return card.is_validated ? "validated" : "pending";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/app" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold font-heading">Painel de Conferência de Cartelas</h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Visualize rapidamente quais cartelas estão validadas e quais ainda faltam
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Game selector */}
        <div className="relative">
          <button
            className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-input bg-card text-sm hover:bg-accent transition-colors shadow-sm"
            onClick={() => setShowGamePicker((v) => !v)}
          >
            <span className={selectedGame ? "text-foreground font-medium" : "text-muted-foreground"}>
              {selectedGame?.name || "Selecione um jogo..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showGamePicker && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-52 overflow-auto">
              {games.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Nenhum jogo encontrado</div>
              ) : (
                games.map((g) => (
                  <button
                    key={g.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted text-sm"
                    onClick={() => {
                      setSelectedGame(g);
                      setShowGamePicker(false);
                      setPage(0);
                      setFilter("all");
                      setSearch("");
                    }}
                  >
                    {g.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedGame && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-border">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold font-heading text-foreground">{allCards.length}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <Layers className="w-3 h-3" /> Total
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold font-heading text-green-700">{validatedCards.length}</div>
                  <div className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Validadas
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold font-heading text-amber-700">{pendingCards.length}</div>
                  <div className="text-xs text-amber-600 mt-1 flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3" /> Pendentes
                  </div>
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold font-heading text-primary">{validationRate}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Taxa de validação</div>
                </CardContent>
              </Card>
            </div>

            {/* Progress bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso do lote</span>
                  <span className="text-sm text-muted-foreground">
                    {validatedCards.length} / {allCards.length}
                  </span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${validationRate}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Refresh button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Atualizando..." : "Atualizar dados"}
              </Button>
            </div>

            {/* Visual Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-base">
                  <Grid3x3 className="w-5 h-5 text-primary" />
                  Grade Visual de Cartelas
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (Faixa: {startNum}–{endNum})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Legend + Grid Filter */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-green-500 border border-green-600" />
                      Validada
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-amber-300 border border-amber-400" />
                      Pendente
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-muted border border-border" />
                      Não encontrada
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={filter === "all" ? "default" : "outline"}
                      onClick={() => setFilter("all")}
                    >
                      Todas
                    </Button>
                    <Button
                      size="sm"
                      variant={filter === "validated" ? "default" : "outline"}
                      className={filter === "validated" ? "bg-green-600 hover:bg-green-700" : ""}
                      onClick={() => setFilter("validated")}
                    >
                      Validadas
                    </Button>
                    <Button
                      size="sm"
                      variant={filter === "pending" ? "default" : "outline"}
                      className={filter === "pending" ? "bg-amber-600 hover:bg-amber-700" : ""}
                      onClick={() => setFilter("pending")}
                    >
                      Não validadas
                    </Button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-15 gap-1.5">
                    {[...Array(60)].map((_, i) => (
                      <div key={i} className="aspect-square rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-15 gap-1.5">
                    {gridNumbers.map((num) => {
                      const status = getCardStatus(num);
                      // Dim cells that don't match the active filter
                      const matchesFilter =
                        filter === "all" ||
                        (filter === "validated" && status === "validated") ||
                        (filter === "pending" && status === "pending");
                      const cellClass =
                        status === "validated"
                          ? "bg-green-500 text-white border-green-600 hover:bg-green-600"
                          : status === "pending"
                          ? "bg-amber-300 text-amber-900 border-amber-400 hover:bg-amber-400"
                          : "bg-muted text-muted-foreground border-border";
                      return (
                        <div
                          key={num}
                          className={`aspect-square rounded border flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all cursor-default ${cellClass} ${
                            matchesFilter ? "opacity-100" : "opacity-20"
                          }`}
                          title={`Cartela ${num} — ${status === "validated" ? "Validada" : status === "pending" ? "Pendente" : "Não encontrada"}`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 0}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                    >
                      ← Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage + 1} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    >
                      Próxima →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed List with filters */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-base">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Lista Detalhada
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filter tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    size="sm"
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => setFilter("all")}
                  >
                    Todas ({allCards.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === "validated" ? "default" : "outline"}
                    className={filter === "validated" ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => setFilter("validated")}
                  >
                    Validadas ({validatedCards.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === "pending" ? "default" : "outline"}
                    className={filter === "pending" ? "bg-amber-600 hover:bg-amber-700" : ""}
                    onClick={() => setFilter("pending")}
                  >
                    Pendentes ({pendingCards.length})
                  </Button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-transparent pl-9 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Buscar por número ou nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* List */}
                <div className="max-h-96 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2 bg-muted/20">
                  {filteredCards.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma cartela encontrada com este filtro.
                    </p>
                  ) : (
                    filteredCards.slice(0, 200).map((card) => (
                      <div
                        key={card.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-sm border ${
                          card.is_validated
                            ? "bg-green-50 border-green-200"
                            : "bg-amber-50 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {card.is_validated ? (
                            <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className="font-bold font-heading">
                            #{String(card.card_number || "").padStart(4, "0")}
                          </span>
                          {card.player_name && card.player_name !== "Cartela Importada" && (
                            <span className="text-muted-foreground truncate">— {card.player_name}</span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            card.is_validated
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}
                        >
                          {card.is_validated ? "Validada" : "Pendente"}
                        </Badge>
                      </div>
                    ))
                  )}
                  {filteredCards.length > 200 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Mostrando 200 de {filteredCards.length} resultados. Use a busca para refinar.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}