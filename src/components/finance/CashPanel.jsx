import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Landmark, 
  Undo2, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Wallet,
  CalendarRange,
  Pencil,
  CheckSquare,
  Search,
  History
} from "lucide-react";
import BankBalanceChart from "@/components/finance/BankBalanceChart";
import MonthlyForecastChart from "@/components/finance/MonthlyForecastChart";
import EditTransactionModal from "@/components/finance/EditTransactionModal";
import SettlementHistoryTab from "@/components/finance/SettlementHistoryTab";

export default function CashPanel({ userEmail }) {
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleTarget, setSettleTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSettleType, setBulkSettleType] = useState(null); // 'receivable' | 'payable'
  const [bulkSaving, setBulkSaving] = useState(false);
  const [activeView, setActiveView] = useState("movimentacoes");

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const [txRes, bankRes] = await Promise.all([
        base44.functions.invoke("portalAuth", {
          operation: "getTransactions",
          email: userEmail,
        }),
        base44.functions.invoke("portalAuth", {
          operation: "getBankAccounts",
          email: userEmail,
        }),
      ]);
      setTransactions(txRes.data.transactions || []);
      setBankAccounts(bankRes.data.bankAccounts || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const inDateRange = (dueDate) => {
    if (!startDate && !endDate) return true;
    const ref = dueDate || new Date().toISOString();
    const d = new Date(ref).getTime();
    if (isNaN(d)) return false;
    const s = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
    const e = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
    return d >= s && d <= e;
  };

  const pendingReceivable = transactions.filter(
    (t) => t.type === "income" && (!t.status || t.status === "pending" || t.status === "partial") && inDateRange(t.due_date)
  );
  const pendingPayable = transactions.filter(
    (t) => t.type === "expense" && (!t.status || t.status === "pending" || t.status === "partial") && inDateRange(t.due_date)
  );
  const settled = transactions.filter((t) => t.status === "settled");

  const handleSettle = async (transactionId, bankAccountId, bankName, settleData) => {
    try {
      await base44.functions.invoke("portalAuth", {
        operation: "settleTransaction",
        email: userEmail,
        transaction_id: transactionId,
        bank_account_id: bankAccountId,
        bank_name: bankName,
        is_partial: settleData?.is_partial || false,
        settled_amount: settleData?.settled_amount || 0,
        remaining_amount: settleData?.remaining_amount || 0,
        interest_amount: settleData?.interest_amount || 0,
        discount_amount: settleData?.discount_amount || 0,
      });
      setSettleTarget(null);
      await loadData();
    } catch (e) {
      alert("Erro ao dar baixa no título");
    }
  };

  const handleEditSaved = async () => {
    setEditTarget(null);
    await loadData();
  };

  const handleReopen = async (transactionId) => {
    if (!confirm("Estornar esta baixa e retornar o título para pendente?")) return;
    try {
      await base44.functions.invoke("portalAuth", {
        operation: "reopenTransaction",
        email: userEmail,
        transaction_id: transactionId,
      });
      await loadData();
    } catch (e) {
      alert("Erro ao estornar baixa");
    }
  };

  // --- Multi-seleção e baixa em lote ---
  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkSettle = async (bankAccountId, bankName) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkSaving(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await base44.functions.invoke("portalAuth", {
          operation: "settleTransaction",
          email: userEmail,
          transaction_id: id,
          bank_account_id: bankAccountId,
          bank_name: bankName,
        });
        ok++;
      } catch (e) {
        fail++;
        console.error("Erro ao baixar título:", id, e);
      }
    }
    setBulkSaving(false);
    setSelectedIds(new Set());
    setBulkSettleType(null);
    await loadData();
    if (fail > 0) {
      alert(`${ok} título(s) baixado(s) com sucesso. ${fail} falha(s).`);
    }
  };

  const clearFilters = () => { setStartDate(""); setEndDate(""); };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
  };

  const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  const totalReceivable = pendingReceivable.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalPayable = pendingPayable.reduce((s, t) => s + parseFloat(t.amount), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTransactions = transactions.filter((t) => {
    const refDate = new Date(t.due_date || t.date);
    return refDate.getMonth() === currentMonth && refDate.getFullYear() === currentYear;
  });

  const monthReceivable = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthPayable = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  const settledIncome = transactions
    .filter((t) => t.status === "settled" && t.type === "income")
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const settledExpense = transactions
    .filter((t) => t.status === "settled" && t.type === "expense")
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const currentBalance = settledIncome - settledExpense;

  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const receivableIds = pendingReceivable.map(t => t.id);
  const payableIds = pendingPayable.map(t => t.id);
  const selectedReceivableCount = receivableIds.filter(id => selectedIds.has(id)).length;
  const selectedPayableCount = payableIds.filter(id => selectedIds.has(id)).length;
  const selectedReceivableTotal = pendingReceivable.filter(t => selectedIds.has(t.id)).reduce((s, t) => s + parseFloat(t.amount), 0);
  const selectedPayableTotal = pendingPayable.filter(t => selectedIds.has(t.id)).reduce((s, t) => s + parseFloat(t.amount), 0);

  const tabBar = (
    <div className="flex gap-1 border-b">
      <button
        onClick={() => setActiveView("movimentacoes")}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          activeView === "movimentacoes"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Wallet className="w-4 h-4" /> Movimentações
      </button>
      <button
        onClick={() => setActiveView("historico")}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          activeView === "historico"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <History className="w-4 h-4" /> Histórico de Baixas
      </button>
    </div>
  );

  if (activeView === "historico") {
    return (
      <div className="space-y-6">
        {tabBar}
        <SettlementHistoryTab userEmail={userEmail} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tabBar}
      {/* Painel de Resumo Financeiro */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            Resumo Financeiro — {monthName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentBalance >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                <Wallet className={`w-5 h-5 ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Atual</p>
                <p className={`text-lg font-bold ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmtMoney(currentBalance)}
                </p>
                <p className="text-xs text-muted-foreground">Títulos baixados</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Receber no Mês</p>
                <p className="text-lg font-bold text-emerald-600">{fmtMoney(monthReceivable)}</p>
                <p className="text-xs text-muted-foreground">
                  {monthTransactions.filter((t) => t.type === "income").length} lançamento(s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Pagar no Mês</p>
                <p className="text-lg font-bold text-red-600">{fmtMoney(monthPayable)}</p>
                <p className="text-xs text-muted-foreground">
                  {monthTransactions.filter((t) => t.type === "expense").length} lançamento(s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(monthReceivable - monthPayable) >= 0 ? "bg-primary/10" : "bg-red-100"}`}>
                <Wallet className={`w-5 h-5 ${(monthReceivable - monthPayable) >= 0 ? "text-primary" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo do Mês</p>
                <p className={`text-lg font-bold ${(monthReceivable - monthPayable) >= 0 ? "text-primary" : "text-red-600"}`}>
                  {fmtMoney(monthReceivable - monthPayable)}
                </p>
                <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de Vencimento */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Vencimento inicial</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Vencimento final</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
              <Search className="w-4 h-4" /> Limpar Filtro
            </Button>
            {(startDate || endDate) && (
              <span className="text-xs text-muted-foreground ml-2">
                Filtrando: {pendingReceivable.length + pendingPayable.length} título(s) no período
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <BankBalanceChart bankAccounts={bankAccounts} transactions={transactions} />

      {/* Gráfico de previsão mensal */}
      <MonthlyForecastChart transactions={transactions} />

      {/* Summary - Pendentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A Receber (pendente)</p>
              <p className="text-lg font-bold text-emerald-600">{fmtMoney(totalReceivable)}</p>
              <p className="text-xs text-muted-foreground">{pendingReceivable.length} título(s)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A Pagar (pendente)</p>
              <p className="text-lg font-bold text-red-600">{fmtMoney(totalPayable)}</p>
              <p className="text-xs text-muted-foreground">{pendingPayable.length} título(s)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* A Receber */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Contas a Receber
                </CardTitle>
                {pendingReceivable.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedReceivableCount === receivableIds.length && receivableIds.length > 0}
                        onChange={() => toggleSelectAll(receivableIds)}
                        className="w-4 h-4"
                      />
                      Selecionar todos
                    </label>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={selectedReceivableCount === 0}
                      onClick={() => setBulkSettleType("receivable")}
                      className="gap-1.5"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Baixar Selecionados ({selectedReceivableCount})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {pendingReceivable.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum título a receber pendente
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingReceivable.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      fmtDate={fmtDate}
                      fmtMoney={fmtMoney}
                      isOverdue={isOverdue}
                      isReceivable
                      onSettle={() => setSettleTarget(tx)}
                      onEdit={() => setEditTarget(tx)}
                      onReopen={() => handleReopen(tx.id)}
                      selected={selectedIds.has(tx.id)}
                      onToggleSelect={() => toggleSelection(tx.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* A Pagar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  Contas a Pagar
                </CardTitle>
                {pendingPayable.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPayableCount === payableIds.length && payableIds.length > 0}
                        onChange={() => toggleSelectAll(payableIds)}
                        className="w-4 h-4"
                      />
                      Selecionar todos
                    </label>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={selectedPayableCount === 0}
                      onClick={() => setBulkSettleType("payable")}
                      className="gap-1.5"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Baixar Selecionados ({selectedPayableCount})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {pendingPayable.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum título a pagar pendente
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingPayable.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      fmtDate={fmtDate}
                      fmtMoney={fmtMoney}
                      isOverdue={isOverdue}
                      onSettle={() => setSettleTarget(tx)}
                      onEdit={() => setEditTarget(tx)}
                      onReopen={() => handleReopen(tx.id)}
                      selected={selectedIds.has(tx.id)}
                      onToggleSelect={() => toggleSelection(tx.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Baixados */}
          {settled.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Títulos Baixados ({settled.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {settled.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === "income" ? "bg-emerald-100" : "bg-red-100"
                          }`}
                        >
                          {tx.type === "income" ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.contact_name && `${tx.contact_name} · `}
                            {tx.bank_name && (
                              <span className="inline-flex items-center gap-1">
                                <Landmark className="w-3 h-3" /> {tx.bank_name} ·
                              </span>
                            )}
                            Baixado em {fmtDate(tx.settled_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <span
                           className={`text-sm font-bold ${
                             tx.type === "income" ? "text-emerald-600" : "text-red-600"
                           }`}
                         >
                           {tx.type === "income" ? "+" : "-"} {fmtMoney(tx.amount)}
                         </span>
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => setEditTarget(tx)}
                           title="Editar"
                         >
                           <Pencil className="w-4 h-4 text-muted-foreground" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => handleReopen(tx.id)}
                           title="Estornar baixa"
                         >
                           <Undo2 className="w-4 h-4 text-muted-foreground" />
                         </Button>
                       </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Settle modal */}
      {settleTarget && (
        <SettleModal
          tx={settleTarget}
          bankAccounts={bankAccounts}
          fmtMoney={fmtMoney}
          fmtDate={fmtDate}
          onClose={() => setSettleTarget(null)}
          onConfirm={handleSettle}
        />
      )}

      {/* Bulk settle modal */}
      {bulkSettleType && (
        <BulkSettleModal
          type={bulkSettleType}
          count={bulkSettleType === "receivable" ? selectedReceivableCount : selectedPayableCount}
          total={bulkSettleType === "receivable" ? selectedReceivableTotal : selectedPayableTotal}
          bankAccounts={bankAccounts}
          fmtMoney={fmtMoney}
          saving={bulkSaving}
          onClose={() => setBulkSettleType(null)}
          onConfirm={handleBulkSettle}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditTransactionModal
          tx={editTarget}
          userEmail={userEmail}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}

function TransactionRow({ tx, fmtDate, fmtMoney, isOverdue, isReceivable, onSettle, onEdit, onReopen, selected, onToggleSelect }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selected ? "bg-primary/5 border-primary/30" : "hover:bg-muted/30"}`}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected || false}
          onChange={onToggleSelect}
          className="w-4 h-4 shrink-0 cursor-pointer"
        />
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            tx.type === "income" ? "bg-emerald-100" : "bg-red-100"
          }`}
        >
          {tx.type === "income" ? (
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{tx.description}</p>
          <p className="text-xs text-muted-foreground">
            {tx.contact_name && `${tx.contact_name} · `}
            Venc: {fmtDate(tx.due_date)}
            {isOverdue(tx.due_date) && (
              <Badge variant="destructive" className="ml-2 text-[10px] py-0">Vencido</Badge>
            )}
            {tx.status === "partial" && (
              <Badge className="ml-2 text-[10px] py-0 bg-amber-100 text-amber-700 border-0">Parcial</Badge>
            )}
          </p>
          {tx.status === "partial" && parseFloat(tx.settled_amount) > 0 && (
            <p className="text-xs text-muted-foreground">
              Baixado: {fmtMoney(tx.settled_amount)} · Restante: {fmtMoney(tx.remaining_amount)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
            className={`text-sm font-bold ${
              tx.type === "income" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {tx.status === "partial" ? fmtMoney(tx.remaining_amount) : fmtMoney(tx.amount)}
          </span>
         <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            title="Editar"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </Button>
          {tx.status === "partial" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onReopen}
              title="Extornar baixa parcial"
            >
              <Undo2 className="w-4 h-4 text-amber-600" />
            </Button>
          )}
          <Button size="sm" onClick={onSettle} className="gap-1">
            <CheckCircle2 className="w-4 h-4" /> Baixar
          </Button>
        </div>
        </div>
        );
        }

function SettleModal({ tx, bankAccounts, fmtMoney, fmtDate, onClose, onConfirm }) {
  const [selectedBank, setSelectedBank] = useState("");
  const [saving, setSaving] = useState(false);
  const [settleMode, setSettleMode] = useState("total");
  const [interestAmount, setInterestAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [partialAmount, setPartialAmount] = useState(0);

  const originalAmount = parseFloat(tx.remaining_amount) > 0 ? parseFloat(tx.remaining_amount) : parseFloat(tx.amount) || 0;
  const interest = parseFloat(interestAmount) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const adjustedTotal = originalAmount + interest - discount;
  const partial = parseFloat(partialAmount) || 0;
  const remaining = adjustedTotal - partial;

  useEffect(() => {
    if (settleMode === "partial" && partialAmount === 0) {
      setPartialAmount(adjustedTotal.toFixed(2));
    }
  }, [settleMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBank) {
      alert("Selecione a conta bancária utilizada");
      return;
    }
    if (settleMode === "partial" && partial <= 0) {
      alert("Informe o valor a ser baixado");
      return;
    }
    if (settleMode === "partial" && partial > adjustedTotal) {
      alert("O valor parcial não pode ser maior que o total ajustado");
      return;
    }
    setSaving(true);
    const account = bankAccounts.find((b) => b.id === selectedBank);
    await onConfirm(tx.id, selectedBank, account?.bank_name || "", {
      is_partial: settleMode === "partial",
      settled_amount: settleMode === "partial" ? partial : adjustedTotal,
      remaining_amount: settleMode === "partial" ? remaining : 0,
      interest_amount: interest,
      discount_amount: discount,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base">Baixar Título</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg bg-muted/30 space-y-1">
            <p className="text-sm font-medium">{tx.description}</p>
            <p className="text-xs text-muted-foreground">
              {tx.contact_name && `${tx.contact_name} · `}
              {tx.type === "income" ? "A Receber" : "A Pagar"}
              {tx.status === "partial" && " · Já há baixa parcial"}
            </p>
            <p className="text-xs text-muted-foreground">
              Vencimento: {fmtDate(tx.due_date)}
            </p>
            <p className={`text-lg font-bold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
              {fmtMoney(originalAmount)}
            </p>
            {tx.status === "partial" && parseFloat(tx.settled_amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                Já baixado: {fmtMoney(tx.settled_amount)}
              </p>
            )}
          </div>

          {/* Modo de baixa */}
          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={settleMode === "total" ? "default" : "outline"}
              onClick={() => { setSettleMode("total"); setPartialAmount(0); }}
              className="flex-1"
            >
              Baixa Total
            </Button>
            <Button
              type="button"
              size="sm"
              variant={settleMode === "partial" ? "default" : "outline"}
              onClick={() => setSettleMode("partial")}
              className="flex-1"
            >
              Baixa Parcial
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Juros e Descontos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Juros / Multa (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestAmount || ""}
                  onChange={(e) => setInterestAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descontos (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Resumo do cálculo */}
            <div className="p-3 rounded-lg bg-muted/20 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor original</span>
                <span>{fmtMoney(originalAmount)}</span>
              </div>
              {interest > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>+ Juros</span>
                  <span>{fmtMoney(interest)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>- Descontos</span>
                  <span>{fmtMoney(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1">
                <span>Total ajustado</span>
                <span className={tx.type === "income" ? "text-emerald-600" : "text-red-600"}>
                  {fmtMoney(adjustedTotal)}
                </span>
              </div>
            </div>

            {/* Valor parcial */}
            {settleMode === "partial" && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor a baixar agora (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={adjustedTotal}
                    value={partialAmount || ""}
                    onChange={(e) => setPartialAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    required
                  />
                </div>
                <div className="flex justify-between text-sm p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-amber-700 font-medium">Restará após baixa</span>
                  <span className="font-bold text-amber-700">{fmtMoney(remaining)}</span>
                </div>
              </div>
            )}

            {/* Conta bancária */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Conta Bancária Utilizada
              </label>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-destructive">
                  Nenhuma conta bancária cadastrada. Cadastre uma conta na aba "Contas Bancárias".
                </p>
              ) : (
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  <option value="">Selecione o banco...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} — Ag {b.agency} / Conta {b.account_number}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving || bankAccounts.length === 0}>
                {saving ? "Baixando..." : settleMode === "partial" ? "Confirmar Baixa Parcial" : "Confirmar Baixa Total"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function BulkSettleModal({ type, count, total, bankAccounts, fmtMoney, saving, onClose, onConfirm }) {
  const [selectedBank, setSelectedBank] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBank) {
      alert("Selecione a conta bancária utilizada");
      return;
    }
    const account = bankAccounts.find((b) => b.id === selectedBank);
    await onConfirm(selectedBank, account?.bank_name || "");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            Baixa em Lote — {type === "receivable" ? "Contas a Receber" : "Contas a Pagar"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg bg-muted/30 space-y-1">
            <p className="text-sm font-medium">
              {count} título(s) selecionado(s)
            </p>
            <p className={`text-lg font-bold ${type === "receivable" ? "text-emerald-600" : "text-red-600"}`}>
              Total: {fmtMoney(total)}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Conta Bancária Utilizada
              </label>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-destructive">
                  Nenhuma conta bancária cadastrada. Cadastre uma conta na aba "Contas Bancárias".
                </p>
              ) : (
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  <option value="">Selecione o banco...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} — Ag {b.agency} / Conta {b.account_number}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving || bankAccounts.length === 0 || count === 0}>
                {saving ? `Baixando ${count} título(s)...` : `Confirmar Baixa de ${count} Título(s)`}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}