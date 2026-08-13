import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, Eye, Layers, ChevronDown, ChevronRight } from "lucide-react";

const GROUP_TYPES = [
  { value: "receita_bruta", label: "Receita Bruta" },
  { value: "deducoes", label: "Deduções" },
  { value: "receita_liquida", label: "Receita Líquida (totalizadora)" },
  { value: "custo_vendas", label: "Custo das Vendas" },
  { value: "resultado_bruto", label: "Resultado Bruto (totalizadora)" },
  { value: "despesas_operacionais", label: "Despesas Operacionais" },
  { value: "resultado_operacional", label: "Resultado Operacional (totalizadora)" },
  { value: "financeiro", label: "Financeiro" },
  { value: "resultado_antes_tributos", label: "Resultado antes dos Tributos (totalizadora)" },
  { value: "tributos", label: "Tributos (IRPJ/CSLL)" },
  { value: "resultado_final", label: "Resultado do Exercício (totalizadora)" },
  { value: "outros", label: "Outros" },
];
const fmtMoney = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ErpDreStructureManager({ user }) {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        base44.entities.ErpDreStructure.filter({ user_email: user.email }, "name", 100),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, is_active: true }, "code", 500),
      ]);
      setItems(d); setAccounts(a);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => (i.name || "").toLowerCase().includes(search.toLowerCase()));
  const handleDelete = async (i) => { if (confirm(`Excluir a estrutura "${i.name}"?`)) { await base44.entities.ErpDreStructure.delete(i.id); load(); } };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estrutura..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Estrutura</Button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr><th className="p-2 text-left">Estrutura</th><th className="p-2 text-left">Linhas</th><th className="p-2 text-left">Contas vinculadas</th><th className="p-2 text-left">Ativa</th><th className="p-2 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400"><Layers className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma estrutura de DRE cadastrada.</td></tr>
            : filtered.map(i => {
              const totalContas = (i.lines || []).reduce((a, l) => a + (l.account_ids || []).length, 0);
              return (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{i.name}</td>
                  <td className="p-2 text-xs">{(i.lines || []).length}</td>
                  <td className="p-2 text-xs">{totalContas}</td>
                  <td className="p-2 text-xs">{i.is_active ? "Sim" : "Não"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setPreview(i)} className="p-1 hover:bg-gray-100 rounded" title="Visualizar DRE"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                    <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showForm && <ErpDreStructureForm user={user} editing={editing} accounts={accounts} onClose={() => setShowForm(false)} onSaved={load} />}
      {preview && <DrePreview structure={preview} accounts={accounts} user={user} onClose={() => setPreview(null)} />}
    </div>
  );
}

