import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, Loader2 } from "lucide-react";

const fmtMoney = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function ErpAccountingReports({ user }) {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("balancete");
  const [year, setYear] = useState(new Date().getFullYear());
  const [razaoAccount, setRazaoAccount] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        base44.entities.ErpJournalEntry.filter({ user_email: user.email, status: "definitivo" }, "date", 1000),
        base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 500),
      ]);
      setEntries(j); setAccounts(a);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const inYear = useMemo(() => entries.filter(e => new Date(e.date).getFullYear() === Number(year)), [entries, year]);

  // Balancete: soma por conta
  const balancete = useMemo(() => {
    const map = {};
    accounts.forEach(a => { map[a.id] = { code: a.code, name: a.name, nature: a.nature, debit: 0, credit: 0 }; });
    inYear.forEach(e => (e.lines || []).forEach(l => {
      if (!map[l.account_id]) map[l.account_id] = { code: l.account_code, name: l.account_name, nature: "", debit: 0, credit: 0 };
      map[l.account_id].debit += Number(l.debit) || 0;
      map[l.account_id].credit += Number(l.credit) || 0;
    }));
    return Object.values(map).filter(r => r.debit || r.credit || true).sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
  }, [inYear, accounts]);

  const totals = balancete.reduce((a, r) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }), { debit: 0, credit: 0 });

  // DRE
  const dre = useMemo(() => {
    const sum = (type) => inYear.flatMap(e => e.lines || []).reduce((acc, l) => {
      const a = accounts.find(a => a.id === l.account_id);
      if (a && a.account_type === type) return acc + (Number(l.debit) || 0) - (Number(l.credit) || 0);
      return acc;
    }, 0);
    const receitas = sum("receita");
    const despesas = sum("despesa");
    return { receitas, despesas, resultado: receitas - despesas };
  }, [inYear, accounts]);

  // Razão
  const razaoLines = useMemo(() => {
    if (!razaoAccount) return [];
    return inYear.filter(e => (e.lines || []).some(l => l.account_id === razaoAccount))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .flatMap(e => (e.lines || []).filter(l => l.account_id === razaoAccount).map(l => ({
        date: e.date, number: e.number, history: e.history + (l.complement ? " - " + l.complement : ""),
        debit: Number(l.debit) || 0, credit: Number(l.credit) || 0,
      })));
  }, [inYear, razaoAccount]);
  const razaoAcct = accounts.find(a => a.id === razaoAccount);
  const razaoSaldo = razaoLines.reduce((a, l) => a + l.debit - l.credit, 0);

  // Balanço Patrimonial
  const balanco = useMemo(() => {
    const grp = (type) => balancete.filter(r => { const a = accounts.find(a => a.code === r.code); return a && a.account_type === type; }).reduce((s, r) => s + (r.debit - r.credit), 0);
    return { ativo: grp("ativo"), passivo: grp("passivo"), pl: grp("patrimonio_liquido") };
  }, [balancete, accounts]);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const TABS = [
    { id: "balancete", label: "Balancete de Verificação" },
    { id: "razao", label: "Razão" },
    { id: "dre", label: "DRE" },
    { id: "balanco", label: "Balanço Patrimonial" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t.id ? "bg-amber-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Ano:</span>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-8 w-20 rounded-md border border-input px-2 text-sm" />
        </div>
      </div>

      {tab === "balancete" && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Conta</th><th className="p-2 text-right">Débito</th><th className="p-2 text-right">Crédito</th><th className="p-2 text-right">Saldo</th></tr></thead>
              <tbody>
                {balancete.map(r => {
                  const saldo = (r.nature === "credora" ? r.credit - r.debit : r.debit - r.credit);
                  return (
                    <tr key={r.code} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-mono">{r.code}</td><td className="p-2">{r.name}</td>
                      <td className="p-2 text-right">{r.debit ? fmtMoney(r.debit) : "—"}</td>
                      <td className="p-2 text-right">{r.credit ? fmtMoney(r.credit) : "—"}</td>
                      <td className="p-2 text-right font-medium">{saldo ? fmtMoney(saldo) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t-2 bg-gray-50 font-bold"><td colSpan={2} className="p-2">Totais</td><td className="p-2 text-right">{fmtMoney(totals.debit)}</td><td className="p-2 text-right">{fmtMoney(totals.credit)}</td><td className="p-2 text-right">{totals.debit === totals.credit ? "✓ Igual" : "Desequilibrado"}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === "razao" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Conta:</span>
            <select value={razaoAccount} onChange={e => setRazaoAccount(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
              <option value="">Selecione uma conta...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          {razaoAccount && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Lançamento</th><th className="p-2 text-left">Histórico</th><th className="p-2 text-right">Débito</th><th className="p-2 text-right">Crédito</th><th className="p-2 text-right">Saldo</th></tr></thead>
                <tbody>
                  {(() => { let s = 0; return razaoLines.map((l, i) => { s += l.debit - l.credit; return (
                    <tr key={i} className="border-t"><td className="p-2 text-xs">{(l.date || "").slice(0, 10)}</td><td className="p-2 font-mono text-xs">{l.number}</td><td className="p-2">{l.history}</td><td className="p-2 text-right">{l.debit ? fmtMoney(l.debit) : "—"}</td><td className="p-2 text-right">{l.credit ? fmtMoney(l.credit) : "—"}</td><td className="p-2 text-right font-medium">{fmtMoney(s)}</td></tr>
                  ); }); })()}
                </tbody>
                {razaoAcct && <tfoot><tr className="border-t-2 bg-gray-50 font-bold"><td colSpan={5} className="p-2">Saldo Final ({razaoAcct.nature})</td><td className="p-2 text-right">{fmtMoney(razaoSaldo)}</td></tr></tfoot>}
              </table>
              {razaoLines.length === 0 && <p className="p-6 text-center text-gray-400">Sem movimentação para esta conta no período.</p>}
            </div>
          )}
        </div>
      )}

      {tab === "dre" && (
        <div className="bg-white rounded-xl border p-4 max-w-xl">
          <h3 className="font-semibold mb-3">Demonstração do Resultado do Exercício — {year}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>(+) Receitas</span><b className="text-emerald-600">{fmtMoney(dre.receitas)}</b></div>
            <div className="flex justify-between"><span>(-) Despesas</span><b className="text-red-600">{fmtMoney(dre.despesas)}</b></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Resultado do Exercício</span><b className={dre.resultado >= 0 ? "text-emerald-700" : "text-red-700"}>{fmtMoney(dre.resultado)}</b></div>
          </div>
        </div>
      )}

      {tab === "balanco" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border p-4"><h3 className="font-semibold mb-2 text-blue-700">Ativo</h3><p className="text-2xl font-bold">{fmtMoney(balanco.ativo)}</p></div>
          <div className="bg-white rounded-xl border p-4"><h3 className="font-semibold mb-2 text-red-700">Passivo + Patrimônio Líquido</h3><p className="text-2xl font-bold">{fmtMoney(balanco.passivo + balanco.pl)}</p><p className="text-xs text-gray-500 mt-1">Passivo: {fmtMoney(balanco.passivo)} · PL: {fmtMoney(balanco.pl)}</p></div>
        </div>
      )}
    </div>
  );
}