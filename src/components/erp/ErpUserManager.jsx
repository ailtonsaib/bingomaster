import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, Users, X } from "lucide-react";

const ROLE_OPTS = [
  { value: "admin", label: "Administrador", color: "text-red-700 bg-red-100" },
  { value: "operador", label: "Operador", color: "text-blue-700 bg-blue-100" },
  { value: "visualizador", label: "Visualizador", color: "text-gray-700 bg-gray-100" },
];

const USER_TYPE_OPTS = [
  { value: "normal", label: "Normal", color: "text-gray-700 bg-gray-100" },
  { value: "diretor", label: "Diretor", color: "text-purple-700 bg-purple-100" },
  { value: "gerente", label: "Gerente", color: "text-indigo-700 bg-indigo-100" },
  { value: "comprador", label: "Comprador", color: "text-emerald-700 bg-emerald-100" },
];

// Módulos e sub-módulos do ERP (espelha Erp.jsx / módulos)
export const ERP_MODULES = [
  {
    id: "suprimentos", label: "Suprimentos",
    submodules: [
      { id: "almoxarifado", label: "Almoxarifado" },
      { id: "compras", label: "Compras" },
      { id: "solicitacao", label: "Solicitação" },
      { id: "tomada", label: "Tomada de Preço" },
      { id: "manufatura", label: "Manufatura" },
    ],
  },
  {
    id: "comercial", label: "Comercial",
    submodules: [
      { id: "clientes", label: "Clientes" },
      { id: "pedidos", label: "Pedidos e Faturamento" },
      { id: "pdv", label: "PDV" },
      { id: "relatorios", label: "Relatórios de Vendas" },
    ],
  },
  {
    id: "administrativo", label: "Administrativo",
    submodules: [
      { id: "contasPagar", label: "Contas a Pagar" },
      { id: "contasReceber", label: "Contas a Receber" },
      { id: "caixaBanco", label: "Caixa e Banco" },
      { id: "contasBancarias", label: "Contas Bancárias" },
      { id: "contabilidade", label: "Contabilidade" },
      { id: "custos", label: "Custos" },
      { id: "patrimonial", label: "Patrimonial" },
      { id: "fiscal", label: "Fiscal" },
    ],
  },
  {
    id: "gerencial", label: "Gerencial",
    submodules: [
      { id: "dashboard", label: "Dashboard" },
      { id: "empresas", label: "Empresas" },
      { id: "departamentos", label: "Departamentos" },
      { id: "setores", label: "Setores" },
      { id: "grupos", label: "Grupos de Estoque" },
      { id: "subgrupos", label: "Sub-grupos" },
      { id: "usuarios", label: "Usuários" },
      { id: "operacoes", label: "Operações" },
      { id: "regras", label: "Regras Fiscais" },
    ],
  },
];

