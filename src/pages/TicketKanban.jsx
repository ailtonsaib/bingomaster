import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, LogOut, Settings, Loader2, Search, AlertTriangle, Lock, BarChart3 } from "lucide-react";
import { getTicketUser, clearTicketUser } from "@/lib/ticketSession";
import KanbanBoard from "@/components/tickets/KanbanBoard";
import TicketForm from "@/components/tickets/TicketForm";
import TicketDetailModal from "@/components/tickets/TicketDetailModal";
import ClientDashboard from "@/components/tickets/ClientDashboard";

export default function TicketKanban() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getTicketUser());
  const isRequester = user?.role === "requester";
  const isAgent = user?.role === "agent";
  const canManage = !isRequester && !isAgent;
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [types, setTypes] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [modules, setModules] = useState([]);
  const [submodules, setSubmodules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [companyPlan, setCompanyPlan] = useState(null);
  const [showDashboard, setShowDashboard] = useState(isRequester);

  const loadData = useCallback(async () => {
    if (!user) { navigate("/chamados"); return; }
    setLoading(true);
    try {
      const [txRes, usersRes, typesRes, priRes, modRes, subModRes, planRes] = await Promise.all([
        base44.functions.invoke('ticketSystem', { operation: 'getTickets', company_id: user.company_id, user_role: user.role }),
        base44.functions.invoke('ticketSystem', { operation: 'getUsers', company_id: user.company_id, user_role: user.role }),
        base44.functions.invoke('ticketSystem', { operation: 'getTypes' }),
        base44.functions.invoke('ticketSystem', { operation: 'getPriorities' }),
        base44.functions.invoke('ticketSystem', { operation: 'getModules' }),
        base44.functions.invoke('ticketSystem', { operation: 'getSubModules' }),
        base44.functions.invoke('ticketSystem', { operation: 'getCompanyPlan', company_id: user.company_id, user_role: user.role }),
      ]);
      setTickets(txRes.data.tickets || []);
      setUsers(usersRes.data.users || []);
      setTypes(typesRes.data.types || []);
      setPriorities(priRes.data.priorities || []);
      setModules(modRes.data.modules || []);
      setSubmodules(subModRes.data.submodules || []);
      setCompanyPlan(planRes.data);
    } catch (e) { console.error("Erro:", e); }
    setLoading(false);
  }, [user, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = () => { clearTicketUser(); navigate("/chamados"); };

  const handleCreate = async (formData) => {
    try {
      await base44.functions.invoke('ticketSystem', { operation: 'createTicket', ...formData });
      setShowForm(false);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Erro ao criar chamado";
      alert(msg);
      throw err;
    }
  };

  const handleMove = async (ticketId, newStatus, direction) => {
    await base44.functions.invoke('ticketSystem', { operation: 'moveTicket', ticket_id: ticketId, new_status: newStatus, direction, moved_by_id: user.id, moved_by_name: user.name });
    await loadData();
  };

  const handleTransfer = async (ticketId, assignedToId, assignedToName) => {
    await base44.functions.invoke('ticketSystem', { operation: 'transferTicket', ticket_id: ticketId, assigned_to_id: assignedToId, assigned_to_name: assignedToName, moved_by_id: user.id, moved_by_name: user.name });
    await loadData();
    setSelectedTicket(null);
  };

  const handleDelete = async (ticketId) => {
    await base44.functions.invoke('ticketSystem', { operation: 'deleteTicket', ticket_id: ticketId });
    setSelectedTicket(null);
    await loadData();
  };

  const filtered = tickets.filter((t) => {
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && t.type_id !== filterType) return false;
    if (filterPriority && t.priority_id !== filterPriority) return false;
    if (filterAssignee && t.assigned_to_id !== filterAssignee) return false;
    return true;
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
            {companyPlan?.company?.logo_url && (
              <img src={companyPlan.company.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-contain border border-border bg-card shrink-0" />
            )}
            <div>
              <h1 className="text-lg font-bold font-heading">Central de Chamados</h1>
              <p className="text-xs text-muted-foreground">
                {user.role === "system_admin" ? "Todas as Empresas" : user.company_name} · {user.name}
                {user.role === "system_admin" && <span className="ml-1 text-primary">· Admin do Sistema</span>}
                {user.role === "company_admin" && <span className="ml-1 text-primary">· Admin da Empresa</span>}
                {isAgent && <span className="ml-1 text-primary">· Atendente</span>}
                {isRequester && <span className="ml-1 text-primary">· Cliente</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {companyPlan && !companyPlan.company?.ticket_full_access && (
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${companyPlan.limit_reached ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {companyPlan.limit_reached ? <Lock className="w-3 h-3 inline mr-1" /> : <AlertTriangle className="w-3 h-3 inline mr-1" />}
                {companyPlan.ticket_count}/{companyPlan.company?.ticket_limit ?? 10} chamados
              </span>
            )}
            {companyPlan && companyPlan.company?.ticket_full_access && (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Plano Completo · {companyPlan.ticket_count} chamados
              </span>
            )}
            {(user.role === "system_admin" || user.role === "company_admin" || user.role === "admin") && <Button variant="outline" size="sm" onClick={() => navigate("/chamados/admin")} className="gap-2"><Settings className="w-4 h-4" /> <span className="hidden sm:inline">Cadastrar Clientes e Usuários</span></Button>}
            <Button variant={showDashboard ? "default" : "outline"} size="sm" onClick={() => setShowDashboard((v) => !v)} className="gap-2"><BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span></Button>
            <Button size="sm" onClick={() => setShowForm(true)} disabled={companyPlan?.limit_reached} className="gap-2"><Plus className="w-4 h-4" /> Novo Chamado</Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
        {/* Filters */}
        {!isRequester && (
          <div className="px-4 pb-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[150px] max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input className="w-full h-9 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm" placeholder="Buscar chamado..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Todos os tipos</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="">Todas as prioridades</option>
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="">Todos os responsáveis</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {companyPlan?.limit_reached && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">
            Limite de {companyPlan.company?.ticket_limit ?? 10} chamados atingido no plano Free. Contate o administrador para liberar acesso completo.
          </p>
        </div>
      )}

      {showDashboard && (
        <div className="p-4 pb-0">
          <ClientDashboard tickets={tickets} />
        </div>
      )}

      <div className="p-4">
        <KanbanBoard tickets={filtered} onMove={canManage ? handleMove : undefined} onTicketClick={setSelectedTicket} readOnly={isRequester || isAgent} />
      </div>

      {showForm && (
        <TicketForm users={users} types={types} priorities={priorities} modules={modules} submodules={submodules} currentUser={user} isRequester={isRequester} onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          users={users}
          currentUser={user}
          onMove={canManage ? handleMove : undefined}
          onTransfer={canManage ? handleTransfer : undefined}
          onDelete={canManage ? handleDelete : undefined}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}