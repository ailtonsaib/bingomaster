import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, CalendarDays, User } from "lucide-react";

export default function TransactionTable({ userEmail }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "getTransactions",
        email: userEmail,
      });
      setTransactions(res.data.transactions || []);
    } catch (e) {
      console.error("Erro ao carregar lançamentos:", e);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
  };

  const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === "settled") return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  const sorted = [...transactions].sort((a, b) => {
    const da = a.due_date || a.date || "";
    const db = b.due_date || b.date || "";
    return new Date(da) - new Date(db);
  });

  const totalReceivable = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalPayable = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const total = totalReceivable - totalPayable;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Lançamentos Financeiros
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum lançamento financeiro cadastrado
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground">Cliente / Fornecedor</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="py-2 px-3 font-medium text-right text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((tx) => {
                    const overdue = isOverdue(tx.due_date, tx.status);
                    return (
                      <tr key={tx.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={overdue ? "text-destructive font-medium" : ""}>
                            {fmtDate(tx.due_date || tx.date)}
                          </span>
                          {overdue && (
                            <Badge variant="destructive" className="ml-2 text-[10px] py-0">Vencido</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {tx.contact_name ? (
                            <span className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {tx.contact_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate" title={tx.description}>
                          {tx.description}
                          {tx.category && (
                            <span className="text-xs text-muted-foreground block">{tx.category}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {tx.type === "income" ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <TrendingUp className="w-3.5 h-3.5" /> Receita
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <TrendingDown className="w-3.5 h-3.5" /> Despesa
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant={tx.status === "settled" ? "default" : "secondary"}>
                            {tx.status === "settled" ? "Baixado" : "Pendente"}
                          </Badge>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.type === "income" ? "+" : "-"} {fmtMoney(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={5} className="py-3 px-3 text-right">Total Geral:</td>
                    <td className={`py-3 px-3 text-right ${total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtMoney(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Resumo */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-muted-foreground">Total a Receber:</span>
                <span className="font-bold text-emerald-600">{fmtMoney(totalReceivable)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-muted-foreground">Total a Pagar:</span>
                <span className="font-bold text-red-600">{fmtMoney(totalPayable)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Saldo:</span>
                <span className={`font-bold ${total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmtMoney(total)}
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}