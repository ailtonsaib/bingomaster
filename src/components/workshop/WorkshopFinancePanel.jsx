import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, CheckCircle2, Undo2, ArrowDownCircle, ArrowUpCircle, CalendarRange, DollarSign, Loader2, Receipt, Clock } from "lucide-react";
import MonthlyForecastChart from "@/components/finance/MonthlyForecastChart";
import WorkshopCashFlowPanel from "@/components/workshop/WorkshopCashFlowPanel";
import WorkshopSettleModal from "@/components/workshop/WorkshopSettleModal";
import WorkshopBankManager from "@/components/workshop/WorkshopBankManager";
import WorkshopCaixaPanel from "@/components/workshop/WorkshopCaixaPanel";
import { useToast } from "@/components/ui/use-toast";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const isOverdue = (dueDate) => dueDate && new Date(dueDate) < new Date(new Date().toDateString());

export default function WorkshopFinancePanel({ userEmail }) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleTarget, setSettleTarget] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const data = await base44.entities.PortalFinanceTransaction.filter(
        { user_email: userEmail, source_module: "workshop" },
        "-created_date"
      );
      setTransactions(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const inDateRange = (dueDate) => {
    if (!startDate && !endDate) return true;
    const ref = dueDate || new Date().toISOString();
    const d = new Date(ref).getTime();
    if (isNaN(d)) return false;
    const s = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
    const e = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
    return d >= s && d <= e;
  };

  const pendingReceivable = transactions.filter(t => t.type === "income" && (!t.status || t.status === "pending" || t.status === "partial") && inDateRange(t.due_date));
  const pendingPayable = transactions.filter(t => t.type === "expense" && (!t.status || t.status === "pending" || t.status === "partial") && inDateRange(t.due_date));
  const settled = transactions.filter(t => t.status === "settled");

  const totalReceivable = pendingReceivable.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalPayable = pendingPayable.reduce((s, t) => s + parseFloat(t.amount), 0);

  const settledIncome = transactions.filter(t => t.status === "settled" && t.type === "income").reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);
  const settledExpense = transactions.filter(t => t.status === "settled" && t.type === "expense").reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);
  const currentBalance = settledIncome - settledExpense;

  const now = new Date();
  const monthTransactions = transactions.filter(t => {
    const ref = new Date(t.due_date || t.date);
    return ref.getMonth() === now.getMonth() && ref.getFullYear() === now.getFullYear();
  });
  const monthReceivable = monthTransactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthPayable = monthTransactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleSettle = async (transactionId, settleData) => {
    try {
      const updates = {
        status: settleData.is_partial ? "partial" : "settled",
        settled_date: new Date().toISOString(),
        settled_amount: settleData.settled_amount,
        remaining_amount: settleData.remaining_amount,
        interest_amount: settleData.interest_amount,
        discount_amount: settleData.discount_amount,
        is_partial: settleData.is_partial,
      };
      if (settleData.bank_name) updates.bank_name = settleData.bank_name;
      await base44.entities.PortalFinanceTransaction.update(transactionId, updates);
      setSettleTarget(null);
      toast({ title: settleData.is_partial ? "Baixa parcial registrada" : "Título baixado", description: "Movimentação atualizada com sucesso." });
      await load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível baixar o título.", variant: "destructive" });
    }
  };

  const handleReopen = async (tx) => {
    if (!confirm("Estornar esta baixa e retornar o título para pendente?")) return;
    try {
      await base44.entities.PortalFinanceTransaction.update(tx.id, {
        status: "pending",
        settled_date: null,
        settled_amount: 0,
        remaining_amount: 0,
        interest_amount: 0,
        discount_amount: 0,
        is_partial: false,
      });
      toast({ title: "Título reaberto", description: "O título voltou para pendente." });
      await load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível estornar.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" /> Controle Financeiro
        </h3>
        <span className="text-xs text-gray-400">Independente do Sistema Automotivo</span>
      </div>

      {/* Resumo */}
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
                <p className={`text-lg font-bold ${currentBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(currentBalance)}</p>
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
                <p className="text-xs text-muted-foreground">{monthTransactions.filter(t => t.type === "income").length} lançamento(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Pagar no Mês</p>
                <p className="text-lg font-bold text-red-600">{fmtMoney(monthPayable)}</p>
                <p className="text-xs text-muted-foreground">{monthTransactions.filter(t => t.type === "expense").length} lançamento(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(monthReceivable - monthPayable) >= 0 ? "bg-primary/10" : "bg-red-100"}`}>
                <Wallet className={`w-5 h-5 ${(monthReceivable - monthPayable) >= 0 ? "text-primary" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo do Mês</p>
                <p className={`text-lg font-bold ${(monthReceivable - monthPayable) >= 0 ? "text-primary" : "text-red-600"}`}>{fmtMoney(monthReceivable - monthPayable)}</p>
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
            <Button variant="outline" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }}>Limpar Filtro</Button>
          </div>
        </CardContent>
      </Card>

      {/* Caixa — OS Concluídas aguardando pagamento */}
      <WorkshopCaixaPanel userEmail={userEmail} />

      {/* Cadastro de Contas Bancárias */}
      <WorkshopBankManager userEmail={userEmail} />

      {/* Fluxo de Caixa Consolidado — gráfico mensal, saldo por banco, previsão */}
      <WorkshopCashFlowPanel transactions={transactions} userEmail={userEmail} />

      {/* Previsão de Recebimentos e Pagamentos */}
      <MonthlyForecastChart transactions={transactions} />

      {/* Cards pendentes */}
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

      {/* Contas a Receber */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Contas a Receber
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingReceivable.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum título a receber pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingReceivable.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.contact_name && `${tx.contact_name} · `}
                        Venc: {fmtDate(tx.due_date)}
                        {isOverdue(tx.due_date) && <Badge variant="destructive" className="ml-2 text-[10px] py-0">Vencido</Badge>}
                        {tx.status === "partial" && <Badge className="ml-2 text-[10px] py-0 bg-amber-100 text-amber-700 border-0">Parcial</Badge>}
                      </p>
                      {tx.status === "partial" && parseFloat(tx.settled_amount) > 0 && (
                        <p className="text-xs text-muted-foreground">Baixado: {fmtMoney(tx.settled_amount)} · Restante: {fmtMoney(tx.remaining_amount)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-600">{tx.status === "partial" ? fmtMoney(tx.remaining_amount) : fmtMoney(tx.amount)}</span>
                    <Button size="sm" onClick={() => setSettleTarget(tx)} className="gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contas a Pagar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            Contas a Pagar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPayable.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum título a pagar pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingPayable.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.contact_name && `${tx.contact_name} · `}
                        Venc: {fmtDate(tx.due_date)}
                        {isOverdue(tx.due_date) && <Badge variant="destructive" className="ml-2 text-[10px] py-0">Vencido</Badge>}
                        {tx.status === "partial" && <Badge className="ml-2 text-[10px] py-0 bg-amber-100 text-amber-700 border-0">Parcial</Badge>}
                      </p>
                      {tx.status === "partial" && parseFloat(tx.settled_amount) > 0 && (
                        <p className="text-xs text-muted-foreground">Baixado: {fmtMoney(tx.settled_amount)} · Restante: {fmtMoney(tx.remaining_amount)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-red-600">{tx.status === "partial" ? fmtMoney(tx.remaining_amount) : fmtMoney(tx.amount)}</span>
                    <Button size="sm" onClick={() => setSettleTarget(tx)} className="gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Títulos Baixados */}
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
              {settled.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "income" ? "bg-emerald-100" : "bg-red-100"}`}>
                      {tx.type === "income" ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.contact_name && `${tx.contact_name} · `}
                        {tx.bank_name && `${tx.bank_name} · `}
                        Baixado em {fmtDate(tx.settled_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                      {tx.type === "income" ? "+" : "-"} {fmtMoney(tx.settled_amount || tx.amount)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleReopen(tx)} title="Estornar baixa">
                      <Undo2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {transactions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhuma movimentação financeira ainda. Conclua uma OS ou importe uma NF-e/NFS-e para gerar títulos.</p>
        </div>
      )}

      {settleTarget && (
        <WorkshopSettleModal
          tx={settleTarget}
          fmtMoney={fmtMoney}
          fmtDate={fmtDate}
          userEmail={userEmail}
          onClose={() => setSettleTarget(null)}
          onConfirm={handleSettle}
        />
      )}
    </div>
  );
}