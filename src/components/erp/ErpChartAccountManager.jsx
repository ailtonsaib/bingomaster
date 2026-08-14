import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, X, ListTree, Upload } from "lucide-react";
import ErpChartAccountImporter from "@/components/erp/ErpChartAccountImporter";
import ErpChartAccountForm from "@/components/erp/ErpChartAccountForm";

const TYPE_OPTS = [
  { value: "ativo", label: "Ativo", color: "text-blue-700 bg-blue-100", nature: "devedora" },
  { value: "passivo", label: "Passivo", color: "text-red-700 bg-red-100", nature: "credora" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido", color: "text-purple-700 bg-purple-100", nature: "credora" },
  { value: "receita", label: "Receita", color: "text-emerald-700 bg-emerald-100", nature: "credora" },
  { value: "despesa", label: "Despesa", color: "text-amber-700 bg-amber-100", nature: "devedora" },
  { value: "compensacao", label: "Compensação", color: "text-gray-700 bg-gray-100", nature: "" },
];
const PROD_COST_TYPES = [
  { value: "insumos", label: "Insumos" },
  { value: "mao_de_obra", label: "Mão de Obra" },
  { value: "ggf", label: "GGF (Gastos Gerais de Fabricação)" },
];

export default function ErpChartAccountManager({ user }) {
  const [items, setItems] = useState([]);
  const [refItems, setRefItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [acc, ref] = await Promise.all([
        base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpChartAccountReferential.filter({ user_email: user.email }, "code", 1000),
      ]);
      setItems(acc); setRefItems(ref);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const sorted = [...items].sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
  const filtered = sorted.filter(i => (i.code + " " + i.name + " " + (i.parent_name || "") + " " + (i.referential_code || "")).toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (i) => { if (confirm(`Excluir a conta "${i.code} - ${i.name}"?`)) { await base44.entities.ErpChartAccount.delete(i.id); load(); } };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conta..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowImporter(true)} className="gap-1.5"><Upload className="w-4 h-4" /> Importar Excel</Button>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Conta</Button>
        {refItems.length === 0 && <span className="text-xs text-amber-600">Importe o Plano Referencial para vincular contas analíticas.</span>}
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-left">Ref.</th><th className="p-2 text-left">Grau</th>
                <th className="p-2 text-left">Identificação</th>
                <th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Natureza</th>
                <th className="p-2 text-left">Nível Superior</th>
                <th className="p-2 text-left">Plano Referencial</th>
                <th className="p-2 text-left">Ativa</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={11} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={11} className="p-8 text-center text-gray-400"><ListTree className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma conta cadastrada.</td></tr>
              : filtered.map(i => {
                const t = TYPE_OPTS.find(o => o.value === i.account_type) || TYPE_OPTS[0];
                return (
                  <tr key={i.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono">{i.code}</td>
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2 text-xs text-gray-500">{i.referencia || "—"}</td>
                    <td className="p-2 text-xs text-center">{i.grau || "—"}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span></td>
                    <td className="p-2 text-xs font-medium">{i.accepts_entries === false ? <span className="text-blue-700">SINTÉTICA</span> : <span className="text-emerald-700">ANALÍTICA</span>}</td>
                    <td className="p-2 text-xs">{i.nature || "—"}</td>
                    <td className="p-2 text-xs font-mono">{i.parent_code || "—"}</td>
                    <td className="p-2 text-xs">{i.referential_code ? <span className="font-mono">{i.referential_code}</span> : <span className="text-gray-300">null</span>}{i.referential_name ? <span className="block text-gray-400">{i.referential_name}</span> : null}</td>
                    <td className="p-2 text-xs">{i.is_active ? "Sim" : "Não"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">✏️</button>
                      <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <ErpChartAccountForm user={user} editing={editing} accounts={sorted} refItems={refItems} onClose={() => setShowForm(false)} onSaved={load} />}
      {showImporter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4">
            <ErpChartAccountImporter user={user} onDone={() => { setShowImporter(false); load(); }} />
            <Button variant="outline" size="sm" onClick={() => setShowImporter(false)} className="mt-3">Fechar</Button>
          </div>
        </div>
      )}
    </div>
  );
}