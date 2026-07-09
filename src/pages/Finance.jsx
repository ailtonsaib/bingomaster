import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Wallet, LogOut } from "lucide-react";
import { getPortalUser, setPortalUser, clearPortalUser } from "@/lib/portalSession";
import LockScreen from "@/components/finance/LockScreen";
import PlanInfoCard from "@/components/finance/PlanInfoCard";

export default function Finance() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const txRes = await base44.functions.invoke('portalAuth', {
        operation: 'getTransactions',
        email: user.email,
      });
      setTransactions(txRes.data.transactions || []);

      const userRes = await base44.functions.invoke('portalAuth', {
        operation: 'getUser',
        email: user.email,
      });
      if (userRes.data.user) {
        setUser(userRes.data.user);
        setPortalUser(userRes.data.user);
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/portal-login');
      return;
    }
    loadData();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'addTransaction',
        email: user.email,
        description,
        amount: parseFloat(amount),
        type,
        category: category || undefined,
      });
      setDescription("");
      setAmount("");
      setCategory("");
      setType("expense");
      setShowForm(false);
      await loadData();
    } catch (err) {
      if (err.response?.data?.error === 'limit_reached') {
        await loadData();
      } else {
        alert("Erro ao adicionar movimentação");
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir esta movimentação?")) return;
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'deleteTransaction',
        email: user.email,
        transaction_id: id,
      });
      await loadData();
    } catch (e) {
      alert("Erro ao excluir movimentação");
    }
  };

  const handleLogout = () => {
    clearPortalUser();
    navigate('/portal-login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const limitReached = !user.finance_full_access && user.finance_transactions_used >= user.finance_transaction_limit;

  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = income - expenses;

  if (limitReached) {
    return <LockScreen user={user} onRefresh={loadData} onLogout={handleLogout} transactions={transactions} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-heading">Controle de Finanças</h1>
              <p className="text-xs text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={user.finance_full_access ? "default" : "secondary"}>
              {user.finance_full_access
                ? "Acesso Completo"
                : `${user.finance_transactions_used}/${user.finance_transaction_limit} movimentações`}
            </Badge>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Plan Info */}
        <div className="mb-6">
          <PlanInfoCard user={user} />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="text-lg font-bold text-emerald-600">R$ {income.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold text-red-600">R$ {expenses.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`text-lg font-bold ${balance >= 0 ? '' : 'text-red-600'}`}>R$ {balance.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Transaction */}
        {showForm ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Nova Movimentação</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Ex: Venda de produto"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Categoria (opcional)</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Alimentação"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Button className="mb-6 gap-2" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nova Movimentação
          </Button>
        )}

        {/* Transaction List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma movimentação registrada
              </p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category && `${tx.category} · `}
                          {new Date(tx.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'} R$ {parseFloat(tx.amount).toFixed(2)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}