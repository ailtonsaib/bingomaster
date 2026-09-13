import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ErpCommissionRuleForm from "./ErpCommissionRuleForm";
import { BASIS_OPTS } from "./ErpCommissionRuleForm";

const basisLabel = (v) => BASIS_OPTS.find(o => o.value === v)?.label || v;

// Lista das regras de comissão cadastradas
export default function ErpCommissionRules({ user }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ErpCommissionRule.filter({ user_email: user.email }, "-created_date", 500);
      setRules(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.email]);

  const handleDelete = async (r) => {
    if (!confirm(`Excluir a regra "${r.name}"?`)) return;
    await base44.entities.ErpCommissionRule.delete(r.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Regras de Comissão</h2>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Regra</th>
                <th className="p-2 text-left">Base de cálculo</th>
                <th className="p-2 text-left">Faixas</th>
                <th className="p-2 text-left">Ativa</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhuma regra cadastrada.</td></tr>
              ) : rules.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 text-gray-600">{basisLabel(r.basis)}</td>
                  <td className="p-2 text-gray-600 text-xs">
                    {[...(r.levels || [])].sort((a, b) => a.limit_pct - b.limit_pct)
                      .map(l => `até ${l.limit_pct}% → ${l.commission_pct}%`).join("  ·  ")}
                    {(Number(r.supervisor_pct) > 0 || Number(r.gerente_pct) > 0) && (
                      <span className="block text-gray-400">Supervisor: {r.supervisor_pct || 0}% · Gerente: {r.gerente_pct || 0}%</span>
                    )}
                  </td>
                  <td className="p-2">{r.is_active !== false ? "Sim" : "Não"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(r)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpCommissionRuleForm
          user={user}
          rule={editing}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}