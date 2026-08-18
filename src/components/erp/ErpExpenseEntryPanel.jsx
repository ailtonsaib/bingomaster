import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import ErpExpenseEntryModal from "./ErpExpenseEntryModal";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";

export default function ErpExpenseEntryPanel({ user, onGoToParams }) {
  const [items, setItems] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [e, p] = await Promise.all([
        base44.entities.ErpFiscalEntry.filter({ user_email: user.email, entry_kind: "despesa" }, "-entry_date", 500),
        base44.entities.ErpExpenseParameter.filter({ user_email: user.email, is_active: true }, "-created_date", 200),
      ]);
      setItems(e); setParameters(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => {
    const t = (i.nota_number + " " + i.supplier_name + " " + (i.purchase_order_number || "")).toLowerCase();
    return t.includes(search.toLowerCase());
  });

  const handleDelete = async (i) => {
    if (!confirm(`Excluir a despesa ${i.nota_number}?`)) return;
    await base44.entities.ErpFiscalEntry.delete(i.id);
    load();
  };

  const openNew = () => {
    if (parameters.length === 0) {
      alert("Cadastre primeiro um Parâmetro de Despesas.");
      onGoToParams?.();
      return;
    }
    setShowModal(true);
  };

  const totalDespesas = filtered.reduce((s, i) => s + (i.total_nota || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documento, fornecedor, OC..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <div className="text-sm text-gray-600 px-3 py-1.5 bg-white rounded-md border">Total: <b className="text-indigo-700">{fmtMoney(totalDespesas)}</b></div>
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Despesa</Button>
      </div>

      {parameters.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4" />
          Nenhum Parâmetro de Despesas ativo. Cadastre um parâmetro (com CFOP de entrada) antes de lançar despesas.
          <button onClick={onGoToParams} className="ml-auto text-indigo-700 underline">Ir para Parâmetros</button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Documento</th><th className="p-2 text-left">Fornecedor</th><th className="p-2 text-left">OC</th>
                <th className="p-2 text-left">CFOP</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Lançamento</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma despesa lançada.</td></tr>
              ) : filtered.map(i => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-mono text-xs">{i.nota_number}</div>
                    <div className="text-[10px] text-gray-400">{i.nota_model === "NFSe" ? "NFS-e" : i.nota_model === "NDF" ? "Doc. Não Fiscal" : `NF-e ${i.nota_model}`} • {fmtDate(i.issue_date)}</div>
                  </td>
                  <td className="p-2">{i.supplier_name || "—"}</td>
                  <td className="p-2 font-mono text-xs">{i.purchase_order_number || "—"}</td>
                  <td className="p-2 font-mono text-xs">{i.cfop || "—"}</td>
                  <td className="p-2 text-right font-medium">{fmtMoney(i.total_nota)}</td>
                  <td className="p-2">
                    {i.journal_entry_number ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700"><CheckCircle2 className="w-3.5 h-3.5" /> LCT {i.journal_entry_number}</span>
                    ) : (
                      <span className="text-xs text-amber-600">pendente contábil</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <ErpExpenseEntryModal user={user} parameters={parameters} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}