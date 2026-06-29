import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Trophy, ChevronDown, Printer, CheckCircle2,
  Clock, User, Phone, MapPin, Medal, ShieldCheck
} from "lucide-react";
import moment from "moment";

export default function FinalReport() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);

  const { data: games = [] } = useQuery({
    queryKey: ["final-report-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["final-report-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter(
      { game_id: String(selectedGame.id), is_winner: true },
      "card_number"
    ),
    enabled: !!selectedGame,
  });

  const prizes = selectedGame?.prizes || [];

  // Only show winners if the game is in progress or finished (not reset/waiting)
  const isActiveGame = selectedGame?.status === "in_progress" || selectedGame?.status === "finished";
  const validCards = isActiveGame ? cards : [];

  // Build flat list of all prize assignments
  const reportRows = prizes.map((prize, idx) => {
    const winner = validCards.find(
      (c) => c.won_prizes && c.won_prizes.some((wp) => wp.prize_index === idx)
    );
    return { prize, idx, winner };
  });

  const paidCount = reportRows.filter(r => r.winner?.payment_status === "paid").length;
  const pendingCount = reportRows.filter(r => r.winner && r.winner.payment_status !== "paid").length;
  const awardedCount = reportRows.filter(r => r.winner).length;

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6 no-print">
        <Link to="/" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-300" /> Relatório Final
            </h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Lista oficial de ganhadores e confirmação de pagamentos
            </p>
          </div>
          {selectedGame && !isLoading && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 shrink-0"
              onClick={handlePrint}
            >
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
                  onClick={() => { setSelectedGame(g); setShowGamePicker(false); }}
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

        {!selectedGame && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground no-print">
            <Trophy className="w-16 h-16 mb-4 opacity-15" />
            <p className="text-base font-medium">Selecione um jogo para gerar o relatório</p>
          </div>
        )}

        {selectedGame && (
          <>
            {/* Print header */}
            <div className="hidden print-only mb-6">
              <h1 className="text-2xl font-bold text-center">Relatório Final — {selectedGame.name}</h1>
              <p className="text-center text-sm text-gray-500 mt-1">
                Gerado em {moment().format("DD/MM/YYYY [às] HH:mm")}
              </p>
              <hr className="mt-4" />
            </div>

            {/* Summary cards */}
            {!isLoading && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold font-heading text-primary">{prizes.length}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total de Prêmios</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold font-heading text-amber-700">{awardedCount}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Prêmios Entregues</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold font-heading text-green-700">{paidCount}</div>
                  <div className="text-xs text-green-600 mt-0.5">Pagamentos Confirmados</div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {reportRows.map(({ prize, idx, winner }) => (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 overflow-hidden ${
                      winner ? "border-amber-300" : "border-border opacity-60"
                    }`}
                  >
                    {/* Prize header */}
                    <div className={`flex items-center gap-3 px-4 py-3 ${
                      winner ? "bg-amber-50" : "bg-muted/40"
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        winner ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm font-heading truncate">{prize.name || `Prêmio ${idx + 1}`}</p>
                        {prize.description && (
                          <p className="text-xs text-muted-foreground truncate">{prize.description}</p>
                        )}
                      </div>
                      {winner ? (
                        <Badge className="bg-amber-500 text-white border-0 shrink-0 gap-1">
                          <Trophy className="w-3 h-3" /> Entregue
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground shrink-0">
                          Sem ganhador
                        </Badge>
                      )}
                    </div>

                    {/* Winner row */}
                    {winner ? (
                      <div className="px-4 py-3 bg-white flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-primary font-heading">
                              Cartela #{String(winner.card_number || "").padStart(4, "0")}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs gap-1 ${
                                winner.payment_status === "paid"
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-orange-100 text-orange-700 border-orange-200"
                              }`}
                            >
                              {winner.payment_status === "paid"
                                ? <><CheckCircle2 className="w-3 h-3" /> Pago</>
                                : <><Clock className="w-3 h-3" /> Pgto pendente</>
                              }
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {winner.player_name && (
                              <span className="flex items-center gap-1 text-sm text-foreground">
                                <User className="w-3 h-3 text-muted-foreground" /> {winner.player_name}
                              </span>
                            )}
                            {winner.player_phone && (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="w-3 h-3" /> {winner.player_phone}
                              </span>
                            )}
                            {winner.player_city && (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {[winner.player_city, winner.player_state].filter(Boolean).join(" - ")}
                              </span>
                            )}
                          </div>
                          {winner.seller_name && (
                            <p className="text-xs text-muted-foreground">Vendedor: {winner.seller_name}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground bg-white">
                        <Medal className="w-4 h-4 opacity-30" />
                        Nenhum vencedor registrado
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pending payments warning */}
            {!isLoading && pendingCount > 0 && (
              <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4 no-print">
                <Clock className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-700">
                    {pendingCount} pagamento{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    Confirme os pagamentos na tela de cartelas do jogo.
                  </p>
                </div>
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