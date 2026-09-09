import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { exportBalancete, exportBalanco } from "@/lib/erpAccountingExport";

const fmtMoney = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Nível hierárquico pela máscara do código (qtd. de pontos + 1)
const codeLevel = (code) => (code || "").split(".").length;

// Cálculo de saldos no padrão balancete (D/C):
// - Saldo Inicial: D se siDeb >= siCre, magnitude = |siDeb - siCre|
// - Saldo Final: se SI for D -> SI + Débito - Crédito; se SI for C -> SI - Débito + Crédito
//   O sinal do resultado define se o SF é D ou C.
const computeSaldo = (siDeb, siCre, deb, cre) => {
  const d = Number(siDeb) || 0, c = Number(siCre) || 0, db = Number(deb) || 0, cr = Number(cre) || 0;
  const siIsDebit = d >= c;
  const siMag = siIsDebit ? (d - c) : (c - d);
  const sfRaw = siIsDebit ? (siMag + db - cr) : (siMag - db + cr);
  const sfIsDebit = sfRaw >= 0 ? siIsDebit : !siIsDebit;
  const sfMag = Math.abs(sfRaw);
  return { siMag, siIsDebit, sfMag, sfIsDebit };
};
const fmtDC = (mag, isDebit) => (mag ? `${fmtMoney(mag)} ${isDebit ? "D" : "C"}` : "—");

