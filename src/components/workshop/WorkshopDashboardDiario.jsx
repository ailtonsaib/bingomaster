import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, CalendarCheck, Banknote, ArrowRightLeft } from "lucide-react";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isOverdue = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date(new Date().toDateString());
  return d < today;
};

export default function WorkshopDashboardDiario({ transactions }) {
  const stats = useMemo(() => {
    const pendingIncome = transactions.filter(t => t.type === "income" && (!t.status || t.status === "pending" || t.status === "partial"));
    const pendingExpense = transactions.filter(t => t.type === "expense" && (!t.status || t.status === "pending" || t.status === "partial"));

    // A receber hoje
    const toReceiveToday = pendingIncome.filter(t => isToday(t.due_date));
    const toReceiveTodayTotal = toReceiveToday.reduce((s, t) => s + parseFloat(t.status === "partial" ? t.remaining_amount || t.amount : t.amount), 0);

    // A pagar hoje
    const toPayToday = pendingExpense.filter(t => isToday(t.due_date));
    const toPayTodayTotal = toPayToday.reduce((s, t) => s + parseFloat(t.status === "partial" ? t.remaining_amount || t.amount : t.amount), 0);

    // Recebido hoje
    const receivedToday = transactions.filter(t => t.type === "income" && t.status === "settled" && isToday(t.settled_date));
    const receivedTodayTotal = receivedToday.reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);

    // Pago hoje
    const paidToday = transactions.filter(t => t.type === "expense" && t.status === "settled" && isToday(t.settled_date));
    const paidTodayTotal = paidToday.reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);

    // Vencidos a receber
    const overdueReceive = pendingIncome.filter(t => isOverdue(t.due_date));
    const overdueReceiveTotal = overdueReceive.reduce((s, t) => s + parseFloat(t.status === "partial" ? t.remaining_amount || t.amount : t.amount), 0);

    // Vencidos a pagar
    const overduePay = pendingExpense.filter(t => isOverdue(t.due_date));
    const overduePayTotal = overduePay.reduce((s, t) => s + parseFloat(t.status === "partial" ? t.remaining_amount || t.amount : t.amount), 0);

    // Total pendente geral
    const totalPendingReceive = pendingIncome.reduce((s, t) => s + parseFloat(t.status === "partial" ? t.remaining_amount || t.amount : t.amount), 0);
    const totalPendingPay = pendingExpense.reduce((s, t) => s + parseFloat(t.status === "partial" ? t.remaining_amount || t.amount : t.amount), 0);

    // Saldo projetado do dia (recebido hoje - pago hoje)
    const dayBalance = receivedTodayTotal - paidTodayTotal;

    return {
      toReceiveToday, toReceiveTodayTotal,
      toPayToday, toPayTodayTotal,
      receivedToday, receivedTodayTotal,
      paidToday, paidTodayTotal,
      overdueReceive, overdueReceiveTotal,
      overduePay, overduePayTotal,
      totalPendingReceive, totalPendingPay,
      dayBalance,
    };
  }, [transactions]);

  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <Card className="bg-gradient-to-br from-blue-50 via-white to-emerald-50 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          Dashboard do Dia
        </CardTitle>
        <p className="text-xs text-muted-foreground capitalize">{todayLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Linha 1: Hoje */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Hoje</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* A receber hoje */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-emerald-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">A Receber Hoje</p>
                <p className="text-base font-bold text-emerald-600 truncate">{fmtMoney(stats.toReceiveTodayTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.toReceiveToday.length} título(s)</p>
              </div>
            </div>

            {/* A pagar hoje */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-red-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">A Pagar Hoje</p>
                <p className="text-base font-bold text-red-600 truncate">{fmtMoney(stats.toPayTodayTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.toPayToday.length} título(s)</p>
              </div>
            </div>

            {/* Recebido hoje */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-green-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Recebido Hoje</p>
                <p className="text-base font-bold text-green-600 truncate">{fmtMoney(stats.receivedTodayTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.receivedToday.length} baixa(s)</p>
              </div>
            </div>

            {/* Pago hoje */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-orange-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Pago Hoje</p>
                <p className="text-base font-bold text-orange-600 truncate">{fmtMoney(stats.paidTodayTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.paidToday.length} baixa(s)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Linha 2: Saldo do dia + Vencidos */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Vencidos & Saldo</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Vencidos a receber */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm ${stats.overdueReceiveTotal > 0 ? "bg-red-50 border-red-300" : "bg-white border-border"}`}>
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Vencidos a Receber</p>
                <p className="text-base font-bold text-red-600 truncate">{fmtMoney(stats.overdueReceiveTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.overdueReceive.length} título(s)</p>
              </div>
            </div>

            {/* Vencidos a pagar */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm ${stats.overduePayTotal > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-border"}`}>
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Vencidos a Pagar</p>
                <p className="text-base font-bold text-amber-600 truncate">{fmtMoney(stats.overduePayTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.overduePay.length} título(s)</p>
              </div>
            </div>

            {/* Saldo do dia */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm ${stats.dayBalance >= 0 ? "bg-primary/5 border-primary/30" : "bg-red-50 border-red-300"}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stats.dayBalance >= 0 ? "bg-primary/10" : "bg-red-100"}`}>
                <ArrowRightLeft className={`w-5 h-5 ${stats.dayBalance >= 0 ? "text-primary" : "text-red-600"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Saldo do Dia</p>
                <p className={`text-base font-bold truncate ${stats.dayBalance >= 0 ? "text-primary" : "text-red-600"}`}>
                  {fmtMoney(stats.dayBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground">Recebido - Pago</p>
              </div>
            </div>

            {/* Total pendente */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "bg-white border-border" : "bg-red-50 border-red-300"}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "bg-blue-100" : "bg-red-100"}`}>
                <Wallet className={`w-5 h-5 ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "text-blue-600" : "text-red-600"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Saldo Pendente Geral</p>
                <p className={`text-base font-bold truncate ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {fmtMoney(stats.totalPendingReceive - stats.totalPendingPay)}
                </p>
                <p className="text-[10px] text-muted-foreground">A receber - A pagar</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de resumo geral */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-white border">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Total a Receber:</span>
            <span className="text-sm font-bold text-emerald-600">{fmtMoney(stats.totalPendingReceive)}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-50 border border-red-200">
            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs text-muted-foreground">Total a Pagar:</span>
            <span className="text-sm font-bold text-red-600">{fmtMoney(stats.totalPendingPay)}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
            <Wallet className={`w-3.5 h-3.5 ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "text-blue-600" : "text-red-600"}`} />
            <span className="text-xs text-muted-foreground">Saldo:</span>
            <span className={`text-sm font-bold ${stats.totalPendingReceive - stats.totalPendingPay >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {fmtMoney(stats.totalPendingReceive - stats.totalPendingPay)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}