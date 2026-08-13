import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, Download, Trash2, Loader2, ListTree } from "lucide-react";
import { REFERENTIAL_PLAN } from "@/lib/planoContasReferencial";

const TYPE_LABELS = {
  ativo: "Ativo", passivo: "Passivo", patrimonio_liquido: "Patrim. Líquido",
  receita: "Receita", despesa: "Despesa", compensacao: "Compensação",
};

export default function ErpChartAccountReferentialManager({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try { setItems(await base44.entities.ErpChartAccountReferential.filter({ user_email: user.email }, "code", 1000)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const handleImport = async () => {
    if (items.length > 0 && !confirm(`Já existem ${items.length} contas. Importar novamente duplicará. Deseja substituir?`)) return;
    setBusy(true);
    try {
      if (items.length > 0) await base44.entities.ErpChartAccountReferential.deleteMany({ user_email: user.email });
      await base44.entities.ErpChartAccountReferential.bulkCreate(
        REFERENTIAL_PLAN.map(a => ({ user_email: user.email, code: a.code, name: a.name, account_type: a.account_type, nature: a.nature, is_active: true }))
      );
      await load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleClear = async () => { if (!confirm("Remover todas as contas referenciais?")) return; setBusy(true); try { await base44.entities.ErpChartAccountReferential.deleteMany({ user_email: user.email }); await load(); } catch (e) { alert(e.message); } setBusy(false); };

  const filtered = items.filter(i => (i.code + " " + i.name).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conta referencial..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <Button size="sm" onClick={handleImport} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Importar Plano da Receita</Button>
        {items.length > 0 && <Button size="sm" variant="outline" onClick={handleClear} disabled={busy} className="gap-1.5"><Trash2 className="w-4 h-4" /> Limpar</Button>}
        <span className="text-xs text-gray-400">{items.length} contas</span>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Natureza</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400"><ListTree className="w-10 h-10 mx-auto mb-2 opacity-30" /> Plano referencial vazio. Clique em "Importar Plano da Receita" para carregar o plano padrão (PCR/ECD).</td></tr>
              : filtered.map(i => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono">{i.code}</td>
                  <td className="p-2">{i.name}</td>
                  <td className="p-2 text-xs">{TYPE_LABELS[i.account_type] || i.account_type}</td>
                  <td className="p-2 text-xs">{i.nature}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}