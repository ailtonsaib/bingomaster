import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Scale, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useUserScope } from "@/hooks/useUserScope";
import { format } from "date-fns";

const BRL = (v) => (Number(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORY_LABELS = {
  venda_cartelas: "Venda de Cartelas",
  venda_ingressos: "Venda de Ingressos",
  doacao: "Doação",
  outra_receita: "Outra Receita",
  papel: "Papel",
  impressao: "Impressão de Cartelas",
  propaganda: "Propaganda",
  bebidas: "Bebidas",
  salgados: "Salgados",
  alimentacao: "Alimentação",
  material_escritorio: "Material de Escritório",
  premios: "Prêmios",
  aluguel: "Aluguel",
  decoracao: "Decoração",
  som_iluminacao: "Som e Iluminação",
  transporte: "Transporte",
  outra_despesa: "Outra Despesa",
};

const STATUS_LABELS = {
  waiting: { label: "Aguardando", className: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { label: "Em andamento", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  finished: { label: "Finalizado", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function EventBalanceReport() {
  const { scope, enabled } = useUserScope();
  const [expanded, setExpanded] = useState(null);

  const { data: games = [] } = useQuery({
    queryKey: ["bingo-games-balance"],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["bingo-transactions-balance"],
    queryFn: () => base44.entities.BingoTransaction.filter(scope(), "-date"),
    enabled,
  });

  // Agrupa transações por game_id
  const txByGame = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      const key = t.game_id || "_sem_evento";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [transactions]);

  // Calcula resumo por evento
  const eventBalances = useMemo(() => {
    return games.map((game) => {
      const txs = txByGame[game.id] || [];
      let cardSales = 0;       // venda_cartelas
      let otherIncome = 0;     // demais receitas
      let expenses = 0;        // todas as despesas
      const expenseBreakdown = {};

      for (const t of txs) {
        if (t.type === "income") {
          if (t.category === "venda_cartelas") cardSales += t.amount || 0;
          else otherIncome += t.amount || 0;
        } else {
          expenses += t.amount || 0;
          const cat = CATEGORY_LABELS[t.category] || "Outros";
          expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + (t.amount || 0);
        }
      }

      const totalIncome = cardSales + otherIncome;
      const balance = totalIncome - expenses;

      return {
        game,
        cardSales,
        otherIncome,
        totalIncome,
        expenses,
        balance,
        expenseBreakdown: Object.entries(expenseBreakdown).sort((a, b) => b[1] - a[1]),
        txCount: txs.length,
      };
    });
  }, [games, txByGame]);

  // Totais gerais
  const grandTotals = useMemo(() => {
    let cardSales = 0, otherIncome = 0, expenses = 0;
    for (const e of eventBalances) {
      cardSales += e.cardSales;
      otherIncome += e.otherIncome;
      expenses += e.expenses;
    }
    const totalIncome = cardSales + otherIncome;
    return { cardSales, otherIncome, totalIncome, expenses, balance: totalIncome - expenses };
  }, [eventBalances]);

  const positiveCount = eventBalances.filter((e) => e.balance > 0).length;
  const negativeCount = eventBalances.filter((e) => e.balance < 0).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/bingo-financeiro">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold font-heading flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" /> Saldo por Evento
            </h1>
            <p className="text-xs text-muted-foreground">Receita de vendas de cartelas menos despesas registradas</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Totais gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Vendas de Cartelas</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-emerald-700">{BRL(grandTotals.cardSales)}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Total de Receitas</span>
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-blue-700">{BRL(grandTotals.totalIncome)}</p>
              <p className="text-xs text-muted-foreground">+{BRL(grandTotals.otherIncome)} outras</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Total de Despesas</span>
                <TrendingDown className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-lg font-bold text-red-700">{BRL(grandTotals.expenses)}</p>
            </CardContent>
          </Card>
          <Card className={grandTotals.balance >= 0 ? "border-primary" : "border-orange-300"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Saldo Final Geral</span>
                <Scale className="w-4 h-4 text-primary" />
              </div>
              <p className={`text-lg font-bold ${grandTotals.balance >= 0 ? "text-primary" : "text-orange-600"}`}>
                {BRL(grandTotals.balance)}
              </p>
              <p className="text-xs text-muted-foreground">
                {positiveCount} lucro / {negativeCount} prejuízo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela por evento */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Saldo de Cada Evento ({eventBalances.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : eventBalances.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum evento encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-y">
                    <tr className="text-left text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-2.5 font-medium">Evento</th>
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Vendas Cartelas</th>
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap hidden md:table-cell">Outras Receitas</th>
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Despesas</th>
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Saldo Final</th>
                      <th className="px-4 py-2.5 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {eventBalances.map((e) => {
                      const st = STATUS_LABELS[e.game.status] || {};
                      const isExpanded = expanded === e.game.id;
                      const hasExpenses = e.expenseBreakdown.length > 0;
                      return (
                        <Fragment key={e.game.id}>
                          <tr className="hover:bg-muted/30">
                            <td className="px-4 py-2.5">
                              <div className="font-medium truncate max-w-[200px]">{e.game.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {st.label && <Badge variant="outline" className={`text-[10px] py-0 ${st.className}`}>{st.label}</Badge>}
                                {e.game.event_date && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(e.game.event_date), "dd/MM/yyyy")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap">{BRL(e.cardSales)}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-blue-600 whitespace-nowrap hidden md:table-cell">{BRL(e.otherIncome)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-red-600 whitespace-nowrap">{BRL(e.expenses)}</td>
                            <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${e.balance >= 0 ? "text-primary" : "text-orange-600"}`}>
                              {BRL(e.balance)}
                            </td>
                            <td className="px-4 py-2.5">
                              {hasExpenses && (
                                <button
                                  onClick={() => setExpanded(isExpanded ? null : e.game.id)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title="Ver despesas por categoria"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && hasExpenses && (
                            <tr className="bg-muted/20">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Despesas por Categoria</div>
                                <div className="flex flex-wrap gap-2">
                                  {e.expenseBreakdown.map(([cat, val]) => (
                                    <div key={cat} className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5 text-xs">
                                      <span className="text-muted-foreground">{cat}</span>
                                      <span className="font-semibold text-red-600">{BRL(val)}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/50 border-t-2">
                    <tr className="font-bold">
                      <td className="px-4 py-3">TOTAL GERAL</td>
                      <td className="px-4 py-3 text-right text-emerald-700 whitespace-nowrap">{BRL(grandTotals.cardSales)}</td>
                      <td className="px-4 py-3 text-right text-blue-700 whitespace-nowrap hidden md:table-cell">{BRL(grandTotals.otherIncome)}</td>
                      <td className="px-4 py-3 text-right text-red-700 whitespace-nowrap">{BRL(grandTotals.expenses)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${grandTotals.balance >= 0 ? "text-primary" : "text-orange-600"}`}>
                        {BRL(grandTotals.balance)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}