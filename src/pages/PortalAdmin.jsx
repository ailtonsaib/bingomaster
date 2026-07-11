import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Plus, Check, RotateCcw, Trash2, Users, Bell, Grid3x3, Wallet, Ticket, FileText, Settings, Search, Globe, Clock, Monitor } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import UserFormModal from "@/components/portal/UserFormModal";
import PlanManagement from "@/components/portal/PlanManagement";
import { useToast } from "@/components/ui/use-toast";

const BINGO_PLANS = ["free", "basic", "pro", "max", "ultra", "enterprise", "mega"];
const SPED_PLANS = ["free", "basic", "pro", "max"];

export default function PortalAdmin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !user.is_admin) {
      navigate('/');
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'getUsers',
        admin_email: user.email,
      });
      setUsers(res.data.users || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateUser = async (userId, data) => {
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'updateUser',
        admin_email: user.email,
        user_id: userId,
        data,
      });
      await loadUsers();
      return true;
    } catch (e) {
      alert("Erro ao atualizar usuário");
      return false;
    }
  };

  const handleApprove = async (userId) => {
    await updateUser(userId, { finance_full_access: true, finance_release_requested: false });
  };

  const handleReset = async (userId) => {
    if (!confirm("Resetar contagem de movimentações deste usuário?")) return;
    const ok = await updateUser(userId, { finance_transactions_used: 0 });
    if (ok) {
      toast({ title: "Contagem resetada", description: "Movimentações zeradas com sucesso." });
    } else {
      toast({ title: "Erro", description: "Não foi possível resetar a contagem.", variant: "destructive" });
    }
  };

  const handleToggle = async (userId, field, currentValue) => {
    await updateUser(userId, { [field]: !currentValue });
  };

  const handleBingoPlan = async (userId, plan) => {
    await updateUser(userId, { bingo_plan: plan });
  };

  const handleFinancePlan = async (userId, fullAccess) => {
    await updateUser(userId, {
      finance_full_access: fullAccess,
      finance_transaction_limit: fullAccess ? 0 : 10,
    });
  };

  const handleSpedPlan = async (userId, plan) => {
    await updateUser(userId, { sped_plan: plan });
  };

  const handleDelete = async (userId) => {
    if (!confirm("Excluir este usuário permanentemente?")) return;
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'deleteUser',
        admin_email: user.email,
        user_id: userId,
      });
      await loadUsers();
    } catch (e) {
      alert("Erro ao excluir usuário");
    }
  };

  const handleLogout = () => {
    clearPortalUser();
    navigate('/portal-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const pendingReleases = users.filter((u) => u.finance_release_requested);

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.is_active && !u.finance_release_requested) ||
      (statusFilter === "inactive" && !u.is_active) ||
      (statusFilter === "pending" && u.finance_release_requested);
    return matchesSearch && matchesStatus;
  });
  const bingoUsers = users.filter((u) => u.can_access_bingo);
  const financeUsers = users.filter((u) => u.can_access_finance);
  const chamadosUsers = users.filter((u) => u.can_access_chamados);
  const spedUsers = users.filter((u) => u.can_access_sped);

  const TabBar = (
    <div className="flex gap-2 mb-6 border-b">
      <button onClick={() => setActiveTab("users")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
        <Users className="w-4 h-4" /> Usuários
      </button>
      <button onClick={() => setActiveTab("plans")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "plans" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
        <Settings className="w-4 h-4" /> Planos e Manutenção
      </button>
    </div>
  );

  const Header = (
    <div className="border-b bg-card">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-heading">Painel Administrador</h1>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  if (activeTab === "plans") {
    return (
      <div className="min-h-screen bg-background">
        {Header}
        <div className="max-w-5xl mx-auto px-4 py-6">
          {TabBar}
          <PlanManagement />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {Header}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {TabBar}
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Grid3x3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">BingoPremier</p>
                <p className="text-lg font-bold">{bingoUsers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Finanças</p>
                <p className="text-lg font-bold">{financeUsers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chamados</p>
                <p className="text-lg font-bold">{chamadosUsers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SPED</p>
                <p className="text-lg font-bold">{spedUsers.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {pendingReleases.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-700">
              {pendingReleases.length} solicitação(ões) de liberação pendente(s)
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Usuários</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="pending">Pendentes de plano</option>
            </select>
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Novo Usuário
            </Button>
          </div>
        </div>

        {/* User Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Usuário</th>
                    <th className="text-left p-3 font-medium">BingoPremier</th>
                    <th className="text-left p-3 font-medium">Finanças</th>
                    <th className="text-left p-3 font-medium">Chamados</th>
                    <th className="text-left p-3 font-medium">SPED</th>
                    <th className="text-left p-3 font-medium">Acesso</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-muted/20">
                      {/* User info */}
                      <td className="p-3 min-w-[160px]">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {u.is_admin && (
                          <Badge variant="default" className="mt-1 text-xs">Admin</Badge>
                        )}
                      </td>

                      {/* BingoPremier permissions */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={u.can_access_bingo}
                              disabled={u.is_admin}
                              onChange={() => handleToggle(u.id, 'can_access_bingo', u.can_access_bingo)}
                              className="w-3.5 h-3.5"
                            />
                            <span className={u.can_access_bingo ? 'text-foreground' : 'text-muted-foreground'}>
                              {u.can_access_bingo ? 'Com acesso' : 'Sem acesso'}
                            </span>
                          </label>
                          {u.can_access_bingo && !u.is_admin && (
                            <select
                              value={u.bingo_plan || 'free'}
                              onChange={(e) => handleBingoPlan(u.id, e.target.value)}
                              className="h-7 rounded border border-input bg-transparent px-2 text-xs"
                            >
                              {BINGO_PLANS.map((p) => (
                                <option key={p} value={p}>{p.toUpperCase()}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Finance permissions */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={u.can_access_finance}
                              disabled={u.is_admin}
                              onChange={() => handleToggle(u.id, 'can_access_finance', u.can_access_finance)}
                              className="w-3.5 h-3.5"
                            />
                            <span className={u.can_access_finance ? 'text-foreground' : 'text-muted-foreground'}>
                              {u.can_access_finance ? 'Com acesso' : 'Sem acesso'}
                            </span>
                          </label>
                          {u.can_access_finance && !u.is_admin && (
                            <select
                              value={u.finance_full_access ? 'full' : 'test'}
                              onChange={(e) => handleFinancePlan(u.id, e.target.value === 'full')}
                              className="h-7 rounded border border-input bg-transparent px-2 text-xs"
                            >
                              <option value="test">Teste (10 mov.)</option>
                              <option value="full">Completo</option>
                            </select>
                          )}
                          {u.can_access_finance && !u.finance_full_access && !u.is_admin && (
                            <span className="text-xs text-muted-foreground">
                              {u.finance_transactions_used}/{u.finance_transaction_limit} usadas
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Chamados permissions */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={u.can_access_chamados}
                              disabled={u.is_admin}
                              onChange={() => handleToggle(u.id, 'can_access_chamados', u.can_access_chamados)}
                              className="w-3.5 h-3.5"
                            />
                            <span className={u.can_access_chamados ? 'text-foreground' : 'text-muted-foreground'}>
                              {u.can_access_chamados ? 'Com acesso' : 'Sem acesso'}
                            </span>
                          </label>
                        </div>
                      </td>

                      {/* SPED permissions */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={u.can_access_sped}
                              disabled={u.is_admin}
                              onChange={() => handleToggle(u.id, 'can_access_sped', u.can_access_sped)}
                              className="w-3.5 h-3.5"
                            />
                            <span className={u.can_access_sped ? 'text-foreground' : 'text-muted-foreground'}>
                              {u.can_access_sped ? 'Com acesso' : 'Sem acesso'}
                            </span>
                          </label>
                          {u.can_access_sped && !u.is_admin && (
                            <select
                              value={u.sped_plan || 'free'}
                              onChange={(e) => handleSpedPlan(u.id, e.target.value)}
                              className="h-7 rounded border border-input bg-transparent px-2 text-xs"
                            >
                              {SPED_PLANS.map((p) => (
                                <option key={p} value={p}>{p.toUpperCase()}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Acesso: IP, último login, app atual */}
                      <td className="p-3 min-w-[140px]">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground" title="IP da máquina">
                            <Globe className="w-3 h-3" />
                            {u.device_ip || '—'}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground" title="Último login">
                            <Clock className="w-3 h-3" />
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground" title="App atual">
                            <Monitor className="w-3 h-3" />
                            {u.current_app ? u.current_app.toUpperCase() : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {u.finance_release_requested && (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                              Liberação solicitada
                            </Badge>
                          )}
                          {!u.is_active && (
                            <Badge variant="destructive" className="text-xs">Inativo</Badge>
                          )}
                          {u.is_active && !u.finance_release_requested && (
                            <Badge variant="secondary" className="text-xs">Ativo</Badge>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {u.finance_release_requested && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handleApprove(u.id)}
                            >
                              <Check className="w-3 h-3" /> Aprovar
                            </Button>
                          )}
                          {!u.finance_full_access && !u.is_admin && u.can_access_finance && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleReset(u.id)}
                              title="Resetar movimentações"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {!u.is_admin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleToggle(u.id, 'is_active', u.is_active)}
                              title={u.is_active ? "Desativar" : "Ativar"}
                            >
                              <span className={`w-3 h-3 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                            </Button>
                          )}
                          {!u.is_admin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(u.id)}
                              title="Excluir usuário"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <UserFormModal
          adminEmail={user.email}
          onClose={() => setShowForm(false)}
          onSaved={loadUsers}
        />
      )}
    </div>
  );
}