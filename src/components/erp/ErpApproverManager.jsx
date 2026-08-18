import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, Plus, Pencil, Trash2, UserCheck } from "lucide-react";
import ErpApproverFormModal from "./ErpApproverFormModal";
import { fmtMoney } from "@/lib/erpUtils";

export default function ErpApproverManager({ user }) {
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setApprovers(await base44.entities.ErpApprover.filter({ user_email: user.email }, "department_name", 500));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = approvers.filter(a => {
    const t = (a.department_name + " " + a.approver_name + " " + (a.substitute_name || "")).toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (a) => {
    if (!confirm(`Excluir o aprovador de "${a.department_name}"?`)) return;
    await base44.entities.ErpApprover.delete(a.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-base">Aprovadores de Ordens de Compra</h2>
        <p className="text-xs text-gray-500">Por setor: quem aprova, o substituto e o valor máximo. Acima do limite, somente diretor aprova.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por setor ou aprovador..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Aprovador</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Setor</th>
                <th className="p-2 text-left">Aprovador</th>
                <th className="p-2 text-left">Substituto</th>
                <th className="p-2 text-right">Valor Máx.</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">
                  <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum aprovador cadastrado.
                </td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-medium">{a.department_name || "—"}</td>
                  <td className="p-2">{a.approver_name || "—"}<div className="text-xs text-gray-400">{a.approver_email}</div></td>
                  <td className="p-2">{a.substitute_name || "—"}{a.substitute_email ? <div className="text-xs text-gray-400">{a.substitute_email}</div> : ""}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(a.max_value)}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active !== false ? "text-emerald-700 bg-emerald-100" : "text-gray-600 bg-gray-100"}`}>{a.is_active !== false ? "Ativo" : "Inativo"}</span></td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(a); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(a)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpApproverFormModal user={user} approver={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}