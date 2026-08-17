import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Pencil, ArrowRightLeft } from "lucide-react";
import ErpOperationFormModal from "./ErpOperationFormModal";

const TYPE_BADGE = {
  entrada: "text-blue-700 bg-blue-100",
  saida: "text-emerald-700 bg-emerald-100",
};

export default function ErpOperationManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.ErpOperation.filter({ user_email: user.email }, "-created_date", 500));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(o => {
    const t = [o.name, o.code, o.cfop, o.cfop_fora_estado, o.cfop_importacao_exportacao, o.nature_operation].map(v => String(v ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => {
    if (!confirm(`Excluir a operação "${o.name}"?`)) return;
    await base44.entities.ErpOperation.delete(o.id);
    load();
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base">Cadastro de Operações de Entrada e Saída</h2>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar operação..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Operação</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Operação</th>
                <th className="p-2 text-left">CFOP Dentro</th>
                <th className="p-2 text-left">CFOP Fora</th>
                <th className="p-2 text-left">Import./Export.</th>
                <th className="p-2 text-left">Natureza</th>
                <th className="p-2 text-center">Patrim.</th>
                <th className="p-2 text-center">Ativa</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">
                  <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma operação cadastrada.
                </td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BADGE[o.type] || "text-gray-700 bg-gray-100"}`}>{o.type === "entrada" ? "Entrada" : "Saída"}</span></td>
                  <td className="p-2 font-medium">{o.name}{o.code ? <span className="text-xs text-gray-400 ml-1">({o.code})</span> : ""}</td>
                  <td className="p-2 font-mono text-xs">{o.cfop || "—"}</td>
                  <td className="p-2 font-mono text-xs">{o.cfop_fora_estado || "—"}</td>
                  <td className="p-2 font-mono text-xs">{o.cfop_importacao_exportacao || "—"}</td>
                  <td className="p-2 text-gray-600">{o.nature_operation || "—"}</td>
                  <td className="p-2 text-center">{o.is_patrimonio ? "Sim" : "—"}</td>
                  <td className="p-2 text-center">{o.is_active !== false ? "Sim" : "Não"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(o); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(o)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpOperationFormModal user={user} operation={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}