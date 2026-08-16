import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, ClipboardList, X, AlertTriangle, PieChart } from "lucide-react";
import { genOrderNumber, fmtMoney, fmtDate } from "@/lib/erpUtils";

const STATUS = {
  aberta: { label: "Aberta", color: "text-blue-700 bg-blue-100" },
  aprovada: { label: "Aprovada", color: "text-amber-700 bg-amber-100" },
  reprovada: { label: "Reprovada", color: "text-red-700 bg-red-100" },
  atendida: { label: "Atendida", color: "text-emerald-700 bg-emerald-100" },
};

const TYPE = {
  compra_material: { label: "Compra de Material", color: "text-indigo-700 bg-indigo-100" },
  almoxarifado: { label: "Material p/ Almoxarifado", color: "text-cyan-700 bg-cyan-100" },
  servico: { label: "Serviço", color: "text-purple-700 bg-purple-100" },
};

const PRIORITY = {
  baixa: { label: "Baixa", color: "text-gray-700 bg-gray-100" },
  media: { label: "Média", color: "text-amber-700 bg-amber-100" },
  alta: { label: "Alta", color: "text-red-700 bg-red-100" },
};

export default function ErpRequisitionPanel({ user }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [departments, setDepartments] = useState([]); // setores (ErpSector) — mesmo nome por compatibilidade
  const [accounts, setAccounts] = useState([]);
  const [myUser, setMyUser] = useState(null);
  const [userParam, setUserParam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, prods, depts, users, accs] = await Promise.all([
        base44.entities.ErpRequisition.filter({ user_email: user.email }, "-request_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpSector.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpUser.filter({ owner_email: user.email, email: user.email }),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true }, "code", 5000),
      ]);
      setItems(list); setProducts(prods); setDepartments(depts); setAccounts(accs);
      const me = users.length > 0 ? users[0] : null;
      setMyUser(me);
      if (me) {
        try {
          const params = await base44.entities.ErpUserParameter.filter({ user_email: user.email, erp_user_id: me.id });
          setUserParam(params.length > 0 ? params[0] : null);
        } catch (e) { setUserParam(null); }
      } else {
        setUserParam(null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const okT = typeFilter === "all" || o.request_type === typeFilter;
    const t = (o.number + " " + (o.department_name || "") + " " + (o.requested_by || "")).toLowerCase();
    return okS && okT && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => { if (!confirm(`Excluir solicitação "${o.number}"?`)) return; await base44.entities.ErpRequisition.delete(o.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar solicitação..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os tipos</option>
          {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Solicitação</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Número</th><th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Setor</th><th className="p-2 text-left">Solicitante</th>
                <th className="p-2 text-left">Data</th><th className="p-2 text-right">Itens</th>
                <th className="p-2 text-right">Total Est.</th>
                <th className="p-2 text-left">Prioridade</th><th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-gray-400"><ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma solicitação.</td></tr>
              : filtered.map(o => {
                const st = STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                const tp = TYPE[o.request_type] || { label: o.request_type, color: "text-gray-700 bg-gray-100" };
                const pr = PRIORITY[o.priority] || { label: o.priority, color: "text-gray-700 bg-gray-100" };
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{o.number}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${tp.color}`}>{tp.label}</span></td>
                    <td className="p-2">{o.department_name || "—"}</td>
                    <td className="p-2">{o.requested_by || "—"}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.request_date)}</td>
                    <td className="p-2 text-right">{o.items?.length || 0}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.total_estimate)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${pr.color}`}>{pr.label}</span></td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(o); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(o)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpRequisitionForm
          user={user} requisition={editing} products={products} departments={departments}
          accounts={accounts} myUser={myUser} userParam={userParam}
          onClose={() => setShowForm(false)} onSaved={load}
        />
      )}
    </div>
  );
}

function ErpRequisitionForm({ user, requisition, products, departments, accounts, myUser, userParam, onClose, onSaved }) {
  // Departamentos e contas permitidos ao usuário (via parâmetro). Sem parâmetro => todos.
  const allowedDepts = userParam && (userParam.allowed_department_ids || []).length > 0
    ? departments.filter(d => userParam.allowed_department_ids.includes(d.id))
    : departments;
  const allowedAccounts = userParam && (userParam.allowed_account_ids || []).length > 0
    ? accounts.filter(a => userParam.allowed_account_ids.includes(a.id))
    : accounts;

  const buildDefaultApportionments = () => {
    // Se editando, usa os rateios existentes
    if (requisition?.apportionments && requisition.apportionments.length > 0) return requisition.apportionments.map(a => ({ ...a }));
    // Se só tem 1 setor => já traz o setor pré-preenchido (mesmo com várias contas)
    if (allowedDepts.length === 1 && !requisition?.id) {
      const onlyDept = allowedDepts[0];
      const onlyAccount = allowedAccounts.length === 1 ? allowedAccounts[0] : null;
      return [{
        department_id: onlyDept.id, department_name: onlyDept.name,
        account_id: onlyAccount?.id || "", account_code: onlyAccount?.code || "", account_name: onlyAccount?.name || "",
        rateio_type: "percent", percent: onlyAccount ? 100 : 0, value: 0,
      }];
    }
    // Se só tem 1 conta => já traz a conta pré-preenchida (mesmo com vários setores)
    if (allowedAccounts.length === 1 && allowedDepts.length > 1 && !requisition?.id) {
      const onlyAccount = allowedAccounts[0];
      return [{
        department_id: "", department_name: "",
        account_id: onlyAccount.id, account_code: onlyAccount.code, account_name: onlyAccount.name,
        rateio_type: "percent", percent: 0, value: 0,
      }];
    }
    return [];
  };

  const [form, setForm] = useState({
    number: requisition?.number || genOrderNumber("SC"),
    request_date: requisition?.request_date || new Date().toISOString().slice(0, 10),
    request_type: requisition?.request_type || "compra_material",
    requested_by: requisition?.requested_by || user.name || "",
    priority: requisition?.priority || "media",
    status: requisition?.status || "aberta",
    notes: requisition?.notes || "",
    items: requisition?.items || [],
    apportionments: buildDefaultApportionments(),
    rateio_type: requisition?.apportionments?.[0]?.rateio_type || "percent",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const isServico = form.request_type === "servico";

  const addItem = () => setForm(prev => ({
    ...prev,
    items: [...prev.items, {
      item_type: isServico ? "servico" : "cadastrado",
      product_id: "", product_name: "", description: "", quantity: 1, unit: "UN", unit_price: 0, total: 0,
    }],
  }));
  const removeItem = (i) => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(prev => {
    const items = [...prev.items]; items[i] = { ...items[i], [field]: value };
    if (field === "product_id") {
      const p = products.find(p => p.id === value);
      if (p) { items[i].product_name = p.name; items[i].unit = p.unit; }
    }
    if (field === "item_type" && value === "cadastrado") { items[i].product_id = ""; items[i].product_name = ""; items[i].description = ""; }
    if (field === "item_type" && value === "novo") { items[i].product_id = ""; items[i].description = ""; }
    if (["quantity", "unit_price"].includes(field)) items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    return { ...prev, items };
  });

  const total = form.items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  // ---- Rateio ----
  const addApportionment = () => setForm(prev => ({
    ...prev,
    apportionments: [...prev.apportionments, {
      department_id: "", department_name: "", account_id: "", account_code: "", account_name: "",
      rateio_type: prev.rateio_type, percent: 0, value: 0,
    }],
  }));
  const removeApportionment = (i) => setForm(prev => ({ ...prev, apportionments: prev.apportionments.filter((_, idx) => idx !== i) }));
  const updateApportionment = (i, field, value) => setForm(prev => {
    const aps = [...prev.apportionments]; aps[i] = { ...aps[i], [field]: value };
    if (field === "department_id") {
      const d = allowedDepts.find(d => d.id === value);
      aps[i].department_name = d?.name || "";
    }
    if (field === "account_id") {
      const a = allowedAccounts.find(a => a.id === value);
      aps[i].account_code = a?.code || "";
      aps[i].account_name = a?.name || "";
    }
    if (field === "rateio_type") {
      aps[i].rateio_type = value;
      aps[i].percent = value === "percent" ? aps[i].percent : 0;
      aps[i].value = value === "value" ? aps[i].value : 0;
    }
    return { ...prev, apportionments: aps };
  });
  const setRateioType = (rt) => setForm(prev => ({
    ...prev,
    rateio_type: rt,
    apportionments: prev.apportionments.map(a => ({ ...a, rateio_type: rt, percent: rt === "percent" ? a.percent : 0, value: rt === "value" ? a.value : 0 })),
  }));

  const pctSum = form.apportionments.reduce((s, a) => s + (Number(a.percent) || 0), 0);
  const valSum = form.apportionments.reduce((s, a) => s + (Number(a.value) || 0), 0);
  const pctOk = form.rateio_type === "percent" && Math.abs(pctSum - 100) < 0.01;
  const valOk = form.rateio_type === "value" && Math.abs(valSum - total) < 0.01;
  const rateioValid = form.apportionments.length > 0 && form.apportionments.every(a => a.department_id && a.account_id) && (pctOk || valOk);

  const handleSave = async () => {
    if (!form.items.length) { alert("Adicione ao menos um item."); return; }
    if (!form.apportionments.length) { alert("Informe ao menos um rateio (setor/conta contábil)."); return; }
    if (form.apportionments.some(a => !a.department_id || !a.account_id)) { alert("Preencha setor e conta contábil em todos os rateios."); return; }
    if (!pctOk) { alert(`A soma dos percentuais do rateio deve ser 100% (atual: ${pctSum.toFixed(2)}%).`); return; }
    setSaving(true);
    const deptNames = form.apportionments.map(a => a.department_name).filter(Boolean);
    const payload = {
      user_email: user.email, number: form.number, request_date: new Date(form.request_date).toISOString(),
      request_type: form.request_type,
      department_id: form.apportionments[0].department_id,
      department_name: deptNames.join(", "),
      requested_by: form.requested_by || undefined, priority: form.priority, status: form.status,
      items: form.items, total_estimate: total,
      apportionments: form.apportionments,
      notes: form.notes || undefined,
    };
    try {
      if (requisition?.id) await base44.entities.ErpRequisition.update(requisition.id, payload);
      else await base44.entities.ErpRequisition.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{requisition ? "Editar Solicitação" : "Nova Solicitação"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Número</Label><Input value={form.number} onChange={e => set("number", e.target.value)} /></div>
            <div><Label>Data</Label><Input type="date" value={form.request_date?.slice(0,10)} onChange={e => set("request_date", e.target.value)} /></div>
            <div><Label>Tipo de Solicitação</Label>
              <select value={form.request_type} onChange={e => set("request_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Solicitante</Label><Input value={form.requested_by} onChange={e => set("requested_by", e.target.value)} /></div>
            <div><Label>Prioridade</Label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Rateio Setor / Conta Contábil */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-indigo-50 border-b">
              <span className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5"><PieChart className="w-4 h-4" /> Rateio (Setor / Conta Contábil)</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">Tipo:</span>
                <span className="px-2 py-1 rounded text-xs bg-indigo-600 text-white">%</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5">
              {form.apportionments.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-2">Nenhum rateio. Clique em "Adicionar Rateio".</p>
              )}
              {form.apportionments.map((a, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
                  <div className="col-span-4">
                    <Label className="text-[10px]">Setor</Label>
                    <select value={a.department_id} onChange={e => updateApportionment(i, "department_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                      <option value="">Selecione...</option>
                      {allowedDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <Label className="text-[10px]">Conta Contábil</Label>
                    <select value={a.account_id} onChange={e => updateApportionment(i, "account_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                      <option value="">Selecione...</option>
                      {allowedAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">%</Label>
                    <Input type="number" step="0.01" value={a.percent}
                      onChange={e => updateApportionment(i, "percent", Number(e.target.value))}
                      className="h-8 text-xs" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeApportionment(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <Button size="sm" variant="outline" onClick={addApportionment} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar Rateio</Button>
                <div className="text-xs">
                  <span className={pctOk ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>Soma: {pctSum.toFixed(2)}% {pctOk ? "✓" : "(deve ser 100%)"}</span>
                </div>
              </div>
            </div>
          </div>
          {userParam && (userParam.allowed_department_ids?.length > 0 || userParam.allowed_account_ids?.length > 0) && (
            <p className="text-[11px] text-gray-500 -mt-1">Setores e contas limitados aos seus parâmetros de usuário.</p>
          )}
          {userParam && userParam.allowed_department_ids?.length === 0 && userParam.allowed_account_ids?.length === 0 && (
            <p className="text-[11px] text-amber-600 -mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Seu parâmetro está sem setores/contas liberados. Solicite ao administrador.</p>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
              <span className="text-sm font-semibold">Itens {isServico ? "(Serviços)" : "(Materiais)"}</span>
              <Button size="sm" variant="outline" onClick={addItem} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button>
            </div>
            {form.items.length === 0 ? <p className="p-4 text-center text-sm text-gray-400">Nenhum item.</p> : form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                {!isServico && (
                  <div className="col-span-2"><Label className="text-[10px]">Tipo item</Label>
                    <select value={it.item_type} onChange={e => updateItem(i, "item_type", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                      <option value="cadastrado">Cadastrado</option>
                      <option value="novo">Novo</option>
                    </select>
                  </div>
                )}
                <div className={isServico ? "col-span-9" : "col-span-7"}><Label className="text-[10px]">{isServico ? "Serviço" : it.item_type === "cadastrado" ? "Produto" : "Material (descrição)"}</Label>
                  {(!isServico && it.item_type === "cadastrado") ? (
                    <select value={it.product_id} onChange={e => updateItem(i, "product_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                      <option value="">Selecione...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : (
                    <Input value={isServico ? (it.description || "") : (it.item_type === "novo" ? (it.description || "") : (it.product_name || ""))} onChange={e => updateItem(i, isServico || it.item_type === "novo" ? "description" : "product_name", e.target.value)} className="h-8 text-xs" placeholder={isServico ? "Descreva o serviço" : "Descrição do material"} />
                  )}
                </div>
                <div className="col-span-1"><Label className="text-[10px]">Qtd</Label><Input type="number" step="0.01" value={it.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-1"><Label className="text-[10px]">Un.</Label><Input value={it.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-1"><button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
            <p className="px-2 py-1.5 bg-gray-50 border-t text-xs text-gray-500">Valores não são informados na solicitação — serão definidos na Tomada de Preço.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !rateioValid}>{saving ? "Salvando..." : "Salvar Solicitação"}</Button>
        </div>
      </div>
    </div>
  );
}