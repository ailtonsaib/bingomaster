import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, Calendar, Wallet, ArrowDownCircle, ArrowUpCircle, FileText, Loader2, Banknote, QrCode, CreditCard, Receipt } from "lucide-react";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

const METHOD_ICONS = {
  dinheiro: Banknote,
  pix: QrCode,
  cartao_credito: CreditCard,
  cartao_debito: CreditCard,
  boleto: Receipt,
};

const METHOD_LABELS = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão Créd.",
  cartao_debito: "Cartão Déb.",
  boleto: "Boleto",
};

export default function WorkshopMovimentacaoCaixa({ transactions }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | settled
  const [dateField, setDateField] = useState("due"); // due | settled
  const [printing, setPrinting] = useState(false);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        // Status
        const isOpen = !t.status || t.status === "pending" || t.status === "partial";
        const isSettled = t.status === "settled";
        if (statusFilter === "open" && !isOpen) return false;
        if (statusFilter === "settled" && !isSettled) return false;

        // Data: usa due_date ou settled_date conforme selecionado
        const refDate = dateField === "settled" ? (t.settled_date || t.due_date) : (t.due_date || t.settled_date);
        if (!refDate) return statusFilter === "settled" ? false : true; // sem data só aparece se filtrar por vencimento
        const d = new Date(refDate);
        const s = startDate ? new Date(startDate + "T00:00:00") : null;
        const e = endDate ? new Date(endDate + "T23:59:59") : null;
        if (s && d < s) return false;
        if (e && d > e) return false;

        return true;
      })
      .sort((a, b) => {
        const da = new Date(a.due_date || a.settled_date || a.created_date);
        const db = new Date(b.due_date || b.settled_date || b.created_date);
        return da - db;
      });
  }, [transactions, startDate, endDate, statusFilter, dateField]);

  // Calcular saldo corrido
  const withBalance = useMemo(() => {
    let running = 0;
    return filtered.map((t) => {
      const value = t.status === "settled" ? parseFloat(t.settled_amount || t.amount) : parseFloat(t.amount);
      if (t.type === "income") running += value;
      else running -= value;
      return { ...t, _value: value, _balance: running };
    });
  }, [filtered]);

  const totalIn = withBalance.filter((t) => t.type === "income").reduce((s, t) => s + t._value, 0);
  const totalOut = withBalance.filter((t) => t.type === "expense").reduce((s, t) => s + t._value, 0);
  const netTotal = totalIn - totalOut;

  const openCount = withBalance.filter((t) => !t.status || t.status === "pending" || t.status === "partial").length;
  const settledCount = withBalance.filter((t) => t.status === "settled").length;

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  };

  const statusLabel = statusFilter === "open" ? "Abertas" : statusFilter === "settled" ? "Recebidas/Pagas" : "Todas";
  const dateFieldLabel = dateField === "settled" ? "Data de Baixa" : "Data de Vencimento";

  return (
    <Card id="print-area">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-600" />
          Relatório de Movimentações de Caixa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="no-print space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data inicial
              </label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Data final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Filtrar data por</label>
              <select value={dateField} onChange={(e) => setDateField(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="due">Vencimento</option>
                <option value="settled">Data de Baixa</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {[
              { v: "all", l: "Todas", icon: FileText },
              { v: "open", l: "Abertas", icon: Wallet },
              { v: "settled", l: "Recebidas/Pagas", icon: ArrowDownCircle },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <Button key={opt.v} size="sm" variant={statusFilter === opt.v ? "default" : "outline"} onClick={() => setStatusFilter(opt.v)} className="gap-1">
                  <Icon className="w-3.5 h-3.5" /> {opt.l}
                </Button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={filtered.length === 0} className="gap-1">
              {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Imprimir Relatório
            </Button>
          </div>
        </div>

        {/* Cabeçalho impresso */}
        <div className="hidden print:block mb-4">
          <h2 className="text-lg font-bold">Relatório de Movimentações de Caixa</h2>
          <p className="text-sm">Período: {fmtDate(startDate + "T00:00:00")} a {fmtDate(endDate + "T00:00:00")} (por {dateFieldLabel})</p>
          <p className="text-sm">Status: {statusLabel}</p>
          <p className="text-sm">Emitido em: {new Date().toLocaleString("pt-BR")}</p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Entradas</p>
              <p className="text-base font-bold text-emerald-600">{fmtMoney(totalIn)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <ArrowUpCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Saídas</p>
              <p className="text-base font-bold text-red-600">{fmtMoney(totalOut)}</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${netTotal >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${netTotal >= 0 ? "bg-blue-100" : "bg-red-100"}`}>
              <Wallet className={`w-4 h-4 ${netTotal >= 0 ? "text-blue-600" : "text-red-600"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Líquido</p>
              <p className={`text-base font-bold ${netTotal >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmtMoney(netTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Movimentações</p>
              <p className="text-base font-bold">{filtered.length}</p>
              <p className="text-[10px] text-muted-foreground">{openCount} abertas · {settledCount} baixadas</p>
            </div>
          </div>
        </div>

        {/* Tabela de movimentações */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma movimentação encontrada com os filtros selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 px-2">Descrição</th>
                  <th className="py-2 px-2">Contato</th>
                  <th className="py-2 px-2">Forma</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Entrada</th>
                  <th className="py-2 px-2 text-right">Saída</th>
                  <th className="py-2 px-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {withBalance.map((tx) => {
                  const isOpen = !tx.status || tx.status === "pending" || tx.status === "partial";
                  const MethodIcon = METHOD_ICONS[tx.payment_method];
                  const refDate = dateField === "settled" ? (tx.settled_date || tx.due_date) : (tx.due_date || tx.settled_date);
                  return (
                    <tr key={tx.id} className="border-b hover:bg-muted/20">
                      <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">{fmtDate(refDate)}</td>
                      <td className="py-2 px-2 font-medium">{tx.description}</td>
                      <td className="py-2 px-2 text-muted-foreground">{tx.contact_name || "—"}</td>
                      <td className="py-2 px-2">
                        {tx.payment_method && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {MethodIcon && <MethodIcon className="w-3 h-3" />}
                            {METHOD_LABELS[tx.payment_method] || tx.payment_method}
                          </span>
                        )}
                        {tx.bank_name && <span className="block text-[10px] text-muted-foreground">{tx.bank_name}</span>}
                      </td>
                      <td className="py-2 px-2">
                        {isOpen ? (
                          <Badge variant="destructive" className="text-[10px]">Aberta</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Baixada</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-600">
                        {tx.type === "income" ? fmtMoney(tx._value) : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-red-600">
                        {tx.type === "expense" ? fmtMoney(tx._value) : "—"}
                      </td>
                      <td className={`py-2 px-2 text-right font-bold ${tx._balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {fmtMoney(tx._balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold bg-muted/30">
                  <td colSpan={5} className="py-2 px-2 text-right text-muted-foreground">Totais:</td>
                  <td className="py-2 px-2 text-right text-emerald-600">{fmtMoney(totalIn)}</td>
                  <td className="py-2 px-2 text-right text-red-600">{fmtMoney(totalOut)}</td>
                  <td className={`py-2 px-2 text-right ${netTotal >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmtMoney(netTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}