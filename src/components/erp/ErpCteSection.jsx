import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Truck, Trash2 } from "lucide-react";
import ErpCteModal from "@/components/erp/ErpCteModal";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

// Painel de CT-es importados no módulo Fiscal: lista os conhecimentos de frete,
// a parcela do frete líquido atribuída a cada nota vinculada (entrada/venda) e
// permite importar novos CT-es com vínculo às notas.
export default function ErpCteSection({ user }) {
  const [ctes, setCtes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCtes(await base44.entities.ErpCte.filter({ user_email: user.email }, "-created_date", 200)); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  // Exclui o CT-e e a conta a pagar em aberto da transportadora.
  // O custo já composto nos produtos NÃO é revertido.
  const handleDelete = async (c) => {
    if (!confirm(`Excluir o CT-e ${c.doc_number}?\n\nA conta a pagar em aberto da transportadora será excluída. O custo já composto nos produtos vinculados NÃO será revertido.`)) return;
    try {
      const esc = String(c.doc_number || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pat = new RegExp(`CT-e ${esc}([^0-9]|$)`);
      const payables = await base44.entities.ErpPayable.filter({ user_email: user.email, status: "aberto" }, "-created_date", 500);
      for (const p of payables.filter(p => pat.test(p.description || ""))) {
        await base44.entities.ErpPayable.delete(p.id);
      }
      await base44.entities.ErpCte.delete(c.id);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-sky-600" /> CT-e (Frete) — Importados e Vínculos</h3>
        <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5 bg-sky-600 hover:bg-sky-700"><Truck className="w-4 h-4" /> Importar CT-e</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr>
              <th className="p-2 text-left">Documento</th>
              <th className="p-2 text-left">Transportadora</th>
              <th className="p-2 text-right">Valor</th>
              <th className="p-2 text-right">Líquido Rateado</th>
              <th className="p-2 text-left">Vencimento</th>
              <th className="p-2 text-left">Notas Vinculadas</th>
              <th className="p-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            ) : ctes.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400"><Truck className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum CT-e importado — clique em "Importar CT-e" para importar o conhecimento de frete e vinculá-lo às notas.</td></tr>
            ) : ctes.map(c => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  <div className="font-mono text-xs">{c.doc_number || "—"}</div>
                  <div className="text-[10px] text-gray-400">{c.doc_model === "57" ? "CT-e" : c.doc_model === "NFSe" ? "NFS-e" : "NF-e"} • {fmtDate(c.issue_date)}</div>
                </td>
                <td className="p-2">{c.supplier_name || "—"}{c.supplier_uf ? <span className="text-[10px] text-gray-400"> ({c.supplier_uf})</span> : ""}</td>
                <td className="p-2 text-right font-medium">{fmtMoney(c.value)}</td>
                <td className="p-2 text-right text-sky-700 font-medium">{fmtMoney(c.net_value)}</td>
                <td className="p-2">{c.due_date ? fmtDate(c.due_date) : "—"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {(c.links || []).map((ln, idx) => (
                      <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded-full ${ln.kind === "venda" ? "bg-violet-100 text-violet-700" : "bg-indigo-100 text-indigo-700"}`}>
                        {ln.kind === "venda" ? "PV" : "NF"} {ln.number}: {fmtMoney(ln.share_value)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-right">
                  <button onClick={() => handleDelete(c)} title="Excluir CT-e (remove a conta a pagar em aberto)" className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <ErpCteModal user={user} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}