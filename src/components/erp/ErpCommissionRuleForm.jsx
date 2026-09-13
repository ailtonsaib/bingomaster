import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export const BASIS_OPTS = [
  { value: "vendas_periodo", label: "Vendas do período (pedidos emitidos)" },
  { value: "vendas_pagas", label: "Vendas pagas no período (recebimentos)" },
  { value: "volume", label: "Volume de vendas (quantidade)" },
];

// Modal de criação/edição da regra de comissão com até 3 faixas por atingimento da meta
export default function ErpCommissionRuleForm({ user, rule, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    basis: rule?.basis || "vendas_periodo",
    supervisor_pct: rule?.supervisor_pct ?? 0,
    gerente_pct: rule?.gerente_pct ?? 0,
    notes: rule?.notes || "",
  });
  const [levels, setLevels] = useState(
    rule?.levels?.length ? rule.levels.map(l => ({ limit_pct: Number(l.limit_pct) || 0, commission_pct: Number(l.commission_pct) || 0 })) : [{ limit_pct: 80, commission_pct: 0 }]
  );
  const [saving, setSaving] = useState(false);

  const setLevel = (i, key, v) => setLevels(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: Number(v) || 0 } : l));
  const addLevel = () => { if (levels.length < 3) setLevels(prev => [...prev, { limit_pct: 100, commission_pct: 0 }]); };
  const removeLevel = (i) => setLevels(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Informe o nome da regra."); return; }
    if (!levels.length) { alert("Cadastre ao menos uma faixa de comissão."); return; }
    for (const l of levels) {
      if (!(l.limit_pct > 0)) { alert("O limite de atingimento (%) deve ser maior que zero em todas as faixas."); return; }
      if (l.commission_pct < 0) { alert("A comissão (%) não pode ser negativa."); return; }
    }
    const sorted = [...levels].sort((a, b) => a.limit_pct - b.limit_pct);
    const payload = { user_email: user.email, ...form, supervisor_pct: Number(form.supervisor_pct) || 0, gerente_pct: Number(form.gerente_pct) || 0, levels: sorted };
    setSaving(true);
    try {
      if (rule?.id) await base44.entities.ErpCommissionRule.update(rule.id, payload);
      else await base44.entities.ErpCommissionRule.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{rule ? "Editar Regra de Comissão" : "Nova Regra de Comissão"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Nome da regra *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1" placeholder="Ex.: Comissão Vendedores 2026" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Base de cálculo *</label>
              <select value={form.basis} onChange={e => setForm(p => ({ ...p, basis: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                {BASIS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Comissão do supervisor (%) sobre vendas dos seus vendedores</label>
              <input type="number" min="0" step="0.01" value={form.supervisor_pct} onChange={e => setForm(p => ({ ...p, supervisor_pct: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Comissão do gerente (%) sobre vendas dos vendedores dos seus supervisores</label>
              <input type="number" min="0" step="0.01" value={form.gerente_pct} onChange={e => setForm(p => ({ ...p, gerente_pct: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Faixas do vendedor por atingimento da meta (até 3 níveis)</p>
              <Button size="sm" variant="outline" onClick={addLevel} disabled={levels.length >= 3} className="gap-1 h-7 text-xs">
                <Plus className="w-3.5 h-3.5" /> Faixa
              </Button>
            </div>
            <p className="text-[11px] text-gray-500">
              Exemplo: até 80% da meta paga 2% de comissão; de 80% até 100% paga 3%; acima da última faixa paga a comissão da última faixa.
            </p>
            {levels.map((l, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Até (%) da meta</label>
                  <input type="number" min="1" step="0.01" value={l.limit_pct} onChange={e => setLevel(i, "limit_pct", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Comissão (%)</label>
                  <input type="number" min="0" step="0.01" value={l.commission_pct} onChange={e => setLevel(i, "commission_pct", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
                </div>
                <button onClick={() => removeLevel(i)} disabled={levels.length <= 1} title="Remover faixa"
                  className="p-2 hover:bg-red-50 rounded disabled:opacity-30"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Observações</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1" />
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