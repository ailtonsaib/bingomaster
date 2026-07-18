import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, TrendingUp, TrendingDown, Wallet, Calendar, FileText, Loader2 } from "lucide-react";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function WorkshopRelatorioFinanceiro({ transactions }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | settled
  const [typeFilter, setTypeFilter] = useState("all"); // all | income | expense
  const [printing, setPrinting] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // Tipo: receita ou despesa
      if (typeFilter !== "all" && t.type !== typeFilter) return false;

      // Status: aberto ou recebido/pago
      const isOpen = !t.status || t.status === "pending" || t.status === "partial";
      const isSettled = t.status === "settled";
      if (statusFilter === "open" && !isOpen) return false;
      if (statusFilter === "settled" && !isSettled) return false;

      // Data: usa vencimento (due_date) como referência; se não houver, usa settled_date ou created
      const refDate = t.due_date || t.settled_date || t.created_date;
      if (!refDate) return false;
      const d = new Date(refDate);
      const s = startDate ? new Date(startDate + "T00:00:00") : null;
      const e = endDate ? new Date(endDate + "T23:59:59") : null;
      if (s && d < s) return false;
      if (e && d > e) return false;

      return true;
    });
  }, [transactions, startDate, endDate, statusFilter, typeFilter]);

  const receivable = filtered.filter((t) => t.type === "income");
  const payable = filtered.filter((t) => t.type === "expense");

  const totalReceivableOpen = receivable.filter((t) => !t.status || t.status === "pending" || t.status === "partial").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalReceivableSettled = receivable.filter((t) => t.status === "settled").reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);

  const totalPayableOpen = payable.filter((t) => !t.status || t.status === "pending" || t.status === "partial").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalPayableSettled = payable.filter((t) => t.status === "settled").reduce((s, t) => s + parseFloat(t.settled_amount || t.amount), 0);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  };

  const statusLabel = statusFilter === "open" ? "Abertos" : statusFilter === "settled" ? "Recebidos/Pagos" : "Todos";
  const typeLabel = typeFilter === "income" ? "Contas a Receber" : typeFilter === "expense" ? "Contas a Pagar" : "Receber + Pagar";

  return (
    <Card id="print-area">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Relatório Financeiro de Contas
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
          </div>

          {/* Tipo: Receber / Pagar / Ambos */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Tipo:</span>
            {[
              { v: "all", l: "Receber + Pagar" },
              { v: "income", l: "Contas a Receber" },
              { v: "expense", l: "Contas a Pagar" },
            ].map((opt) => (
              <Button
                key={opt.v}
                size="sm"
                variant={typeFilter === opt.v ? "default" : "outline"}
                onClick={() => setTypeFilter(opt.v)}
              >
                {opt.l}
              </Button>
            ))}
          </div>

          {/* Status: Abertos / Recebidos / Todos */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {[
              { v: "all", l: "Todos", icon: FileText },
              { v: "open", l: "Abertos", icon: Wallet },
              { v: "settled", l: "Recebidos/Pagos", icon: TrendingUp },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.v}
                  size="sm"
                  variant={statusFilter === opt.v ? "default" : "outline"}
                  onClick={() => setStatusFilter(opt.v)}
                  className="gap-1"
                >
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

        {/* Cabeçalho do relatório impresso */}
        <div className="hidden print:block mb-4">
          <h2 className="text-lg font-bold">Relatório Financeiro de Contas</h2>
          <p className="text-sm">Período: {fmtDate(startDate + "T00:00:00")} a {fmtDate(endDate + "T00:00:00")}</p>
          <p className="text-sm">Tipo: {typeLabel} | Status: {statusLabel}</p>
          <p className="text-sm">Emitido em: {new Date().toLocaleString("pt-BR")}</p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A Receber (Abertos)</p>
              <p className="text-base font-bold text-emerald-600">{fmtMoney(totalReceivableOpen)}</p>
              <p className="text-[10px] text-muted-foreground">{receivable.filter((t) => !t.status || t.status === "pending" || t.status === "partial").length} título(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-base font-bold text-green-600">{fmtMoney(totalReceivableSettled)}</p>
              <p className="text-[10px] text-muted-foreground">{receivable.filter((t) => t.status === "settled").length} título(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A Pagar (Abertos)</p>
              <p className="text-base font-bold text-red-600">{fmtMoney(totalPayableOpen)}</p>
              <p className="text-[10px] text-muted-foreground">{payable.filter((t) => !t.status || t.status === "pending" || t.status === "partial").length} título(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="text-base font-bold text-orange-600">{fmtMoney(totalPayableSettled)}</p>
              <p className="text-[10px] text-muted-foreground">{payable.filter((t) => t.status === "settled").length} título(s)</p>
            </div>
          </div>
        </div>

        {/* Tabela de contas */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma conta encontrada com os filtros selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 px-2">Contato</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">Vencimento</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .sort((a, b) => {
                    const da = new Date(a.due_date || a.settled_date || a.created_date);
                    const db = new Date(b.due_date || b.settled_date || b.created_date);
                    return da - db;
                  })
                  .map((tx) => {
                    const isOpen = !tx.status || tx.status === "pending" || tx.status === "partial";
                    return (
                      <tr key={tx.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-2 font-medium">{tx.description}</td>
                        <td className="py-2 px-2 text-muted-foreground">{tx.contact_name || "—"}</td>
                        <td className="py-2 px-2">
                          {tx.type === "income" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Receber</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Pagar</Badge>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{fmtDate(tx.due_date)}</td>
                        <td className="py-2 px-2">
                          {isOpen ? (
                            <Badge variant="destructive" className="text-[10px]">Aberto</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Recebido</Badge>
                          )}
                        </td>
                        <td className={`py-2 px-2 text-right font-bold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.type === "income" ? "+" : "-"} {fmtMoney(isOpen ? tx.amount : tx.settled_amount || tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={5} className="py-2 text-right text-muted-foreground">Total Geral:</td>
                  <td className={`py-2 px-2 text-right ${totalReceivableOpen + totalReceivableSettled - totalPayableOpen - totalPayableSettled >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmtMoney(totalReceivableOpen + totalReceivableSettled - totalPayableOpen - totalPayableSettled)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}