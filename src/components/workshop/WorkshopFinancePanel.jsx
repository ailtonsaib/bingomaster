import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, CheckCircle2, Clock, TrendingUp, Receipt } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function WorkshopFinancePanel({ userEmail }) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [txs, ords] = await Promise.all([
        base44.entities.PortalFinanceTransaction.filter({ user_email: userEmail, type: "income" }, "-created_date"),
        base44.entities.ServiceOrder.filter({ user_email: userEmail }, "-created_date"),
      ]);
      setTransactions(txs);
      setOrders(ords);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [userEmail]);

  const pending = transactions.filter(t => t.status === "pending");
  const settled = transactions.filter(t => t.status === "settled");
  const totalPending = pending.reduce((s, t) => s + (t.amount || 0), 0);
  const totalSettled = settled.reduce((s, t) => s + (t.amount || 0), 0);
  const totalAll = transactions.reduce((s, t) => s + (t.amount || 0), 0);

  const handleSettle = async (tx) => {
    try {
      await base44.entities.PortalFinanceTransaction.update(tx.id, {
        status: "settled",
        settled_date: new Date().toISOString(),
        settled_amount: tx.amount,
      });
      toast({ title: "Recebimento registrado", description: `${tx.contact_name || "Cliente"} — ${formatCurrency(tx.amount)}` });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar o recebimento.", variant: "destructive" });
    }
  };

  const handleReopen = async (tx) => {
    try {
      await base44.entities.PortalFinanceTransaction.update(tx.id, {
        status: "pending",
        settled_date: null,
        settled_amount: 0,
      });
      toast({ title: "Título reaberto", description: "O recebimento foi revertido para pendente." });
      load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível reabrir o título.", variant: "destructive" });
    }
  };

  const filtered = filter === "all" ? transactions : transactions.filter(t => t.status === filter);

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
        <span className="text-xs text-gray-400">Receitas geradas automaticamente ao concluir OS</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-amber-700">A Receber</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-amber-600 mt-1">{pending.length} título(s) pendente(s)</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-green-700">Recebido</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalSettled)}</p>
          <p className="text-xs text-green-600 mt-1">{settled.length} título(s) baixado(s)</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-blue-700">Total Geral</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalAll)}</p>
          <p className="text-xs text-blue-600 mt-1">{transactions.length} transação(ões)</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5">
        {[
          { value: "all", label: "Todas" },
          { value: "pending", label: "Pendentes" },
          { value: "settled", label: "Recebidas" },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">
            {transactions.length === 0
              ? "Nenhum recebimento ainda. Conclua uma OS para gerar um título no financeiro."
              : "Nenhuma transação encontrada para este filtro."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-medium">Descrição</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium text-right">Valor</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Vencimento</th>
                <th className="p-3 font-medium">Recebido em</th>
                <th className="p-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="p-3">
                    <p className="font-medium text-gray-800">{tx.description || "—"}</p>
                    {tx.cost_center_name && <p className="text-xs text-gray-400">{tx.cost_center_name}</p>}
                  </td>
                  <td className="p-3 text-gray-600">{tx.contact_name || "—"}</td>
                  <td className="p-3 text-right font-medium text-green-600">{formatCurrency(tx.amount)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === "settled" ? "bg-green-50 text-green-600" :
                      tx.status === "partial" ? "bg-amber-50 text-amber-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      {tx.status === "settled" ? "Recebido" : tx.status === "partial" ? "Parcial" : "Pendente"}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{formatDate(tx.due_date)}</td>
                  <td className="p-3 text-gray-400 text-xs">{formatDate(tx.settled_date)}</td>
                  <td className="p-3 text-center">
                    {tx.status === "pending" && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSettle(tx)}
                        className="h-7 text-xs text-white gap-1"
                        style={{ backgroundColor: "#16a34a" }}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Receber
                      </Button>
                    )}
                    {tx.status === "settled" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleReopen(tx)}
                        className="h-7 text-xs"
                      >
                        Reabrir
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}