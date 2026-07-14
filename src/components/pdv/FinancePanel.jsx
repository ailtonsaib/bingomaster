import { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, KeyRound, Receipt, Building2, Landmark, Users, ClipboardList, CalendarDays, FileBarChart, LayoutDashboard, Download } from "lucide-react";
import { setPortalUser } from "@/lib/portalSession";
import PlanInfoCard from "@/components/finance/PlanInfoCard";
import ChangePasswordModal from "@/components/portal/ChangePasswordModal";
import CostCenterManager from "@/components/finance/CostCenterManager";
import BankAccountManager from "@/components/finance/BankAccountManager";
import ContactManager from "@/components/finance/ContactManager";
import TransactionForm from "@/components/finance/TransactionForm";
import CashPanel from "@/components/finance/CashPanel";
import TransactionTable from "@/components/finance/TransactionTable";
import CashFlowReport from "@/components/finance/CashFlowReport";
import DrillDownDashboard from "@/components/finance/DrillDownDashboard";
import AgapeMigrationModal from "@/components/finance/AgapeMigrationModal";
import TransactionClassifier from "@/components/finance/TransactionClassifier";
import LockScreen from "@/components/finance/LockScreen";

export default function FinancePanel({ user: initialUser }) {
  const [user, setUser] = useState(initialUser);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAgapeMigration, setShowAgapeMigration] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

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
    loadData();
  }, []);

  const handleAdd = async (formData) => {
    setSaving(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'addTransaction',
        email: user.email,
        ...formData,
      });
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

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const limitReached = !user.finance_full_access && user.finance_transactions_used >= user.finance_transaction_limit;

  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = income - expenses;

  if (limitReached) {
    return <LockScreen user={user} onRefresh={loadData} onLogout={() => {}} transactions={transactions} embedded />;
  }

  const subTabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Movimentações", icon: Receipt },
    { id: "relatorio", label: "Relatório", icon: FileBarChart },
    { id: "lancamentos", label: "Lançamentos", icon: CalendarDays },
    { id: "cashpanel", label: "Caixa & Banco", icon: ClipboardList },
    { id: "classify", label: "Classificar", icon: ClipboardList },
    { id: "costcenters", label: "Centros de Custo", icon: Building2 },
    { id: "bankaccounts", label: "Contas Bancárias", icon: Landmark },
    { id: "contacts", label: "Clientes & Fornecedores", icon: Users },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header with plan badge and actions */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={user.finance_full_access ? "default" : "secondary"}>
              {user.finance_full_access
                ? "Acesso Completo"
                : `${user.finance_transactions_used}/${user.finance_transaction_limit} movimentações`}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAgapeMigration(true)} className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Migrar Ágape</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowChangePassword(true)} title="Alterar Senha">
              <KeyRound className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showChangePassword && (
          <ChangePasswordModal userEmail={user.email} onClose={() => setShowChangePassword(false)} />
        )}

        {showAgapeMigration && (
          <AgapeMigrationModal
            userEmail={user.email}
            onClose={() => setShowAgapeMigration(false)}
            onSuccess={async () => {
              setShowAgapeMigration(false);
              await loadData();
            }}
          />
        )}

        {/* Plan Info */}
        <div className="mb-6">
          <PlanInfoCard user={user} />
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 border-b overflow-x-auto">
          {subTabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === "dashboard" && <DrillDownDashboard userEmail={user.email} />}

        {activeTab === "transactions" && (
          <>
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

            {showForm ? (
              <TransactionForm
                userEmail={user.email}
                onSave={handleAdd}
                onCancel={() => setShowForm(false)}
              />
            ) : (
              <Button className="mb-6 gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Nova Movimentação
              </Button>
            )}

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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {tx.type === 'income' ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {tx.contact_name && <span className="text-primary/80">{tx.contact_name} · </span>}
                              {tx.category && `${tx.category} · `}
                              Lanç: {tx.launch_date ? new Date(tx.launch_date).toLocaleDateString('pt-BR') : new Date(tx.date).toLocaleDateString('pt-BR')}
                              {tx.due_date && ` · Venc: ${new Date(tx.due_date).toLocaleDateString('pt-BR')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
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
          </>
        )}

        {activeTab === "classify" && <TransactionClassifier userEmail={user.email} onClassified={loadData} />}
        {activeTab === "costcenters" && <CostCenterManager userEmail={user.email} />}
        {activeTab === "bankaccounts" && <BankAccountManager userEmail={user.email} />}
        {activeTab === "contacts" && <ContactManager userEmail={user.email} />}
        {activeTab === "cashpanel" && <CashPanel userEmail={user.email} />}
        {activeTab === "lancamentos" && <TransactionTable userEmail={user.email} />}
        {activeTab === "relatorio" && <CashFlowReport userEmail={user.email} />}
      </div>
    </div>
  );
}