import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Settings2, Pencil, CheckCircle2 } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const empty = {
  name: "",
  operation_id: "",
  cfop_entrada: "",
  cfop_entrada_servico: "",
  default_department_id: "",
  default_account_id: "",
  is_active: true,
};

export default function ErpExpenseParameterManager({ user }) {
  const [items, setItems] = useState([]);
  const [operations, setOperations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, op, d, acc] = await Promise.all([
        base44.entities.ErpExpenseParameter.filter({ user_email: user.email }, "-created_date", 200),
        base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
        base44.entities.ErpDepartment.filter({ user_email: user.email, is_active: true }, "name", 500),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
      ]);
      setItems(p); setOperations(op); setDepartments(d); setAccounts(acc);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => (i.name || "").toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      operation_id: p.operation_id || "",
      cfop_entrada: p.cfop_entrada || "",
      cfop_entrada_servico: p.cfop_entrada_servico || "",
      default_department_id: p.default_department_id || "",
      default_account_id: p.default_account_id || "",
      is_active: p.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome do parâmetro."); return; }
    setSaving(true);
    try {
      const op = operations.find(o => o.id === form.operation_id);
      const dep = departments.find(d => d.id === form.default_department_id);
      const acc = accounts.find(a => a.id === form.default_account_id);
      const payload = {
        user_email: user.email,
        name: form.name.trim(),
        operation_id: form.operation_id || undefined,
        operation_name: op?.name || undefined,
        cfop_entrada: form.cfop_entrada.trim(),
        cfop_entrada_servico: form.cfop_entrada_servico.trim(),
        default_department_id: form.default_department_id || undefined,
        default_department_name: dep?.name || undefined,
        default_account_id: form.default_account_id || undefined,
        default_account_code: acc?.code || undefined,
        default_account_name: acc?.name || undefined,
        is_active: form.is_active,
      };
      if (editing) await base44.entities.ErpExpenseParameter.update(editing.id, payload);
      else await base44.entities.ErpExpenseParameter.create(payload);
      setShowForm(false); load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (p) => {
    if (!confirm(`Excluir o parâmetro "${p.name}"?`)) return;
    await base44.entities.ErpExpenseParameter.delete(p.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar parâmetro..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Novo Parâmetro</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr>
              <th className="p-2 text-left">Nome</th><th className="p-2 text-left">Operação</th>
              <th className="p-2 text-left">CFOP Entrada</th><th className="p-2 text-left">CFOP Serviço</th>
              <th className="p-2 text-left">Setor/Conta Padrão</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400"><Settings2 className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum parâmetro de despesa cadastrado.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2 text-gray-600">{p.operation_name || "—"}</td>
                <td className="p-2 font-mono text-xs">{p.cfop_entrada || "—"}</td>
                <td className="p-2 font-mono text-xs">{p.cfop_entrada_servico || "—"}</td>
                <td className="p-2 text-xs text-gray-600">
                  {p.default_department_name || "—"} / {p.default_account_code ? `${p.default_account_code} ${p.default_account_name}` : "—"}
                </td>
                <td className="p-2">{p.is_active !== false ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <span className="text-xs text-gray-400">inativo</span>}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-600" /></button>
                  <button onClick={() => handleDelete(p)} className="p-1 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-bold flex items-center gap-2"><Settings2 className="w-5 h-5 text-indigo-600" /> {editing ? "Editar" : "Novo"} Parâmetro de Despesas</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Nome *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm" placeholder="Ex: Despesa Padrão, Despesa Operacional..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Operação de Entrada (opcional)</label>
                <select value={form.operation_id} onChange={e => setForm(p => ({ ...p, operation_id: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Nenhuma</option>
                  {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">CFOP Entrada (NF-e)</label>
                  <input value={form.cfop_entrada} onChange={e => setForm(p => ({ ...p, cfop_entrada: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono" placeholder="ex: 1102, 2102, 1949" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">CFOP Serviço (NFS-e)</label>
                  <input value={form.cfop_entrada_servico} onChange={e => setForm(p => ({ ...p, cfop_entrada_servico: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono" placeholder="ex: 1305, 2305, 1933" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Setor Padrão (opcional)</label>
                  <select value={form.default_department_id} onChange={e => setForm(p => ({ ...p, default_department_id: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Nenhum</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Conta Contábil Padrão (opcional)</label>
                  <select value={form.default_account_id} onChange={e => setForm(p => ({ ...p, default_account_id: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">Nenhuma</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                Parâmetro ativo
              </label>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}