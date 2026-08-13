import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, Users, Crown, UserCog, User } from "lucide-react";
import { maskPhone } from "@/lib/brMasks";

const ROLE_OPTS = [
  { value: "gerente", label: "Gerente", color: "text-amber-700 bg-amber-100", icon: Crown },
  { value: "supervisor", label: "Supervisor", color: "text-indigo-700 bg-indigo-100", icon: UserCog },
  { value: "vendedor", label: "Vendedor", color: "text-emerald-700 bg-emerald-100", icon: User },
];

export default function ErpSalesTeamManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ErpSalesTeam.filter({ user_email: user.email }, "-created_date", 500);
      setItems(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const gerentes = items.filter(i => i.team_role === "gerente");
  const supervisores = items.filter(i => i.team_role === "supervisor");

  const filtered = items.filter(i => (i.name + " " + (i.email || "") + " " + (i.supervisor_name || "") + " " + (i.gerente_name || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (i) => { if (!confirm(`Excluir "${i.name}"?`)) return; await base44.entities.ErpSalesTeam.delete(i.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, gerente, supervisor..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Membro</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Função</th>
                <th className="p-2 text-left">Gerente</th>
                <th className="p-2 text-left">Supervisor</th>
                <th className="p-2 text-left">Contato</th>
                <th className="p-2 text-left">Comissão</th>
                <th className="p-2 text-left">Ativo</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum membro da equipe.</td></tr>
              : filtered.map(i => {
                const r = ROLE_OPTS.find(o => o.value === i.team_role) || ROLE_OPTS[2];
                return (
                  <tr key={i.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span></td>
                    <td className="p-2">{i.gerente_name || (i.team_role === "gerente" ? "—" : "—")}</td>
                    <td className="p-2">{i.supervisor_name || "—"}</td>
                    <td className="p-2 text-xs">{i.phone || i.email || "—"}</td>
                    <td className="p-2 text-xs">{i.commission_rate ? i.commission_rate + "%" : "—"}</td>
                    <td className="p-2">{i.is_active ? <span className="text-emerald-600 text-xs">Sim</span> : <span className="text-gray-400 text-xs">Não</span>}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpSalesTeamForm user={user} editing={editing} gerentes={gerentes} supervisores={supervisores} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}

function ErpSalesTeamForm({ user, editing, gerentes, supervisores, onClose, onSaved }) {
  const [form, setForm] = useState({
    team_role: editing?.team_role || "vendedor",
    name: editing?.name || "",
    email: editing?.email || "",
    phone: editing?.phone || "",
    commission_rate: editing?.commission_rate || 0,
    supervisor_id: editing?.supervisor_id || "",
    gerente_id: editing?.gerente_id || "",
    is_active: editing?.is_active !== false,
    notes: editing?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const onRole = (role) => setForm(prev => ({ ...prev, team_role: role, supervisor_id: role === "vendedor" ? prev.supervisor_id : "", gerente_id: role === "supervisor" ? prev.gerente_id : "" }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome."); return; }
    setSaving(true);
    const payload = { user_email: user.email, team_role: form.team_role, name: form.name, email: form.email || undefined, phone: form.phone || undefined, commission_rate: Number(form.commission_rate) || 0, is_active: !!form.is_active, notes: form.notes || undefined };
    if (form.team_role === "vendedor" && form.supervisor_id) {
      payload.supervisor_id = form.supervisor_id;
      const sup = supervisores.find(s => s.id === form.supervisor_id);
      payload.supervisor_name = sup?.name || "";
      if (sup?.gerente_id) { payload.gerente_id = sup.gerente_id; payload.gerente_name = sup.gerente_name || ""; }
    }
    if (form.team_role === "supervisor" && form.gerente_id) {
      payload.gerente_id = form.gerente_id;
      const g = gerentes.find(g => g.id === form.gerente_id);
      payload.gerente_name = g?.name || "";
    }
    try {
      if (editing?.id) await base44.entities.ErpSalesTeam.update(editing.id, payload);
      else await base44.entities.ErpSalesTeam.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{editing ? "Editar Membro" : "Novo Membro da Equipe de Vendas"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <Label>Função *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {ROLE_OPTS.map(r => {
                const Ic = r.icon;
                const on = form.team_role === r.value;
                return (
                  <button key={r.value} type="button" onClick={() => onRole(r.value)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium ${on ? r.color + " border-current" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    <Ic className="w-5 h-5" /> {r.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => set("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div>
            <div><Label>Comissão (%)</Label><Input type="number" step="0.01" value={form.commission_rate} onChange={e => set("commission_rate", e.target.value)} /></div>
          </div>

          {form.team_role === "supervisor" && (
            <div><Label>Atribuir ao Gerente *</Label>
              <select value={form.gerente_id} onChange={e => set("gerente_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione um gerente...</option>
                {gerentes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {gerentes.length === 0 && <p className="text-xs text-amber-600 mt-1">Cadastre um gerente primeiro.</p>}
            </div>
          )}
          {form.team_role === "vendedor" && (
            <div><Label>Atribuir ao Supervisor *</Label>
              <select value={form.supervisor_id} onChange={e => set("supervisor_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione um supervisor...</option>
                {supervisores.map(s => <option key={s.id} value={s.id}>{s.name}{s.gerente_name ? ` (Gerente: ${s.gerente_name})` : ""}</option>)}
              </select>
              {supervisores.length === 0 && <p className="text-xs text-amber-600 mt-1">Cadastre um supervisor primeiro.</p>}
              {form.supervisor_id && (() => { const s = supervisores.find(s => s.id === form.supervisor_id); return s?.gerente_name ? <p className="text-xs text-gray-500 mt-1">Gerente responsável: <b>{s.gerente_name}</b></p> : null; })()}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Membro ativo</label>
          <div><Label>Observações</Label><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}