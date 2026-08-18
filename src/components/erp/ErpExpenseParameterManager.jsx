import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Settings2, Pencil, CheckCircle2, MapPin, Percent } from "lucide-react";

const empty = {
  name: "",
  operation_id: "",
  cfop_nfe_dentro: "",
  cfop_nfe_fora: "",
  cfop_nfse_dentro: "",
  cfop_nfse_fora: "",
  default_department_ids: [],
  default_account_ids: [],
  credora_account_id: "",
  outras_impostos_account_id: "",
  credit_accounts: [],
  retentions: [],
  is_active: true,
};

const toggle = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];

export default function ErpExpenseParameterManager({ user }) {
  const [items, setItems] = useState([]);
  const [operations, setOperations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, op, d, acc, s] = await Promise.all([
        base44.entities.ErpExpenseParameter.filter({ user_email: user.email }, "-created_date", 200),
        base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 200),
        base44.entities.ErpDepartment.filter({ user_email: user.email, is_active: true }, "name", 500),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
        base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500),
      ]);
      setItems(p); setOperations(op); setDepartments(d); setAccounts(acc); setSuppliers(s);
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
      cfop_nfe_dentro: p.cfop_nfe_dentro || "",
      cfop_nfe_fora: p.cfop_nfe_fora || "",
      cfop_nfse_dentro: p.cfop_nfse_dentro || "",
      cfop_nfse_fora: p.cfop_nfse_fora || "",
      default_department_ids: p.default_department_ids || [],
      default_account_ids: p.default_account_ids || [],
      credora_account_id: p.credora_account_id || "",
      outras_impostos_account_id: p.outras_impostos_account_id || "",
      credit_accounts: (p.credit_accounts || []).map(c => ({ type: c.type, account_id: c.account_id || "" })),
      retentions: (p.retentions || []).map(r => ({ type: r.type || "IRRF", partner_id: r.partner_id || "", account_id: r.account_id || "", rate: r.rate || 0 })),
      is_active: p.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome do parâmetro."); return; }
    setSaving(true);
    try {
      const op = operations.find(o => o.id === form.operation_id);
      const depNames = form.default_department_ids.map(id => departments.find(d => d.id === id)?.name).filter(Boolean);
      const accList = form.default_account_ids.map(id => accounts.find(a => a.id === id)).filter(Boolean);
      const credoraAcc = accounts.find(a => a.id === form.credora_account_id);
      const outrasAcc = accounts.find(a => a.id === form.outras_impostos_account_id);
      const credit_accounts = (form.credit_accounts || []).filter(c => c.type && c.account_id).map(c => {
        const a = accounts.find(x => x.id === c.account_id);
        return { type: c.type, account_id: c.account_id, account_name: a?.name || "", account_code: a?.code || "" };
      });
      const retentions = (form.retentions || []).filter(r => r.type && r.partner_id).map(r => {
        const sup = suppliers.find(s => s.id === r.partner_id);
        const a = accounts.find(x => x.id === r.account_id);
        return { type: r.type, partner_id: r.partner_id, partner_name: sup?.name || "", account_id: r.account_id || "", account_name: a?.name || "", account_code: a?.code || "", rate: Number(r.rate) || 0 };
      });
      const payload = {
        user_email: user.email,
        name: form.name.trim(),
        operation_id: form.operation_id || undefined,
        operation_name: op?.name || undefined,
        cfop_nfe_dentro: form.cfop_nfe_dentro.trim(),
        cfop_nfe_fora: form.cfop_nfe_fora.trim(),
        cfop_nfse_dentro: form.cfop_nfse_dentro.trim(),
        cfop_nfse_fora: form.cfop_nfse_fora.trim(),
        default_department_ids: form.default_department_ids,
        default_department_names: depNames,
        default_account_ids: form.default_account_ids,
        default_account_codes: accList.map(a => a.code),
        default_account_names: accList.map(a => a.name),
        credora_account_id: form.credora_account_id || undefined,
        credora_account_code: credoraAcc?.code || undefined,
        credora_account_name: credoraAcc?.name || undefined,
        outras_impostos_account_id: form.outras_impostos_account_id || undefined,
        outras_impostos_account_code: outrasAcc?.code || undefined,
        outras_impostos_account_name: outrasAcc?.name || undefined,
        credit_accounts,
        retentions,
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
              <th className="p-2 text-left">CFOPs (NF-e / NFS-e)</th>
              <th className="p-2 text-left">Setores / Contas</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400"><Settings2 className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum parâmetro de despesa cadastrado.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2 text-gray-600">{p.operation_name || "—"}</td>
                <td className="p-2 text-xs">
                  <div><span className="text-gray-400">NF-e:</span> <span className="font-mono">{p.cfop_nfe_dentro || "—"}</span> / <span className="font-mono">{p.cfop_nfe_fora || "—"}</span></div>
                  <div><span className="text-gray-400">NFS-e:</span> <span className="font-mono">{p.cfop_nfse_dentro || "—"}</span> / <span className="font-mono">{p.cfop_nfse_fora || "—"}</span></div>
                </td>
                <td className="p-2 text-xs text-gray-600">
                  <div>{(p.default_department_names || []).join(", ") || "—"}</div>
                  <div className="text-gray-400">{(p.default_account_codes || []).map((c, i) => `${c} ${p.default_account_names?.[i] || ""}`).join(", ") || "—"}</div>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-bold flex items-center gap-2"><Settings2 className="w-5 h-5 text-indigo-600" /> {editing ? "Editar" : "Novo"} Parâmetro de Despesas</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-4">
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

              <div className="border rounded-lg p-3 bg-indigo-50/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 mb-2"><MapPin className="w-3.5 h-3.5" /> CFOPs de Entrada (dentro / fora do estado)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500">NF-e — Dentro do Estado</label>
                    <input value={form.cfop_nfe_dentro} onChange={e => setForm(p => ({ ...p, cfop_nfe_dentro: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono" placeholder="ex: 1102, 1949" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500">NF-e — Fora do Estado</label>
                    <input value={form.cfop_nfe_fora} onChange={e => setForm(p => ({ ...p, cfop_nfe_fora: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono" placeholder="ex: 2102, 2949" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500">NFS-e — Dentro do Estado</label>
                    <input value={form.cfop_nfse_dentro} onChange={e => setForm(p => ({ ...p, cfop_nfse_dentro: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono" placeholder="ex: 1305, 1933" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500">NFS-e — Fora do Estado</label>
                    <input value={form.cfop_nfse_fora} onChange={e => setForm(p => ({ ...p, cfop_nfse_fora: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono" placeholder="ex: 2305, 2933" />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-3 bg-emerald-50/40">
                <div className="text-xs font-semibold text-emerald-800 mb-2">Contabilização (contas do lançamento)</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500">Conta Credora (Fornecedores / Impostos a Pagar)</label>
                    <select value={form.credora_account_id} onChange={e => setForm(p => ({ ...p, credora_account_id: e.target.value }))} className="w-full h-8 rounded border border-input bg-white px-2 text-xs">
                      <option value="">Auto (passivo Fornecedores)</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500">Outras de Impostos (sem crédito)</label>
                    <select value={form.outras_impostos_account_id} onChange={e => setForm(p => ({ ...p, outras_impostos_account_id: e.target.value }))} className="w-full h-8 rounded border border-input bg-white px-2 text-xs">
                      <option value="">— (cai na despesa) —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="text-[11px] font-medium text-gray-500 mb-1">Créditos de Impostos (a recuperar) — débito</div>
                <div className="space-y-1.5">
                  {["ICMS", "PIS", "COFINS"].map(type => {
                    const cur = (form.credit_accounts || []).find(c => c.type === type);
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-xs font-medium w-14">{type}</span>
                        <select value={cur?.account_id || ""} onChange={e => {
                          const v = e.target.value;
                          setForm(p => {
                            let list = (p.credit_accounts || []).filter(c => c.type !== type);
                            if (v) list = [...list, { type, account_id: v }];
                            return { ...p, credit_accounts: list };
                          });
                        }} className="flex-1 h-8 rounded border border-input bg-white px-2 text-xs">
                          <option value="">— sem crédito (vai para outras/despesa) —</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Sem crédito configurado, o imposto da nota vai para "Outras de Impostos" (se definida) ou permanece na despesa (rateio).</p>
              </div>

              <div className="border rounded-lg p-3 bg-amber-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Retenções de Serviço (fornecedor + conta credora)</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setForm(p => ({ ...p, retentions: [...(p.retentions || []), { type: "IRRF", partner_id: "", account_id: "", rate: 0 }] }))} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Retenção</Button>
                </div>
                {(form.retentions || []).length === 0 && <p className="text-xs text-gray-400">Nenhuma retenção configurada.</p>}
                {(form.retentions || []).map((r, i) => (
                  <div key={i} className="border rounded-md p-2 mb-1.5 space-y-1.5 bg-white">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <select value={r.type} onChange={e => setForm(p => ({ ...p, retentions: p.retentions.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x) }))} className="col-span-3 h-8 rounded border border-input bg-white px-2 text-xs">
                        {["IRRF", "PIS", "COFINS", "CSLL", "INSS", "ISS"].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select value={r.partner_id} onChange={e => setForm(p => ({ ...p, retentions: p.retentions.map((x, idx) => idx === i ? { ...x, partner_id: e.target.value } : x) }))} className="col-span-8 h-8 rounded border border-input bg-white px-2 text-xs">
                        <option value="">Selecione o fornecedor...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setForm(p => ({ ...p, retentions: p.retentions.filter((_, idx) => idx !== i) }))} className="col-span-1 text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-4 h-4 mx-auto" /></button>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <select value={r.account_id} onChange={e => setForm(p => ({ ...p, retentions: p.retentions.map((x, idx) => idx === i ? { ...x, account_id: e.target.value } : x) }))} className="col-span-10 h-8 rounded border border-input bg-white px-2 text-xs">
                        <option value="">Conta credora da retenção (Impostos a Pagar)...</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                      <input type="number" step="0.01" value={r.rate} onChange={e => setForm(p => ({ ...p, retentions: p.retentions.map((x, idx) => idx === i ? { ...x, rate: Number(e.target.value) || 0 } : x) }))} className="col-span-2 h-8 rounded border border-input px-1 text-right text-xs" placeholder="%" title="Alíquota %" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Setores Padrão ({form.default_department_ids.length})</label>
                  <div className="border rounded-md p-2 max-h-44 overflow-y-auto space-y-1 bg-white">
                    {departments.length === 0 && <p className="text-xs text-gray-400">Nenhum departamento cadastrado.</p>}
                    {departments.map(d => (
                      <label key={d.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                        <input type="checkbox" checked={form.default_department_ids.includes(d.id)} onChange={() => setForm(p => ({ ...p, default_department_ids: toggle(p.default_department_ids, d.id) }))} />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Contas Contábeis Padrão ({form.default_account_ids.length})</label>
                  <div className="border rounded-md p-2 max-h-44 overflow-y-auto space-y-1 bg-white">
                    {accounts.length === 0 && <p className="text-xs text-gray-400">Nenhuma conta analítica cadastrada.</p>}
                    {accounts.map(a => (
                      <label key={a.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                        <input type="checkbox" checked={form.default_account_ids.includes(a.id)} onChange={() => setForm(p => ({ ...p, default_account_ids: toggle(p.default_account_ids, a.id) }))} />
                        <span className="font-mono text-xs">{a.code}</span> {a.name}
                      </label>
                    ))}
                  </div>
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