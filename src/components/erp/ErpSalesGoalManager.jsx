import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, Target } from "lucide-react";

const MONTHS = [
  { value: 0, label: "Ano todo" }, { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" }, { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];
const LEVELS = [
  { value: "gerente", label: "Gerente", color: "text-amber-700 bg-amber-100" },
  { value: "supervisor", label: "Supervisor", color: "text-indigo-700 bg-indigo-100" },
  { value: "vendedor", label: "Vendedor", color: "text-emerald-700 bg-emerald-100" },
  { value: "produto", label: "Produto", color: "text-purple-700 bg-purple-100" },
];
const GOAL_TYPES = [
  { value: "valor", label: "Valor (R$)", color: "text-emerald-700 bg-emerald-100" },
  { value: "volume", label: "Volume (quantidade)", color: "text-blue-700 bg-blue-100" },
];

const fmtMoney = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (v) => (Number(v) || 0).toLocaleString("pt-BR");

export default function ErpSalesGoalManager({ user }) {
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [products, setProducts] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [g, t, p, sg] = await Promise.all([
        base44.entities.ErpSalesGoal.filter({ user_email: user.email }, "-year,-month,-created_date", 500),
        base44.entities.ErpSalesTeam.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email, is_active: true }, "name", 500),
        base44.entities.ErpStockSubgroup.filter({ user_email: user.email }, "name", 500),
      ]);
      setItems(g); setTeam(t); setProducts(p); setSubgroups(sg);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => (i.name + " " + (i.owner_name || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (i) => { if (!confirm(`Excluir o objetivo "${i.name}"?`)) return; await base44.entities.ErpSalesGoal.delete(i.id); load(); };

  const sumPct = (i) => (i.distributions || []).reduce((a, r) => a + (Number(r.percent) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar objetivo ou responsável..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Objetivo</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Objetivo</th>
                <th className="p-2 text-left">Período</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Nível</th>
                <th className="p-2 text-left">Responsável</th>
                <th className="p-2 text-right">Meta Total</th>
                <th className="p-2 text-right">% Distrib.</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400"><Target className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum objetivo de vendas cadastrado.</td></tr>
              : filtered.map(i => {
                const lv = LEVELS.find(l => l.value === i.level) || LEVELS[0];
                const gt = GOAL_TYPES.find(g => g.value === i.goal_type) || GOAL_TYPES[0];
                const pct = sumPct(i);
                return (
                  <tr key={i.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2 text-xs">{(MONTHS.find(m => m.value === i.month)?.label || "—") + "/" + (i.year || "—")}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${gt.color}`}>{gt.label}</span></td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${lv.color}`}>{lv.label}</span></td>
                    <td className="p-2">{i.owner_name || "—"}</td>
                    <td className="p-2 text-right font-medium">{i.goal_type === "valor" ? fmtMoney(i.target_value) : fmtNum(i.target_value) + " " + (i.target_unit || "UN")}</td>
                    <td className="p-2 text-right text-xs">{pct.toFixed(0)}%</td>
                    <td className="p-2 text-xs">{i.status}</td>
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

      {showForm && (
        <ErpSalesGoalForm user={user} editing={editing} team={team} products={products} subgroups={subgroups} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}

function ErpSalesGoalForm({ user, editing, team, products, subgroups, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editing?.name || "",
    year: editing?.year || new Date().getFullYear(),
    month: editing?.month ?? 0,
    goal_type: editing?.goal_type || "valor",
    target_value: editing?.target_value || 0,
    target_unit: editing?.target_unit || "UN",
    level: editing?.level || "gerente",
    owner_id: editing?.owner_id || "",
    owner_name: editing?.owner_name || "",
    status: editing?.status || "ativa",
    notes: editing?.notes || "",
  });
  const [distributions, setDistributions] = useState((editing?.distributions || []).map(d => ({ ...d, percent: Number(d.percent) || 0, target_value: Number(d.target_value) || 0, volume: Number(d.volume) || 0 })));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // responsáveis: gerente/supervisor/vendedor (ErpSalesTeam) ou produto (ErpProduct)
  const owners = form.level === "produto"
    ? products.map(p => ({ id: p.id, name: p.name, unit: p.unit }))
    : team.filter(t => t.team_role === form.level);

  const mergeRows = (cands) => {
    setDistributions(prev => {
      const map = {}; prev.forEach(r => { map[r.target_id] = r; });
      return cands.map(c => map[c.target_id] ? { ...map[c.target_id], target_name: c.target_name, target_type: c.target_type } : { target_type: c.target_type, target_id: c.target_id, target_name: c.target_name, percent: 0, target_value: 0, volume: 0 });
    });
  };

  // Auto-gera linhas: gerente → supervisores, supervisor → vendedores,
  // vendedor → subgrupos de estoque
  useEffect(() => {
    if (form.level === "gerente") {
      mergeRows(team.filter(t => t.team_role === "supervisor").map(s => ({ target_type: "supervisor", target_id: s.id, target_name: s.name })));
    } else if (form.level === "supervisor") {
      mergeRows(team.filter(t => t.team_role === "vendedor" && t.supervisor_id === form.owner_id).map(v => ({ target_type: "vendedor", target_id: v.id, target_name: v.name })));
    } else if (form.level === "vendedor") {
      mergeRows(subgroups.map(s => ({ target_type: "subgrupo", target_id: s.id, target_name: s.name })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.level, form.owner_id]);

  const total = Number(form.target_value) || 0;
  const isValor = form.goal_type === "valor";

  const setPct = (idx, pct) => {
    const p = Number(pct) || 0;
    const tv = total * p / 100;
    setDistributions(prev => prev.map((r, i) => i === idx ? { ...r, percent: p, target_value: isValor ? tv : 0, volume: !isValor ? tv : 0 } : r));
  };
  const setTarget = (idx, val) => {
    const v = Number(val) || 0;
    const pct = total > 0 ? v / total * 100 : 0;
    setDistributions(prev => prev.map((r, i) => i === idx ? { ...r, percent: pct, target_value: isValor ? v : 0, volume: !isValor ? v : 0 } : r));
  };
  const removeRow = (idx) => setDistributions(prev => prev.filter((_, i) => i !== idx));

  const sumPct = distributions.reduce((a, r) => a + (Number(r.percent) || 0), 0);

  const onOwner = (id) => {
    const o = owners.find(o => o.id === id);
    setForm(p => ({ ...p, owner_id: id, owner_name: o?.name || "", ...(form.level === "produto" && o?.unit ? { target_unit: o.unit } : {}) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome do objetivo."); return; }
    if (!form.owner_id) { alert(`Selecione o ${form.level} responsável.`); return; }
    if (total <= 0) { alert("Informe a meta total."); return; }
    if (Math.abs(sumPct - 100) > 0.5 && distributions.length > 0) { if (!confirm(`O total distribuído é ${sumPct.toFixed(1)}% (ideal 100%). Salvar mesmo assim?`)) return; }
    setSaving(true);
    const payload = {
      user_email: user.email, name: form.name, year: Number(form.year), month: Number(form.month),
      goal_type: form.goal_type, target_value: total,
      target_unit: !isValor ? form.target_unit : undefined,
      level: form.level, owner_id: form.owner_id, owner_name: form.owner_name,
      distributions: distributions.map(d => ({ target_type: d.target_type, target_id: d.target_id, target_name: d.target_name, percent: Number(d.percent) || 0, target_value: Number(d.target_value) || 0, volume: Number(d.volume) || 0 })),
      status: form.status, notes: form.notes || undefined,
    };
    try {
      if (editing?.id) await base44.entities.ErpSalesGoal.update(editing.id, payload);
      else await base44.entities.ErpSalesGoal.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const distLabel = form.level === "gerente" ? "Distribuição entre Supervisores" : form.level === "supervisor" ? "Distribuição entre Vendedores" : "Distribuição entre Subgrupos de Produtos";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{editing ? "Editar Objetivo de Vendas" : "Novo Objetivo de Vendas"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome do Objetivo *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Meta Q1 2026" /></div>
            <div><Label>Ano *</Label><Input type="number" value={form.year} onChange={e => set("year", e.target.value)} /></div>
            <div><Label>Período</Label>
              <select value={form.month} onChange={e => set("month", Number(e.target.value))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div><Label>Tipo da Meta *</Label>
              <div className="flex gap-2 mt-1">
                {GOAL_TYPES.map(g => (
                  <button key={g.value} type="button" onClick={() => set("goal_type", g.value)} className={`flex-1 py-1.5 rounded-md border text-xs font-medium ${form.goal_type === g.value ? g.color + " border-current" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{g.label}</button>
                ))}
              </div>
            </div>
            <div><Label>{isValor ? "Meta Total (R$) *" : "Meta Total (volume) *"}</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" value={form.target_value} onChange={e => set("target_value", e.target.value)} />
                {!isValor && <Input value={form.target_unit} onChange={e => set("target_unit", e.target.value)} placeholder="UN" className="w-20" />}
              </div>
            </div>
            <div><Label>Nível *</Label>
              <select value={form.level} onChange={e => set("level", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div><Label>Responsável ({form.level}) *</Label>
              <select value={form.owner_id} onChange={e => onOwner(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {owners.length === 0 && <p className="text-xs text-amber-600 mt-1">Cadastre um {form.level} na Equipe de Vendas primeiro.</p>}
            </div>
          </div>

          {form.owner_id && form.level !== "produto" && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">{distLabel}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${Math.abs(sumPct - 100) <= 0.5 ? "text-emerald-700 bg-emerald-100" : "text-amber-700 bg-amber-100"}`}>Total: {sumPct.toFixed(1)}%</span>
              </div>

              {distributions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  Nenhum item para distribuir. Verifique o cadastro da equipe ou dos subgrupos de estoque.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-500 text-xs">
                      <tr>
                        <th className="p-1.5 text-left">{form.level === "vendedor" ? "Subgrupo" : form.level === "gerente" ? "Supervisor" : "Vendedor"}</th>
                        <th className="p-1.5 text-right w-24">% da Meta</th>
                        <th className="p-1.5 text-right w-40">{isValor ? "Meta (R$)" : "Meta (vol.)"}</th>
                        {form.level === "vendedor" && <th className="p-1.5 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {distributions.map((r, idx) => (
                        <tr key={r.target_id} className="border-t">
                          <td className="p-1.5">{r.target_name}</td>
                          <td className="p-1.5 text-right">
                            <input type="number" step="0.01" value={r.percent} onChange={e => setPct(idx, e.target.value)} className="w-20 h-8 rounded border border-input px-2 text-right text-sm" />
                          </td>
                          <td className="p-1.5 text-right">
                            <input type="number" step="0.01" value={isValor ? r.target_value : r.volume} onChange={e => setTarget(idx, e.target.value)} className="w-32 h-8 rounded border border-input px-2 text-right text-sm" />
                          </td>
                          {form.level === "vendedor" && (
                            <td className="p-1.5 text-center"><button type="button" onClick={() => removeRow(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="ativa">Ativa</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
          <div><Label>Observações</Label><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Objetivo"}</Button>
        </div>
      </div>
    </div>
  );
}