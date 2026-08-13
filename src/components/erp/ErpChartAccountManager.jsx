import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, ListTree } from "lucide-react";

const TYPE_OPTS = [
  { value: "ativo", label: "Ativo", color: "text-blue-700 bg-blue-100", nature: "devedora" },
  { value: "passivo", label: "Passivo", color: "text-red-700 bg-red-100", nature: "credora" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido", color: "text-purple-700 bg-purple-100", nature: "credora" },
  { value: "receita", label: "Receita", color: "text-emerald-700 bg-emerald-100", nature: "credora" },
  { value: "despesa", label: "Despesa", color: "text-amber-700 bg-amber-100", nature: "devedora" },
  { value: "compensacao", label: "Compensação", color: "text-gray-700 bg-gray-100", nature: "" },
];
const PROD_COST_TYPES = [
  { value: "insumos", label: "Insumos" },
  { value: "mao_de_obra", label: "Mão de Obra" },
  { value: "ggf", label: "GGF (Gastos Gerais de Fabricação)" },
];

export default function ErpChartAccountManager({ user }) {
  const [items, setItems] = useState([]);
  const [refItems, setRefItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [acc, ref] = await Promise.all([
        base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpChartAccountReferential.filter({ user_email: user.email }, "code", 1000),
      ]);
      setItems(acc); setRefItems(ref);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const sorted = [...items].sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
  const filtered = sorted.filter(i => (i.code + " " + i.name + " " + (i.parent_name || "") + " " + (i.referential_code || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (i) => { if (confirm(`Excluir a conta "${i.code} - ${i.name}"?`)) { await base44.entities.ErpChartAccount.delete(i.id); load(); } };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conta..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} disabled={refItems.length === 0} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Conta</Button>
        {refItems.length === 0 && <span className="text-xs text-amber-600">Importe o Plano Referencial primeiro.</span>}
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Natureza</th>
                <th className="p-2 text-left">Conta Pai</th>
                <th className="p-2 text-left">Plano Referencial</th>
                <th className="p-2 text-left">Custo Produção</th>
                <th className="p-2 text-left">Aceita Lançto.</th><th className="p-2 text-left">Ativa</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400"><ListTree className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma conta cadastrada.</td></tr>
              : filtered.map(i => {
                const t = TYPE_OPTS.find(o => o.value === i.account_type) || TYPE_OPTS[0];
                return (
                  <tr key={i.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono">{i.code}</td>
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span></td>
                    <td className="p-2 text-xs">{i.nature || "—"}</td>
                    <td className="p-2 text-xs">{i.parent_name || "—"}</td>
                    <td className="p-2 text-xs">{i.referential_code ? <span className="font-mono">{i.referential_code}</span> : "—"}{i.referential_name ? <span className="block text-gray-400">{i.referential_name}</span> : null}</td>
                    <td className="p-2 text-xs">{i.participates_production_cost ? <span className="text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">{(PROD_COST_TYPES.find(t => t.value === i.production_cost_type) || {}).label || i.production_cost_type}</span> : <span className="text-gray-400">Não</span>}</td>
                    <td className="p-2 text-xs">{i.accepts_entries ? "Sim" : "Não"}</td>
                    <td className="p-2 text-xs">{i.is_active ? "Sim" : "Não"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                      <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <ErpChartAccountForm user={user} editing={editing} accounts={sorted} refItems={refItems} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ErpChartAccountForm({ user, editing, accounts, refItems, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: editing?.code || "", name: editing?.name || "",
    account_type: editing?.account_type || "ativo", nature: editing?.nature || "devedora",
    parent_id: editing?.parent_id || "", parent_name: editing?.parent_name || "",
    referential_code: editing?.referential_code || "", referential_name: editing?.referential_name || "",
    participates_production_cost: !!editing?.participates_production_cost,
    production_cost_type: editing?.production_cost_type || "insumos",
    accepts_entries: editing?.accepts_entries !== false, is_active: editing?.is_active !== false,
  });
  const [refSearch, setRefSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onType = (t) => { const opt = TYPE_OPTS.find(o => o.value === t); setForm(p => ({ ...p, account_type: t, nature: opt.nature || p.nature })); };
  const onParent = (id) => { const p = accounts.find(a => a.id === id); set("parent_id", id); set("parent_name", p?.name || ""); };
  const onRef = (code) => { const r = refItems.find(r => r.code === code); setForm(p => ({ ...p, referential_code: code, referential_name: r?.name || "" })); };

  const filteredRef = refItems.filter(r => (r.code + " " + r.name).toLowerCase().includes(refSearch.toLowerCase()));

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { alert("Informe código e nome."); return; }
    if (!form.referential_code) { alert("Selecione a conta do Plano Referencial (obrigatório)."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email, code: form.code, name: form.name,
      account_type: form.account_type, nature: form.nature,
      referential_code: form.referential_code, referential_name: form.referential_name,
      participates_production_cost: !!form.participates_production_cost,
      production_cost_type: form.participates_production_cost ? form.production_cost_type : undefined,
      accepts_entries: !!form.accepts_entries, is_active: !!form.is_active,
    };
    if (form.parent_id) { payload.parent_id = form.parent_id; payload.parent_name = form.parent_name; }
    try {
      if (editing?.id) await base44.entities.ErpChartAccount.update(editing.id, payload);
      else await base44.entities.ErpChartAccount.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b"><h2 className="font-bold">{editing ? "Editar Conta" : "Nova Conta do Plano"}</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Código *</Label><Input value={form.code} onChange={e => set("code", e.target.value)} placeholder="1.1.1" /></div>
            <div><Label>Conta Pai (agrupadora)</Label>
              <select value={form.parent_id} onChange={e => onParent(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Sem pai (conta raiz)</option>
                {accounts.filter(a => a.id !== editing?.id).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><Label>Tipo *</Label>
              <select value={form.account_type} onChange={e => onType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div><Label>Natureza</Label>
              <select value={form.nature} onChange={e => set("nature", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="devedora">Devedora</option><option value="credora">Credora</option>
              </select>
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-gray-50">
            <Label className="block mb-1">Plano de Contas Referencial * <span className="text-xs text-gray-400">(obrigatório — Receita/ECD)</span></Label>
            <select value={form.referential_code} onChange={e => onRef(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
              <option value="">Selecione a conta referencial...</option>
              {refItems.map(r => <option key={r.code} value={r.code}>{r.code} - {r.name}</option>)}
            </select>
            {form.referential_code && <p className="text-xs text-gray-500 mt-1">Vinculado: {form.referential_code} — {form.referential_name}</p>}
            {refItems.length === 0 && <p className="text-xs text-amber-600 mt-1">Importe o Plano Referencial na aba "Plano Referencial" antes de cadastrar contas.</p>}
          </div>
          <div className="border rounded-lg p-3 bg-gray-50">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <input type="checkbox" checked={form.participates_production_cost} onChange={e => set("participates_production_cost", e.target.checked)} className="w-4 h-4" />
              Participa dos custos de produção
            </label>
            {form.participates_production_cost && (
              <div>
                <Label>Tipo de custo de produção *</Label>
                <select value={form.production_cost_type} onChange={e => set("production_cost_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm">
                  {PROD_COST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.accepts_entries} onChange={e => set("accepts_entries", e.target.checked)} className="w-4 h-4" /> Aceita lançamentos</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Ativa</label>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}