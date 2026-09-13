import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Layers, X } from "lucide-react";

// Cadastro de Etapas de Produção (ex: Montagem, Envase, Rotulagem)
export default function ErpProductionStageManager({ user, onChange }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setStages(await base44.entities.ErpProductionStage.filter({ user_email: user.email }, "name", 500));
    } catch (e) { console.error(e); }
    setLoading(false);
    if (onChange) onChange();
  };
  useEffect(() => { load(); }, [user.email]);

  const handleDelete = async (s) => {
    if (!confirm(`Excluir a etapa "${s.name}"?`)) return;
    await base44.entities.ErpProductionStage.delete(s.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold">Etapas de Produção</h2>
        </div>
        <Button size="sm" onClick={() => setEditing({ __new: true })} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nova Etapa
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Etapa</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-center">Ativa</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : stages.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">
                  <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma etapa cadastrada.
                </td></tr>
              ) : stages.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{s.code || "—"}</td>
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2 text-gray-600">{s.description || "—"}</td>
                  <td className="p-2 text-center">{s.is_active !== false ? "✅" : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(s)} className="p-1 hover:bg-gray-100 rounded text-xs">✏️</button>
                    <button onClick={() => handleDelete(s)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <StageModal
          user={user}
          stage={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StageModal({ user, stage, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: stage?.code || "", name: stage?.name || "", description: stage?.description || "",
    is_active: stage?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { alert("Informe o nome da etapa."); return; }
    setSaving(true);
    const payload = { user_email: user.email, code: form.code || undefined, name: form.name.trim(), description: form.description || undefined, is_active: form.is_active };
    try {
      if (stage?.id) await base44.entities.ErpProductionStage.update(stage.id, payload);
      else await base44.entities.ErpProductionStage.create(payload);
      onSaved();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-600" /> {stage ? "Editar Etapa" : "Nova Etapa de Produção"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Código</label><input value={form.code} onChange={e => set("code", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">Nome da etapa *</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Montagem, Envase, Rotulagem" className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
          </div>
          <div><label className="text-xs text-gray-500">Descrição</label><input value={form.description} onChange={e => set("description", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4" /> Etapa ativa
          </label>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </div>
  );
}