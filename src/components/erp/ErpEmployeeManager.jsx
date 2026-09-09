import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Pencil, Users } from "lucide-react";
import { maskCpf, maskPhone, maskCep, onlyDigits } from "@/lib/brMasks";

const CONTRACT_OPTS = [
  { value: "clt", label: "CLT" },
  { value: "estagiario", label: "Estagiário" },
  { value: "aprendiz", label: "Aprendiz" },
  { value: "intermitente", label: "Intermitente" },
  { value: "diretor", label: "Diretor" },
];


export default function ErpEmployeeManager({ user }) {
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [emp, depts] = await Promise.all([
        base44.entities.ErpEmployee.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpDepartment.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setItems(emp); setDepartments(depts);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(e => [e.name, e.cpf, e.job_title, e.department_name].map(v => String(v ?? "")).join(" ").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Funcionários (Folha de Pagamento)</h2>
        <Button size="sm" onClick={() => setEditing({})} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Funcionário</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CPF, cargo..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">CPF</th><th className="p-2 text-left">Cargo</th><th className="p-2 text-left">Depto</th><th className="p-2 text-left">Admissão</th><th className="p-2 text-right">Salário</th><th className="p-2 text-left">Contrato</th><th className="p-2 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum funcionário cadastrado.</td></tr>
                : filtered.map(e => (
                  <tr key={e.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{e.name}</td>
                    <td className="p-2 font-mono text-xs">{e.cpf || "—"}</td>
                    <td className="p-2">{e.job_title || "—"}</td>
                    <td className="p-2">{e.department_name || "—"}</td>
                    <td className="p-2 text-xs">{(e.admission_date || "").slice(0, 10)}</td>
                    <td className="p-2 text-right">{Number(e.salary_base || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="p-2 text-xs">{(CONTRACT_OPTS.find(c => c.value === e.contract_type) || {}).label || e.contract_type}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button title="Editar" onClick={() => setEditing(e)} className="p-1 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4 text-blue-500" /></button>
                      <button title="Excluir" onClick={async () => { if (confirm(`Excluir "${e.name}"?`)) { await base44.entities.ErpEmployee.delete(e.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <EmployeeForm user={user} editing={editing} departments={departments} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EmployeeForm({ user, editing, departments, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "", cpf: "", pis_pasep: "", rg: "", birth_date: "", sexo: "M",
    ctps_number: "", ctps_series: "", ctps_uf: "", admission_date: "", cbo_code: "",
    job_title: "", department_id: "", department_name: "", contract_type: "clt",
    weekly_hours: 44, salary_base: 0, dependents_count: 0, dependents_irrf: 0,
    bank_code: "", bank_name: "", bank_agency: "", bank_account: "", payment_method: "conta", pix_key: "",
    address: "", city: "", uf: "", zip: "", phone: "", email: "", is_active: true, notes: "",
    ...(editing.id ? editing : {}),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return alert("Informe o nome do funcionário.");
    if (!onlyDigits(form.cpf)) return alert("Informe o CPF.");
    setSaving(true);
    try {
      const dept = departments.find(d => d.id === form.department_id);
      const payload = { ...form, cpf: onlyDigits(form.cpf), pis_pasep: onlyDigits(form.pis_pasep), department_name: dept?.name || "", user_email: user.email };
      if (editing.id) await base44.entities.ErpEmployee.update(editing.id, payload);
      else await base44.entities.ErpEmployee.create(payload);
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{editing.id ? "Editar Funcionário" : "Novo Funcionário"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div><Label>CPF *</Label><Input value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" /></div>
          <div><Label>PIS/PASEP</Label><Input value={form.pis_pasep} onChange={e => set("pis_pasep", e.target.value)} /></div>
          <div><Label>RG</Label><Input value={form.rg} onChange={e => set("rg", e.target.value)} /></div>
          <div><Label>Nascimento</Label><Input type="date" value={(form.birth_date || "").slice(0, 10)} onChange={e => set("birth_date", e.target.value)} /></div>
          <div><Label>Sexo</Label><select value={form.sexo} onChange={e => set("sexo", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
          <div><Label>CTPS Nº</Label><Input value={form.ctps_number} onChange={e => set("ctps_number", e.target.value)} /></div>
          <div><Label>CTPS Série</Label><Input value={form.ctps_series} onChange={e => set("ctps_series", e.target.value)} /></div>
          <div><Label>CTPS UF</Label><Input value={form.ctps_uf} onChange={e => set("ctps_uf", e.target.value)} /></div>
          <div><Label>Admissão *</Label><Input type="date" value={(form.admission_date || "").slice(0, 10)} onChange={e => set("admission_date", e.target.value)} /></div>
          <div><Label>Demissão</Label><Input type="date" value={(form.resignation_date || "").slice(0, 10)} onChange={e => set("resignation_date", e.target.value)} /></div>
          <div><Label>CBO</Label><Input value={form.cbo_code} onChange={e => set("cbo_code", e.target.value)} /></div>
          <div className="col-span-2"><Label>Cargo/Função</Label><Input value={form.job_title} onChange={e => set("job_title", e.target.value)} /></div>
          <div><Label>Departamento</Label><select value={form.department_id} onChange={e => set("department_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"><option value="">—</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><Label>Tipo de Contrato</Label><select value={form.contract_type} onChange={e => set("contract_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">{CONTRACT_OPTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          <div><Label>Jornada (h/sem)</Label><Input type="number" value={form.weekly_hours} onChange={e => set("weekly_hours", e.target.value)} /></div>
          <div><Label>Salário Base (R$) *</Label><Input type="number" step="0.01" value={form.salary_base} onChange={e => set("salary_base", e.target.value)} /></div>
          <div><Label>Dependentes (qtd)</Label><Input type="number" value={form.dependents_count} onChange={e => set("dependents_count", e.target.value)} /></div>
          <div><Label>Dep. p/ IRRF</Label><Input type="number" value={form.dependents_irrf} onChange={e => set("dependents_irrf", e.target.value)} /></div>
          <div><Label>Banco (cód)</Label><Input value={form.bank_code} onChange={e => set("bank_code", e.target.value)} /></div>
          <div><Label>Agência</Label><Input value={form.bank_agency} onChange={e => set("bank_agency", e.target.value)} /></div>
          <div><Label>Conta</Label><Input value={form.bank_account} onChange={e => set("bank_account", e.target.value)} /></div>
          <div><Label>Pagamento</Label><select value={form.payment_method} onChange={e => set("payment_method", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"><option value="conta">Conta</option><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option></select></div>
          <div><Label>Telefone</Label><Input value={form.phone} onChange={e => set("phone", maskPhone(e.target.value))} placeholder="(47) 99999-9999" /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div className="col-span-3"><Label>Endereço</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
          <div><Label>Cidade</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
          <div><Label>UF</Label><Input value={form.uf} onChange={e => set("uf", e.target.value)} /></div>
          <div><Label>CEP</Label><Input value={form.zip} onChange={e => set("zip", maskCep(e.target.value))} placeholder="00000-000" /></div>
          <div className="col-span-3"><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          <label className="col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Funcionário ativo (empregado)</label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}