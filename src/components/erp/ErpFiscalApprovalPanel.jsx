import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import ErpFiscalApprovalModal from "./ErpFiscalApprovalModal";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

// Painel de aprovação NF x OC: lista entradas aguardando aprovação (valores divergentes).
export default function ErpFiscalApprovalPanel({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [approval, setApproval] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-entry_date", 500);
      // mostra pendentes (aguardando) + reprovadas/nao_aprovadas para histórico
      setItems(all.filter(i => i.approval_status === "aguardando_aprovacao" || i.status === "nao_aprovada"));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => (i.nota_number + " " + i.supplier_name + " " + (i.purchase_order_number || "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nota, fornecedor, OC..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-amber-600" /> {filtered.filter(i => i.approval_status === "aguardando_aprovacao").length} aguardando aprovação</div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Nota</th><th className="p-2 text-left">Fornecedor</th><th className="p-2 text-left">OC</th>
                <th className="p-2 text-right">Total NF</th><th className="p-2 text-right">Total OC</th><th className="p-2 text-right">Dif.</th>
                <th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400"><ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma nota aguardando aprovação.</td></tr>
              ) : filtered.map(i => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-mono text-xs">{i.nota_number}</div>
                    <div className="text-[10px] text-gray-400">{fmtDate(i.issue_date)}</div>
                  </td>
                  <td className="p-2">{i.supplier_name || "—"}</td>
                  <td className="p-2 font-mono text-xs">{i.purchase_order_number || "—"}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(i.total_nota)}</td>
                  <td className="p-2 text-right text-gray-600">{fmtMoney(i.po_total_value)}</td>
                  <td className="p-2 text-right font-medium text-amber-600">{fmtMoney(i.value_diff)}</td>
                  <td className="p-2">
                    {i.status === "nao_aprovada"
                      ? <span className="text-xs px-2 py-0.5 rounded-full text-red-700 bg-red-100 flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Não Aprovada</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full text-amber-700 bg-amber-100">Aguardando</span>}
                    {i.approval_obs && <div className="text-[10px] text-gray-400 mt-0.5">{i.approved_by_name ? `por ${i.approved_by_name}` : ""}</div>}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {i.approval_status === "aguardando_aprovacao" && (
                      <Button size="sm" variant="outline" onClick={() => setApproval(i)} className="gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Analisar</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {approval && (
        <ErpFiscalApprovalModal entry={approval} userName={user.name} onClose={() => setApproval(null)} onDone={() => { setApproval(null); load(); }} />
      )}
    </div>
  );
}