export default function ErpAccountingReports({ user }) {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("balancete");
  const [year, setYear] = useState(new Date().getFullYear());
  const [razaoAccount, setRazaoAccount] = useState("");
  const [onlyWithValues, setOnlyWithValues] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [j, a, comps] = await Promise.all([
        base44.entities.ErpJournalEntry.filter({ user_email: user.email, status: "definitivo" }, "date", 5000),
        base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 5000),
        base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 5),
      ]);
      setEntries(j); setAccounts(a);
      setCompany(comps.length > 0 ? comps[0] : null);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const yearStart = new Date(Number(year), 0, 1);
  const yearEnd = new Date(Number(year) + 1, 0, 1);
  const inYear = useMemo(() => entries.filter(e => { const d = new Date(e.date); return d >= yearStart && d < yearEnd; }), [entries, yearStart, yearEnd]);
  const beforeYear = useMemo(() => entries.filter(e => new Date(e.date) < yearStart), [entries, yearStart]);

  // --- Saldos por conta analítica (componentes crus D/C) ---
  // siDeb/siCre = acumulado antes do ano; deb/cre = movimentação no ano
  const analBalances = useMemo(() => {
    const map = {};
    accounts.forEach(a => { map[a.id] = { siDeb: 0, siCre: 0, deb: 0, cre: 0 }; });
    beforeYear.forEach(e => (e.lines || []).forEach(l => {
      if (!l.account_id) return;
      if (!map[l.account_id]) map[l.account_id] = { siDeb: 0, siCre: 0, deb: 0, cre: 0 };
      map[l.account_id].siDeb += Number(l.debit) || 0;
      map[l.account_id].siCre += Number(l.credit) || 0;
    }));
    inYear.forEach(e => (e.lines || []).forEach(l => {
      if (!l.account_id) return;
      if (!map[l.account_id]) map[l.account_id] = { siDeb: 0, siCre: 0, deb: 0, cre: 0 };
      map[l.account_id].deb += Number(l.debit) || 0;
      map[l.account_id].cre += Number(l.credit) || 0;
    }));
    return map;
  }, [beforeYear, inYear, accounts]);

  // --- Consolidação hierárquica: cada conta que possui filhas (sintética) soma
  // os saldos das contas folha (analíticas reais) descendentes pela máscara do código.
  const consolidated = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
    const hasChildren = (code) => sorted.some(c => c.code !== code && (c.code || "").startsWith((code || "") + "."));
    const leaves = sorted.filter(c => !hasChildren(c.code));
    const result = sorted.map(a => {
      const isGrouping = hasChildren(a.code);
      const isAnalitica = !isGrouping;
      let siDeb = 0, siCre = 0, deb = 0, cre = 0;
      if (isAnalitica) {
        const b = analBalances[a.id] || { siDeb: 0, siCre: 0, deb: 0, cre: 0 };
        siDeb = b.siDeb; siCre = b.siCre; deb = b.deb; cre = b.cre;
      } else {
        const prefix = (a.code || "") + ".";
        leaves.forEach(c => {
          if ((c.code || "").startsWith(prefix)) {
            const b = analBalances[c.id] || { siDeb: 0, siCre: 0, deb: 0, cre: 0 };
            siDeb += b.siDeb; siCre += b.siCre; deb += b.deb; cre += b.cre;
          }
        });
      }
      const { siMag, siIsDebit, sfMag, sfIsDebit } = computeSaldo(siDeb, siCre, deb, cre);
      const siD = siIsDebit ? siMag : -siMag;
      const sfD = sfIsDebit ? sfMag : -sfMag;
      const si = a.nature === "credora" ? -siD : siD;
      const sf = a.nature === "credora" ? -sfD : sfD;
      return {
        id: a.id, code: a.code, name: a.name, nature: a.nature, account_type: a.account_type,
        analitica: isAnalitica, level: codeLevel(a.code) - 1,
        siDeb, siCre, deb, cre, siMag, siIsDebit, sfMag, sfIsDebit, si, sf,
      };
    });
    return result;
  }, [accounts, analBalances]);

  // --- Balancete: todas as contas (sintéticas + analíticas) consolidadas ---
  const balancete = consolidated;
  // Opção: listar apenas contas com valores (saldo inicial, débito/crédito ou saldo final)
  const balanceteRows = useMemo(() => onlyWithValues
    ? balancete.filter(r => r.siMag || r.deb || r.cre || r.sfMag)
    : balancete, [balancete, onlyWithValues]);
  const totals = useMemo(() => {
    // Totais apenas das analíticas (sintéticas são consolidação — somá-las duplicaria)
    const a = consolidated.filter(r => r.analitica);
    const siDeb = a.reduce((s, r) => s + r.siDeb, 0);
    const siCre = a.reduce((s, r) => s + r.siCre, 0);
    const deb = a.reduce((s, r) => s + r.deb, 0);
    const cre = a.reduce((s, r) => s + r.cre, 0);
    const { siMag, siIsDebit, sfMag, sfIsDebit } = computeSaldo(siDeb, siCre, deb, cre);
    return { deb, cre, siMag, siIsDebit, sfMag, sfIsDebit };
  }, [consolidated]);

  // --- DRE ---
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

  // --- Razão ---
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
  const razaoRaw = razaoAcct ? (analBalances[razaoAcct.id] || null) : null;
  const razaoSi = razaoRaw ? (razaoAcct.nature === "credora" ? (razaoRaw.siCre - razaoRaw.siDeb) : (razaoRaw.siDeb - razaoRaw.siCre)) : 0;
  const razaoSaldo = razaoSi + razaoLines.reduce((a, l) => a + l.debit - l.credit, 0);

  // --- Balanço Patrimonial hierárquico consolidado ---
  const balanco = useMemo(() => {
    const buildGroup = (id, label) => {
      const accs = consolidated.filter(r => r.account_type === id).sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
      // saldo da conta conforme natureza para balanço
      const items = accs.map(a => ({
        ...a, saldo: a.sf, level: a.level, analitica: a.analitica,
      }));
      // Total do grupo = soma das contas de nível superior (topo), que já consolidam os descendentes.
      // Se não houver contas de nível 0, soma as analíticas.
      const topItems = items.filter(r => r.level === 0);
      const total = topItems.length > 0
        ? topItems.reduce((s, r) => s + r.sf, 0)
        : items.filter(r => r.analitica).reduce((s, r) => s + r.sf, 0);
      return { id, label, accounts: items, total };
    };
    const ativo = buildGroup("ativo", "Ativo");
    const passivo = buildGroup("passivo", "Passivo");
    const pl = buildGroup("patrimonio_liquido", "Patrimônio Líquido");
    return { ativo, passivo, pl };
  }, [consolidated]);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const companyName = company?.razao_social || "";

  const TABS = [
    { id: "balancete", label: "Balancete de Verificação" },
    { id: "razao", label: "Razão" },
    { id: "dre", label: "DRE" },
    { id: "balanco", label: "Balanço Patrimonial" },
  ];

  const ExportButtons = ({ onPdf, onXls }) => (
    <div className="flex items-center gap-2">
      <button onClick={onXls} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
      <button onClick={onPdf} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"><FileText className="w-4 h-4" /> PDF</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t.id ? "bg-amber-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Ano:</span>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-8 w-20 rounded-md border border-input px-2 text-sm" />
          {tab === "balancete" && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={onlyWithValues} onChange={e => setOnlyWithValues(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              Somente contas com valores
            </label>
          )}
          {tab === "balancete" && (
            <ExportButtons
              onPdf={() => exportBalancete({ rows: balanceteRows, totals, year, companyName, format: "pdf" })}
              onXls={() => exportBalancete({ rows: balanceteRows, totals, year, companyName, format: "excel" })}
            />
          )}
          {tab === "balanco" && (
            <ExportButtons
              onPdf={() => exportBalanco({ groups: [balanco.ativo, balanco.passivo, balanco.pl], year, companyName, format: "pdf" })}
              onXls={() => exportBalanco({ groups: [balanco.ativo, balanco.passivo, balanco.pl], year, companyName, format: "excel" })}
            />
          )}
        </div>
      </div>

      {tab === "balancete" && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs">
                <tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Conta</th><th className="p-2 text-right">Saldo Inicial</th><th className="p-2 text-right">Débito</th><th className="p-2 text-right">Crédito</th><th className="p-2 text-right">Saldo Final</th></tr>
              </thead>
              <tbody>
                {balanceteRows.map(r => (
                  <tr key={r.id} className={`border-t hover:bg-gray-50 ${!r.analitica ? "bg-gray-50/60 font-semibold" : ""}`}>
                    <td className="p-2 font-mono text-xs">{r.code}</td>
                    <td className="p-2" style={{ paddingLeft: `${8 + r.level * 14}px` }}>{r.name}</td>
                    <td className="p-2 text-right">{fmtDC(r.siMag, r.siIsDebit)}</td>
                    <td className="p-2 text-right">{r.deb ? fmtMoney(r.deb) : "—"}</td>
                    <td className="p-2 text-right">{r.cre ? fmtMoney(r.cre) : "—"}</td>
                    <td className="p-2 text-right font-medium">{fmtDC(r.sfMag, r.sfIsDebit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 bg-gray-100 font-bold"><td colSpan={2} className="p-2">Totais (analíticas)</td><td className="p-2 text-right">{fmtDC(totals.siMag, totals.siIsDebit)}</td><td className="p-2 text-right">{fmtMoney(totals.deb)}</td><td className="p-2 text-right">{fmtMoney(totals.cre)}</td><td className="p-2 text-right">{fmtDC(totals.sfMag, totals.sfIsDebit)}</td></tr>
                <tr className="bg-gray-100 text-xs text-gray-600"><td colSpan={6} className="p-2">Totais das analíticas (sintéticas são consolidação dos níveis superiores). {totals.deb === totals.cre ? "✓ Débito = Crédito" : "⚠ Desequilibrado"}</td></tr>
              </tfoot>
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
              {accounts.filter(a => a.accepts_entries).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          {razaoAccount && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Lançamento</th><th className="p-2 text-left">Histórico</th><th className="p-2 text-right">Débito</th><th className="p-2 text-right">Crédito</th><th className="p-2 text-right">Saldo</th></tr></thead>
                <tbody>
                  {(() => { let s = razaoSi; return razaoLines.map((l, i) => { s += l.debit - l.credit; return (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { ...balanco.ativo, color: "text-blue-700", bg: "bg-blue-50" },
            { ...balanco.passivo, color: "text-red-700", bg: "bg-red-50" },
            { ...balanco.pl, color: "text-purple-700", bg: "bg-purple-50" },
          ].map(g => (
            <div key={g.id} className="bg-white rounded-xl border overflow-hidden">
              <div className={`flex items-center justify-between p-3 border-b ${g.bg}`}>
                <h3 className={`font-semibold ${g.color}`}>{g.label}</h3>
                <span className={`font-bold ${g.color}`}>{fmtMoney(g.total)}</span>
              </div>
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 text-gray-500 sticky top-0"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Conta</th><th className="p-2 text-right">Saldo</th></tr></thead>
                  <tbody>
                    {g.accounts.map(a => (
                      <tr key={a.id} className={`border-t ${!a.analitica ? "bg-gray-50/70 font-semibold" : "hover:bg-gray-50"}`}>
                        <td className="p-2 font-mono">{a.code}</td>
                        <td className="p-2" style={{ paddingLeft: `${8 + a.level * 14}px` }}>{a.name}</td>
                        <td className="p-2 text-right font-medium">{a.saldo ? fmtMoney(a.saldo) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="md:col-span-2 bg-white rounded-xl border p-4 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Ativo = Passivo + Patrimônio Líquido</span>
            <span className={`font-bold ${balanco.ativo.total === balanco.passivo.total + balanco.pl.total ? "text-emerald-600" : "text-amber-600"}`}>
              {fmtMoney(balanco.ativo.total)} = {fmtMoney(balanco.passivo.total + balanco.pl.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}