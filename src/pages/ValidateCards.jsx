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
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeLoading, setRangeLoading] = useState(false);
  const [saleCard, setSaleCard] = useState(null);
  const [saleName, setSaleName] = useState("");
  const [salePhone, setSalePhone] = useState("");
  const [saleLoading, setSaleLoading] = useState(false);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [] } = useQuery({
    queryKey: ["validate-games", userId],
    queryFn: () => base44.entities.BingoGame.filter({}, "-created_date"),
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
  const isValidated = (card) => !!card.is_validated;
  // Pendente de validação = paga mas ainda não marcada como concorrendo
  const awaitingValidation = (card) => isPaid(card) && !isValidated(card);

  // Stats
  const paidCards = cards.filter(isPaid);
  const pendingCards = cards.filter(isPending);
  const validatedCards = cards.filter(isValidated);
  const awaitingCount = cards.filter(awaitingValidation);

  // Sort: validated first, then awaiting validation, then pending payment, then with seller, then available
  const sortOrder = (card) => {
    if (awaitingValidation(card)) return 0;
    if (isPending(card)) return 1;
    if (hasSeller(card)) return 2;
    if (isValidated(card)) return 4;
    return 3;
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

  const handleRangeValidate = async () => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (!start || !end || start > end) return;
    setRangeLoading(true);
    const toValidate = cards.filter(
      (c) => c.card_number >= start && c.card_number <= end && !c.is_validated
    );
    await Promise.all(
      toValidate.map((c) => base44.entities.BingoCard.update(c.id, { is_validated: true }))
    );
    await queryClient.refetchQueries({ queryKey: ["validate-cards", selectedGame?.id] });
    setRangeLoading(false);
    setRangeStart("");
    setRangeEnd("");
  };

  const handleOpenSale = (card) => {
    setSaleCard(card);
    setSaleName(card.player_name || "");
    setSalePhone(card.player_phone || "");
  };

  const handleSaveSale = async () => {
    if (!saleName.trim()) return;
    setSaleLoading(true);
    await base44.entities.BingoCard.update(saleCard.id, {
      player_name: saleName.trim(),
      player_phone: salePhone.trim(),
      payment_status: "paid",
      is_validated: true,
    });
    await queryClient.refetchQueries({ queryKey: ["validate-cards", selectedGame?.id] });
    setSaleLoading(false);
    setSaleCard(null);
    setSaleName("");
    setSalePhone("");
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

            {/* Batch range validation */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
              <span className="text-xs font-medium text-foreground shrink-0">Validar lote:</span>
              <Input
                type="number"
                className="w-20 h-9 text-sm"
                placeholder="De"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="number"
                className="w-20 h-9 text-sm"
                placeholder="Até"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1 text-xs h-9"
                disabled={rangeLoading || !rangeStart || !rangeEnd}
                onClick={handleRangeValidate}
              >
                <ListChecks className="w-3.5 h-3.5" />
                {rangeLoading ? "Validando..." : "Validar faixa"}
              </Button>
              {showDetails && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Clique no número para vender/editar
                </span>
              )}
            </div>

            {/* Cards grid */}
            {isLoading ? (
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}>
                {[...Array(80)].map((_, i) => (
                  <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma cartela encontrada.
              </div>
            ) : (
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}>
                {filtered.map((card) => {
                  const validated = isValidated(card);
                  const cellStyle = validated
                    ? "bg-green-500 text-white"
                    : awaitingValidation(card)
                    ? "bg-amber-200 text-amber-900"
                    : isPending(card)
                    ? "bg-orange-200 text-orange-900"
                    : hasSeller(card)
                    ? "bg-blue-200 text-blue-900"
                    : "bg-muted text-muted-foreground";
                  const title = validated
                    ? "Concorrendo — clique para remover"
                    : `Cartela ${String(card.card_number || "").padStart(4, "0")}${
                        card.player_name ? " — " + card.player_name : ""
                      }${card.seller_name ? " — Vendedor: " + card.seller_name : ""}`;
                  return (
                    <button
                      key={card.id}
                      onClick={() => (showDetails ? handleOpenSale(card) : (validated ? handleUnvalidate(card) : handleValidate(card)))}
                      disabled={validated ? unvalidating === card.id : validating === card.id}
                      title={title}
                      className={`flex items-center justify-center h-9 rounded-md text-xs font-bold font-heading transition-all hover:scale-110 hover:z-10 relative ${cellStyle} ${
                        validated ? "ring-1 ring-green-600" : ""
                      }`}
                    >
                      {String(card.card_number || "").padStart(4, "0")}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Sale modal */}
        {saleCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saleLoading && setSaleCard(null)}>
            <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold font-heading text-lg">
                  Vender Cartela {String(saleCard.card_number || "").padStart(4, "0")}
                </h3>
                {!saleLoading && (
                  <button onClick={() => setSaleCard(null)} className="text-muted-foreground hover:text-foreground">
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome do comprador</label>
                  <Input
                    className="mt-1 h-10"
                    placeholder="Digite o nome..."
                    value={saleName}
                    onChange={(e) => setSaleName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                  <Input
                    className="mt-1 h-10"
                    placeholder="(00) 00000-0000"
                    value={salePhone}
                    onChange={(e) => setSalePhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                A cartela será validada automaticamente para concorrer aos prêmios.
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                disabled={saleLoading || !saleName.trim()}
                onClick={handleSaveSale}
              >
                <CheckCircle2 className="w-4 h-4" />
                {saleLoading ? "Salvando..." : "Vender e Validar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}