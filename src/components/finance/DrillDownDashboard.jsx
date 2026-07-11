import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Wallet, Building2, Users, FileText,
  ChevronRight, ChevronLeft, Layers, PieChart, ArrowRight, Calendar
} from "lucide-react";
import DailyChart from "@/components/finance/DailyChart";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export default function DrillDownDashboard({ userEmail }) {
  const [transactions, setTransactions] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // drill-down state
  const [level, setLevel] = useState(0); // 0=sintético, 1=centro de custo, 2=contato, 3=lançamento
  const [selectedCostCenter, setSelectedCostCenter] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // "income" | "expense" | null

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const [txRes, ccRes, ctRes] = await Promise.all([
        base44.functions.invoke("portalAuth", { operation: "getTransactions", email: userEmail }),
        base44.functions.invoke("portalAuth", { operation: "getCostCenters", email: userEmail }),
        base44.functions.invoke("portalAuth", { operation: "getContacts", email: userEmail }),
      ]);
      setTransactions(txRes.data.transactions || []);
      setCostCenters(ccRes.data.costCenters || []);
      setContacts(ctRes.data.contacts || []);
    } catch (e) {
      console.error("Erro:", e);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ====== Cálculos por nível ======

  // Nível 0: Sintético
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalBalance = totalIncome - totalExpense;

  // Agrupar por centro de custo (para nível 1)
  const byCostCenter = {};
  transactions.forEach((tx) => {
    const ccId = tx.cost_center_id || "none";
    if (!byCostCenter[ccId]) {
      byCostCenter[ccId] = {
        id: ccId,
        name: tx.cost_center_name || costCenters.find((c) => c.id === ccId)?.name || "Sem Centro de Custo",
        income: 0,
        expense: 0,
        count: 0,
      };
    }
    byCostCenter[ccId].count++;
    if (tx.type === "income") byCostCenter[ccId].income += parseFloat(tx.amount);
    else byCostCenter[ccId].expense += parseFloat(tx.amount);
  });

  const costCenterRows = Object.values(byCostCenter)
    .filter((cc) => {
      if (!selectedType) return true;
      return selectedType === "income" ? cc.income > 0 : cc.expense > 0;
    })
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  // Filtra transações pelo centro de custo selecionado
  const txsInCostCenter = transactions.filter((t) =>
    (selectedCostCenter === "none" && !t.cost_center_id) ||
    t.cost_center_id === selectedCostCenter
  );

  // Agrupar por contato dentro do centro de custo (para nível 2)
  const byContact = {};
  txsInCostCenter.forEach((tx) => {
    const ctId = tx.contact_id || "none";
    if (!byContact[ctId]) {
      byContact[ctId] = {
        id: ctId,
        name: tx.contact_name || contacts.find((c) => c.id === ctId)?.razao_social || "Sem Contato",
        income: 0,
        expense: 0,
        count: 0,
      };
    }
    byContact[ctId].count++;
    if (tx.type === "income") byContact[ctId].income += parseFloat(tx.amount);
    else byContact[ctId].expense += parseFloat(tx.amount);
  });

  const contactRows = Object.values(byContact)
    .filter((c) => {
      if (!selectedType) return true;
      return selectedType === "income" ? c.income > 0 : c.expense > 0;
    })
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  // Filtra transações pelo contato selecionado (para nível 3)
  const txsInContact = txsInCostCenter.filter((t) =>
    (selectedContact === "none" && !t.contact_id) ||
    t.contact_id === selectedContact
  );

  // ====== Handlers de navegação ======

  const drillToCostCenters = (type) => {
    setSelectedType(type);
    setLevel(1);
  };

  const drillToContacts = (ccId) => {
    setSelectedCostCenter(ccId);
    setLevel(2);
  };

  const drillToTransactions = (ctId) => {
    setSelectedContact(ctId);
    setLevel(3);
  };

  const goBack = () => {
    if (level === 1) { setSelectedType(null); setLevel(0); }
    else if (level === 2) { setSelectedCostCenter(null); setLevel(1); }
    else if (level === 3) { setSelectedContact(null); setLevel(2); }
  };

  const resetToTop = () => {
    setLevel(0);
    setSelectedType(null);
    setSelectedCostCenter(null);
    setSelectedContact(null);
  };

  // ====== Breadcrumb ======
  const breadcrumbs = [
    { label: "Sintético", icon: PieChart, level: 0 },
  ];
  if (level >= 1) {
    breadcrumbs.push({
      label: selectedType === "income" ? "Receitas por Centro de Custo" : "Despesas por Centro de Custo",
      icon: Building2,
      level: 1,
    });
  }
  if (level >= 2) {
    const ccName = costCenterRows.find((c) => c.id === selectedCostCenter)?.name || "—";
    breadcrumbs.push({ label: ccName, icon: Users, level: 2 });
  }
  if (level >= 3) {
    const ctName = contactRows.find((c) => c.id === selectedContact)?.name || "—";
    breadcrumbs.push({ label: ctName, icon: FileText, level: 3 });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma movimentação financeira registrada ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb / navegação */}
      <div className="flex items-center gap-1 flex-wrap text-sm">
        {level > 0 && (
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          {breadcrumbs.map((bc, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <button
                onClick={() => idx < breadcrumbs.length - 1 && resetToTop()}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                  idx === breadcrumbs.length - 1
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <bc.icon className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">{bc.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Nível 0: Sintético */}
      {level === 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Visão Sintética — Clique para detalhar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Receitas */}
                <button
                  onClick={() => drillToCostCenters("income")}
                  className="group text-left rounded-xl border p-5 hover:border-emerald-400 hover:shadow-md transition-all bg-emerald-50/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total de Receitas</p>
                  <p className="text-2xl font-bold text-emerald-600">{fmtMoney(totalIncome)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {transactions.filter((t) => t.type === "income").length} lançamentos
                  </p>
                </button>

                {/* Despesas */}
                <button
                  onClick={() => drillToCostCenters("expense")}
                  className="group text-left rounded-xl border p-5 hover:border-red-400 hover:shadow-md transition-all bg-red-50/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-red-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total de Despesas</p>
                  <p className="text-2xl font-bold text-red-600">{fmtMoney(totalExpense)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {transactions.filter((t) => t.type === "expense").length} lançamentos
                  </p>
                </button>

                {/* Saldo */}
                <div className="rounded-xl border p-5 bg-primary/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-0.5">Saldo Consolidado</p>
                  <p className={`text-2xl font-bold ${totalBalance >= 0 ? "text-primary" : "text-red-600"}`}>
                    {fmtMoney(totalBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {transactions.length} lançamentos totais
                  </p>
                </div>
              </div>

              {/* Barra de proporção */}
              {totalIncome + totalExpense > 0 && (
                <div className="mt-6">
                  <p className="text-xs text-muted-foreground mb-2">Proporção Receitas x Despesas</p>
                  <div className="flex h-4 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 flex items-center justify-center text-[10px] text-white font-medium"
                      style={{ width: `${(totalIncome / (totalIncome + totalExpense)) * 100}%` }}
                    >
                      {((totalIncome / (totalIncome + totalExpense)) * 100).toFixed(0)}%
                    </div>
                    <div
                      className="bg-red-500 flex items-center justify-center text-[10px] text-white font-medium"
                      style={{ width: `${(totalExpense / (totalIncome + totalExpense)) * 100}%` }}
                    >
                      {((totalExpense / (totalIncome + totalExpense)) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            </Card>

            {/* Gráfico diário */}
            <DailyChart transactions={transactions} />
            </div>
            )}

            {/* Nível 1: Por Centro de Custo */}
      {level === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              {selectedType === "income" ? "Receitas" : "Despesas"} por Centro de Custo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {costCenterRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum lançamento encontrado
              </p>
            ) : (
              <div className="space-y-2">
                {costCenterRows.map((cc, idx) => {
                  const value = selectedType === "income" ? cc.income : cc.expense;
                  const total = selectedType === "income" ? totalIncome : totalExpense;
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  const isIncome = selectedType === "income";
                  return (
                    <button
                      key={cc.id}
                      onClick={() => drillToContacts(cc.id)}
                      className="group w-full text-left rounded-lg border p-4 hover:shadow-md hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-6">#{idx + 1}</span>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isIncome ? "bg-emerald-100" : "bg-red-100"}`}>
                            <Building2 className={`w-4 h-4 ${isIncome ? "text-emerald-600" : "text-red-600"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{cc.name}</p>
                            <p className="text-xs text-muted-foreground">{cc.count} lançamento(s)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-base font-bold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                              {fmtMoney(value)}
                            </p>
                            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do total</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                      {/* Mini barra de proporção */}
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isIncome ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Nível 2: Por Contato/Fornecedor */}
      {level === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {selectedType === "income" ? "Receitas" : "Despesas"} por Cliente/Fornecedor
              <span className="text-muted-foreground font-normal text-sm">
                · {costCenterRows.find((c) => c.id === selectedCostCenter)?.name}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contactRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum contato vinculado neste centro de custo
              </p>
            ) : (
              <div className="space-y-2">
                {contactRows.map((ct, idx) => {
                  const value = selectedType === "income" ? ct.income : ct.expense;
                  const ccTotal = costCenterRows.find((c) => c.id === selectedCostCenter);
                  const ccValue = selectedType === "income" ? ccTotal?.income : ccTotal?.expense;
                  const pct = ccValue > 0 ? (value / ccValue) * 100 : 0;
                  const isIncome = selectedType === "income";
                  return (
                    <button
                      key={ct.id}
                      onClick={() => drillToTransactions(ct.id)}
                      className="group w-full text-left rounded-lg border p-4 hover:shadow-md hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-6">#{idx + 1}</span>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isIncome ? "bg-emerald-100" : "bg-red-100"}`}>
                            <Users className={`w-4 h-4 ${isIncome ? "text-emerald-600" : "text-red-600"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{ct.name}</p>
                            <p className="text-xs text-muted-foreground">{ct.count} lançamento(s)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-base font-bold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                              {fmtMoney(value)}
                            </p>
                            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isIncome ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Nível 3: Lançamentos individuais */}
      {level === 3 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Lançamentos
              <span className="text-muted-foreground font-normal text-sm">
                · {contactRows.find((c) => c.id === selectedContact)?.name}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txsInContact.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum lançamento encontrado
              </p>
            ) : (
              <div className="space-y-2">
                {txsInContact.map((tx) => {
                  const isIncome = tx.type === "income";
                  return (
                    <div
                      key={tx.id}
                      className="rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isIncome ? "bg-emerald-100" : "bg-red-100"}`}>
                            {isIncome ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{tx.description}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {tx.category && <Badge variant="secondary" className="text-[10px] py-0">{tx.category}</Badge>}
                              {tx.contact_name && <Badge variant="outline" className="text-[10px] py-0">{tx.contact_name}</Badge>}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {tx.due_date ? `Venc: ${fmtDate(tx.due_date)}` : fmtDate(tx.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                            {isIncome ? "+" : "-"} {fmtMoney(tx.amount)}
                          </p>
                          <Badge variant={tx.status === "settled" ? "default" : "secondary"} className="text-[10px] py-0 mt-1">
                            {tx.status === "settled" ? "Baixado" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}