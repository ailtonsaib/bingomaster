import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Pencil, Trash2, X, Shield, Eye, Wrench, Loader2, Search, Users, BadgePercent } from "lucide-react";

// Painéis disponíveis (mesmos IDs do TABS do Workshop)
const AVAILABLE_PANELS = [
  { id: "clients", label: "Clientes e Veículos" },
  { id: "orders", label: "Ordens de Serviço" },
  { id: "finance", label: "Financeiro" },
  { id: "history", label: "Histórico de Manutenção" },
  { id: "report", label: "Relatório Mensal" },
  { id: "service_types", label: "Tipos de Serviço" },
  { id: "mechanics", label: "Mecânicos" },
  { id: "commissions", label: "Comissões" },
  { id: "ranking", label: "Ranking" },
  { id: "productivity", label: "Produtividade" },
  { id: "parts", label: "Peças" },
  { id: "suppliers", label: "Fornecedores" },
  { id: "entries", label: "Entradas" },
];

const ROLES = [
  { id: "admin", label: "Administrador", icon: Shield, desc: "Acesso total a todos os painéis" },
  { id: "operador", label: "Operador", icon: Wrench, desc: "Acesso aos painéis selecionados" },
  { id: "visualizador", label: "Visualizador", icon: Eye, desc: "Apenas visualização" },
];

export default function UserManager({ userEmail }) {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.WorkshopUser.filter({ owner_email: userEmail });
      setUsers(list || []);
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar usuários.", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing({ name: "", email: "", phone: "", password: "", role: "operador", allowed_panels: [], is_active: true, must_change_password: true, can_grant_discount: false, discount_password: "" });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing({ ...u, password: "", discount_password: "", can_grant_discount: u.can_grant_discount || false });
    setModalOpen(true);
  };

  const togglePanel = (panelId) => {
    const current = editing.allowed_panels || [];
    setEditing({
      ...editing,
      allowed_panels: current.includes(panelId)
        ? current.filter(p => p !== panelId)
        : [...current, panelId]
    });
  };

  const handleSave = async () => {
    if (!editing.name || !editing.email) {
      toast({ title: "Campos obrigatórios", description: "Nome e email são obrigatórios.", variant: "destructive" });
      return;
    }
    if (!editing.id && !editing.password) {
      toast({ title: "Senha obrigatória", description: "Defina uma senha para o novo usuário.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing.can_grant_discount && !editing.discount_password && !editing.id) {
        toast({ title: "Senha obrigatória", description: "Defina a senha de autorização de desconto.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const res = await base44.functions.invoke("portalAuth", {
        operation: "saveWorkshopUser",
        owner_email: userEmail,
        id: editing.id || undefined,
        name: editing.name,
        email: editing.email,
        phone: editing.phone || undefined,
        password: editing.password || undefined,
        role: editing.role,
        allowed_panels: editing.allowed_panels,
        is_active: editing.is_active,
        must_change_password: editing.must_change_password,
        can_grant_discount: editing.can_grant_discount,
        discount_password: editing.discount_password || undefined,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast({ title: editing.id ? "Usuário atualizado" : "Usuário criado", description: "Usuário vinculado à sua empresa." });
      setModalOpen(false);
      load();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Falha ao salvar.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (u) => {
    if (!confirm(`Excluir o usuário ${u.name}?`)) return;
    try {
      await base44.entities.WorkshopUser.delete(u.id);
      toast({ title: "Usuário excluído" });
      load();
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" });
    }
  };

  const toggleActive = async (u) => {
    try {
      await base44.entities.WorkshopUser.update(u.id, { is_active: !u.is_active });
      load();
    } catch {
      toast({ title: "Erro", description: "Falha ao alterar status.", variant: "destructive" });
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#1B1C21]">Usuários do Sistema</h2>
          <p className="text-sm text-[#71717A]">Cadastre usuários e defina quais painéis cada um pode acessar.</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]">
          <UserPlus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="pl-9 max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#71717A]">
          <Users className="w-10 h-10 mx-auto mb-3 text-[#D4D4D8]" />
          <p className="text-sm">Nenhum usuário cadastrado. Clique em "Novo Usuário" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(u => {
            const RoleIcon = ROLES.find(r => r.id === u.role)?.icon || Wrench;
            return (
              <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                    <RoleIcon className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1B1C21]">{u.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "visualizador" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>
                        {ROLES.find(r => r.id === u.role)?.label || u.role}
                      </span>
                      {!u.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inativo</span>}
                      {u.can_grant_discount && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                          <BadgePercent className="w-3 h-3" /> Desconto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#71717A]">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      {u.allowed_panels?.length || 0} painéis liberados
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(u)} className="text-xs">
                    {u.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(u)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && editing && (
        <UserFormModal
          editing={editing}
          setEditing={setEditing}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          saving={saving}
          togglePanel={togglePanel}
        />
      )}
    </div>
  );
}

function UserFormModal({ editing, setEditing, onSave, onClose, saving, togglePanel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-[#1B1C21]">{editing.id ? "Editar Usuário" : "Novo Usuário"}</h3>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#1B1C21]"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="João Silva" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="joao@oficina.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={editing.phone || ""} onChange={e => setEditing({ ...editing, phone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>{editing.id ? "Nova senha (opcional)" : "Senha *"}</Label>
              <Input type="password" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} placeholder="••••••" />
            </div>
          </div>

          <div>
            <Label>Papel</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => {
                const Icon = r.icon;
                const active = editing.role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setEditing({ ...editing, role: r.id })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${active ? "border-[#2563EB] bg-blue-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "text-[#2563EB]" : "text-[#A1A1AA]"}`} />
                    <span className={`text-xs font-medium ${active ? "text-[#2563EB]" : "text-[#71717A]"}`}>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {editing.role !== "admin" && (
            <div>
              <Label>Painéis permitidos</Label>
              <p className="text-xs text-[#A1A1AA] mb-2">Selecione quais painéis este usuário poderá acessar.</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border border-gray-100">
                {AVAILABLE_PANELS.map(p => (
                  <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      checked={editing.allowed_panels?.includes(p.id)}
                      onCheckedChange={() => togglePanel(p.id)}
                    />
                    <span className="text-sm text-[#1B1C21]">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {editing.role === "admin" && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              Administradores têm acesso a todos os painéis automaticamente.
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              checked={editing.must_change_password}
              onCheckedChange={v => setEditing({ ...editing, must_change_password: v })}
            />
            <Label className="text-sm font-normal cursor-pointer">Exigir troca de senha no primeiro acesso</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={editing.is_active}
              onCheckedChange={v => setEditing({ ...editing, is_active: v })}
            />
            <Label className="text-sm font-normal cursor-pointer">Usuário ativo</Label>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={editing.can_grant_discount}
                onCheckedChange={v => setEditing({ ...editing, can_grant_discount: v })}
              />
              <Label className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <BadgePercent className="w-4 h-4 text-amber-600" />
                Autorizado a conceder descontos
              </Label>
            </div>
            {editing.can_grant_discount && (
              <div>
                <Label>Senha de Autorização de Desconto {editing.id ? "(deixe em branco para manter)" : "*"}</Label>
                <Input
                  type="password"
                  value={editing.discount_password || ""}
                  onChange={e => setEditing({ ...editing, discount_password: e.target.value })}
                  placeholder="••••••••"
                />
                <p className="text-xs text-amber-700 mt-1">Senha separada usada ao aplicar descontos no caixa.</p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving} className="bg-[#2563EB] hover:bg-[#1D4ED8]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}