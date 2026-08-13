import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, ClipboardList, X } from "lucide-react";
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
  const [departments, setDepartments] = useState([]);
  const [myUser, setMyUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, prods, depts, users] = await Promise.all([
        base44.entities.ErpRequisition.filter({ user_email: user.email }, "-request_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpDepartment.filter({ user_email: user.email }, "-created_date", 200),
        base44.entities.ErpUser.filter({ owner_email: user.email, email: user.email }),
      ]);
      setItems(list); setProducts(prods); setDepartments(depts);
      setMyUser(users.length > 0 ? users[0] : null);
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
          user={user} requisition={editing} products={products} departments={departments} myUser={myUser}
          onClose={() => setShowForm(false)} onSaved={load}
        />
      )}
    </div>
  );
}

function ErpRequisitionForm({ user, requisition, products, departments, myUser, onClose, onSaved }) {
  const defaultDept = myUser?.department_id || "";
  const defaultDeptName = myUser?.department_name || "";
  const [form, setForm] = useState({
    number: requisition?.number || genOrderNumber("SC"),
    request_date: requisition?.request_date || new Date().toISOString().slice(0, 10),
    request_type: requisition?.request_type || "compra_material",
    department_id: requisition?.department_id || defaultDept,
    department_name: requisition?.department_name || defaultDeptName,
    requested_by: requisition?.requested_by || user.name || "",
    priority: requisition?.priority || "media",
    status: requisition?.status || "aberta",
    notes: requisition?.notes || "",
    items: requisition?.items || [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const onDept = (id) => {
    const d = departments.find(d => d.id === id);
    setForm(prev => ({ ...prev, department_id: id, department_name: d?.name || "" }));
  };

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
      if (p) { items[i].product_name = p.name; items[i].unit = p.unit; items[i].unit_price = p.cost_price || p.sale_price || 0; }
    }
    if (field === "item_type" && value === "cadastrado") { items[i].product_id = ""; items[i].product_name = ""; items[i].description = ""; }
    if (field === "item_type" && value === "novo") { items[i].product_id = ""; items[i].description = ""; }
    if (["quantity", "unit_price"].includes(field)) items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    return { ...prev, items };
  });

  const total = form.items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const handleSave = async () => {
    if (!form.items.length) { alert("Adicione ao menos um item."); return; }
    if (!form.department_id) { alert("Selecione o setor."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email, number: form.number, request_date: new Date(form.request_date).toISOString(),
      request_type: form.request_type, department_id: form.department_id, department_name: form.department_name,
      requested_by: form.requested_by || undefined, priority: form.priority, status: form.status,
      items: form.items, total_estimate: total, notes: form.notes || undefined,
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
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Setor *</Label>
              <select value={form.department_id} onChange={e => onDept(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {myUser && <p className="text-[10px] text-gray-400 mt-0.5">Vinculado ao seu cadastro: {myUser.department_name || "—"}</p>}
            </div>
            <div><Label>Solicitante</Label><Input value={form.requested_by} onChange={e => set("requested_by", e.target.value)} /></div>
            <div><Label>Prioridade</Label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

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
                <div className={isServico ? "col-span-5" : "col-span-4"}><Label className="text-[10px]">{isServico ? "Serviço" : it.item_type === "cadastrado" ? "Produto" : "Material (descrição)"}</Label>
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
                <div className="col-span-2"><Label className="text-[10px]">Vlr. unit.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-2"><Label className="text-[10px]">Total</Label><p className="h-8 flex items-center font-medium">{fmtMoney(it.total)}</p></div>
                <div className="col-span-1"><button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
            <div className="flex justify-end p-2 bg-gray-50 border-t text-sm"><span className="mr-3 text-gray-500">Total estimado:</span><b>{fmtMoney(total)}</b></div>
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
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Solicitação"}</Button>
        </div>
      </div>
    </div>
  );
}