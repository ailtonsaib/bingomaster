import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2, Loader2, PieChart } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";
import { maskMoney, parseMoney } from "@/lib/brMasks";

const MONTH_OPTS = [
  { value: 0, label: "Ano todo" },
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
  { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];
const monthLabel = (m) => MONTH_OPTS.find(o => o.value === Number(m))?.label || "—";

export default function ErpBudgetManager({ user }) {
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, d, s] = await Promise.all([
        base44.entities.ErpBudget.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpDepartment.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpSector.filter({ user_email: user.email }, "name", 500),
      ]);
      setItems(b); setDepartments(d.filter(x => x.is_active !== false)); setSectors(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(it =>
    [it.name, it.category, it.department_name, it.sector_name, String(it.year)]
      .map(v => String(v ?? "")).join(" ").toLowerCase().includes(search.toLowerCase()));

  const del = async (it) => {
    if (!confirm(`Excluir o orçamento "${it.name}"?`)) return;
    await base44.entities.ErpBudget.delete(it.id);
    load();
  };

  const sectorCell = (it) => {
    if (it.allocation_mode === "setor") return it.sector_name || "—";
    const allocs = it.sector_allocations || [];
    if (!allocs.length) return "—";
    return <span title={allocs.map(a => `${a.sector_name}: ${a.percent}% = ${fmtMoney(a.value)}`).join(" • ")} className="text-xs text-gray-600 flex items-center gap-1"><PieChart className="w-3 h-3 text-purple-500" />{allocs.length} setor(es)</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar orçamento, departamento, setor..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Orçamento</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Orçamento</th><th className="p-2 text-left">Ano</th><th className="p-2 text-left">Mês</th>
                <th className="p-2 text-left">Categoria</th><th className="p-2 text-left">Departamento</th><th className="p-2 text-left">Setor</th>
                <th className="p-2 text-right">Planejado</th><th className="p-2 text-left">Ativo</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhum orçamento cadastrado.</td></tr>
              ) : filtered.map(it => (
                <tr key={it.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{it.name}</td>
                  <td className="p-2">{it.year}</td>
                  <td className="p-2 text-xs">{monthLabel(it.month)}</td>
                  <td className="p-2 text-xs">{it.category || "—"}</td>
                  <td className="p-2">{it.department_name || "—"}</td>
                  <td className="p-2">{sectorCell(it)}</td>
                  <td className="p-2 text-right">{fmtMoney(Number(it.planned_value) || 0)}</td>
                  <td className="p-2 text-xs">{it.is_active !== false ? "Sim" : "Não"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(it); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => del(it)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpBudgetForm
          user={user}
          departments={departments}
          sectors={sectors}
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function ErpBudgetForm({ user, departments, sectors, editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editing?.name || "", year: editing?.year || new Date().getFullYear(),
    month: editing?.month ?? 0, category: editing?.category || "",
    allocation_mode: editing?.allocation_mode || "departamento",
    department_id: editing?.department_id || "", sector_id: editing?.sector_id || "",
    planned_value: editing?.planned_value ? maskMoney(editing.planned_value) : "", is_active: editing?.is_active !== false,
    notes: editing?.notes || "",
  });
  const [rates, setRates] = useState(() => {
    const r = {};
    (editing?.sector_allocations || []).forEach(a => { r[a.sector_id] = Number(a.percent) || 0; });
    return r;
  });
  const [saving, setSaving] = useState(false);

  const deptSectors = sectors.filter(s => s.department_id === form.department_id && s.is_active !== false);
  const totalPct = deptSectors.reduce((s, sec) => s + (Number(rates[sec.id]) || 0), 0);
  const planned = parseMoney(form.planned_value);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const onDeptChange = (v) => { setForm(p => ({ ...p, department_id: v, sector_id: "" })); setRates({}); };
  const distributeEven = () => {
    if (!deptSectors.length) return;
    const r = {};
    deptSectors.forEach(s => { r[s.id] = +(100 / deptSectors.length).toFixed(2); });
    setRates(r);
  };

  const save = async () => {
    if (!String(form.name).trim()) return alert("Informe o nome do orçamento.");
    if (!form.year) return alert("Informe o ano.");
    const dept = departments.find(d => d.id === form.department_id);
    if (!dept) return alert("Selecione o departamento (do cadastro gerencial).");
    let sectorAllocations = [], sectorId = "", sectorName = "";
    if (form.allocation_mode === "departamento") {
      if (deptSectors.length) {
        if (Math.abs(totalPct - 100) > 0.01) return alert(`O rateio entre os setores deve somar 100% (atual: ${totalPct}%).`);
        sectorAllocations = deptSectors
          .filter(s => Number(rates[s.id]) > 0)
          .map(s => ({ sector_id: s.id, sector_name: s.name, percent: Number(rates[s.id]), value: +(planned * Number(rates[s.id]) / 100).toFixed(2) }));
      }
    } else {
      const sector = sectors.find(s => s.id === form.sector_id);
      if (!sector) return alert("Selecione o setor (do cadastro gerencial).");
      sectorId = sector.id; sectorName = sector.name;
    }
    setSaving(true);
    try {
      const payload = {
        user_email: user.email, ...form,
        year: Number(form.year), month: Number(form.month), planned_value: planned,
        department_id: dept.id, department_name: dept.name,
        sector_id: sectorId, sector_name: sectorName,
        sector_allocations: sectorAllocations,
      };
      if (editing?.id) await base44.entities.ErpBudget.update(editing.id, payload);
      else await base44.entities.ErpBudget.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{editing ? "Editar Orçamento" : "Novo Orçamento"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 flex gap-6 border rounded-lg p-2.5 bg-gray-50">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.allocation_mode === "departamento"} onChange={() => set("allocation_mode", "departamento")} />
              Por Departamento <span className="text-xs text-gray-500">(rateia para os setores por %)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.allocation_mode === "setor"} onChange={() => set("allocation_mode", "setor")} />
              Por Setor <span className="text-xs text-gray-500">(valor direto do setor)</span>
            </label>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600">Nome do Orçamento *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-600">Ano *</Label>
              <Input type="number" value={form.year} onChange={e => set("year", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Mês</Label>
              <select value={Number(form.month)} onChange={e => set("month", Number(e.target.value))} className="w-full h-9 rounded-md border border-input bg-white px-2 text-sm mt-1">
                {MONTH_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600">Departamento (cadastro gerencial) *</Label>
            <select value={form.department_id} onChange={e => onDeptChange(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.code ? d.code + " — " : ""}{d.name}</option>)}
            </select>
          </div>
          {form.allocation_mode === "setor" ? (
            <div>
              <Label className="text-xs font-medium text-gray-600">Setor *</Label>
              <select value={form.sector_id} onChange={e => set("sector_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
                <option value="">Selecione...</option>
                {sectors.filter(s => s.department_id === form.department_id && s.is_active !== false).map(s => <option key={s.id} value={s.id}>{s.code ? s.code + " — " : ""}{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-medium text-gray-600">Valor Planejado (departamento) *</Label>
              <Input inputMode="decimal" placeholder="0,00" value={form.planned_value} onChange={e => set("planned_value", maskMoney(e.target.value))} className="mt-1 text-right" />
            </div>
          )}
          {form.allocation_mode === "setor" && (
            <div>
              <Label className="text-xs font-medium text-gray-600">Valor Planejado (setor) *</Label>
              <Input inputMode="decimal" placeholder="0,00" value={form.planned_value} onChange={e => set("planned_value", maskMoney(e.target.value))} className="mt-1 text-right" />
            </div>
          )}

          <div>
            <Label className="text-xs font-medium text-gray-600">Categoria / Conta</Label>
            <Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Código/nome da conta contábil" className="mt-1" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} /> Ativo
            </label>
          </div>

          {form.allocation_mode === "departamento" && (
            <div className="col-span-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-600">Rateio por Setor (%) — {deptSectors.length} setor(es) do departamento</Label>
                <Button variant="outline" size="sm" onClick={distributeEven} disabled={!deptSectors.length}>Distribuir igualmente</Button>
              </div>
              {deptSectors.length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">Nenhum setor vinculado a este departamento no cadastro gerencial — o orçamento ficará apenas no departamento.</p>
              ) : (
                <>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 text-gray-500 text-xs">
                        <tr><th className="p-2 text-left">Setor</th><th className="p-2 text-right w-28">% Rateio</th><th className="p-2 text-right w-32">Valor Calculado</th></tr>
                      </thead>
                      <tbody>
                        {deptSectors.map(s => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">{s.code ? s.code + " — " : ""}{s.name}</td>
                            <td className="p-2 text-right">
                              <input type="number" min="0" max="100" step="0.01" value={rates[s.id] ?? ""} onChange={e => setRates(r => ({ ...r, [s.id]: e.target.value }))} className="w-24 h-8 rounded-md border border-input px-2 text-sm text-right" />
                            </td>
                            <td className="p-2 text-right font-medium">{fmtMoney(+(planned * (Number(rates[s.id]) || 0) / 100).toFixed(2))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className={`text-xs mt-1 font-medium ${Math.abs(totalPct - 100) <= 0.01 ? "text-emerald-600" : "text-red-600"}`}>
                    Total do rateio: {totalPct}% {Math.abs(totalPct - 100) <= 0.01 ? "✓" : "(deve somar 100%)"}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Observações</Label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-md border border-input px-3 py-2 text-sm mt-1" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}