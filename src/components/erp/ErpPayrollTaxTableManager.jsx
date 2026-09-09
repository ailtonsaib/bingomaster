import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Pencil, ScrollText, Sparkles } from "lucide-react";

const TAX_OPTS = [
  { value: "inss", label: "INSS (empregado)", color: "bg-blue-100 text-blue-700" },
  { value: "irrf", label: "IRRF", color: "bg-amber-100 text-amber-700" },
  { value: "fgts", label: "FGTS", color: "bg-emerald-100 text-emerald-700" },
  { value: "salario_familia", label: "Salário Família", color: "bg-purple-100 text-purple-700" },
  { value: "employer_charges", label: "Encargos do Empregador", color: "bg-red-100 text-red-700" },
];

// Tabelas padrão — 2024 e 2026 (INSS: Portaria Interministerial; IRRF 2026: Lei 15.270/2025)
const DEFAULT_TABLES = [
  {
    name: "INSS 2024", tax_type: "inss", year: 2024, is_default: true, inss_ceiling: 7786.02,
    brackets: [
      { min: 0, max: 1412.00, rate: 7.5, deduction: 0 },
      { min: 1412.00, max: 2666.68, rate: 9, deduction: 0 },
      { min: 2666.68, max: 4000.03, rate: 12, deduction: 0 },
      { min: 4000.03, max: 0, rate: 14, deduction: 0 },
    ],
  },
  {
    name: "IRRF 2024", tax_type: "irrf", year: 2024, is_default: true, dependent_deduction: 189.59,
    brackets: [
      { min: 0, max: 2259.20, rate: 0, deduction: 0 },
      { min: 2259.20, max: 2826.65, rate: 7.5, deduction: 169.44 },
      { min: 2826.65, max: 3751.05, rate: 15, deduction: 381.44 },
      { min: 3751.05, max: 4664.68, rate: 22.5, deduction: 662.77 },
      { min: 4664.68, max: 0, rate: 27.5, deduction: 896.00 },
    ],
  },
  { name: "FGTS 2024", tax_type: "fgts", year: 2024, is_default: true, fgts_rate: 8, brackets: [] },
  { name: "Salário Família 2024", tax_type: "salario_familia", year: 2024, is_default: true, salario_familia_value: 62.04, salario_familia_limit: 1819.26, brackets: [] },
  { name: "Encargos Empregador 2024", tax_type: "employer_charges", year: 2024, is_default: true, inss_employer_rate: 20, fgts_rate: 8, sat_rate: 1, terceiros_rate: 5.8, brackets: [] },
  {
    name: "INSS 2026", tax_type: "inss", year: 2026, is_default: true, inss_ceiling: 8475.55,
    brackets: [
      { min: 0, max: 1621.00, rate: 7.5, deduction: 0 },
      { min: 1621.00, max: 2902.84, rate: 9, deduction: 0 },
      { min: 2902.84, max: 4354.27, rate: 12, deduction: 0 },
      { min: 4354.27, max: 0, rate: 14, deduction: 0 },
    ],
  },
  {
    name: "IRRF 2026 (Lei 15.270/2025)", tax_type: "irrf", year: 2026, is_default: true, dependent_deduction: 189.59,
    irrf_isento_limit: 5000, irrf_reduction_limit: 7350,
    brackets: [
      { min: 0, max: 2428.80, rate: 0, deduction: 0 },
      { min: 2428.80, max: 2826.65, rate: 7.5, deduction: 182.16 },
      { min: 2826.65, max: 3751.05, rate: 15, deduction: 394.16 },
      { min: 3751.05, max: 4664.68, rate: 22.5, deduction: 675.49 },
      { min: 4664.68, max: 0, rate: 27.5, deduction: 908.73 },
    ],
  },
  { name: "FGTS 2026", tax_type: "fgts", year: 2026, is_default: true, fgts_rate: 8, brackets: [] },
  { name: "Salário Família 2026", tax_type: "salario_familia", year: 2026, is_default: true, salario_familia_value: 67.54, salario_familia_limit: 1980.38, brackets: [] },
  { name: "Encargos Empregador 2026", tax_type: "employer_charges", year: 2026, is_default: true, inss_employer_rate: 20, fgts_rate: 8, sat_rate: 1, terceiros_rate: 5.8, brackets: [] },
];

export default function ErpPayrollTaxTableManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await base44.entities.ErpPayrollTaxTable.filter({ user_email: user.email }, "-year", 500)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(t => [t.name, t.tax_type, String(t.year)].map(v => String(v ?? "")).join(" ").toLowerCase().includes(search.toLowerCase()));

  const seedDefaults = async () => {
    if (!confirm("Carregar tabelas de impostos padrão (2024 e 2026 — valores oficiais, incl. isenção do IRRF até R$ 5.000)? As já cadastradas não serão duplicadas.")) return;
    setSeeding(true);
    try {
      const existing = new Set(items.map(t => `${t.year}-${t.tax_type}`));
      const toCreate = DEFAULT_TABLES.filter(t => !existing.has(`${t.year}-${t.tax_type}`)).map(t => ({ ...t, user_email: user.email }));
      if (toCreate.length) await base44.entities.ErpPayrollTaxTable.bulkCreate(toCreate);
      load();
    } catch (e) { alert(e.message); }
    setSeeding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Tabelas de Impostos (INSS / IRRF / FGTS / Encargos)</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={seedDefaults} disabled={seeding} className="gap-1.5"><Sparkles className="w-4 h-4" /> Carregar Tabelas Padrão (2024/2026)</Button>
          <Button size="sm" onClick={() => setEditing({})} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Tabela</Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tabela..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Ano</th><th className="p-2 text-center">Padrão</th><th className="p-2 text-left">Faixas</th><th className="p-2 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma tabela. Clique em "Carregar Tabelas 2024" para começar.</td></tr>
                : filtered.map(t => {
                  const to = TAX_OPTS.find(o => o.value === t.tax_type) || {};
                  return (
                    <tr key={t.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-medium">{t.name}</td>
                      <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${to.color}`}>{to.label || t.tax_type}</span></td>
                      <td className="p-2">{t.year}</td>
                      <td className="p-2 text-center">{t.is_default ? "✓" : "—"}</td>
                      <td className="p-2 text-xs">{(t.brackets || []).length} faixa(s)</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button title="Editar" onClick={() => setEditing(t)} className="p-1 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4 text-blue-500" /></button>
                        <button title="Excluir" onClick={async () => { if (confirm(`Excluir "${t.name}"?`)) { await base44.entities.ErpPayrollTaxTable.delete(t.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <TableForm user={user} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TableForm({ user, editing, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: "", tax_type: "inss", year: new Date().getFullYear(), is_default: true,
    brackets: [], inss_ceiling: 0, fgts_rate: 8, inss_employer_rate: 20, sat_rate: 1, terceiros_rate: 5.8,
    dependent_deduction: 189.59, irrf_isento_limit: 0, irrf_reduction_limit: 0,
    irrf_reduction_base: 978.62, irrf_reduction_factor: 0.133145,
    salario_familia_value: 0, salario_familia_limit: 0, notes: "",
    ...(editing.id ? editing : {}),
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const hasBrackets = form.tax_type === "inss" || form.tax_type === "irrf";
  const addBracket = () => set("brackets", [...(form.brackets || []), { min: 0, max: 0, rate: 0, deduction: 0 }]);
  const updBracket = (i, k, v) => set("brackets", (form.brackets || []).map((b, idx) => idx === i ? { ...b, [k]: Number(v) } : b));
  const delBracket = (i) => set("brackets", (form.brackets || []).filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.name.trim()) return alert("Informe o nome da tabela.");
    setSaving(true);
    try {
      const payload = { ...form, user_email: user.email };
      if (editing.id) await base44.entities.ErpPayrollTaxTable.update(editing.id, payload);
      else await base44.entities.ErpPayrollTaxTable.create(payload);
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white"><h2 className="font-bold">{editing.id ? "Editar Tabela" : "Nova Tabela"}</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">✕</button></div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div><Label>Tipo *</Label><select value={form.tax_type} onChange={e => set("tax_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">{TAX_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><Label>Ano *</Label><Input type="number" value={form.year} onChange={e => set("year", Number(e.target.value))} /></div>
          <div className="col-span-2 flex items-end"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.is_default} onChange={e => set("is_default", e.target.checked)} className="w-4 h-4" /> Tabela padrão deste tipo para o ano</label></div>

          {form.tax_type === "inss" && <div><Label>Teto do INSS (R$)</Label><Input type="number" step="0.01" value={form.inss_ceiling} onChange={e => set("inss_ceiling", Number(e.target.value))} /></div>}
          {form.tax_type === "irrf" && <>
            <div><Label>Dedução por dependente (R$)</Label><Input type="number" step="0.01" value={form.dependent_deduction} onChange={e => set("dependent_deduction", Number(e.target.value))} /></div>
            <div><Label>Isento até rendimento (R$)</Label><Input type="number" step="0.01" value={form.irrf_isento_limit} onChange={e => set("irrf_isento_limit", Number(e.target.value))} /></div>
            <div><Label>Redução linear até (R$)</Label><Input type="number" step="0.01" value={form.irrf_reduction_limit} onChange={e => set("irrf_reduction_limit", Number(e.target.value))} /></div>
          </>}
          {form.tax_type === "fgts" && <div><Label>Alíquota FGTS (%)</Label><Input type="number" step="0.01" value={form.fgts_rate} onChange={e => set("fgts_rate", Number(e.target.value))} /></div>}
          {form.tax_type === "salario_familia" && <>
            <div><Label>Valor por filho (R$)</Label><Input type="number" step="0.01" value={form.salario_familia_value} onChange={e => set("salario_familia_value", Number(e.target.value))} /></div>
            <div><Label>Limite de salário (0 = sem)</Label><Input type="number" step="0.01" value={form.salario_familia_limit} onChange={e => set("salario_familia_limit", Number(e.target.value))} /></div>
          </>}
          {form.tax_type === "employer_charges" && <>
            <div><Label>INSS Patronal (%)</Label><Input type="number" step="0.01" value={form.inss_employer_rate} onChange={e => set("inss_employer_rate", Number(e.target.value))} /></div>
            <div><Label>FGTS (%)</Label><Input type="number" step="0.01" value={form.fgts_rate} onChange={e => set("fgts_rate", Number(e.target.value))} /></div>
            <div><Label>RAT/SAT (%)</Label><Input type="number" step="0.01" value={form.sat_rate} onChange={e => set("sat_rate", Number(e.target.value))} /></div>
            <div><Label>Terceiros (%)</Label><Input type="number" step="0.01" value={form.terceiros_rate} onChange={e => set("terceiros_rate", Number(e.target.value))} /></div>
          </>}

          {hasBrackets && (
            <div className="col-span-3 border-t pt-3">
              <div className="flex items-center justify-between mb-2"><Label className="m-0">Faixas Progressivas</Label><Button size="sm" variant="outline" onClick={addBracket} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Faixa</Button></div>
              <div className="space-y-2">
                {(form.brackets || []).map((b, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-end">
                    <div><Label className="text-xs">De (R$)</Label><Input type="number" step="0.01" value={b.min} onChange={e => updBracket(i, "min", e.target.value)} /></div>
                    <div><Label className="text-xs">Até (0=∞)</Label><Input type="number" step="0.01" value={b.max} onChange={e => updBracket(i, "max", e.target.value)} /></div>
                    <div><Label className="text-xs">Alíquota (%)</Label><Input type="number" step="0.01" value={b.rate} onChange={e => updBracket(i, "rate", e.target.value)} /></div>
                    <div><Label className="text-xs">Dedução (R$)</Label><Input type="number" step="0.01" value={b.deduction} onChange={e => updBracket(i, "deduction", e.target.value)} /></div>
                    <button onClick={() => delBracket(i)} className="h-9 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {(form.brackets || []).length === 0 && <p className="text-xs text-gray-400">Nenhuma faixa. Adicione as faixas progressivas.</p>}
              </div>
            </div>
          )}
          <div className="col-span-3"><Label>Observações</Label><Input value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white"><Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button><Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button></div>
      </div>
    </div>
  );
}