function ErpDreStructureForm({ user, editing, accounts, onClose, onSaved }) {
  const [name, setName] = useState(editing?.name || "");
  const [isActive, setIsActive] = useState(editing?.is_active !== false);
  const [lines, setLines] = useState((editing?.lines || []).map(l => ({ ...l, account_ids: l.account_ids || [], account_names: l.account_names || [] })));
  const [openLine, setOpenLine] = useState(null);
  const [accSearch, setAccSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(prev => [...prev, { code: String(prev.length + 1), label: "", group_type: "receita_bruta", operation: "soma", totalizer: false, account_ids: [], account_names: [] }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));
  const setLine = (idx, patch) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const toggleAccount = (idx, acc) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const has = (l.account_ids || []).includes(acc.id);
      const account_ids = has ? l.account_ids.filter(a => a !== acc.id) : [...(l.account_ids || []), acc.id];
      const account_names = has ? l.account_names.filter((_, n) => l.account_ids[n] !== acc.id) : [...(l.account_names || []), acc.name];
      return { ...l, account_ids, account_names };
    }));
  };

  const filteredAccounts = accounts.filter(a => (a.code + " " + a.name).toLowerCase().includes(accSearch.toLowerCase()));

  const handleSave = async () => {
    if (!name.trim()) { alert("Informe o nome da estrutura."); return; }
    setSaving(true);
    const payload = { user_email: user.email, name, lines: lines.map(l => ({ code: l.code, label: l.label, group_type: l.group_type, operation: l.operation, totalizer: !!l.totalizer, account_ids: l.account_ids, account_names: l.account_names })), is_active: isActive };
    try {
      if (editing?.id) await base44.entities.ErpDreStructure.update(editing.id, payload);
      else await base44.entities.ErpDreStructure.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10"><h2 className="font-bold">{editing ? "Editar Estrutura de DRE" : "Nova Estrutura de DRE"}</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome da Estrutura *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: DRE Padrão 2026" /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4" /> Ativa</label></div>
          </div>
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold">Linhas da Estrutura</p><Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1"><Plus className="w-3.5 h-3.5" /> Linha</Button></div>
            {lines.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Adicione linhas à estrutura.</p>}
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="border rounded-lg bg-white p-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={l.code} onChange={e => setLine(idx, { code: e.target.value })} placeholder="Cód." className="col-span-1 h-8 rounded border border-input px-2 text-xs" />
                    <input value={l.label} onChange={e => setLine(idx, { label: e.target.value })} placeholder="Descrição da linha" className="col-span-4 h-8 rounded border border-input px-2 text-sm" />
                    <select value={l.group_type} onChange={e => setLine(idx, { group_type: e.target.value })} className="col-span-3 h-8 rounded border border-input px-1 text-xs">
                      {GROUP_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                    <select value={l.operation} onChange={e => setLine(idx, { operation: e.target.value })} disabled={l.totalizer} className="col-span-2 h-8 rounded border border-input px-1 text-xs">
                      <option value="soma">Soma (+)</option><option value="subtrai">Subtrai (−)</option>
                    </select>
                    <label className="col-span-1 flex items-center gap-1 text-xs" title="Totalizadora (sem contas)"><input type="checkbox" checked={l.totalizer} onChange={e => setLine(idx, { totalizer: e.target.checked })} className="w-4 h-4" /></label>
                    <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeLine(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
                  </div>
                  {!l.totalizer && (
                    <div className="mt-2 border-t pt-2">
                      <button type="button" onClick={() => setOpenLine(openLine === idx ? null : idx)} className="text-xs text-blue-600 flex items-center gap-1">
                        {openLine === idx ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Contas vinculadas ({(l.account_ids || []).length})
                      </button>
                      {(l.account_names || []).length > 0 && openLine !== idx && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{l.account_names.join(", ")}</p>
                      )}
                      {openLine === idx && (
                        <div className="mt-2 border rounded p-2 bg-gray-50">
                          <input value={accSearch} onChange={e => setAccSearch(e.target.value)} placeholder="Filtrar contas..." className="w-full h-7 rounded border border-input px-2 text-xs mb-2" />
                          <div className="max-h-44 overflow-y-auto space-y-0.5">
                            {filteredAccounts.map(a => (
                              <label key={a.id} className="flex items-center gap-2 text-xs py-0.5">
                                <input type="checkbox" checked={(l.account_ids || []).includes(a.id)} onChange={() => toggleAccount(idx, a)} className="w-4 h-4" />
                                <span className="font-mono">{a.code}</span> — {a.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Estrutura"}</Button>
        </div>
      </div>
    </div>
  );
}

function DrePreview({ structure, accounts, user, onClose }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setEntries(await base44.entities.ErpJournalEntry.filter({ user_email: user.email, status: "definitivo" }, "date", 2000)); }
      catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const acctById = useMemo(() => { const m = {}; accounts.forEach(a => { m[a.id] = a; }); return m; }, [accounts]);

  const accountBalance = (id) => {
    const a = acctById[id]; if (!a) return 0;
    let debit = 0, credit = 0;
    entries.filter(e => new Date(e.date).getFullYear() === Number(year)).forEach(e => (e.lines || []).forEach(l => { if (l.account_id === id) { debit += Number(l.debit) || 0; credit += Number(l.credit) || 0; } }));
    return a.nature === "credora" ? credit - debit : debit - credit;
  };

  const computed = useMemo(() => {
    let result = 0;
    return (structure.lines || []).map(l => {
      let val = 0;
      if (!l.totalizer) val = (l.account_ids || []).reduce((s, id) => s + accountBalance(id), 0);
      if (l.operation === "subtrai") val = -val;
      if (!l.totalizer) result += val;
      return { ...l, value: l.totalizer ? result : val };
    });
  }, [structure, accounts, entries, year]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white"><div><h2 className="font-bold">{structure.name}</h2><p className="text-xs text-gray-400">Visualização do DRE</p></div><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Ano:</span>
            <input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-8 w-24 rounded-md border border-input px-2 text-sm" />
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs"><tr><th className="p-2 text-left">Cód.</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Valor</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={3} className="p-4 text-center text-gray-400">Carregando...</td></tr>
                : computed.map((l, i) => (
                  <tr key={i} className={`border-t ${l.totalizer ? "bg-gray-50 font-bold" : ""}`}>
                    <td className="p-2 font-mono text-xs">{l.code}</td>
                    <td className="p-2" style={{ paddingLeft: `${(l.code || "").split(".").length * 8 + 8}px` }}>{l.label}{l.operation === "subtrai" && !l.totalizer ? " (−)" : ""}</td>
                    <td className={`p-2 text-right ${l.value >= 0 ? "" : "text-red-600"}`}>{fmtMoney(l.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}