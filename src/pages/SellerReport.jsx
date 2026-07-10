import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, UserCheck, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Package, DollarSign
} from "lucide-react";

export default function SellerReport() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedSeller, setExpandedSeller] = useState(null);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [] } = useQuery({
    queryKey: ["seller-report-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["seller-report-sellers", userId],
    queryFn: () => base44.entities.Seller.filter(scope()),
    enabled,
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["seller-report-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter(scope({ game_id: String(selectedGame.id) }), "card_number"),
    enabled: !!selectedGame,
  });

  // Build seller map by id
  const sellerMap = {};
  sellers.forEach((s) => { sellerMap[s.id] = s; });

  // Group cards by seller
  const sellerStats = (() => {
    const stats = {};

    cards.forEach((card) => {
      const hasBuyer = !!card.player_phone || !!card.player_city;
      if (!hasBuyer) return; // only sold cards

      const sellerId = card.seller_id || "__sem_vendedor__";
      const sellerName = card.seller_name || (card.seller_id ? sellerMap[card.seller_id]?.name : null) || "Sem vendedor";

      if (!stats[sellerId]) {
        stats[sellerId] = { sellerId, sellerName, paid: [], pending: [], cards: [] };
      }

      stats[sellerId].cards.push(card);
      if (card.payment_status === "pending") {
        stats[sellerId].pending.push(card);
      } else {
        stats[sellerId].paid.push(card);
      }
    });

    return Object.values(stats).sort((a, b) => b.cards.length - a.cards.length);
  })();

  const filtered = sellerStats.filter((s) =>
    s.sellerName.toLowerCase().includes(search.toLowerCase())
  );

  const totalSold = cards.filter((c) => !!c.player_phone || !!c.player_city).length;
  const totalPaid = cards.filter((c) => (!!c.player_phone || !!c.player_city) && c.payment_status !== "pending").length;
  const totalPending = cards.filter((c) => (!!c.player_phone || !!c.player_city) && c.payment_status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-white/80" /> Relatório de Vendedores
        </h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Cartelas vendidas e status de pagamento por vendedor
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Game picker */}
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
              {games.map((g) => (
                <button
                  key={g.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-sm"
                  onClick={() => { setSelectedGame(g); setShowGamePicker(false); setExpandedSeller(null); }}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {g.status === "finished" ? "✅ Finalizado" : g.status === "in_progress" ? "🎯 Em andamento" : "⏳ Aguardando"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedGame && !isLoading && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border rounded-xl p-3 text-center">
                <div className="text-2xl font-bold font-heading text-primary">{totalSold}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total vendidas</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold font-heading text-green-700">{totalPaid}</div>
                <div className="text-xs text-green-600 mt-0.5">Pagas</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold font-heading text-orange-700">{totalPending}</div>
                <div className="text-xs text-orange-600 mt-0.5">Pgto pendente</div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-11"
                placeholder="Buscar por vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Seller cards */}
            {filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-14 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mb-3 opacity-20" />
                  <p>Nenhuma venda registrada para este jogo.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((stat) => {
                  const isExpanded = expandedSeller === stat.sellerId;
                  const paidPct = stat.cards.length > 0 ? Math.round((stat.paid.length / stat.cards.length) * 100) : 0;

                  return (
                    <Card key={stat.sellerId} className="overflow-hidden">
                      <button
                        className="w-full text-left"
                        onClick={() => setExpandedSeller(isExpanded ? null : stat.sellerId)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold font-heading">{stat.sellerName}</span>
                                <Badge variant="outline" className="text-xs bg-muted">
                                  <Package className="w-3 h-3 mr-1" />
                                  {stat.cards.length} cartela{stat.cards.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>

                              {/* Payment bar */}
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-orange-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${paidPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{paidPct}% pago</span>
                              </div>

                              <div className="flex gap-3 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-green-700">
                                  <CheckCircle2 className="w-3 h-3" /> {stat.paid.length} pago{stat.paid.length !== 1 ? "s" : ""}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-orange-600">
                                  <Clock className="w-3 h-3" /> {stat.pending.length} pendente{stat.pending.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-muted-foreground">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </CardContent>
                      </button>

                      {/* Expanded: card list */}
                      {isExpanded && (
                        <div className="border-t bg-muted/30 px-4 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {stat.cards.map((card) => (
                              <div
                                key={card.id}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm ${
                                  card.payment_status === "pending"
                                    ? "bg-orange-50 border-orange-200"
                                    : "bg-green-50 border-green-200"
                                }`}
                              >
                                {card.payment_status === "pending"
                                  ? <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  : <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                }
                                <div className="min-w-0">
                                  <div className="font-bold font-heading text-xs">
                                    #{String(card.card_number || "").padStart(4, "0")}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {card.player_name || card.player_phone || "—"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {selectedGame && isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
          </div>
        )}

        {!selectedGame && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-20 text-center text-muted-foreground">
              <UserCheck className="w-14 h-14 mb-4 opacity-15" />
              <p className="font-medium">Selecione um jogo acima</p>
              <p className="text-sm mt-1">para ver o relatório de vendas por vendedor</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}