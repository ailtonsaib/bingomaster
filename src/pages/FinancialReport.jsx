import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUserScope } from "@/hooks/useUserScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronDown, Printer, CheckCircle2, Clock,
  TrendingUp, DollarSign, Users, AlertCircle, ChevronRight
} from "lucide-react";

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export default function FinancialReport() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [expandedSeller, setExpandedSeller] = useState(null);
  const { userId, scope, enabled } = useUserScope();

  const { data: games = [] } = useQuery({
    queryKey: ["fin-report-games", userId],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["fin-report-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter(scope({ game_id: String(selectedGame.id) })),
    enabled: !!selectedGame,
  });

  const ticketPrice = useMemo(() => {
    if (!selectedGame?.event_price) return 0;
    const parsed = parseFloat(String(selectedGame.event_price).replace(/[^\d,.-]/g, "").replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  }, [selectedGame]);

  // Only sold cards (have a buyer)
  const soldCards = useMemo(() =>
    cards.filter(c => c.player_phone || c.player_city || (c.player_name && !c.player_name.startsWith("Cartela"))),
    [cards]
  );

  const sellerStats = useMemo(() => {
    const map = {};
    for (const card of soldCards) {
      const key = card.seller_id || "__sem_vendedor__";
      const name = card.seller_name || "Sem vendedor";
      if (!map[key]) map[key] = { id: key, name, paid: [], pending: [] };
      if (card.payment_status === "paid") {
        map[key].paid.push(card);
      } else {
        map[key].pending.push(card);
      }
    }
    return Object.values(map).sort((a, b) =>
      (b.paid.length + b.pending.length) - (a.paid.length + a.pending.length)
    );
  }, [soldCards]);

  const totalPaid = soldCards.filter(c => c.payment_status === "paid").length;
  const totalPending = soldCards.filter(c => c.payment_status !== "paid").length;
  const totalRevenuePaid = totalPaid * ticketPrice;
  const totalRevenuePending = totalPending * ticketPrice;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6 no-print">
        <Link to="/app" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-yellow-300" /> Relatório Financeiro
            </h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Total arrecadado por vendedor — pago vs pendente
            </p>
          </div>
          {selectedGame && !isLoading && (
            <Button variant="secondary" size="sm" className="gap-2 shrink-0" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Game picker */}
        <div className="relative no-print">
          <button
            className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-input bg-card text-sm hover:bg-accent transition-colors shadow-sm"
            onClick={() => setShowGamePicker(v => !v)}
          >
            <span className={selectedGame ? "text-foreground font-medium" : "text-muted-foreground"}>
              {selectedGame?.name || "Selecione um jogo..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showGamePicker && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-52 overflow-auto">
              {games.map(g => (
                <button
                  key={g.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-sm"
                  onClick={() => { setSelectedGame(g); setShowGamePicker(false); setExpandedSeller(null); }}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {g.status === "finished" ? "✅ Finalizado" : g.status === "in_progress" ? "🎯 Em andamento" : "⏳ Aguardando"}
                  </span>
                  {g.event_price && (
                    <span className="ml-2 text-xs text-primary font-semibold">R$ {g.event_price}/cartela</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedGame && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <DollarSign className="w-16 h-16 mb-4 opacity-15" />
            <p className="text-base font-medium">Selecione um jogo para ver o relatório financeiro</p>
          </div>
        )}

        {selectedGame && isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        )}

        {selectedGame && !isLoading && (
          <>
            {/* Print header */}
            <div className="hidden print-only mb-4">
              <h1 className="text-xl font-bold">Relatório Financeiro — {selectedGame.name}</h1>
              <p className="text-sm text-gray-500">Valor por cartela: {ticketPrice > 0 ? currency(ticketPrice) : "não informado"}</p>
              <hr className="mt-3" />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-700 text-xs font-semibold mb-1">
                  <CheckCircle2 className="w-4 h-4" /> PAGO
                </div>
                <div className="text-2xl font-bold font-heading text-green-800">
                  {ticketPrice > 0 ? currency(totalRevenuePaid) : `${totalPaid} cartelas`}
                </div>
                {ticketPrice > 0 && (
                  <div className="text-xs text-green-600 mt-0.5">{totalPaid} cartela{totalPaid !== 1 ? "s" : ""}</div>
                )}
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-orange-700 text-xs font-semibold mb-1">
                  <Clock className="w-4 h-4" /> PENDENTE
                </div>
                <div className="text-2xl font-bold font-heading text-orange-800">
                  {ticketPrice > 0 ? currency(totalRevenuePending) : `${totalPending} cartelas`}
                </div>
                {ticketPrice > 0 && (
                  <div className="text-xs text-orange-600 mt-0.5">{totalPending} cartela{totalPending !== 1 ? "s" : ""}</div>
                )}
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
                  <TrendingUp className="w-4 h-4" /> TOTAL GERAL
                </div>
                <div className="text-2xl font-bold font-heading text-foreground">
                  {ticketPrice > 0 ? currency(totalRevenuePaid + totalRevenuePending) : `${soldCards.length} cartelas`}
                </div>
                {ticketPrice > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">{soldCards.length} cartela{soldCards.length !== 1 ? "s" : ""} vendida{soldCards.length !== 1 ? "s" : ""}</div>
                )}
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
                  <Users className="w-4 h-4" /> VENDEDORES
                </div>
                <div className="text-2xl font-bold font-heading text-foreground">{sellerStats.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">com cartelas vendidas</div>
              </div>
            </div>

            {ticketPrice === 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 no-print">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  O valor por cartela não está definido neste jogo — exibindo quantidade de cartelas. Defina o valor do evento no cadastro do jogo para ver os valores em reais.
                </p>
              </div>
            )}

            {/* Per-seller breakdown */}
            {sellerStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p>Nenhuma cartela vendida neste jogo.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Por Vendedor</h2>
                {sellerStats.map(seller => {
                  const paidAmt = seller.paid.length * ticketPrice;
                  const pendingAmt = seller.pending.length * ticketPrice;
                  const total = seller.paid.length + seller.pending.length;
                  const paidPct = total > 0 ? Math.round((seller.paid.length / total) * 100) : 0;
                  const isOpen = expandedSeller === seller.id;

                  return (
                    <div key={seller.id} className="rounded-xl border overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => setExpandedSeller(isOpen ? null : seller.id)}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{seller.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{seller.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {/* Progress bar */}
                            <div className="flex-1 h-1.5 rounded-full bg-orange-200 overflow-hidden max-w-[120px]">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{paidPct}% pago</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">
                            {ticketPrice > 0 ? currency(paidAmt + pendingAmt) : `${total} cart.`}
                          </p>
                          <p className="text-xs text-muted-foreground">{total} cartela{total !== 1 ? "s" : ""}</p>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="border-t bg-muted/20 px-4 py-3 grid grid-cols-2 gap-3">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold mb-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                            </div>
                            <p className="text-lg font-bold font-heading text-green-800">
                              {ticketPrice > 0 ? currency(paidAmt) : seller.paid.length}
                            </p>
                            <p className="text-xs text-green-600">{seller.paid.length} cartela{seller.paid.length !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 text-orange-700 text-xs font-semibold mb-1">
                              <Clock className="w-3.5 h-3.5" /> Pendente
                            </div>
                            <p className="text-lg font-bold font-heading text-orange-800">
                              {ticketPrice > 0 ? currency(pendingAmt) : seller.pending.length}
                            </p>
                            <p className="text-xs text-orange-600">{seller.pending.length} cartela{seller.pending.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}