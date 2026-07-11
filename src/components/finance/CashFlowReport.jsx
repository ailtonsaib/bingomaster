import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, FileBarChart, Building2, ChevronDown, ChevronRight } from "lucide-react";
import CashFlowForecast from "@/components/finance/CashFlowForecast";

export default function CashFlowReport({ userEmail }) {
  const [transactions, setTransactions] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedCenters, setExpandedCenters] = useState({});

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const [txRes, ccRes] = await Promise.all([
        base44.functions.invoke("portalAuth", { operation: "getTransactions", email: userEmail }),
        base44.functions.invoke("portalAuth", { operation: "getCostCenters", email: userEmail }),
      ]);
      setTransactions(txRes.data.transactions || []);
      setCostCenters(ccRes.data.costCenters || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  const getPeriodRange = () => {
    const now = new Date();
    if (periodFilter === "month") {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    }
    if (periodFilter === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1), to: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59) };
    }
    if (periodFilter === "year") {
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
    }
    if (periodFilter === "custom" && customFrom && customTo) {
      return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
    }
    return null;
  };

  const range = getPeriodRange();

  const filtered = transactions.filter((t) => {
    if (!range) return true;
    const refDate = new Date(t.due_date || t.date);
    return refDate >= range.from && refDate <= range.to;
  });

  // Agrupar por centro de custo
  const byCostCenter = {};
  const noCenter = { income: 0, expense: 0, items: [] };

  filtered.forEach((tx) => {
    const ccId = tx.cost_center_id || "none";
    if (ccId === "none") {
      noCenter.items.push(tx);
      if (tx.type === "income") noCenter.income += parseFloat(tx.amount);
      else noCenter.expense += parseFloat(tx.amount);
      return;
    }
    if (!byCostCenter[ccId]) {
      const cc = costCenters.find((c) => c.id === ccId);
      byCostCenter[ccId] = {
        id: ccId,
        name: tx.cost_center_name || cc?.name || "—",
        level: cc?.level || "centro_custo",
        parent_id: cc?.parent_id,
        income: 0,
        expense: 0,
        items: [],
      };
    }
    byCostCenter[ccId].items.push(tx);
    if (tx.type === "income") byCostCenter[ccId].income += parseFloat(tx.amount);
    else byCostCenter[ccId].expense += parseFloat(tx.amount);
  });

  const costCenterList = Object.values(byCostCenter).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  // Totais gerais
  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalBalance = totalIncome - totalExpense;

  // Totais por status
  const settledIncome = filtered.filter((t) => t.status === "settled" && t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const settledExpense = filtered.filter((t) => t.status === "settled" && t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const pendingIncome = filtered.filter((t) => t.status !== "settled" && t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const pendingExpense = filtered.filter((t) => t.status !== "settled" && t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

  const toggleCenter = (id) => {
    setExpandedCenters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const periodLabel = {
    all: "Todo o período",
    month: "Mês atual",
    quarter: "Trimestre atual",
    year: "Ano atual",
    custom: `${customFrom ? fmtDate(customFrom + "T00:00:00") : "—"} a ${customTo ? fmtDate(customTo + "T00:00:00") : "—"}`,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros de período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-primary" />
            Fluxo de Caixa Consolidado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "all", label: "Tudo" },
              { key: "month", label: "Mês" },
              { key: "quarter", label: "Trimestre" },
              { key: "year", label: "Ano" },
              { key: "custom", label: "Personalizado" },
            ].map((p) => (
              <Button
                key={p.key}
                variant={periodFilter === p.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodFilter(p.key)}
              >
                {p.label}
              </Button>
            ))}
            {periodFilter === "custom" && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">até</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                />
              </div>
            )}
            <span className="text-sm text-muted-foreground ml-auto">
              {periodLabel[periodFilter]} · {filtered.length} lançamento(s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Receitas</p>
              <p className="text-lg font-bold text-emerald-600">{fmtMoney(totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Despesas</p>
              <p className="text-lg font-bold text-red-600">{fmtMoney(totalExpense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalBalance >= 0 ? "bg-primary/10" : "bg-red-100"}`}>
              <Wallet className={`w-5 h-5 ${totalBalance >= 0 ? "text-primary" : "text-red-600"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo do Período</p>
              <p className={`text-lg font-bold ${totalBalance >= 0 ? "text-primary" : "text-red-600"}`}>
                {fmtMoney(totalBalance)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Centros de Custo</p>
              <p className="text-lg font-bold">{costCenterList.length}</p>
              <p className="text-xs text-muted-foreground">
                {noCenter.items.length > 0 && `${noCenter.items.length} sem vínculo`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projeção 5/10/15/30 dias */}
      <CashFlowForecast transactions={transactions} />

      {/* Resumo por status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Realizado (Baixado)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <TrendingUp className="w-4 h-4" /> Recebido
              </span>
              <span className="font-bold text-emerald-600">{fmtMoney(settledIncome)}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="flex items-center gap-1.5 text-red-600">
                <TrendingDown className="w-4 h-4" /> Pago
              </span>
              <span className="font-bold text-red-600">{fmtMoney(settledExpense)}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1 border-t mt-1 pt-2">
              <span className="font-medium">Saldo Realizado</span>
              <span className={`font-bold ${settledIncome - settledExpense >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtMoney(settledIncome - settledExpense)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <TrendingUp className="w-4 h-4" /> A Receber
              </span>
              <span className="font-bold text-emerald-600">{fmtMoney(pendingIncome)}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="flex items-center gap-1.5 text-red-600">
                <TrendingDown className="w-4 h-4" /> A Pagar
              </span>
              <span className="font-bold text-red-600">{fmtMoney(pendingExpense)}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1 border-t mt-1 pt-2">
              <span className="font-medium">Saldo Pendente</span>
              <span className={`font-bold ${pendingIncome - pendingExpense >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtMoney(pendingIncome - pendingExpense)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por Centro de Custo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Detalhamento por Centro de Custo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costCenterList.length === 0 && noCenter.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum lançamento no período selecionado
            </p>
          ) : (
            <div className="space-y-2">
              {costCenterList.map((cc) => {
                const balance = cc.income - cc.expense;
                const isExpanded = expandedCenters[cc.id];
                return (
                  <div key={cc.id} className="rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleCenter(cc.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{cc.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0">{cc.items.length} lan.</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-600 font-medium">{fmtMoney(cc.income)}</span>
                        <span className="text-red-600 font-medium">{fmtMoney(cc.expense)}</span>
                        <span className={`font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmtMoney(balance)}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-muted/10">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-1.5 px-3">Vencimento</th>
                              <th className="py-1.5 px-3">Descrição</th>
                              <th className="py-1.5 px-3">Contato</th>
                              <th className="py-1.5 px-3">Status</th>
                              <th className="py-1.5 px-3 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cc.items.map((tx) => (
                              <tr key={tx.id} className="border-b last:border-0">
                                <td className="py-1.5 px-3 whitespace-nowrap">{fmtDate(tx.due_date || tx.date)}</td>
                                <td className="py-1.5 px-3">{tx.description}</td>
                                <td className="py-1.5 px-3">{tx.contact_name || "—"}</td>
                                <td className="py-1.5 px-3">
                                  <Badge variant={tx.status === "settled" ? "default" : "secondary"} className="text-[10px] py-0">
                                    {tx.status === "settled" ? "Baixado" : "Pendente"}
                                  </Badge>
                                </td>
                                <td className={`py-1.5 px-3 text-right font-medium ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                                  {tx.type === "income" ? "+" : "-"} {fmtMoney(tx.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Lançamentos sem centro de custo */}
              {noCenter.items.length > 0 && (
                <div className="rounded-lg border overflow-hidden border-dashed">
                  <button
                    onClick={() => toggleCenter("none")}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedCenters["none"] ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-muted-foreground">Sem Centro de Custo</span>
                      <Badge variant="outline" className="text-[10px] py-0">{noCenter.items.length} lan.</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-emerald-600 font-medium">{fmtMoney(noCenter.income)}</span>
                      <span className="text-red-600 font-medium">{fmtMoney(noCenter.expense)}</span>
                      <span className={`font-bold ${(noCenter.income - noCenter.expense) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {fmtMoney(noCenter.income - noCenter.expense)}
                      </span>
                    </div>
                  </button>
                  {expandedCenters["none"] && (
                    <div className="border-t bg-muted/10">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b">
                            <th className="py-1.5 px-3">Vencimento</th>
                            <th className="py-1.5 px-3">Descrição</th>
                            <th className="py-1.5 px-3">Contato</th>
                            <th className="py-1.5 px-3">Status</th>
                            <th className="py-1.5 px-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {noCenter.items.map((tx) => (
                            <tr key={tx.id} className="border-b last:border-0">
                              <td className="py-1.5 px-3 whitespace-nowrap">{fmtDate(tx.due_date || tx.date)}</td>
                              <td className="py-1.5 px-3">{tx.description}</td>
                              <td className="py-1.5 px-3">{tx.contact_name || "—"}</td>
                              <td className="py-1.5 px-3">
                                <Badge variant={tx.status === "settled" ? "default" : "secondary"} className="text-[10px] py-0">
                                  {tx.status === "settled" ? "Baixado" : "Pendente"}
                                </Badge>
                              </td>
                              <td className={`py-1.5 px-3 text-right font-medium ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                                {tx.type === "income" ? "+" : "-"} {fmtMoney(tx.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total geral */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between px-3">
            <span className="text-sm font-bold">Total Geral Consolidado</span>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-bold text-emerald-600">{fmtMoney(totalIncome)}</span>
              <span className="font-bold text-red-600">{fmtMoney(totalExpense)}</span>
              <span className={`font-bold ${totalBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtMoney(totalBalance)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}