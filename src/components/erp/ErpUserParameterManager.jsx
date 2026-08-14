import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, SlidersHorizontal, Check } from "lucide-react";

export default function ErpUserParameterManager({ user }) {
  const [params, setParams] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, us, secs, accs] = await Promise.all([
        base44.entities.ErpUserParameter.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpUser.filter({ owner_email: user.email }, "name", 500),
        base44.entities.ErpSector.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, account_type: "despesa" }, "code", 5000),
      ]);
      setParams(list); setUsers(us); setDepartments(secs); setAccounts(accs);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = params.filter(p => (p.erp_user_name + " " + (p.erp_user_email || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (p) => {
    if (!confirm(`Excluir parâmetros de "${p.erp_user_name}"?`)) return;
    await base44.entities.ErpUserParameter.delete(p.id);
    load();
  };

  const deptName = (id) => departments.find(d => d.id === id)?.name || "—";
  const accLabel = (id) => {
    const a = accounts.find(a => a.id === id);
    return a ? `${a.code} — ${a.name}` : "—";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4" /> Novo Parâmetro</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Usuário</th>
                <th className="p-2 text-left">Setores Permitidos</th>
                <th className="p-2 text-left">Contas Contábeis Permitidas</th>
                <th className="p-2 text-left">Ativo</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400"><SlidersHorizontal className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum parâmetro cadastrado.</td></tr>
              : filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50 align-top">
                  <td className="p-2">
                    <div className="font-medium">{p.erp_user_name}</div>
                    <div className="text-xs text-gray-500">{p.erp_user_email}</div>
                  </td>
                  <td className="p-2 text-xs">
                    {(p.allowed_department_ids || []).length === 0
                      ? <span className="text-gray-400">Nenhum</span>
                      : (p.allowed_department_ids || []).map((id, i) => (
                          <span key={i} className="inline-block mr-1 mb-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{deptName(id)}</span>
                        ))
                    }
                  </td>
                  <td className="p-2 text-xs">
                    {(p.allowed_account_ids || []).length === 0
                      ? <span className="text-gray-400">Nenhuma</span>
                      : (p.allowed_account_ids || []).map((id, i) => (
                          <span key={i} className="inline-block mr-1 mb-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">{accLabel(id)}</span>
                        ))
                    }
                  </td>
                  <td className="p-2 text-xs">{p.is_active ? "Sim" : "Não"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                    <button onClick={() => handleDelete(p)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpUserParameterForm
          user={user} editing={editing} users={users} departments={departments} accounts={accounts}
          onClose={() => setShowForm(false)} onSaved={load}
        />
      )}
    </div>
  );
}

function ErpUserParameterForm({ user, editing, users, departments, accounts, onClose, onSaved }) {
  const [form, setForm] = useState({
    erp_user_id: editing?.erp_user_id || "",
    erp_user_name: editing?.erp_user_name || "",
    erp_user_email: editing?.erp_user_email || "",
    allowed_department_ids: editing?.allowed_department_ids || [],
    allowed_account_ids: editing?.allowed_account_ids || [],
    is_active: editing?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const onUser = (id) => {
    const u = users.find(u => u.id === id);
    setForm(p => ({ ...p, erp_user_id: id, erp_user_name: u?.name || "", erp_user_email: u?.email || "" }));
  };

  const toggleDept = (id) => {
    setForm(p => {
      const has = p.allowed_department_ids.includes(id);
      return { ...p, allowed_department_ids: has ? p.allowed_department_ids.filter(x => x !== id) : [...p.allowed_department_ids, id] };
    });
  };
  const toggleAcc = (id) => {
    setForm(p => {
      const has = p.allowed_account_ids.includes(id);
      return { ...p, allowed_account_ids: has ? p.allowed_account_ids.filter(x => x !== id) : [...p.allowed_account_ids, id] };
    });
  };
  const selectAllDepts = () => setForm(p => ({ ...p, allowed_department_ids: departments.map(d => d.id) }));
  const clearDepts = () => setForm(p => ({ ...p, allowed_department_ids: [] }));
  const selectAllAccs = () => setForm(p => ({ ...p, allowed_account_ids: accounts.map(a => a.id) }));
  const clearAccs = () => setForm(p => ({ ...p, allowed_account_ids: [] }));

  const handleSave = async () => {
    if (!form.erp_user_id) { alert("Selecione o usuário."); return; }
    setSaving(true);
    const deptNames = form.allowed_department_ids.map(id => departments.find(d => d.id === id)?.name).filter(Boolean);
    const accObjs = form.allowed_account_ids.map(id => accounts.find(a => a.id === id)).filter(Boolean);
    const payload = {
      user_email: user.email,
      erp_user_id: form.erp_user_id,
      erp_user_name: form.erp_user_name,
      erp_user_email: form.erp_user_email,
      allowed_department_ids: form.allowed_department_ids,
      allowed_department_names: deptNames,
      allowed_account_ids: form.allowed_account_ids,
      allowed_account_codes: accObjs.map(a => a.code),
      allowed_account_names: accObjs.map(a => a.name),
      is_active: !!form.is_active,
    };
    try {
      if (editing?.id) await base44.entities.ErpUserParameter.update(editing.id, payload);
      else await base44.entities.ErpUserParameter.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold text-purple-800">Parâmetros de Usuário</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label>Usuário *</Label>
            <select value={form.erp_user_id} onChange={e => onUser(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">Selecione...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ""}</option>)}
            </select>
          </div>

          <div className="border rounded-lg">
            <div className="flex items-center justify-between p-2 bg-blue-50 border-b">
              <span className="text-sm font-semibold text-blue-800">Setores Permitidos ({form.allowed_department_ids.length})</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={selectAllDepts} className="h-7 text-xs">Todos</Button>
                <Button size="sm" variant="outline" onClick={clearDepts} className="h-7 text-xs">Limpar</Button>
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto p-2 grid grid-cols-2 gap-1">
              {departments.length === 0 ? <p className="text-xs text-gray-400 p-2">Nenhum setor cadastrado.</p>
              : departments.map(d => {
                const checked = form.allowed_department_ids.includes(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => toggleDept(d.id)} className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs text-left ${checked ? "bg-blue-100 border-blue-400 text-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>{checked && <Check className="w-3 h-3 text-white" />}</span>
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border rounded-lg">
            <div className="flex items-center justify-between p-2 bg-emerald-50 border-b">
              <span className="text-sm font-semibold text-emerald-800">Contas Contábeis Permitidas ({form.allowed_account_ids.length})</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={selectAllAccs} className="h-7 text-xs">Todas</Button>
                <Button size="sm" variant="outline" onClick={clearAccs} className="h-7 text-xs">Limpar</Button>
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-2 space-y-1">
              {accounts.length === 0 ? <p className="text-xs text-gray-400 p-2">Nenhuma conta analítica cadastrada.</p>
              : accounts.map(a => {
                const checked = form.allowed_account_ids.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleAcc(a.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-xs text-left ${checked ? "bg-emerald-100 border-emerald-400 text-emerald-800" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-emerald-600 border-emerald-600" : "border-gray-300"}`}>{checked && <Check className="w-3 h-3 text-white" />}</span>
                    <span className="font-mono">{a.code}</span>
                    <span className="truncate">{a.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            Parâmetro ativo
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-purple-700 hover:bg-purple-800">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}