import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Users, Tag, Flag, Plus, Trash2, LogOut, Loader2, Pencil, Check, X, KanbanSquare, Lock, Unlock, Boxes, Shield } from "lucide-react";
import { ModuleManager } from "@/components/tickets/ModuleManager";
import UserEditModal from "@/components/tickets/UserEditModal";
import CompanyLogoUploader from "@/components/tickets/CompanyLogoUploader";
import { getTicketUser, setTicketUser, clearTicketUser } from "@/lib/ticketSession";
function clearPortalUser() { clearTicketUser(); }

const ROLE_LABELS = { system_admin: "Admin do Sistema", company_admin: "Admin da Empresa", master_agent: "Atendente Master", admin: "Admin da Empresa", agent: "Agente", requester: "Solicitante" };

const maskCNPJ = (v) => v.replace(/\D/g, "").slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");

export default function TicketAdmin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getTicketUser());
  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [companyLogo, setCompanyLogo] = useState(null);

  const handleLogout = () => { clearPortalUser(); navigate("/chamados"); };

  useEffect(() => {
    if (!user) { navigate("/chamados"); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('ticketSystem', { operation: 'getCompanyPlan', company_id: user.company_id, user_role: user.role });
        setCompanyLogo(res.data.company?.logo_url || null);
      } catch (e) {}
      setLoading(false);
    })();
  }, [user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/chamados/kanban")}><ArrowLeft className="w-5 h-5" /></Button>
            <CompanyLogoUploader companyId={user.company_id} logoUrl={companyLogo} onUpdated={setCompanyLogo} size="lg" />
            <div>
              <h1 className="text-lg font-bold font-heading">Administração</h1>
              <p className="text-xs text-muted-foreground">{user.company_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/chamados/kanban")} className="gap-2"><KanbanSquare className="w-4 h-4" /> <span className="hidden sm:inline">Kanban</span></Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex gap-2 mb-6 border-b">
          {[
            { key: "users", label: "Clientes e Usuários", icon: Users },
            { key: "modules", label: "Módulos e Sub-módulos", icon: Boxes },
            { key: "types", label: "Tipos de Chamado", icon: Tag },
            { key: "priorities", label: "Prioridades", icon: Flag },
            ...(user.role === "system_admin" ? [{ key: "companies", label: "Empresas", icon: Building2 }] : []),
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {user.role === "admin" && (
          <Card className="bg-purple-50 border-purple-200 mb-4"><CardContent className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-purple-900">Tornar-se Administrador do Sistema</p>
              <p className="text-xs text-purple-700">Você terá acesso total a todas as empresas e ao painel de planos. Esta ação é exclusiva e não pode ser desfeita.</p>
            </div>
            <PromoteButton user={user} />
          </CardContent></Card>
        )}
        {tab === "users" && <UserManager user={user} />}
        {tab === "modules" && <ModuleManager />}
        {tab === "types" && <TypeManager />}
        {tab === "priorities" && <PriorityManager />}
        {tab === "companies" && <CompanyManager user={user} />}
      </div>
    </div>
  );
}

// ─── USER MANAGER ───
function UserManager({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "Premier@123", role: "agent", company_id: "" });
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('ticketSystem', { operation: 'getUsers', company_id: user.company_id, user_role: user.role });
      setUsers(res.data.users || []);
      if (user.role === "system_admin") {
        const compRes = await base44.functions.invoke('ticketSystem', { operation: 'getCompanies' });
        setCompanies(compRes.data.companies || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.company_id, user.role]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const targetCompanyId = user.role === "system_admin" ? (form.company_id || user.company_id) : user.company_id;
      await base44.functions.invoke('ticketSystem', { operation: 'createUser', ...form, company_id: targetCompanyId, created_by_role: user.role });
      setForm({ name: "", email: "", password: "Premier@123", role: "agent", company_id: "" });
      setShowForm(false);
      await load();
    } catch (e) { alert(e.response?.data?.error || "Erro"); }
    setSaving(false);
  };

  const handleEdit = async (userId, updates) => {
    try {
      await base44.functions.invoke('ticketSystem', { operation: 'updateUser', user_id: userId, ...updates, updated_by_role: user.role });
      setEditingUser(null);
      await load();
    } catch (e) { alert(e.response?.data?.error || "Erro ao atualizar"); }
  };

  const toggleActive = async (u) => {
    await base44.functions.invoke('ticketSystem', { operation: 'updateUser', user_id: u.id, is_active: !u.is_active });
    await load();
  };

  const handleDelete = async (u) => {
    if (!confirm(`Excluir ${u.name}?`)) return;
    await base44.functions.invoke('ticketSystem', { operation: 'deleteUser', user_id: u.id });
    await load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {showForm ? (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Cadastrar Cliente ou Usuário</h3><Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button></div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Solicitante</strong>: cliente que abre chamados (SAC). <strong>Agente</strong>: atendente que resolve chamados. <strong>Atendente Master</strong>: recebe todos os chamados e distribui para os atendentes (um por empresa).{user.role === "system_admin" && " <strong>Admin da Empresa</strong>: acesso total do CNPJ vinculado."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Senha inicial</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>Tipo de Acesso</Label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="requester">Solicitante (Cliente - abre chamados)</option>
              <option value="agent">Agente (Atendente)</option>
              <option value="master_agent">Atendente Master (recebe e distribui chamados)</option>
              {user.role === "system_admin" && <option value="company_admin">Administrador da Empresa</option>}
            </select></div>
            {user.role === "system_admin" && (
              <div className="col-span-2"><Label>Empresa</Label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                <option value="">Selecione uma empresa...</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </select></div>
            )}
          </div>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Criar Usuário"}</Button>
        </CardContent></Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Cadastrar Cliente ou Usuário</Button>
      )}
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}><CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{u.name} {u.id === user.id && <Badge variant="secondary" className="text-[10px] ml-1">Você</Badge>}</p>
              <p className="text-xs text-muted-foreground">{u.email} · {ROLE_LABELS[u.role] || u.role}{user.role === "system_admin" && u.company_name ? ` · ${u.company_name}` : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={u.is_active ? "default" : "secondary"} className="text-xs">{u.is_active ? "Ativo" : "Inativo"}</Badge>
              <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)} title="Editar"><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(u)} title={u.is_active ? "Desativar" : "Ativar"}><Check className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(u)} title="Excluir"><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
      {editingUser && (
        <UserEditModal user={editingUser} currentUser={user} onSave={handleEdit} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}

// ─── TYPE MANAGER ───
function TypeManager() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('ticketSystem', { operation: 'getTypes' }); setTypes(res.data.types || []); } catch (e) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name) return;
    await base44.functions.invoke('ticketSystem', { operation: 'createType', name, description: desc });
    setName(""); setDesc(""); await load();
  };
  const handleDelete = async (id) => { if (confirm("Excluir tipo?")) { await base44.functions.invoke('ticketSystem', { operation: 'deleteType', type_id: id }); await load(); } };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold">Novo Tipo de Chamado</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bug, Suporte, Infraestrutura" /></div>
          <div><Label>Descrição</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <Button onClick={handleCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </CardContent></Card>
      <div className="space-y-2">
        {types.map((t) => (
          <Card key={t.id}><CardContent className="p-3 flex items-center justify-between">
            <div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.description}</p></div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

// ─── PRIORITY MANAGER ───
function PriorityManager() {
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [color, setColor] = useState("blue");

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('ticketSystem', { operation: 'getPriorities' }); setPriorities(res.data.priorities || []); } catch (e) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name) return;
    await base44.functions.invoke('ticketSystem', { operation: 'createPriority', name, level: Number(level), color });
    setName(""); setLevel(1); setColor("blue"); await load();
  };
  const handleDelete = async (id) => { if (confirm("Excluir prioridade?")) { await base44.functions.invoke('ticketSystem', { operation: 'deletePriority', priority_id: id }); await load(); } };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const colors = ["red", "orange", "yellow", "blue", "green"];
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold">Nova Prioridade</h3>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Crítica, Alta, Baixa" /></div>
          <div><Label>Nível (1-5)</Label><Input type="number" min="1" max="5" value={level} onChange={(e) => setLevel(e.target.value)} /></div>
          <div><Label>Cor</Label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={color} onChange={(e) => setColor(e.target.value)}>
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        </div>
        <Button onClick={handleCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </CardContent></Card>
      <div className="space-y-2">
        {priorities.map((p) => (
          <Card key={p.id}><CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full bg-${p.color}-500`} />
              <p className="text-sm font-medium">{p.name}</p>
              <Badge variant="secondary" className="text-xs">Nível {p.level}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

// ─── COMPANY MANAGER ───
function CompanyManager({ user }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {       const res = await base44.functions.invoke('ticketSystem', { operation: 'getCompaniesWithPlan', user_role: user.role }); setCompanies(res.data.companies || []); } catch (e) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleFullAccess = async (c) => {
    setSavingId(c.id);
    try {
      const newAccess = !c.ticket_full_access;
      await base44.functions.invoke('ticketSystem', {
        operation: 'updateCompanyPlan',
        company_id: c.id,
        user_role: user.role,
        ticket_full_access: newAccess,
        ticket_plan: newAccess ? "full" : "free",
      });
      await load();
    } catch (e) { alert("Erro ao atualizar plano"); }
    setSavingId(null);
  };

  const toggleCompanyActive = async (c) => {
    setSavingId(c.id);
    try {
      await base44.functions.invoke('ticketSystem', {
        operation: 'updateCompany',
        company_id: c.id,
        is_active: !c.is_active,
      });
      await load();
    } catch (e) { alert("Erro ao atualizar empresa"); }
    setSavingId(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  return (
    <div className="space-y-2">
      <Card className="bg-amber-50 border-amber-200"><CardContent className="p-3 text-xs text-amber-800">
        Libere "Acesso Completo" para uma empresa permitir abertura de chamados ilimitados. Sem liberação, o plano Free limita em 10 chamados.
      </CardContent></Card>
      {companies.map((c) => {
        const isFull = c.ticket_full_access || c.ticket_plan === "full";
        return (
          <Card key={c.id} className={isFull ? "ring-1 ring-emerald-300" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <CompanyLogoUploader companyId={c.id} logoUrl={c.logo_url} onUpdated={(url) => { c.logo_url = url; setCompanies([...companies]); }} />
                    <p className="text-sm font-medium">{c.razao_social}</p>
                    {isFull
                      ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Acesso Completo</Badge>
                      : <Badge variant="secondary" className="text-[10px]">Free</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">CNPJ: {c.cnpj}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {c.ticket_count ?? 0}{!isFull && <span>/{c.ticket_limit ?? 10}</span>} chamados
                  </span>
                  <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">{c.is_active ? "Ativa" : "Inativa"}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => toggleCompanyActive(c)}
                    disabled={savingId === c.id}
                    title={c.is_active ? "Desativar empresa" : "Ativar empresa"}
                  >
                    {savingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : c.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {c.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant={isFull ? "outline" : "default"}
                    className={`h-8 gap-1.5 ${isFull ? "" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    onClick={() => toggleFullAccess(c)}
                    disabled={savingId === c.id}
                  >
                    {savingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isFull ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {isFull ? "Bloquear" : "Liberar Completo"}
                  </Button>
                </div>
              </div>
              {c.endereco && <p className="text-xs text-muted-foreground mt-1">{c.endereco}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── PROMOTE BUTTON (one-time: admin → system_admin) ───
function PromoteButton({ user }) {
  const [loading, setLoading] = useState(false);
  const handlePromote = async () => {
    if (!confirm("Confirmar: você se tornará o Administrador do Sistema com acesso total. Esta ação não pode ser desfeita.")) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('ticketSystem', { operation: 'promoteSystemAdmin', user_id: user.id });
      setTicketUser(res.data.user);
      window.location.reload();
    } catch (e) {
      alert(e.response?.data?.error || "Erro ao promover");
    }
    setLoading(false);
  };
  return (
    <Button size="sm" onClick={handlePromote} disabled={loading} className="bg-purple-600 hover:bg-purple-700 gap-2 shrink-0">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
      Promover
    </Button>
  );
}