import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Plus, Check, RotateCcw, Trash2, Users, Bell } from "lucide-react";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import UserFormModal from "@/components/portal/UserFormModal";

export default function PortalAdmin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getPortalUser());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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

  const handleApprove = async (userId) => {
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'approveRelease',
        admin_email: user.email,
        user_id: userId,
      });
      await loadUsers();
    } catch (e) {
      alert("Erro ao aprovar liberação");
    }
  };

  const handleReset = async (userId) => {
    if (!confirm("Resetar contagem de movimentações deste usuário?")) return;
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'resetTransactions',
        admin_email: user.email,
        user_id: userId,
      });
      await loadUsers();
    } catch (e) {
      alert("Erro ao resetar");
    }
  };

  const handleToggle = async (userId, field, currentValue) => {
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'updateUser',
        admin_email: user.email,
        user_id: userId,
        data: { [field]: !currentValue },
      });
      await loadUsers();
    } catch (e) {
      alert("Erro ao atualizar usuário");
    }
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-heading">Gerenciar Usuários</h1>
              <p className="text-xs text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Usuários</p>
                <p className="text-lg font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Liberações Pendentes</p>
                <p className="text-lg font-bold">{pendingReleases.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Usuários</h2>
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Novo Usuário
          </Button>
        </div>

        {/* User Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Apps</th>
                    <th className="text-left p-3 font-medium">Finanças</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {u.is_admin && (
                          <Badge variant="default" className="mt-1 text-xs">
                            Admin
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={u.can_access_bingo}
                              disabled={u.is_admin}
                              onChange={() => handleToggle(u.id, 'can_access_bingo', u.can_access_bingo)}
                              className="w-3.5 h-3.5"
                            />
                            Bingo
                          </label>
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={u.can_access_finance}
                              disabled={u.is_admin}
                              onChange={() => handleToggle(u.id, 'can_access_finance', u.can_access_finance)}
                              className="w-3.5 h-3.5"
                            />
                            Finanças
                          </label>
                        </div>
                      </td>
                      <td className="p-3">
                        {u.finance_full_access ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">
                            Acesso Completo
                          </Badge>
                        ) : (
                          <span className="text-xs">
                            {u.finance_transactions_used}/{u.finance_transaction_limit} usadas
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {u.finance_release_requested && (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                              Liberação solicitada
                            </Badge>
                          )}
                          {!u.is_active && (
                            <Badge variant="destructive" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                          {u.is_active && !u.finance_release_requested && (
                            <Badge variant="secondary" className="text-xs">
                              Ativo
                            </Badge>
                          )}
                        </div>
                      </td>
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
                          {!u.finance_full_access && !u.is_admin && (
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