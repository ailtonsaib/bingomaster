import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, Plus, Pencil, Trash2, ScrollText } from "lucide-react";
import ErpTaxRuleForm from "@/components/erp/ErpTaxRuleForm";

const DEST_BADGE = {
  contribuinte: "text-emerald-700 bg-emerald-100",
  nao_contribuinte: "text-blue-700 bg-blue-100",
  pessoa_fisica: "text-purple-700 bg-purple-100",
};
const DEST_LABEL = {
  contribuinte: "Contribuinte",
  nao_contribuinte: "Não contribuinte",
  pessoa_fisica: "Pessoa física",
};

export default function ErpTaxRuleManager({ user }) {
  const [rules, setRules] = useState([]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([
        base44.entities.ErpTaxRule.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpOperation.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setRules(r); setOperations(o);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = rules.filter(r => {
    const t = (r.operation_name + " " + (r.ncm || "") + " " + (r.cfop || "") + " " + (r.uf || "") + " " + (r.destinatario_tipo || "")).toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (r) => {
    if (!confirm("Excluir esta regra fiscal?")) return;
    await base44.entities.ErpTaxRule.delete(r.id);
    load();
  };

  const opBadge = (type) => type === "entrada"
    ? "text-blue-700 bg-blue-100"
    : "text-emerald-700 bg-emerald-100";

  return (
    <div className="space-y-3">
      <div><h2 className="font-semibold text-base">Regras Fiscais por NCM</h2>
        <p className="text-xs text-gray-500">ICMS, PIS, COFINS, IPI, CBS e IBS — por NCM, tipo de operação (entrada/saída), UF e tipo de destinatário — o NCM de cada produto define a regra aplicada na nota</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por NCM, operação, CFOP ou destinatário..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Regra</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">NCM</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Operação</th>
                <th className="p-2 text-left">CFOP</th>
                <th className="p-2 text-left">UF</th>
                <th className="p-2 text-left">Destinatário</th>
                <th className="p-2 text-left">ICMS</th>
                <th className="p-2 text-left">PIS/COFINS</th>
                <th className="p-2 text-left">IPI</th>
                <th className="p-2 text-left">CBS/IBS</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400">
                  <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma regra fiscal cadastrada.
                </td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs font-medium">{r.ncm || "Geral"}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${opBadge(r.operation_type)}`}>{r.operation_type === "entrada" ? "Entrada" : r.operation_type === "saida" ? "Saída" : "Ambas"}</span></td>
                  <td className="p-2">{r.operation_name || "Todas"}</td>
                  <td className="p-2 font-mono text-xs">{r.cfop || "—"}</td>
                  <td className="p-2 font-mono text-xs">{r.uf || "Todas"}{r.difal_enabled ? <span className="ml-1 text-blue-600" title="Aplica DIFAL">⚡</span> : ""}{r.st_enabled ? <span className="ml-1 text-amber-600" title="Aplica ST">ST</span> : ""}</td>
                  <td className="p-2"><span className={`text-[10px] px-2 py-0.5 rounded-full ${DEST_BADGE[r.destinatario_tipo] || "text-gray-600 bg-gray-100"}`}>{DEST_LABEL[r.destinatario_tipo] || "—"}</span></td>
                  <td className="p-2 text-xs">{r.cst_icms} · {r.icms_rate}%</td>
                  <td className="p-2 text-xs">{r.cst_pis}/{r.cst_cofins} · {r.pis_rate}%/{r.cofins_rate}%</td>
                  <td className="p-2 text-xs">{r.cst_ipi} · {r.ipi_rate}%</td>
                  <td className="p-2 text-xs">{r.cbs_rate}% / {r.ibs_rate}%</td>
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
        <ErpTaxRuleForm user={user} rule={editing} operations={operations} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}