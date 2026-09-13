import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, ArrowLeftRight } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const fmtMoney = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ErpJournalEntryManager({ user }) {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [j, a, c, s] = await Promise.all([
        base44.entities.ErpJournalEntry.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
        base44.entities.ErpCostCenter.filter({ user_email: user.email }, "code", 200),
        base44.entities.ErpSector.filter({ user_email: user.email, is_active: true }, "name", 500),
      ]);
      setItems(j); setAccounts(a); setCostCenters(c); setSectors(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => (i.number + " " + i.history + " " + (i.document || "")).toLowerCase().includes(search.toLowerCase()));
  const handleDelete = async (i) => { if (confirm(`Excluir lançamento "${i.number}"?`)) { await base44.entities.ErpJournalEntry.delete(i.id); load(); } };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lançamento..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Lançamento</Button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Número</th><th className="p-2 text-left">Data</th><th className="p-2 text-left">Histórico</th>
                <th className="p-2 text-left">Doc.</th><th className="p-2 text-right">Débito</th><th className="p-2 text-right">Crédito</th>
                <th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-400"><ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum lançamento.</td></tr>
              : filtered.map(i => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{i.number}</td>
                  <td className="p-2 text-xs">{fmtDate(i.date)}</td>
                  <td className="p-2">{i.history}</td>
                  <td className="p-2 text-xs">{i.document || "—"}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(i.total_debit)}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(i.total_credit)}</td>
                  <td className="p-2 text-xs">{i.status === "definitivo" ? <span className="text-emerald-700">Definitivo</span> : <span className="text-amber-700">Rascunho</span>}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                    <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <ErpJournalEntryForm user={user} editing={editing} accounts={accounts} costCenters={costCenters} sectors={sectors} nextNumber={items.length + 1} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ErpJournalEntryForm({ user, editing, accounts, costCenters, sectors, nextNumber, onClose, onSaved }) {
  const [form, setForm] = useState({
    number: editing?.number || `LCT ${String(nextNumber).padStart(4, "0")}/${new Date().getFullYear()}`,
    date: (editing?.date || new Date().toISOString()).slice(0, 10),
    history: editing?.history || "",
    document: editing?.document || "",
    cost_center_id: editing?.cost_center_id || "",
    cost_center_name: editing?.cost_center_name || "",
    status: editing?.status || "rascunho",
    notes: editing?.notes || "",
  });
  const [lines, setLines] = useState(editing?.lines?.map(l => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) || [{ account_id: "", account_code: "", account_name: "", debit: 0, credit: 0, complement: "", sector_id: "", sector_name: "" }]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const totalDebit = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((a, l) => a + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const setLine = (idx, patch) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const onAccount = (idx, id) => { const a = accounts.find(a => a.id === id); setLine(idx, { account_id: id, account_code: a?.code || "", account_name: a?.name || "" }); };
  const onSector = (idx, id) => { const s = (sectors || []).find(x => x.id === id); setLine(idx, { sector_id: id || "", sector_name: s?.name || "" }); };
  const addLine = () => setLines(prev => [...prev, { account_id: "", account_code: "", account_name: "", debit: 0, credit: 0, complement: "", sector_id: "", sector_name: "" }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));
  const onCost = (id) => { const c = costCenters.find(c => c.id === id); set("cost_center_id", id); set("cost_center_name", c?.name || ""); };

  const handleSave = async () => {
    if (!form.history.trim()) { alert("Informe o histórico."); return; }
    if (!balanced) { alert("Lançamento não está balanceado (débito ≠ crédito)."); return; }
    const valid = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (valid.length < 2) { alert("Informe ao menos 2 partidas válidas."); return; }
    // Bloqueia contas sintéticas — só é permitido lançar em contas analíticas (accepts_entries: true)
    const sintetica = valid.find(l => !accounts.some(a => a.id === l.account_id));
    if (sintetica) { alert("Não é permitido usar conta sintética no lançamento contábil. Selecione apenas contas analíticas do plano de contas."); return; }
    setSaving(true);
    const payload = {
      user_email: user.email, number: form.number, date: new Date(form.date).toISOString(),
      history: form.history, document: form.document || undefined,
      cost_center_id: form.cost_center_id || undefined, cost_center_name: form.cost_center_name || undefined,
      lines: valid, total_debit: totalDebit, total_credit: totalCredit, status: form.status, notes: form.notes || undefined,
    };
    try {
      if (editing?.id) await base44.entities.ErpJournalEntry.update(editing.id, payload);
      else await base44.entities.ErpJournalEntry.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10"><h2 className="font-bold">{editing ? "Editar Lançamento" : "Novo Lançamento Contábil"}</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Número</Label><Input value={form.number} onChange={e => set("number", e.target.value)} /></div>
            <div><Label>Data *</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
            <div><Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="rascunho">Rascunho</option><option value="definitivo">Definitivo</option>
              </select>
            </div>
            <div className="col-span-2"><Label>Histórico *</Label><Input value={form.history} onChange={e => set("history", e.target.value)} /></div>
            <div><Label>Documento</Label><Input value={form.document} onChange={e => set("document", e.target.value)} /></div>
            <div className="col-span-3"><Label>Centro de Custo</Label>
              <select value={form.cost_center_id} onChange={e => onCost(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Sem centro de custo</option>
                {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold">Partidas (Débito / Crédito)</p>
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1"><Plus className="w-3.5 h-3.5" /> Linha</Button></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs">
                  <tr>
                    <th className="p-1.5 text-left">Conta</th><th className="p-1.5 text-left w-40">Setor</th><th className="p-1.5 text-right w-28">Débito</th><th className="p-1.5 text-right w-28">Crédito</th><th className="p-1.5 text-left">Histórico Compl.</th><th className="p-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1.5">
                        <select value={l.account_id} onChange={e => onAccount(idx, e.target.value)} className="w-full h-8 rounded border border-input px-1 text-xs">
                          <option value="">Selecione...</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <select value={l.sector_id || ""} onChange={e => onSector(idx, e.target.value)} className="w-full h-8 rounded border border-input px-1 text-xs">
                          <option value="">Sem setor</option>
                          {(sectors || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="p-1.5"><input type="number" step="0.01" value={l.debit} onChange={e => setLine(idx, { debit: Number(e.target.value) || 0, credit: 0 })} className="w-24 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                      <td className="p-1.5"><input type="number" step="0.01" value={l.credit} onChange={e => setLine(idx, { credit: Number(e.target.value) || 0, debit: 0 })} className="w-24 h-8 rounded border border-input px-2 text-right text-xs" /></td>
                      <td className="p-1.5"><input value={l.complement} onChange={e => setLine(idx, { complement: e.target.value })} className="w-full h-8 rounded border border-input px-2 text-xs" /></td>
                      <td className="p-1.5 text-center">{lines.length > 1 && <button type="button" onClick={() => removeLine(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-4 mt-2 text-sm">
              <span>Total Débito: <b>{fmtMoney(totalDebit)}</b></span>
              <span>Total Crédito: <b>{fmtMoney(totalCredit)}</b></span>
              <span className={balanced ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{balanced ? "✓ Balanceado" : "✗ Desequilibrado"}</span>
            </div>
          </div>
          <div><Label>Observações</Label><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Lançamento"}</Button>
        </div>
      </div>
    </div>
  );
}