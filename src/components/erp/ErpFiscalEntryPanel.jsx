import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, FileText, ArrowDownToLine, CheckCircle2, XCircle, Clock } from "lucide-react";
import ErpFiscalEntryImport from "./ErpFiscalEntryImport";
import { fmtMoney, fmtDate } from "@/lib/erpUtils";
import { gerarLancamentoEntrada } from "@/lib/erpJournal";

const STATUS = {
  pendente: { label: "Pendente", color: "text-amber-700 bg-amber-100" },
  aprovada: { label: "Aprovada", color: "text-emerald-700 bg-emerald-100" },
  nao_aprovada: { label: "Não Aprovada", color: "text-red-700 bg-red-100" },
  lancada: { label: "Lançada", color: "text-blue-700 bg-blue-100" },
};

export default function ErpFiscalEntryPanel({ user, onGoToProducts }) {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([
        base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-entry_date", 500),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
      ]);
      setItems(e); setAccounts(a);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(i => {
    const okF = filter === "all" || i.status === filter;
    const t = (i.nota_number + " " + i.supplier_name + " " + (i.purchase_order_number || "")).toLowerCase();
    return okF && t.includes(search.toLowerCase());
  });

  const handleDelete = async (i) => {
    if (!confirm(`Excluir a entrada da NF ${i.nota_number}?`)) return;
    await base44.entities.ErpFiscalEntry.delete(i.id);
    load();
  };

  // "Atualizar Lançamento": gera lançamento contábil + atualiza estoque
  const handleLancar = async (entry) => {
    setBusy(entry.id);
    try {
      // Conta de passivo "Fornecedores" / "Contas a Pagar"
      const passivo = accounts.find(a => a.account_type === "passivo" && /fornecedor|contas a pagar/i.test(a.name));
      if (!passivo) { alert("Cadastre uma conta de passivo 'Fornecedores' (ou 'Contas a Pagar') para gerar o lançamento."); setBusy(null); return; }
      if (!entry.apportionments?.length) { alert("Sem rateio vinculado à nota. Vincule uma ordem de compra com rateio."); setBusy(null); return; }

      const je = await gerarLancamentoEntrada(user, entry, accounts);

      // Atualiza estoque dos itens (prefere vínculo product_id, depois código/barras/nome)
      const products = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500);
      const byId = new Map(products.map(p => [p.id, p]));
      for (const it of entry.items || []) {
        const prod = (it.product_id && byId.get(it.product_id)) || products.find(p => (p.code && p.code === it.product_code) || (p.barcode && p.barcode === it.barcode) || (p.name && p.name.toLowerCase() === (it.product_name || "").toLowerCase()));
        if (prod) {
          await base44.entities.ErpProduct.update(prod.id, {
            stock: (prod.stock || 0) + (it.quantity || 0),
            cost_price: it.unit_price || prod.cost_price,
          });
        }
      }

      await base44.entities.ErpFiscalEntry.update(entry.id, {
        status: "lancada",
        journal_entry_id: je.id,
        journal_entry_number: je.number,
      });
      load();
    } catch (e) { alert(e.message); }
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nota, fornecedor, OC..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => setShowImport(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4" /> Nova Entrada</Button>
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
                <tr><td colSpan={8} className="p-8 text-center text-gray-400"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma entrada de nota fiscal.</td></tr>
              ) : filtered.map(i => {
                const st = STATUS[i.status] || { label: i.status, color: "text-gray-700 bg-gray-100" };
                return (
                  <tr key={i.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <div className="font-mono text-xs">{i.nota_number}</div>
                      <div className="text-[10px] text-gray-400">{i.nota_model === "NFSe" ? "NFS-e" : i.nota_model === "NDF" ? "Doc. Não Fiscal" : `NF-e ${i.nota_model}`} • {fmtDate(i.issue_date)}</div>
                    </td>
                    <td className="p-2">{i.supplier_name || "—"}</td>
                    <td className="p-2 font-mono text-xs">{i.purchase_order_number || "—"}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(i.total_nota)}</td>
                    <td className="p-2 text-right text-gray-600">{fmtMoney(i.po_total_value)}</td>
                    <td className={`p-2 text-right font-medium ${i.values_match ? "text-emerald-600" : "text-amber-600"}`}>{fmtMoney(i.value_diff)}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      {i.journal_entry_number && <div className="text-[10px] text-gray-400 mt-0.5">LCT: {i.journal_entry_number}</div>}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {i.status === "aprovada" && (
                        <button onClick={() => handleLancar(i)} disabled={busy === i.id} title="Atualizar Lançamento" className="p-1 hover:bg-blue-50 rounded disabled:opacity-50">
                          {busy === i.id ? <Clock className="w-4 h-4 text-gray-400 animate-spin" /> : <ArrowDownToLine className="w-4 h-4 text-blue-600" />}
                        </button>
                      )}
                      {i.status === "pendente" && <span className="text-[10px] text-amber-600" title="Aguardando aprovação do admin">aguarda aprovação</span>}
                      {i.status === "nao_aprovada" && <XCircle className="w-4 h-4 text-red-500 inline" />}
                      {i.status === "lancada" && <CheckCircle2 className="w-4 h-4 text-blue-600 inline" title="Lançamento gerado" />}
                      <button onClick={() => handleDelete(i)} className="p-1 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showImport && <ErpFiscalEntryImport user={user} onClose={() => setShowImport(false)} onSaved={load} onGoToProducts={onGoToProducts} />}
    </div>
  );
}