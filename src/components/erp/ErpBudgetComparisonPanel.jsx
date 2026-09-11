import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { fmtMoney } from "@/lib/erpUtils";

const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = (v) => Number(v) || 0;

// Comparativo do orçamento: Orçado (planejado), Empenhado (notas lançadas —
// independente de pagas ou não) e Realizado (somente documentos pagos no financeiro).
export default function ErpBudgetComparisonPanel({ user }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [budgets, setBudgets] = useState([]);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, j, a, e, p] = await Promise.all([
          base44.entities.ErpBudget.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpJournalEntry.filter({ user_email: user.email }, "-date", 500),
          base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 1000),
          base44.entities.ErpFiscalEntry.filter({ user_email: user.email, status: "lancada" }, "-entry_date", 500),
          base44.entities.ErpPayable.filter({ user_email: user.email }, "-created_date", 500),
        ]);
        setBudgets(b); setJournals(j); setAccounts(a); setEntries(e); setPayables(p);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const yearBudgets = budgets.filter(b => num(b.year) === year && b.is_active !== false);
  const yearJournals = journals.filter(j => j.status === "definitivo" && (j.date || "").startsWith(String(year)));
  const yearEntries = entries.filter(e => (e.entry_date || e.issue_date || "").startsWith(String(year)));

  // Contas contábeis vinculadas à categoria do orçamento (código ou nome)
  const matchedAccounts = (budget) => {
    const c = (budget.category || "").trim().toLowerCase();
    if (!c) return [];
    return accounts.filter(ac =>
      (ac.code || "").toLowerCase() === c ||
      (ac.name || "").toLowerCase() === c ||
      ((ac.name || "").toLowerCase().includes(c) && c.length >= 3));
  };

  // Parcela de cada nota lançada atribuída ao orçamento pelos rateios da entrada:
  // contas vinculadas à categoria ou, em orçamento por setor, o próprio setor
  const entryShares = (budget, matched) => {
    const ids = new Set(matched.map(m => m.id));
    const bySector = budget.allocation_mode === "setor" && !!budget.sector_id;
    const monthPrefix = num(budget.month) > 0 ? `${year}-${String(num(budget.month)).padStart(2, "0")}` : null;
    const shares = [];
    yearEntries.forEach(e => {
      const d = e.entry_date || e.issue_date || "";
      if (monthPrefix && !d.startsWith(monthPrefix)) return;
      (e.apportionments || []).forEach(ap => {
        if (!(ids.has(ap.account_id) || (bySector && ap.sector_id === budget.sector_id))) return;
        const val = ap.rateio_type === "value" ? num(ap.value) : num(e.total_nota) * num(ap.percent) / 100;
        if (val > 0) shares.push({ entry: e, value: val });
      });
    });
    return shares;
  };

  const rows = yearBudgets.map(b => {
    const matched = matchedAccounts(b);
    const isReceita = matched.some(m => m.account_type === "receita");
    const linked = matched.length > 0 || (b.allocation_mode === "setor" && !!b.sector_id);
    const planned = num(b.planned_value);

    // Orçamento de receita: sem empenho — realizado pelos lançamentos contábeis (créditos)
    if (isReceita) {
      const ids = new Set(matched.map(m => m.id));
      const monthPrefix = num(b.month) > 0 ? `${year}-${String(num(b.month)).padStart(2, "0")}` : null;
      let real = 0;
      yearJournals.forEach(j => {
        if (monthPrefix && !(j.date || "").startsWith(monthPrefix)) return;
        (j.lines || []).forEach(l => { if (ids.has(l.account_id)) real += num(l.credit); });
      });
      return {
        id: b.id, name: b.name, category: b.category, department_name: b.department_name || "",
        sectorCell: b.allocation_mode === "setor" ? (b.sector_name || "—")
          : (b.sector_allocations || []).length ? `${b.sector_allocations.length} setor(es) — rateio` : "—",
        sectorTitle: (b.sector_allocations || []).map(a => `${a.sector_name}: ${a.percent}% = ${fmtMoney(a.value)}`).join(" • "),
        monthLabel: num(b.month) > 0 ? MONTHS[num(b.month)] : "Ano todo",
        planned, committed: 0, realized: real, linked: true, isReceita: true,
        saldo: planned, diff: planned - real,
      };
    }

    const shares = linked ? entryShares(b, matched) : [];
    // Empenhado: notas lançadas, independente de pagas ou não
    const committed = shares.reduce((s, x) => s + x.value, 0);
    // Realizado: somente a parcela dos documentos pagos (baixados no financeiro)
    const realized = shares.reduce((s, x) => {
      const pays = payables.filter(p => p.fiscal_entry_id === x.entry.id);
      const tot = pays.reduce((s2, p) => s2 + num(p.amount), 0);
      const paid = pays.filter(p => p.status === "pago").reduce((s2, p) => s2 + num(p.settled_value || p.amount), 0);
      const ratio = tot > 0 ? Math.min(1, paid / tot) : 0;
      return s + x.value * ratio;
    }, 0);
    return {
      id: b.id, name: b.name, category: b.category, department_name: b.department_name || "",
      sectorCell: b.allocation_mode === "setor" ? (b.sector_name || "—")
        : (b.sector_allocations || []).length ? `${b.sector_allocations.length} setor(es) — rateio` : "—",
      sectorTitle: (b.sector_allocations || []).map(a => `${a.sector_name}: ${a.percent}% = ${fmtMoney(a.value)}`).join(" • "),
      monthLabel: num(b.month) > 0 ? MONTHS[num(b.month)] : "Ano todo",
      planned, committed, realized, linked, isReceita: false,
      saldo: planned - committed, diff: planned - realized,
    };
  });
  const totPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totCommitted = rows.reduce((s, r) => s + r.committed, 0);
  const totReal = rows.reduce((s, r) => s + r.realized, 0);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-sm">Comparativo Orçado x Empenhado x Realizado</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Exercício</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
            {[currentYear, currentYear - 1, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Orçado ({year})</p><p className="text-xl font-bold">{fmtMoney(totPlanned)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Empenhado (notas lançadas)</p><p className="text-xl font-bold text-blue-600">{fmtMoney(totCommitted)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Realizado (documentos pagos)</p><p className="text-xl font-bold text-emerald-600">{fmtMoney(totReal)}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Saldo (Orçado − Empenhado)</p><p className={`text-xl font-bold ${totPlanned - totCommitted < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(totPlanned - totCommitted)}</p></div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Orçamento</th><th className="p-2 text-left">Categoria / Conta</th><th className="p-2 text-left">Departamento</th><th className="p-2 text-left">Setor</th><th className="p-2 text-left">Mês</th>
                <th className="p-2 text-right">Orçado</th><th className="p-2 text-right">Empenhado</th><th className="p-2 text-right">Realizado</th>
                <th className="p-2 text-right">Saldo</th><th className="p-2 text-right">% Executado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhum orçamento ativo para {year}. Cadastre na aba "Cadastro de Orçamentos".</td></tr>
                : rows.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-xs">{r.category || "—"}</td>
                    <td className="p-2">{r.department_name || "—"}</td>
                    <td className="p-2 text-xs" title={r.sectorTitle}>{r.sectorCell}</td>
                    <td className="p-2 text-xs">{r.monthLabel}</td>
                    <td className="p-2 text-right">{fmtMoney(r.planned)}</td>
                    <td className="p-2 text-right text-blue-600">{!r.linked ? <span className="text-gray-400 text-xs">sem vínculo</span> : r.isReceita ? "—" : fmtMoney(r.committed)}</td>
                    <td className="p-2 text-right text-emerald-600">{!r.linked ? <span className="text-gray-400 text-xs">sem vínculo</span> : fmtMoney(r.realized)}</td>
                    <td className={`p-2 text-right ${!r.linked ? "" : r.saldo < 0 ? "text-red-600" : "text-emerald-700"}`}>{!r.linked ? "—" : fmtMoney(r.saldo)}</td>
                    <td className="p-2 text-right text-xs">{!r.linked || r.planned <= 0 ? "—" : `${(r.realized / r.planned * 100).toFixed(1)}%`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Empenhado: valor das notas lançadas atribuído ao orçamento pelo rateio da entrada (conta da categoria ou setor), independente de pagas ou não.
        Realizado: parcela dos documentos efetivamente pagos (baixados no financeiro). Orçamentos de receita seguem pelos créditos dos lançamentos contábeis.
        Preencha a categoria com o código/nome da conta contábil para vincular.
      </p>
    </div>
  );
}