export default function ErpUserManager({ user }) {
  const [items, setItems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, secs] = await Promise.all([
        base44.entities.ErpUser.filter({ owner_email: user.email }, "-created_date", 500),
        base44.entities.ErpSector.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setItems(list); setSectors(secs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(u => (u.name + " " + u.email + " " + (u.department_name || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (u) => { if (!confirm(`Excluir usuário "${u.name}"?`)) return; await base44.entities.ErpUser.delete(u.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4" /> Novo Usuário</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Nome</th><th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Setor</th>
                <th className="p-2 text-left">Papel</th><th className="p-2 text-center">Módulos</th>
                <th className="p-2 text-left">Ativo</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum usuário.</td></tr>
              : filtered.map(u => {
                const tp = USER_TYPE_OPTS.find(o => o.value === u.user_type) || USER_TYPE_OPTS[0];
                const rl = ROLE_OPTS.find(o => o.value === u.role) || ROLE_OPTS[1];
                const modCount = (u.allowed_modules || []).length;
                return (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{u.name}</td>
                    <td className="p-2 text-gray-600">{u.email}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${tp.color}`}>{tp.label}</span></td>
                    <td className="p-2">{u.department_name || "—"}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${rl.color}`}>{rl.label}</span></td>
                    <td className="p-2 text-center">{modCount}</td>
                    <td className="p-2">{u.is_active ? <span className="text-emerald-600 text-xs">Sim</span> : <span className="text-gray-400 text-xs">Não</span>}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(u); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(u)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpUserForm user={user} editing={editing} sectors={sectors} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}

function ErpUserForm({ user, editing, sectors, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editing?.name || "",
    email: editing?.email || "",
    password_hash: editing?.password_hash || "",
    role: editing?.role || "operador",
    user_type: editing?.user_type || "normal",
    department_id: editing?.department_id || "",
    department_name: editing?.department_name || "",
    phone: editing?.phone || "",
    is_active: editing?.is_active !== false,
    allowed_modules: editing?.allowed_modules || [],
    allowed_submodules: editing?.allowed_submodules || [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const onSector = (id) => { const s = sectors.find(s => s.id === id); setForm(prev => ({ ...prev, department_id: id, department_name: s?.name || "" })); };

  const toggleModule = (modId) => set("allowed_modules", form.allowed_modules.includes(modId)
    ? form.allowed_modules.filter(m => m !== modId)
    : [...form.allowed_modules, modId]);

  const toggleSub = (subId) => set("allowed_submodules", form.allowed_submodules.includes(subId)
    ? form.allowed_submodules.filter(s => s !== subId)
    : [...form.allowed_submodules, subId]);

  const toggleAllSubOfModule = (mod, checked) => {
    const subIds = mod.submodules.map(s => s.id);
    set("allowed_submodules", checked
      ? Array.from(new Set([...form.allowed_submodules, ...subIds]))
      : form.allowed_submodules.filter(s => !subIds.includes(s)));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { alert("Informe nome e email."); return; }
    setSaving(true);
    const payload = {
      owner_email: user.email, name: form.name, email: form.email,
      role: form.role, user_type: form.user_type,
      department_id: form.department_id || undefined, department_name: form.department_name || undefined,
      phone: form.phone || undefined, is_active: !!form.is_active,
      allowed_modules: form.allowed_modules, allowed_submodules: form.allowed_submodules,
    };
    if (form.password_hash) payload.password_hash = form.password_hash;
    try {
      if (editing?.id) await base44.entities.ErpUser.update(editing.id, payload);
      else await base44.entities.ErpUser.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{editing ? "Editar Usuário" : "Novo Usuário"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><Label>Email *</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Senha</Label><Input type="password" value={form.password_hash} onChange={e => set("password_hash", e.target.value)} placeholder={editing ? "Manter (em branco)" : ""} /></div>
            <div><Label>Tipo de Usuário</Label>
              <select value={form.user_type} onChange={e => set("user_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {USER_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div><Label>Papel (sistema)</Label>
              <select value={form.role} onChange={e => set("role", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {ROLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Setor *</Label>
              <select value={form.department_id} onChange={e => onSector(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          </div>

          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="text-sm font-semibold mb-2">Módulos e Sub-módulos permitidos</p>
            <div className="space-y-2">
              {ERP_MODULES.map(mod => {
                const modOn = form.allowed_modules.includes(mod.id);
                const subOn = mod.submodules.filter(s => form.allowed_submodules.includes(s.id));
                const allSub = subOn.length === mod.submodules.length;
                return (
                  <div key={mod.id} className="border rounded-lg p-2 bg-white">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={modOn} onChange={() => toggleModule(mod.id)} className="w-4 h-4" /> {mod.label}
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={allSub} onChange={e => toggleAllSubOfModule(mod, e.target.checked)} className="w-3.5 h-3.5" /> Todos os sub-módulos
                      </label>
                    </div>
                    {modOn && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-2 pl-6">
                        {mod.submodules.map(s => (
                          <label key={s.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <input type="checkbox" checked={form.allowed_submodules.includes(s.id)} onChange={() => toggleSub(s.id)} className="w-3.5 h-3.5" /> {s.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {!modOn && subOn.length > 0 && <p className="text-[10px] text-amber-600 mt-1 pl-6">{subOn.length} sub-módulo(s) sem o módulo ativo</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Usuário ativo</label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Usuário"}</Button>
        </div>
      </div>
    </div>
  );
}