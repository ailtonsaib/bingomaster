import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Pencil, Receipt, Sparkles } from "lucide-react";

const KIND_OPTS = [
  { value: "provento", label: "Provento", color: "bg-emerald-100 text-emerald-700" },
  { value: "desconto", label: "Desconto", color: "bg-red-100 text-red-700" },
  { value: "base", label: "Base", color: "bg-blue-100 text-blue-700" },
  { value: "informativa", label: "Informativa", color: "bg-gray-100 text-gray-600" },
];

const DEFAULT_RUBRICAS = [
  { code: "101", name: "Salário Base", kind: "provento", inc_inss: true, inc_irrf: true, inc_fgts: true, inc_13: true, auto_salary: true },
  { code: "102", name: "Salário Família", kind: "provento", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "120", name: "Horas Extras 50%", kind: "provento", inc_inss: true, inc_irrf: true, inc_fgts: true, inc_13: true },
  { code: "121", name: "Horas Extras 100%", kind: "provento", inc_inss: true, inc_irrf: true, inc_fgts: true, inc_13: true },
  { code: "130", name: "Adicional Noturno", kind: "provento", inc_inss: true, inc_irrf: true, inc_fgts: true, inc_13: true },
  { code: "140", name: "DSR (Descanso Semanal Remunerado)", kind: "provento", inc_inss: true, inc_irrf: true, inc_fgts: true, inc_13: true },
  { code: "150", name: "Vale Refeição", kind: "provento", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "410", name: "INSS", kind: "desconto", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "420", name: "IRRF", kind: "desconto", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "430", name: "FGTS (informativo)", kind: "informativa", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "501", name: "Adiantamento Salarial", kind: "desconto", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "502", name: "Vale Transporte", kind: "desconto", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "503", name: "Faltas/Atrasos", kind: "desconto", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
  { code: "504", name: "Pensão Alimentícia", kind: "desconto", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false },
];

export default function ErpPayrollRubricManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await base44.entities.ErpPayrollRubric.filter({ user_email: user.email }, "code", 500)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(r => [r.code, r.name, r.kind].map(v => String(v ?? "")).join(" ").toLowerCase().includes(search.toLowerCase()));

  const seedDefaults = async () => {
    if (!confirm("Carregar rubricas padrão? Isso adiciona as rubricas comuns (as existentes não serão duplicadas).")) return;
    setSeeding(true);
    try {
      const existing = new Set(items.map(r => r.code));
      const toCreate = DEFAULT_RUBRICAS.filter(r => !existing.has(r.code)).map(r => ({ ...r, user_email: user.email, is_active: true }));
      if (toCreate.length) await base44.entities.ErpPayrollRubric.bulkCreate(toCreate);
      load();
    } catch (e) { alert(e.message); }
    setSeeding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Rubricas (Proventos e Descontos)</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={seedDefaults} disabled={seeding} className="gap-1.5"><Sparkles className="w-4 h-4" /> Carregar Padrão</Button>
          <Button size="sm" onClick={() => setEditing({})} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Rubrica</Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar rubrica..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr><th className="p-2 text-left">Cód</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-center">INSS</th><th className="p-2 text-center">IRRF</th><th className="p-2 text-center">FGTS</th><th className="p-2 text-center">13º</th><th className="p-2 text-center">Auto</th><th className="p-2 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma rubrica. Clique em "Carregar Padrão" para começar.</td></tr>
                : filtered.map(r => {
                  const ko = KIND_OPTS.find(k => k.value === r.kind) || {};
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{r.code}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${ko.color}`}>{ko.label}</span></td>
                      <td className="p-2 text-center">{r.inc_inss ? "✓" : "—"}</td>
                      <td className="p-2 text-center">{r.inc_irrf ? "✓" : "—"}</td>
                      <td className="p-2 text-center">{r.inc_fgts ? "✓" : "—"}</td>
                      <td className="p-2 text-center">{r.inc_13 ? "✓" : "—"}</td>
                      <td className="p-2 text-center">{r.auto_salary ? "✓" : "—"}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button title="Editar" onClick={() => setEditing(r)} className="p-1 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4 text-blue-500" /></button>
                        <button title="Excluir" onClick={async () => { if (confirm(`Excluir "${r.name}"?`)) { await base44.entities.ErpPayrollRubric.delete(r.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <RubricForm user={user} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RubricForm({ user, editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: "", name: "", kind: "provento", inc_inss: false, inc_irrf: false, inc_fgts: false, inc_13: false, auto_salary: false, is_active: true,
    ...(editing.id ? editing : {}),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return alert("Informe código e nome.");
    setSaving(true);
    try {
      const payload = { ...form, user_email: user.email };
      if (editing.id) await base44.entities.ErpPayrollRubric.update(editing.id, payload);
      else await base44.entities.ErpPayrollRubric.create(payload);
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b"><h2 className="font-bold">{editing.id ? "Editar Rubrica" : "Nova Rubrica"}</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">✕</button></div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div><Label>Código *</Label><Input value={form.code} onChange={e => set("code", e.target.value)} /></div>
          <div><Label>Tipo *</Label><select value={form.kind} onChange={e => set("kind", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">{KIND_OPTS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
          <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="col-span-2 grid grid-cols-4 gap-2">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.inc_inss} onChange={e => set("inc_inss", e.target.checked)} className="w-4 h-4" /> Incide INSS</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.inc_irrf} onChange={e => set("inc_irrf", e.target.checked)} className="w-4 h-4" /> Incide IRRF</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.inc_fgts} onChange={e => set("inc_fgts", e.target.checked)} className="w-4 h-4" /> Incide FGTS</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.inc_13} onChange={e => set("inc_13", e.target.checked)} className="w-4 h-4" /> Incide 13º</label>
          </div>
          <label className="col-span-2 flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.auto_salary} onChange={e => set("auto_salary", e.target.checked)} className="w-4 h-4" /> Preenche automaticamente com o salário base do funcionário</label>
          <label className="col-span-2 flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Ativa</label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button><Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button></div>
      </div>
    </div>
  );
}