import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/erpUtils";
import { printElements } from "@/lib/printUtils";

const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = (v) => Number(v) || 0;

// Pares de comparação do relatório — o usuário escolhe quais exibir/imprimir
const PAIR_DEFS = [
  { key: "orc_empenhado", label: "Orçado x Empenhado", aKey: "planned", aLabel: "Orçado", bKey: "committed", bLabel: "Empenhado" },
  { key: "orc_realizado", label: "Orçado x Realizado", aKey: "planned", aLabel: "Orçado", bKey: "realized", bLabel: "Realizado" },
  { key: "empenhado_realizado", label: "Empenhado x Realizado", aKey: "committed", aLabel: "Empenhado", bKey: "realized", bLabel: "Realizado" },
];

// Relatório comparativo do orçamento: Orçado (planejado), Empenhado (notas
// lançadas — independente de pagas ou não) e Realizado (somente documentos pagos).
// Filtro por departamento (com quebra e totalização por setor), setor ou conta contábil.
export default function ErpBudgetComparisonPanel({ user }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [pairs, setPairs] = useState(["orc_empenhado"]);
  const [dim, setDim] = useState("all"); // all | department | sector | account
  const [dimValue, setDimValue] = useState("");
  const [budgets, setBudgets] = useState([]);
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [entries, setEntries] = useState([]);
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, j, a, sec, e, p] = await Promise.all([
          base44.entities.ErpBudget.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpJournalEntry.filter({ user_email: user.email }, "-date", 500),
          base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 1000),
          base44.entities.ErpSector.filter({ user_email: user.email }, "name", 500),
          base44.entities.ErpFiscalEntry.filter({ user_email: user.email, status: "lancada" }, "-entry_date", 500),
          base44.entities.ErpPayable.filter({ user_email: user.email }, "-created_date", 500),
        ]);
        setBudgets(b); setJournals(j); setAccounts(a); setSectors(sec); setEntries(e); setPayables(p);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const togglePair = (key) =>
    setPairs(p => p.includes(key) ? p.filter(x => x !== key) : [...p, key]);

  const yearBudgets = budgets.filter(b => num(b.year) === year && b.is_active !== false);
  const yearJournals = journals.filter(j => j.status === "definitivo" && (j.date || "").startsWith(String(year)));
  const yearEntries = entries.filter(e => (e.entry_date || e.issue_date || "").startsWith(String(year)));
  const sectorById = new Map(sectors.map(s => [s.id, s]));

  // Opções do filtro: departamentos (dos setores e dos orçamentos) e setores
  const deptOptions = (() => {
    const map = new Map();
    sectors.forEach(s => { if (s.department_id && !map.has(s.department_id)) map.set(s.department_id, s.department_name || s.department_id); });
    yearBudgets.forEach(b => { if (b.department_id && !map.has(b.department_id)) map.set(b.department_id, b.department_name || b.department_id); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();

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
        if (val > 0) shares.push({ entry: e, value: val, sector_id: ap.sector_id || "", sector_name: ap.sector_name || "" });
      });
    });
    return shares;
  };

  // Proporção paga da entrada: documentos baixados ÷ total das contas a pagar da nota
  const paidRatioByEntry = new Map();
  const paidRatioOf = (entry) => {
    if (paidRatioByEntry.has(entry.id)) return paidRatioByEntry.get(entry.id);
    const pays = payables.filter(p => p.fiscal_entry_id === entry.id);
    const tot = pays.reduce((s, p) => s + num(p.amount), 0);
    const paid = pays.filter(p => p.status === "pago").reduce((s, p) => s + num(p.settled_value || p.amount), 0);
    const ratio = tot > 0 ? Math.min(1, paid / tot) : 0;
    paidRatioByEntry.set(entry.id, ratio);
    return ratio;
  };

  // Cada orçamento gera uma ou mais linhas por setor — base da quebra
  const budgetRows = yearBudgets.map(b => {
    const matched = matchedAccounts(b);
    const isReceita = matched.some(m => m.account_type === "receita");
    const linked = matched.length > 0 || (b.allocation_mode === "setor" && !!b.sector_id);
    const planned = num(b.planned_value);
    const base = {
      id: b.id, name: b.name, category: b.category, department_name: b.department_name || "",
      sectorCell: b.allocation_mode === "setor" ? (b.sector_name || "—")
        : (b.sector_allocations || []).length ? `${b.sector_allocations.length} setor(es) — rateio` : "—",
      sectorTitle: (b.sector_allocations || []).map(a => `${a.sector_name}: ${a.percent}% = ${fmtMoney(a.value)}`).join(" • "),
      monthLabel: num(b.month) > 0 ? MONTHS[num(b.month)] : "Ano todo",
      accountIds: new Set(matched.map(m => m.id)),
      // Departamento do orçamento: direto, ou o do setor (orçamento por setor)
      dept_id: b.allocation_mode === "setor" ? sectorById.get(b.sector_id)?.department_id || "" : (b.department_id || ""),
      linked, isReceita,
    };

    // Orçamento de receita: sem empenho — realizado pelos lançamentos contábeis (créditos)
    if (isReceita) {
      const ids = new Set(matched.map(m => m.id));
      const monthPrefix = num(b.month) > 0 ? `${year}-${String(num(b.month)).padStart(2, "0")}` : null;
      let real = 0;
      yearJournals.forEach(j => {
        if (monthPrefix && !(j.date || "").startsWith(monthPrefix)) return;
        (j.lines || []).forEach(l => { if (ids.has(l.account_id)) real += num(l.credit); });
      });
      return { ...base, committed: 0, realized: real, lines: [{ sector_id: b.sector_id || "", setorName: b.sector_name || "—", planned, committed: 0, realized: real }] };
    }

    const shares = linked ? entryShares(b, matched) : [];
    const committed = shares.reduce((s, x) => s + x.value, 0);
    const realized = shares.reduce((s, x) => s + x.value * paidRatioOf(x.entry), 0);

    // Linhas por setor: orçamento por setor é direto; por departamento, quebra pelo
    // rateio entre setores (empenhado/realizado seguem os rateios das notas)
    let lines;
    if (b.allocation_mode === "setor") {
      lines = [{ sector_id: b.sector_id || "", setorName: b.sector_name || "—", planned, committed, realized }];
    } else if ((b.sector_allocations || []).length) {
      const covered = new Set();
      lines = b.sector_allocations.map(a => {
        covered.add(a.sector_id);
        const sh = shares.filter(s => s.sector_id === a.sector_id);
        return {
          sector_id: a.sector_id || "", setorName: a.sector_name || "—",
          planned: num(a.value) || planned * num(a.percent) / 100,
          committed: sh.reduce((s, x) => s + x.value, 0),
          realized: sh.reduce((s, x) => s + x.value * paidRatioOf(x.entry), 0),
        };
      });
      const leftover = shares.filter(s => !covered.has(s.sector_id));
      if (leftover.length) {
        lines.push({
          sector_id: "", setorName: "Outros setores",
          planned: 0,
          committed: leftover.reduce((s, x) => s + x.value, 0),
          realized: leftover.reduce((s, x) => s + x.value * paidRatioOf(x.entry), 0),
        });
      }
    } else {
      lines = [{ sector_id: "", setorName: "—", planned, committed, realized }];
    }
    return { ...base, committed, realized, lines };
  });

  // Aplica o filtro escolhido e monta as linhas do relatório
  const dimActive = dim !== "all" && !!dimValue;
  const isDeptBreak = dim === "department" && dimActive;
  const selectedRows = budgetRows.filter(b => {
    if (!dimActive) return true;
    if (dim === "department") return b.dept_id === dimValue;
    if (dim === "sector") return b.lines.some(l => l.sector_id === dimValue);
    if (dim === "account") return b.accountIds.has(dimValue);
    return true;
  });

  // Linhas do relatório: com quebra por setor (departamento) ou uma linha por orçamento
  const reportLines = (() => {
    if (isDeptBreak) {
      return selectedRows.flatMap(b =>
        b.lines.map(l => ({
          name: b.name, category: b.category, department_name: b.department_name,
          monthLabel: b.monthLabel, linked: b.linked, isReceita: b.isReceita,
          setorName: l.setorName, planned: l.planned, committed: l.committed, realized: l.realized,
        })));
    }
    if (dim === "sector" && dimActive) {
      return selectedRows.flatMap(b =>
        b.lines.filter(l => l.sector_id === dimValue).map(l => ({
          name: b.name, category: b.category, department_name: b.department_name,
          monthLabel: b.monthLabel, linked: b.linked, isReceita: b.isReceita,
          setorName: l.setorName, planned: l.planned, committed: l.committed, realized: l.realized,
        })));
    }
    return selectedRows.map(b => ({
      name: b.name, category: b.category, department_name: b.department_name,
      monthLabel: b.monthLabel, linked: b.linked, isReceita: b.isReceita,
      setorName: b.sectorCell, planned: b.planned, committed: b.committed, realized: b.realized,
      sectorTitle: b.sectorTitle,
    }));
  })();

  // Quebra por setor (modo departamento): agrupa e totaliza cada setor
  const sections = (() => {
    if (!isDeptBreak) return [{ setorName: null, lines: reportLines }];
    const groups = new Map();
    reportLines.forEach(l => {
      const k = l.setorName || "—";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(l);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([setorName, lines]) => ({ setorName, lines }));
  })();

  const sumOf = (lines, key) => lines.reduce((s, l) => s + (l.linked ? l[key] : 0), 0);
  const totPlanned = reportLines.reduce((s, l) => s + l.planned, 0);
  const totCommitted = sumOf(reportLines, "committed");
  const totReal = sumOf(reportLines, "realized");
  const selPairs = PAIR_DEFS.filter(p => pairs.includes(p.key));

  const dimOptions = dim === "department" ? deptOptions
    : dim === "sector" ? sectors.map(s => ({ id: s.id, name: s.name }))
    : dim === "account" ? accounts.map(a => ({ id: a.id, name: `${a.code} — ${a.name}` }))
    : [];
  const dimLabel = dim === "department" ? deptOptions.find(d => d.id === dimValue)?.name
    : dim === "sector" ? sectorById.get(dimValue)?.name
    : dim === "account" ? accounts.find(a => a.id === dimValue)?.name
    : null;

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      {/* Filtros — fora da área de impressão */}
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <h2 className="font-semibold text-sm">Relatório Comparativo do Orçamento</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Exercício</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
              {[currentYear, currentYear - 1, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Filtrar por</label>
            <select value={dim} onChange={e => { setDim(e.target.value); setDimValue(""); }} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
              <option value="all">Todos</option>
              <option value="department">Departamento (quebra por setor)</option>
              <option value="sector">Setor</option>
              <option value="account">Conta Contábil</option>
            </select>
            {dim !== "all" && (
              <select value={dimValue} onChange={e => setDimValue(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-sm max-w-64">
                <option value="">Selecione...</option>
                {dimOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {PAIR_DEFS.map(p => (
              <label key={p.key} className="flex items-center gap-1 text-xs text-gray-700 bg-white border rounded-md px-2 py-1.5">
                <input type="checkbox" checked={pairs.includes(p.key)} onChange={() => togglePair(p.key)} className="w-3.5 h-3.5" /> {p.label}
              </label>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => printElements(["budget-report-area"])} className="gap-1.5">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Área do relatório (impressão) */}
      <div id="budget-report-area" className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="font-bold text-base">Relatório Comparativo do Orçamento — Exercício {year}</h3>
          <p className="text-xs text-gray-500">
            {dimLabel ? `Filtro: ${dim === "department" ? "Departamento" : dim === "sector" ? "Setor" : "Conta Contábil"} ${dimLabel}${isDeptBreak ? " — quebra e totalização por setor" : ""} • ` : ""}
            Orçado: valor planejado • Empenhado: notas lançadas (pagas ou não) • Realizado: somente documentos pagos —
            Emissão: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Orçado ({year})</p><p className="text-xl font-bold">{fmtMoney(totPlanned)}</p></div>
          <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Empenhado (notas lançadas)</p><p className="text-xl font-bold text-blue-600">{fmtMoney(totCommitted)}</p></div>
          <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Total Realizado (documentos pagos)</p><p className="text-xl font-bold text-emerald-600">{fmtMoney(totReal)}</p></div>
          <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Saldo (Orçado − Empenhado)</p><p className={`text-xl font-bold ${totPlanned - totCommitted < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(totPlanned - totCommitted)}</p></div>
        </div>

        {selPairs.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6 no-print">Selecione ao menos um comparativo acima (Orçado x Empenhado, Orçado x Realizado ou Empenhado x Realizado).</p>
        )}

        {selPairs.map(def => {
          const pairTotal = { planned: sumOf(reportLines, "planned"), committed: totCommitted, realized: totReal };
          return (
            <div key={def.key} className="space-y-2">
              <h4 className="font-semibold text-sm text-gray-700">{def.label}</h4>
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-500 text-xs">
                      <tr>
                        <th className="p-2 text-left">Orçamento</th><th className="p-2 text-left">Categoria / Conta</th><th className="p-2 text-left">Departamento</th><th className="p-2 text-left">Setor</th><th className="p-2 text-left">Mês</th>
                        <th className="p-2 text-right">{def.aLabel}</th><th className="p-2 text-right">{def.bLabel}</th>
                        <th className="p-2 text-right">Variação</th><th className="p-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLines.length === 0 ? <tr><td colSpan={9} className="p-6 text-center text-gray-400">Nenhum orçamento ativo para {year}{dimActive ? " com o filtro selecionado" : ""}. Cadastre na aba "Cadastro de Orçamentos".</td></tr>
                        : sections.map((sec, si) => (
                          <SectionRows key={si} section={sec} def={def} showGroupHeader={isDeptBreak} />
                        ))}
                      {reportLines.length > 0 && (
                        <tr className="border-t bg-gray-50 font-semibold">
                          <td className="p-2" colSpan={5}>Total Geral</td>
                          <td className="p-2 text-right">{fmtMoney(pairTotal.planned)}</td>
                          <td className={`p-2 text-right ${def.bKey === "committed" ? "text-blue-600" : "text-emerald-600"}`}>{fmtMoney(pairTotal[def.bKey])}</td>
                          <td className={`p-2 text-right ${(pairTotal[def.aKey] - pairTotal[def.bKey]) < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtMoney(pairTotal[def.aKey] - pairTotal[def.bKey])}</td>
                          <td className="p-2 text-right text-xs">{pairTotal[def.aKey] > 0 ? `${(pairTotal[def.bKey] / pairTotal[def.aKey] * 100).toFixed(1)}%` : "—"}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        <p className="text-xs text-gray-400">
          Empenhado: valor das notas lançadas atribuído ao orçamento pelo rateio da entrada (conta da categoria ou setor), independente de pagas ou não.
          Realizado: parcela dos documentos efetivamente pagos (baixados no financeiro). Orçamentos de receita seguem pelos créditos dos lançamentos contábeis.
          Preencha a categoria com o código/nome da conta contábil para vincular.
        </p>
      </div>
    </div>
  );
}

// Linhas de uma seção (grupo de setor, no modo departamento) com subtotal do setor
function SectionRows({ section, def, showGroupHeader }) {
  const sumOf = (key) => section.lines.reduce((s, l) => s + (l.linked ? l[key] : 0), 0);
  const totA = sumOf(def.aKey);
  const totB = sumOf(def.bKey);
  return (
    <>
      {showGroupHeader && (
        <tr className="border-t bg-slate-50">
          <td className="p-2 font-semibold text-slate-700" colSpan={5}>Setor: {section.setorName}</td>
          <td className="p-2 text-right font-semibold">{fmtMoney(sumOf("planned"))}</td>
          <td className={`p-2 text-right font-semibold ${def.bKey === "committed" ? "text-blue-600" : "text-emerald-600"}`}>{fmtMoney(totB)}</td>
          <td className={`p-2 text-right font-semibold ${(totA - totB) < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtMoney(totA - totB)}</td>
          <td className="p-2 text-right text-xs font-semibold">{totA > 0 ? `${(totB / totA * 100).toFixed(1)}%` : "—"}</td>
        </tr>
      )}
      {section.lines.map((l, i) => {
        const a = l[def.aKey];
        const b = l[def.bKey];
        const bNa = def.bKey === "committed" && l.isReceita; // empenho não se aplica a receita
        return (
          <tr key={i} className="border-t hover:bg-gray-50">
            <td className={`p-2 ${showGroupHeader ? "font-medium pl-6" : "font-medium"}`}>{l.name}</td>
            <td className="p-2 text-xs">{l.category || "—"}</td>
            <td className="p-2">{l.department_name || "—"}</td>
            <td className="p-2 text-xs" title={l.sectorTitle}>{l.setorName}</td>
            <td className="p-2 text-xs">{l.monthLabel}</td>
            <td className="p-2 text-right">{fmtMoney(a)}</td>
            <td className={`p-2 text-right ${def.bKey === "committed" ? "text-blue-600" : "text-emerald-600"}`}>
              {!l.linked ? <span className="text-gray-400 text-xs">sem vínculo</span> : bNa ? "—" : fmtMoney(b)}
            </td>
            <td className={`p-2 text-right ${!l.linked || bNa ? "" : (a - b) < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {!l.linked || bNa ? "—" : fmtMoney(a - b)}
            </td>
            <td className="p-2 text-right text-xs">{!l.linked || bNa || a <= 0 ? "—" : `${(b / a * 100).toFixed(1)}%`}</td>
          </tr>
        );
      })}
      {showGroupHeader && section.lines.length > 0 && (
        <tr className="border-t bg-slate-100/60 font-semibold text-slate-700">
          <td className="p-2" colSpan={5}>Subtotal — Setor {section.setorName}</td>
          <td className="p-2 text-right">{fmtMoney(sumOf("planned"))}</td>
          <td className={`p-2 text-right ${def.bKey === "committed" ? "text-blue-600" : "text-emerald-600"}`}>{fmtMoney(totB)}</td>
          <td className={`p-2 text-right ${(totA - totB) < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtMoney(totA - totB)}</td>
          <td className="p-2 text-right text-xs">{totA > 0 ? `${(totB / totA * 100).toFixed(1)}%` : "—"}</td>
        </tr>
      )}
    </>
  );
}