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
  ArrowUpCircle 
} from "lucide-react";

export default function CashPanel({ userEmail }) {
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleTarget, setSettleTarget] = useState(null); // transaction being settled

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

  const pendingReceivable = transactions.filter(
    (t) => t.type === "income" && (!t.status || t.status === "pending")
  );
  const pendingPayable = transactions.filter(
    (t) => t.type === "expense" && (!t.status || t.status === "pending")
  );
  const settled = transactions.filter((t) => t.status === "settled");

  const handleSettle = async (transactionId, bankAccountId, bankName) => {
    try {
      await base44.functions.invoke("portalAuth", {
        operation: "settleTransaction",
        email: userEmail,
        transaction_id: transactionId,
        bank_account_id: bankAccountId,
        bank_name: bankName,
      });
      setSettleTarget(null);
      await loadData();
    } catch (e) {
      alert("Erro ao dar baixa no título");
    }
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

  return (
    <div className="space-y-6">
      {/* Summary */}
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
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Contas a Receber
              </CardTitle>
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
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* A Pagar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                Contas a Pagar
              </CardTitle>
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
    </div>
  );
}

function TransactionRow({ tx, fmtDate, fmtMoney, isOverdue, isReceivable, onSettle }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
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
            Venc: {fmtDate(tx.due_date)}
            {isOverdue(tx.due_date) && (
              <Badge variant="destructive" className="ml-2 text-[10px] py-0">Vencido</Badge>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-bold ${
            tx.type === "income" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {fmtMoney(tx.amount)}
        </span>
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBank) {
      alert("Selecione a conta bancária utilizada");
      return;
    }
    setSaving(true);
    const account = bankAccounts.find((b) => b.id === selectedBank);
    await onConfirm(tx.id, selectedBank, account?.bank_name || "");
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Baixar Título</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg bg-muted/30 space-y-1">
            <p className="text-sm font-medium">{tx.description}</p>
            <p className="text-xs text-muted-foreground">
              {tx.contact_name && `${tx.contact_name} · `}
              {tx.type === "income" ? "A Receber" : "A Pagar"}
            </p>
            <p className="text-xs text-muted-foreground">
              Vencimento: {fmtDate(tx.due_date)}
            </p>
            <p className={`text-lg font-bold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
              {fmtMoney(tx.amount)}
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
              <Button type="submit" disabled={saving || bankAccounts.length === 0}>
                {saving ? "Baixando..." : "Confirmar Baixa"}
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