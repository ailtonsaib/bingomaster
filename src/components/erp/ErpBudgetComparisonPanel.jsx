import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = (v) => Number(v) || 0;

export default function ErpBudgetComparisonPanel({ user }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [budgets, setBudgets] = useState([]);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, j, a] = await Promise.all([
          base44.entities.ErpBudget.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpJournalEntry.filter({ user_email: user.email }, "-date", 500),
          base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 1000),
        ]);
        setBudgets(b); setJournals(j); setAccounts(a);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const yearBudgets = budgets.filter(b => num(b.year) === year && b.is_active !== false);
  const yearJournals = journals.filter(j => j.status === "definitivo" && (j.date || "").startsWith(String(year)));

  // Realizado = lançamentos contábeis das contas vinculadas à categoria do orçamento
  const realized = (budget) => {
    const c = (budget.category || "").trim().toLowerCase();
    if (!c) return null; // sem vínculo
    const matched = accounts.filter(ac =>
      (ac.code || "").toLowerCase() === c ||
      (ac.name || "").toLowerCase() === c ||
      ((ac.name || "").toLowerCase().includes(c) && c.length >= 3));
    if (!matched.length) return null;
    const ids = new Set(matched.map(m => m.id));
    const revIds = new Set(matched.filter(m => m.account_type === "receita").map(m => m.id));
    const monthPrefix = num(budget.month) > 0 ? `${year}-${String(num(budget.month)).padStart(2, "0")}` : null;
    let total = 0;
    yearJournals.forEach(j => {
      if (monthPrefix && !(j.date || "").startsWith(monthPrefix)) return;
      (j.lines || []).forEach(l => {
        if (ids.has(l.account_id)) total += revIds.has(l.account_id) ? num(l.credit) : num(l.debit);
      });
    });
    return total;
  };

  const rows = yearBudgets.map(b => {
    const real = realized(b);
    const planned = num(b.planned_value);
    return {
      id: b.id, name: b.name, category: b.category,
      department_name: b.department_name || "",
      sectorCell: b.allocation_mode === "setor" ? (b.sector_name || "—")
        : (b.sector_allocations || []).length ? `${b.sector_allocations.length} setor(es) — rateio` : "—",
      sectorTitle: (b.sector_allocations || []).map(a => `${a.sector_name}: ${a.percent}% = ${fmtMoney(a.value)}`).join(" • "),
      monthLabel: num(b.month) > 0 ? MONTHS[num(b.month)] : "Ano todo",
      planned, realized: real,
      diff: real === null ? null : planned - real,
    };
  });
  const totPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const linked = rows.filter(r => r.realized !== null);
  const totReal = linked.reduce((s, r) => s + r.realized, 0);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-sm">Comparativo Orçado x Realizado</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Exercício</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
            {[currentYear, currentYear - 1, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Orçado ({year})</p><p className="text-xl font-bold">{fmtMoney(totPlanned)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Realizado (vinculados)</p><p className="text-xl font-bold text-emerald-600">{fmtMoney(totReal)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Variação</p><p className={`text-xl font-bold ${totPlanned - totReal < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(totPlanned - totReal)}</p></div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Orçamento</th><th className="p-2 text-left">Categoria / Conta</th><th className="p-2 text-left">Departamento</th><th className="p-2 text-left">Setor</th><th className="p-2 text-left">Mês</th>
                <th className="p-2 text-right">Planejado</th><th className="p-2 text-right">Realizado</th>
                <th className="p-2 text-right">Variação</th><th className="p-2 text-right">% Executado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhum orçamento ativo para {year}. Cadastre na aba "Cadastro de Orçamentos".</td></tr>
                : rows.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-xs">{r.category || "—"}</td>
                    <td className="p-2">{r.department_name || "—"}</td>
                    <td className="p-2 text-xs" title={r.sectorTitle}>{r.sectorCell}</td>
                    <td className="p-2 text-xs">{r.monthLabel}</td>
                    <td className="p-2 text-right">{fmtMoney(r.planned)}</td>
                    <td className="p-2 text-right text-emerald-600">{r.realized === null ? <span className="text-gray-400 text-xs">sem vínculo contábil</span> : fmtMoney(r.realized)}</td>
                    <td className={`p-2 text-right ${r.diff === null ? "" : r.diff < 0 ? "text-red-600" : "text-emerald-700"}`}>{r.diff === null ? "—" : fmtMoney(r.diff)}</td>
                    <td className="p-2 text-right text-xs">{r.realized === null || r.planned <= 0 ? "—" : `${(r.realized / r.planned * 100).toFixed(1)}%`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">O realizado soma os débitos (ou créditos, se conta de receita) dos lançamentos contábeis definitivos das contas cujo código ou nome corresponde à categoria do orçamento. Preencha a categoria com o código/nome da conta contábil para vincular.</p>
    </div>
  );
}