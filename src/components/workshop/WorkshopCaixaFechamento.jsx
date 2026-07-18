import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, QrCode, CreditCard, Receipt, Wallet, Printer, Calendar, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const METHOD_CONFIG = {
  dinheiro: { label: "Dinheiro", icon: Banknote, color: "text-green-600 bg-green-100" },
  pix: { label: "PIX", icon: QrCode, color: "text-blue-600 bg-blue-100" },
  cartao_credito: { label: "Cartão de Crédito", icon: CreditCard, color: "text-purple-600 bg-purple-100" },
  cartao_debito: { label: "Cartão de Débito", icon: CreditCard, color: "text-indigo-600 bg-indigo-100" },
  boleto: { label: "Boleto", icon: Receipt, color: "text-amber-600 bg-amber-100" },
};

export default function WorkshopCaixaFechamento({ transactions }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closing, setClosing] = useState(false);

  const dayTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.settled_date) return false;
      const d = new Date(t.settled_date);
      const sel = new Date(selectedDate + "T00:00:00");
      return d.getDate() === sel.getDate() && d.getMonth() === sel.getMonth() && d.getFullYear() === sel.getFullYear();
    });
  }, [transactions, selectedDate]);

  const incomeTx = dayTransactions.filter((t) => t.type === "income");
  const expenseTx = dayTransactions.filter((t) => t.type === "expense");

  const totalIncome = incomeTx.reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);
  const totalExpense = expenseTx.reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);
  const netTotal = totalIncome - totalExpense;

  // Totais por forma de pagamento (apenas receitas)
  const byMethod = useMemo(() => {
    const groups = {};
    incomeTx.forEach((t) => {
      const method = t.payment_method || "dinheiro";
      if (!groups[method]) groups[method] = { count: 0, total: 0 };
      groups[method].count++;
      groups[method].total += parseFloat(t.settled_amount || t.amount);
    });
    return groups;
  }, [incomeTx]);

  const handlePrint = () => {
    window.print();
  };

  const handleCloseDay = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      window.print();
    }, 500);
  };

  return (
    <Card id="print-area">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-600" />
          Acerto de Caixa — Encerramento do Dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletor de data */}
        <div className="flex flex-wrap items-end gap-3 no-print">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Data do caixa
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleCloseDay} disabled={closing || dayTransactions.length === 0} className="gap-1">
            {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            Encerrar Caixa do Dia
          </Button>
        </div>

        {/* Cabeçalho do relatório (visível na impressão) */}
        <div className="hidden print:block mb-4">
          <h2 className="text-lg font-bold">Relatório de Encerramento de Caixa</h2>
          <p className="text-sm">Data: {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR")}</p>
          <p className="text-sm">Emitado em: {new Date().toLocaleString("pt-BR")}</p>
        </div>

        {dayTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma movimentação baixada nesta data.
          </p>
        ) : (
          <>
            {/* Totais por forma de pagamento */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Recebimentos por Forma de Pagamento</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(METHOD_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const data = byMethod[key];
                  return (
                    <div key={key} className={`p-2 rounded-lg border ${data ? "" : "opacity-40"}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <Icon className={`w-3 h-3 ${cfg.color.split(" ")[0]}`} />
                        <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
                      </div>
                      <p className="text-sm font-bold">{fmtMoney(data?.total || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">{data?.count || 0} transação(ões)</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumo geral */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  <p className="text-base font-bold text-emerald-600">{fmtMoney(totalIncome)}</p>
                  <p className="text-[10px] text-muted-foreground">{incomeTx.length} recebimento(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="text-base font-bold text-red-600">{fmtMoney(totalExpense)}</p>
                  <p className="text-[10px] text-muted-foreground">{expenseTx.length} pagamento(s)</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${netTotal >= 0 ? "bg-primary/5 border-primary/20" : "bg-red-50 border-red-200"}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${netTotal >= 0 ? "bg-primary/10" : "bg-red-100"}`}>
                  <Wallet className={`w-4 h-4 ${netTotal >= 0 ? "text-primary" : "text-red-600"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo do Caixa</p>
                  <p className={`text-base font-bold ${netTotal >= 0 ? "text-primary" : "text-red-600"}`}>{fmtMoney(netTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">{dayTransactions.length} movimentação(ões)</p>
                </div>
              </div>
            </div>

            {/* Lista de movimentações do dia */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Movimentações do Dia</p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {dayTransactions
                  .sort((a, b) => new Date(a.settled_date) - new Date(b.settled_date))
                  .map((tx) => {
                    const cfg = METHOD_CONFIG[tx.payment_method] || METHOD_CONFIG.dinheiro;
                    const Icon = cfg.icon;
                    const isIncome = tx.type === "income";
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-white text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{tx.description}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {fmtDateTime(tx.settled_date)} · {cfg.label}
                              {tx.contact_name && ` · ${tx.contact_name}`}
                              {tx.bank_name && ` · ${tx.bank_name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={isIncome ? "default" : "destructive"} className="text-[10px] py-0">
                            {isIncome ? "Entrada" : "Saída"}
                          </Badge>
                          <span className={`font-bold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                            {isIncome ? "+" : "-"} {fmtMoney(tx.settled_amount || tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}