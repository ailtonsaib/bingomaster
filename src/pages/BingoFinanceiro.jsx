import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Wallet, Trash2, Search, DollarSign, Scale } from "lucide-react";
import { useUserScope } from "@/hooks/useUserScope";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";
import BingoTransactionForm from "@/components/bingo/BingoTransactionForm";

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

export default function BingoFinanceiro() {
  const { scope, enabled } = useUserScope();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [gameFilter, setGameFilter] = useState("all");

  const { data: games = [] } = useQuery({
    queryKey: ["bingo-games-financeiro"],
    queryFn: () => base44.entities.BingoGame.filter(scope(), "-created_date"),
    enabled,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["bingo-transactions"],
    queryFn: () => base44.entities.BingoTransaction.filter(scope(), "-date"),
    enabled,
  });

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount || 0;
      else expense += t.amount || 0;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  // Agrupa despesas por categoria para o resumo
  const expensesByCategory = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const cat = CATEGORY_LABELS[t.category] || "Outros";
      map[cat] = (map[cat] || 0) + (t.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = typeFilter === "all" || t.type === typeFilter;
      const matchesGame = gameFilter === "all" || t.game_id === gameFilter;
      const matchesSearch = !search ||
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        (CATEGORY_LABELS[t.category] || "").toLowerCase().includes(search.toLowerCase()) ||
        t.supplier?.toLowerCase().includes(search.toLowerCase()) ||
        t.game_name?.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesGame && matchesSearch;
    });
  }, [transactions, search, typeFilter, gameFilter]);

  const handleSave = async (data) => {
    await base44.entities.BingoTransaction.create({
      ...data,
      ...scope(),
      user_email: authUser?.email || "",
    });
    queryClient.invalidateQueries({ queryKey: ["bingo-transactions"] });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir esta movimentação?")) return;
    await base44.entities.BingoTransaction.delete(id);
    queryClient.invalidateQueries({ queryKey: ["bingo-transactions"] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/app">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold font-heading flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" /> Movimentações do Evento
              </h1>
              <p className="text-xs text-muted-foreground">Vendas de cartelas e despesas do bingo</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/saldo-eventos">
              <Button variant="outline" className="gap-2">
                <Scale className="w-4 h-4" /> Saldo por Evento
              </Button>
            </Link>
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Nova Movimentação
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Total de Receitas</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-xl font-bold text-emerald-700">{BRL(totals.income)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{transactions.filter(t => t.type === "income").length} receita(s)</p>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Total de Despesas</span>
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                </div>
              </div>
              <p className="text-xl font-bold text-red-700">{BRL(totals.expense)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{transactions.filter(t => t.type === "expense").length} despesa(s)</p>
            </CardContent>
          </Card>

          <Card className={totals.balance >= 0 ? "border-blue-200" : "border-orange-200"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Saldo Líquido</span>
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className={`text-xl font-bold ${totals.balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>{BRL(totals.balance)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{totals.balance >= 0 ? "Lucro" : "Prejuízo"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Despesas por categoria */}
        {expensesByCategory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expensesByCategory.map(([cat, val]) => {
                  const pct = totals.expense > 0 ? (val / totals.expense) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-40 shrink-0 truncate">{cat}</span>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-red-600 w-24 text-right">{BRL(val)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm sm:w-56 shrink-0"
          >
            <option value="all">Todos os eventos</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição, categoria, fornecedor..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {[
              { value: "all", label: "Todas" },
              { value: "income", label: "Receitas" },
              { value: "expense", label: "Despesas" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  typeFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Movimentações ({filteredTransactions.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">Nenhuma movimentação registrada.</p>
                <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4" /> Registrar primeira movimentação
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-y">
                    <tr className="text-left text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-2.5 font-medium">Data</th>
                      <th className="px-4 py-2.5 font-medium">Descrição</th>
                      <th className="px-4 py-2.5 font-medium">Categoria</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Pagamento</th>
                      <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                      <th className="px-4 py-2.5 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {t.date ? format(new Date(t.date), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium truncate max-w-[200px]">{t.description}</div>
                          {t.supplier && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{t.supplier}</div>}
                          {t.game_name && <div className="text-xs text-primary truncate max-w-[200px]">{t.game_name}</div>}
                          {t.quantity > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {t.quantity} un. × {BRL(t.unit_price)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={t.type === "income" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                            {CATEGORY_LABELS[t.category] || t.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                          {t.payment_method || "—"}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                          {t.type === "income" ? "+" : "−"} {BRL(t.amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <BingoTransactionForm
          games={games}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}