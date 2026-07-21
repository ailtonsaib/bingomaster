import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserScope } from "@/hooks/useUserScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, ChevronDown, User, Phone, CheckCircle2,
  XCircle, ArrowLeft, Eye, EyeOff, ShieldCheck, Undo2, ShoppingCart, Clock, Users, ListChecks
} from "lucide-react";
import { Link } from "react-router-dom";

export default function ValidateCards() {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [validating, setValidating] = useState(null);
  const [unvalidating, setUnvalidating] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [] } = useQuery({
    queryKey: ["validate-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["validate-cards", selectedGame?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("getGameCards", {
        game_id: String(selectedGame.id),
      });
      return (res.data.cards || []).sort((a, b) => (a.card_number || 0) - (b.card_number || 0));
    },
    enabled: !!selectedGame,
  });

  // Card status helpers
  const hasBuyer = (card) => !!card.player_phone || !!card.player_city;
  const isPaid = (card) => hasBuyer(card) && (card.payment_status === "paid" || !card.payment_status);
  const isPending = (card) => hasBuyer(card) && card.payment_status === "pending";
  const hasSeller = (card) => !!card.seller_id && !hasBuyer(card);
  const isValidated = (card) => !!card.is_validated && hasBuyer(card);
  // Pendente de validação = paga mas ainda não marcada como concorrendo
  const awaitingValidation = (card) => isPaid(card) && !isValidated(card);

  // Stats
  const paidCards = cards.filter(isPaid);
  const pendingCards = cards.filter(isPending);
  const validatedCards = cards.filter(isValidated);
  const awaitingCount = cards.filter(awaitingValidation);

  // Sort: validated first, then awaiting validation, then pending payment, then with seller, then available
  const sortOrder = (card) => {
    if (isValidated(card)) return 0;
    if (awaitingValidation(card)) return 1;
    if (isPending(card)) return 2;
    if (hasSeller(card)) return 3;
    return 4;
  };

  const filtered = cards
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        String(c.card_number).padStart(4, "0").includes(q) ||
        c.player_name?.toLowerCase().includes(q) ||
        c.player_phone?.includes(q) ||
        c.seller_name?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => sortOrder(a) - sortOrder(b));

  const handleValidate = async (card) => {
    setValidating(card.id);
    await base44.entities.BingoCard.update(card.id, { is_validated: true });
    await queryClient.refetchQueries({ queryKey: ["validate-cards", selectedGame?.id] });
    setValidating(null);
  };

  const handleUnvalidate = async (card) => {
    setUnvalidating(card.id);
    await base44.entities.BingoCard.update(card.id, { is_validated: false });
    await queryClient.refetchQueries({ queryKey: ["validate-cards", selectedGame?.id] });
    setUnvalidating(null);
  };

  const toggleSelect = (cardId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  };

  const selectableCards = filtered.filter(awaitingValidation);

  const toggleSelectAll = () => {
    if (selected.size === selectableCards.length && selectableCards.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableCards.map((c) => c.id)));
    }
  };

  const handleBulkValidate = async () => {
    setBulkLoading(true);
    const toValidate = cards.filter((c) => selected.has(c.id));
    await Promise.all(toValidate.map((c) => base44.entities.BingoCard.update(c.id, { is_validated: true })));
    setSelected(new Set());
    await queryClient.refetchQueries({ queryKey: ["validate-cards", selectedGame?.id] });
    setBulkLoading(false);
  };

  const getCardStyle = (card) => {
    if (isValidated(card)) return "border-green-200 bg-green-50/50";
    if (awaitingValidation(card)) return "border-amber-200 bg-amber-50/30";
    if (isPending(card)) return "border-orange-200 bg-orange-50/30";
    if (hasSeller(card)) return "border-blue-200 bg-blue-50/20";
    return "border-border bg-card";
  };

  const getCardStatus = (card) => {
    if (isValidated(card)) return { label: "Concorrendo 🏆", className: "bg-green-100 text-green-700 border-green-200" };
    if (awaitingValidation(card)) return { label: "Aguard. validação", className: "bg-amber-100 text-amber-700 border-amber-200" };
    if (isPending(card)) return { label: "Pgto pendente", className: "bg-orange-100 text-orange-700 border-orange-200" };
    if (hasSeller(card)) return { label: "Com vendedor", className: "bg-blue-100 text-blue-700 border-blue-200" };
    return { label: "Disponível", className: "text-muted-foreground" };
  };

  const getStatusIcon = (card) => {
    if (isValidated(card)) return <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />;
    if (awaitingValidation(card)) return <ShoppingCart className="w-4 h-4 text-amber-500 shrink-0" />;
    if (isPending(card)) return <Clock className="w-4 h-4 text-orange-500 shrink-0" />;
    if (hasSeller(card)) return <Users className="w-4 h-4 text-blue-500 shrink-0" />;
    return <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/app" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-heading">Validação de Cartelas</h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Habilite as cartelas pagas para concorrerem aos prêmios no sorteio
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
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
              {games.filter(g => g.status !== "finished").length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Nenhum jogo encontrado</div>
              ) : (
                games.filter(g => g.status !== "finished").map((g) => (
                  <button
                    key={g.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted text-sm"
                    onClick={() => { setSelectedGame(g); setShowGamePicker(false); setSearch(""); }}
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
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-card border rounded-xl p-3 text-center">
                <div className="text-xl font-bold font-heading text-foreground">{cards.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <div className="text-xl font-bold font-heading text-amber-700">{awaitingCount.length}</div>
                <div className="text-xs text-amber-600 mt-0.5">Aguard. validação</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <div className="text-xl font-bold font-heading text-orange-700">{pendingCards.length}</div>
                <div className="text-xs text-orange-600 mt-0.5">Pgto pendente</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <div className="text-xl font-bold font-heading text-green-700">{validatedCards.length}</div>
                <div className="text-xs text-green-600 mt-0.5">Concorrendo 🏆</div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-700 border border-green-200"><ShieldCheck className="w-3 h-3" /> Concorrendo aos prêmios</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700 border border-amber-200"><ShoppingCart className="w-3 h-3" /> Aguardando validação</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-100 text-orange-700 border border-orange-200"><Clock className="w-3 h-3" /> Pagamento pendente</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 text-blue-700 border border-blue-200"><Users className="w-3 h-3" /> Com vendedor</span>
            </div>

            {/* Search + toggle details */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-11"
                  placeholder="Buscar por nº, nome, telefone ou vendedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant={showDetails ? "default" : "outline"}
                className="h-11 gap-2 shrink-0"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showDetails ? "Ocultar" : "Dados"}</span>
              </Button>
            </div>

            {/* Bulk action bar */}
            {selectableCards.length > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-green-600 cursor-pointer"
                  checked={selected.size === selectableCards.length && selectableCards.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="text-sm text-amber-800 flex-1">
                  {selected.size > 0
                    ? `${selected.size} cartela${selected.size > 1 ? "s" : ""} selecionada${selected.size > 1 ? "s" : ""}`
                    : `Selecionar todas (${selectableCards.length}) em espera`}
                </span>
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                    disabled={bulkLoading}
                    onClick={handleBulkValidate}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    {bulkLoading ? "Salvando..." : "Habilitar selecionadas"}
                  </Button>
                )}
              </div>
            )}

            {/* Cards list */}
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma cartela encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((card) => {
                  const status = getCardStatus(card);
                   const validated = isValidated(card);
                   const pending = isPending(card);
                   const withSeller = hasSeller(card);
                  const canValidate = awaitingValidation(card);

                  return (
                    <Card key={card.id} className={`border transition-all ${getCardStyle(card)}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        {canValidate && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-green-600 cursor-pointer shrink-0"
                            checked={selected.has(card.id)}
                            onChange={() => toggleSelect(card.id)}
                          />
                        )}
                        {getStatusIcon(card)}

                        {/* Card number */}
                        <span className={`font-bold font-heading text-base shrink-0 ${
                          validated ? "text-green-800" : awaitingValidation(card) ? "text-amber-800" : pending ? "text-orange-800" : withSeller ? "text-blue-800" : "text-foreground"
                        }`}>
                          {String(card.card_number || "").padStart(4, "0")}
                        </span>

                        {/* Status badge */}
                        <Badge variant="outline" className={`text-xs shrink-0 ${status.className}`}>
                          {status.label}
                        </Badge>

                        {/* Buyer / seller info */}
                        {showDetails && (
                          <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-0.5">
                            {card.player_name && (
                              <span className="flex items-center gap-1 text-sm truncate">
                                <User className="w-3.5 h-3.5 shrink-0" />
                                {card.player_name}
                              </span>
                            )}
                            {card.player_phone && (
                              <span className="flex items-center gap-1 text-sm">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                {card.player_phone}
                              </span>
                            )}
                            {withSeller && card.seller_name && (
                              <span className="flex items-center gap-1 text-sm text-blue-700">
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                {card.seller_name}
                              </span>
                            )}
                          </div>
                        )}

                        {!showDetails && <div className="flex-1" />}

                        {/* Action buttons */}
                        {validated ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 gap-1 text-xs"
                            disabled={unvalidating === card.id}
                            onClick={() => handleUnvalidate(card)}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            {unvalidating === card.id ? "..." : "Remover da disputa"}
                          </Button>
                        ) : canValidate ? (
                          <Button
                            size="sm"
                            className="shrink-0 bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                            disabled={validating === card.id}
                            onClick={() => handleValidate(card)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {validating === card.id ? "..." : "Concorrer aos Prêmios"}
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}