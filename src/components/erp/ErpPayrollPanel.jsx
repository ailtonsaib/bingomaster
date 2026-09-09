import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, FileText, Receipt, Calculator, Download, Printer } from "lucide-react";
import { calcFolha, calcFerias, calcDecimoTerceiro, fmtMoney } from "@/lib/erpPayrollCalc";
import { checkOfficialTables } from "@/lib/erpPayrollTables";

const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PAYROLL_TYPES = [
  { value: "normal", label: "Folha Mensal" },
  { value: "ferias", label: "Férias" },
  { value: "primeira_parcela", label: "13º — 1ª Parcela" },
  { value: "segunda_parcela", label: "13º — 2ª Parcela" },
];
const num = (v) => Number(v) || 0;
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ErpPayrollPanel({ user }) {
  const [employees, setEmployees] = useState([]);
  const [rubricas, setRubricas] = useState([]);
  const [tables, setTables] = useState([]);
  const [folhas, setFolhas] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("folha");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showNewFolha, setShowNewFolha] = useState(false);
  const [holerite, setHolerite] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [emp, rub, tab, fol, comp] = await Promise.all([
        base44.entities.ErpEmployee.filter({ user_email: user.email }, "name", 500),
        base44.entities.ErpPayrollRubric.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpPayrollTaxTable.filter({ user_email: user.email }, "-year", 500),
        base44.entities.ErpPayroll.filter({ user_email: user.email }, "-created_date", 1000),
        base44.entities.ErpCompany.filter({ user_email: user.email }, "-created_date", 5),
      ]);
      setEmployees(emp.filter(e => e.is_active !== false));
      setRubricas(rub.filter(r => r.is_active !== false));
      setTables(tab);
      setCompany(comp[0] || null);
      setFolhas(fol);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  // Mapa de tabelas por tipo (is_default tem prioridade)
  // Usa a tabela do ano da competência; sem tabela do ano, usa qualquer uma (padrão primeiro)
  const taxTables = useMemo(() => {
    const map = {};
    ["inss", "irrf", "fgts", "salario_familia", "employer_charges"].forEach(type => {
      let of = tables.filter(t => t.tax_type === type && num(t.year) === year);
      if (of.length === 0) of = tables.filter(t => t.tax_type === type);
      map[type] = of.find(t => t.is_default) || of[0] || null;
    });
    return map;
  }, [tables, year]);
  const missingTables = ["inss", "irrf", "fgts", "salario_familia", "employer_charges"].filter(t => !taxTables[t]);
  // Tabelas oficiais em vigor para o ano da competência — importação obrigatória
  const vigencia = useMemo(() => checkOfficialTables(tables, year), [tables, year]);
  const calculoBloqueado = missingTables.length > 0 || vigencia.missing.length > 0;

  const monthFolhas = folhas.filter(f => num(f.month) === month && num(f.year) === year);
  const totals = useMemo(() => ({
    proventos: monthFolhas.reduce((s, f) => s + num(f.gross_provents || f.gross_salary), 0),
    descontos: monthFolhas.reduce((s, f) => s + num(f.total_discounts || f.discounts), 0),
    liquido: monthFolhas.reduce((s, f) => s + num(f.net_salary), 0),
    encargos: monthFolhas.reduce((s, f) => s + num(f.employer_total), 0),
  }), [monthFolhas]);

  // Linhas de rubricas padrão de um funcionário (auto preenchidas)
  const buildLines = (employee) => rubricas
    .filter(r => r.kind === "provento" || r.kind === "base")
    .map(r => ({
      rubric_id: r.id, code: r.code, name: r.name, kind: r.kind,
      value: r.auto_salary ? num(employee.salary_base) : 0,
      inc_inss: !!r.inc_inss, inc_irrf: !!r.inc_irrf, inc_fgts: !!r.inc_fgts, inc_13: !!r.inc_13,
    }))
    .filter(l => l.value > 0);

  const calcFor = (employee, lines) => {
    const r = calcFolha(employee, lines, taxTables);
    return {
      rubricas: lines,
      base_inss: r.base_inss, base_irrf: r.base_irrf, base_fgts: r.base_fgts, base_13: r.base_13,
      inss_value: r.inss_value, irrf_value: r.irrf_value, fgts_value: r.fgts_value,
      salario_familia_value: r.salario_familia_value, dependent_count: r.dependent_count,
      employer_inss: r.employer_inss, employer_fgts: r.employer_fgts, employer_sat: r.employer_sat,
      employer_terceiros: r.employer_terceiros, employer_total: r.employer_total,
      gross_provents: r.gross_provents, total_discounts: r.total_discounts, net_salary: r.net_salary,
    };
  };

  const calcAllFolhas = async () => {
    if (calculoBloqueado) return alert(vigencia.missing.length > 0
      ? `Importação obrigatória: importe as tabelas oficiais de ${year} em RH → Tabelas de Impostos ("Verificar Tabelas em Vigor") antes de calcular a folha.`
      : "Cadastre as tabelas de impostos (aba Tabelas de Impostos) antes de calcular a folha.");
    if (!confirm(`Calcular a folha de ${MONTHS[month]}/${year} para todos os funcionários ativos (${employees.length})? Funcionários com folha já lançada neste mês não serão duplicados.`)) return;
    setBusy(true);
    try {
      const jaLancados = new Set(monthFolhas.filter(f => f.payroll_type === "normal").map(f => f.employee_id));
      const novos = [];
      employees.forEach(emp => {
        if (jaLancados.has(emp.id)) return;
        const lines = buildLines(emp);
        if (!lines.length) return;
        const calc = calcFor(emp, lines);
        novos.push({
          user_email: user.email, employee_id: emp.id, employee_name: emp.name, employee_cpf: emp.cpf || "",
          job_title: emp.job_title || "", department_name: emp.department_name || "",
          month, year, payroll_type: "normal", status: "pendente",
          gross_salary: calc.gross_provents, gross_provents: calc.gross_provents,
          discounts: calc.total_discounts, ...calc,
        });
      });
      if (novos.length) await base44.entities.ErpPayroll.bulkCreate(novos);
      alert(`${novos.length} folha(s) calculada(s).`);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const markPago = async (f) => { await base44.entities.ErpPayroll.update(f.id, { status: "pago", payment_date: todayISO() }); load(); };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const TABS = [
    { id: "folha", label: "Folha Mensal", icon: Receipt },
    { id: "ferias", label: "Férias", icon: Calculator },
    { id: "decimo", label: "13º Salário", icon: Calculator },
    { id: "arquivos", label: "Arquivos da Receita", icon: FileText },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t.id ? "bg-emerald-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Competência:</span>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-8 rounded-md border border-input bg-white px-2 text-sm">
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="h-8 w-20 rounded-md border border-input px-2 text-sm" />
        </div>
      </div>

      {(missingTables.length > 0 || vigencia.missing.length > 0) && (
        <div className={`border rounded-lg p-2.5 text-xs ${vigencia.missing.length > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          {vigencia.missing.length > 0
            ? <>⛔ Importação obrigatória: as tabelas oficiais de {year} estão em vigor e não foram importadas ({vigencia.missingNames.join(", ")}). O cálculo da folha de {year} está bloqueado — vá em RH → Tabelas de Impostos e clique em "Verificar Tabelas em Vigor" para importar.</>
            : <>⚠ Tabelas de impostos não cadastradas ({missingTables.join(", ")}). Vá em RH → Tabelas de Impostos e clique em "Carregar Tabelas Padrão (2024/2026)" para habilitar os cálculos.</>}
        </div>
      )}

      {tab === "folha" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button size="sm" onClick={calcAllFolhas} disabled={busy || calculoBloqueado} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Calcular Folha de Todos</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewFolha(true)} className="gap-1.5"><Plus className="w-4 h-4" /> Folha Individual</Button>
            </div>
            <div className="text-xs text-gray-600 flex gap-3 flex-wrap">
              <span>Proventos: <b>{fmtMoney(totals.proventos)}</b></span>
              <span>Descontos: <b>{fmtMoney(totals.descontos)}</b></span>
              <span>Líquido: <b className="text-emerald-700">{fmtMoney(totals.liquido)}</b></span>
              <span>Encargos: <b className="text-red-700">{fmtMoney(totals.encargos)}</b></span>
            </div>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs">
                  <tr><th className="p-2 text-left">Funcionário</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Proventos</th><th className="p-2 text-right">Descontos</th><th className="p-2 text-right">Líquido</th><th className="p-2 text-right">Encargos</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Ações</th></tr>
                </thead>
                <tbody>
                  {monthFolhas.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhuma folha lançada para {MONTHS[month]}/{year}.</td></tr>
                    : monthFolhas.map(f => (
                      <tr key={f.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">{f.employee_name}</td>
                        <td className="p-2 text-xs">{(PAYROLL_TYPES.find(t => t.value === f.payroll_type) || { label: f.payroll_type }).label}</td>
                        <td className="p-2 text-right">{fmtMoney(f.gross_provents || f.gross_salary)}</td>
                        <td className="p-2 text-right text-red-600">{fmtMoney(f.total_discounts || f.discounts)}</td>
                        <td className="p-2 text-right font-semibold">{fmtMoney(f.net_salary)}</td>
                        <td className="p-2 text-right text-xs">{fmtMoney(f.employer_total)}</td>
                        <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${f.status === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{f.status === "pago" ? "Pago" : "Pendente"}</span></td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <button title="Holerite" onClick={() => setHolerite(f)} className="p-1 hover:bg-blue-50 rounded"><FileText className="w-4 h-4 text-blue-500" /></button>
                          {f.status !== "pago" && <button title="Marcar como Pago" onClick={() => markPago(f)} className="p-1 hover:bg-emerald-50 rounded"><Receipt className="w-4 h-4 text-emerald-500" /></button>}
                          <button title="Excluir" onClick={async () => { if (confirm(`Excluir a folha de ${f.employee_name}?`)) { await base44.entities.ErpPayroll.delete(f.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "ferias" && <FeriasTab user={user} employees={employees} taxTables={taxTables} month={month} year={year} blocked={calculoBloqueado} onSaved={load} />}
      {tab === "decimo" && <DecimoTab user={user} employees={employees} taxTables={taxTables} month={month} year={year} blocked={calculoBloqueado} onSaved={load} />}
      {tab === "arquivos" && <ArquivosTab folhas={monthFolhas} company={company} month={month} year={year} />}

      {showNewFolha && (
        <NewFolhaModal user={user} employees={employees} rubricas={rubricas} taxTables={taxTables} month={month} year={year} blocked={calculoBloqueado}
          onClose={() => setShowNewFolha(false)} onSaved={() => { setShowNewFolha(false); load(); }} buildLines={buildLines} calcFor={calcFor} />
      )}
      {holerite && <HolleriteModal folha={holerite} company={company} month={month} year={year} onClose={() => setHolerite(null)} />}
    </div>
  );
}

// ─── Férias ───
function FeriasTab({ user, employees, taxTables, month, year, blocked, onSaved }) {
  const [empId, setEmpId] = useState("");
  const [days, setDays] = useState(30);
  const [abono, setAbono] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const employee = employees.find(e => e.id === empId);
  const calc = employee ? calcFerias(employee, taxTables, num(days), abono) : null;

  const save = async () => {
    if (!employee) return alert("Selecione o funcionário.");
    setSaving(true);
    try {
      await base44.entities.ErpPayroll.create({
        user_email: user.email, employee_id: employee.id, employee_name: employee.name, employee_cpf: employee.cpf || "",
        job_title: employee.job_title || "", department_name: employee.department_name || "",
        month, year, payroll_type: "ferias", status: "pendente",
        vacation_days: num(days), vacation_start: start, vacation_end: end,
        abono_pecuniario: abono, ferias_um_terco: calc.ferias_um_terco,
        base_inss: calc.base_inss, base_irrf: calc.base_irrf, base_fgts: calc.base_fgts,
        inss_value: calc.inss_value, irrf_value: calc.irrf_value, fgts_value: calc.fgts_value,
        employer_inss: calc.employer_inss, employer_fgts: calc.employer_fgts, employer_sat: calc.employer_sat,
        employer_terceiros: calc.employer_terceiros, employer_total: calc.employer_total,
        gross_provents: calc.gross_provents, gross_salary: calc.gross_provents,
        total_discounts: calc.total_discounts, discounts: calc.total_discounts, net_salary: calc.net_salary,
        rubricas: [...calc.proventos.map(p => ({ ...p })), ...calc.descontos.map(d => ({ ...d }))],
      });
      alert("Férias lançadas na folha.");
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border p-4 max-w-2xl space-y-3">
      <h3 className="font-semibold text-sm">Cálculo de Férias</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2"><Label>Funcionário *</Label>
          <select value={empId} onChange={e => setEmpId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
            <option value="">Selecione...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {fmtMoney(e.salary_base)}</option>)}
          </select>
        </div>
        <div><Label>Dias de férias</Label><Input type="number" value={days} onChange={e => setDays(e.target.value)} /></div>
        <div className="flex items-end"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={abono} onChange={e => setAbono(e.target.checked)} className="w-4 h-4" /> Abono pecuniário (1/3)</label></div>
        <div><Label>Início</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div><Label>Fim</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
      </div>
      {calc && employee && (
        <div className="border rounded-lg p-3 text-sm space-y-1 bg-gray-50">
          <div className="flex justify-between"><span>Férias ({days} dias)</span><b>{fmtMoney(calc.vacation_value)}</b></div>
          <div className="flex justify-between"><span>1/3 Constitucional</span><b>{fmtMoney(calc.ferias_um_terco)}</b></div>
          {abono && <div className="flex justify-between"><span>Abono Pecuniário (isento)</span><b>{fmtMoney(calc.abono_value)}</b></div>}
          <div className="flex justify-between text-red-600"><span>INSS</span><b>-{fmtMoney(calc.inss_value)}</b></div>
          <div className="flex justify-between text-red-600"><span>IRRF</span><b>-{fmtMoney(calc.irrf_value)}</b></div>
          <div className="flex justify-between border-t pt-1"><span><b>Líquido das férias</b></span><b className="text-emerald-700">{fmtMoney(calc.net_salary)}</b></div>
          <div className="flex justify-between text-xs text-gray-500"><span>FGTS (depósito)</span><span>{fmtMoney(calc.fgts_value)}</span></div>
          <div className="flex justify-between text-xs text-gray-500"><span>Encargos do empregador</span><span>{fmtMoney(calc.employer_total)}</span></div>
        </div>
      )}
      <Button size="sm" disabled={saving || !employee || blocked} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Lançando..." : "Lançar Férias na Folha"}</Button>
    </div>
  );
}

// ─── 13º Salário ───
function DecimoTab({ user, employees, taxTables, month, year, blocked, onSaved }) {
  const [empId, setEmpId] = useState("");
  const [monthsWorked, setMonthsWorked] = useState(12);
  const [saving, setSaving] = useState(false);
  const employee = employees.find(e => e.id === empId);
  const calc = employee ? calcDecimoTerceiro(employee, taxTables, num(monthsWorked)) : null;

  const save = async () => {
    if (!employee) return alert("Selecione o funcionário.");
    setSaving(true);
    try {
      const base = {
        user_email: user.email, employee_id: employee.id, employee_name: employee.name, employee_cpf: employee.cpf || "",
        job_title: employee.job_title || "", department_name: employee.department_name || "",
        month, year, status: "pendente", decimo_months: calc.decimo_months,
        base_inss: calc.base_inss, base_irrf: calc.base_irrf, base_fgts: calc.base_fgts,
        inss_value: calc.inss_value, irrf_value: calc.irrf_value, fgts_value: calc.fgts_value,
        employer_inss: calc.employer_inss, employer_fgts: calc.employer_fgts, employer_sat: calc.employer_sat,
        employer_terceiros: calc.employer_terceiros, employer_total: calc.employer_total,
      };
      await base44.entities.ErpPayroll.bulkCreate([
        { ...base, payroll_type: "primeira_parcela", gross_provents: calc.primeira_parcela, gross_salary: calc.primeira_parcela, total_discounts: 0, discounts: 0, net_salary: calc.primeira_parcela,
          rubricas: [{ code: "13-1", name: `13º Salário — 1ª Parcela (${calc.decimo_months} meses)`, kind: "provento", value: calc.primeira_parcela }] },
        { ...base, payroll_type: "segunda_parcela", gross_provents: calc.decimo_total, gross_salary: calc.decimo_total, total_discounts: calc.inss_value + calc.irrf_value, discounts: calc.inss_value + calc.irrf_value, net_salary: calc.segunda_parcela,
          rubricas: [
            { code: "13-2", name: "13º Salário — 2ª Parcela (50% restante)", kind: "provento", value: calc.primeira_parcela },
            { code: "INSS", name: "INSS (total do 13º)", kind: "desconto", value: calc.inss_value },
            { code: "IRRF", name: "IRRF (total do 13º)", kind: "desconto", value: calc.irrf_value },
          ] },
      ]);
      alert("13º salário lançado (1ª e 2ª parcelas).");
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border p-4 max-w-2xl space-y-3">
      <h3 className="font-semibold text-sm">Cálculo de 13º Salário</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Funcionário *</Label>
          <select value={empId} onChange={e => setEmpId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
            <option value="">Selecione...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {fmtMoney(e.salary_base)}</option>)}
          </select>
        </div>
        <div><Label>Meses trabalhados (1-12)</Label><Input type="number" min="1" max="12" value={monthsWorked} onChange={e => setMonthsWorked(e.target.value)} /></div>
      </div>
      {calc && employee && (
        <div className="border rounded-lg p-3 text-sm space-y-1 bg-gray-50">
          <div className="flex justify-between"><span>13º Total ({calc.decimo_months} meses)</span><b>{fmtMoney(calc.decimo_total)}</b></div>
          <div className="flex justify-between"><span>1ª Parcela (sem descontos)</span><b className="text-emerald-700">{fmtMoney(calc.primeira_parcela)}</b></div>
          <div className="flex justify-between text-red-600"><span>INSS</span><b>-{fmtMoney(calc.inss_value)}</b></div>
          <div className="flex justify-between text-red-600"><span>IRRF</span><b>-{fmtMoney(calc.irrf_value)}</b></div>
          <div className="flex justify-between"><span>2ª Parcela (líquida)</span><b className="text-emerald-700">{fmtMoney(calc.segunda_parcela)}</b></div>
          <div className="flex justify-between text-xs text-gray-500"><span>FGTS (depósito)</span><span>{fmtMoney(calc.fgts_value)}</span></div>
          <div className="flex justify-between text-xs text-gray-500"><span>Encargos do empregador</span><span>{fmtMoney(calc.employer_total)}</span></div>
        </div>
      )}
      <Button size="sm" disabled={saving || !employee || blocked} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Lançando..." : "Lançar 13º na Folha"}</Button>
    </div>
  );
}

// ─── Arquivos da Receita (SEFIP/GFIP, eSocial S-1200, DCTF — layouts simplificados) ───
function ArquivosTab({ folhas, company, month, year }) {
  const [fileType, setFileType] = useState("sefip");
  const pad = (s, len) => String(s ?? "").substring(0, len).padEnd(len, " ");
  const lpad = (n, len) => String(num(n).toFixed(2)).replace(".", ",").padStart(len, " ");
  const cnpj = (company?.cnpj || "00000000000000").replace(/\D/g, "");

  const generateSefip = () => {
    const lines = [];
    lines.push(`00${pad("RECEITA FEDERAL - GFIP/SEFIP (SIMPLIFICADO)", 80)}`);
    lines.push(`01${pad(company?.razao_social || "EMPRESA", 60)}${pad(cnpj, 14)}${pad(month, 2)}${pad(year, 4)}`);
    folhas.forEach(f => {
      lines.push(`10${pad((f.employee_cpf || "").replace(/\D/g, ""), 11)}${pad(f.employee_name, 52)}${lpad(f.base_inss || f.gross_provents, 15)}${lpad(f.inss_value, 15)}${lpad(f.base_fgts || f.gross_provents, 15)}${lpad(f.fgts_value, 15)}`);
    });
    lines.push(`99${pad(folhas.length, 80)}`);
    return lines.join("\r\n");
  };

  const generateESocial = () => {
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const emp = folhas.map(f => `    <dmide>
      <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>
      <ideTrabalhador><cpfTrab>${(f.employee_cpf || "").replace(/\D/g, "")}</cpfTrab><nmTrab>${esc(f.employee_name)}</nmTrab></ideTrabalhador>
      <dmvInc><vrSalBase>${num(f.base_inss || f.gross_provents).toFixed(2)}</vrSalBase><vrDescCP>${num(f.inss_value).toFixed(2)}</vrDescCP><vrDescIRRF>${num(f.irrf_value).toFixed(2)}</vrDescIRRF><vrFGTS>${num(f.fgts_value).toFixed(2)}</vrFGTS><vrLiq>${num(f.net_salary).toFixed(2)}</vrLiq></dmvInc>
    </dmide>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtTabVinculo">
  <evtPagtoFolha Id="S1200-${cnpj}-${year}${String(month).padStart(2, "0")}">
    <ideEvento><indRetif>1</indRetif><tpAmb>2</tpAmb><procEmi>1</procEmi></ideEvento>
    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>
    <idePeriodo><perApur>${year}-${String(month).padStart(2, "0")}</perApur></idePeriodo>
${emp}
  </evtPagtoFolha>
</eSocial>`;
  };

  const generateDctf = () => {
    const totInss = folhas.reduce((s, f) => s + num(f.base_inss || f.gross_provents), 0);
    const totInssPat = folhas.reduce((s, f) => s + num(f.employer_inss), 0);
    const totIrrf = folhas.reduce((s, f) => s + num(f.irrf_value), 0);
    const totFgts = folhas.reduce((s, f) => s + num(f.fgts_value), 0);
    return [
      `DCTF (DECLARACAO DE DEBITOS E CREDITOS TRIBUTARIOS) - SIMPLIFICADO`,
      `EMPRESA: ${company?.razao_social || "-"} | CNPJ: ${cnpj}`,
      `PERIODO: ${String(month).padStart(2, "0")}/${year}`,
      ``,
      `CNP: 1244 - INSS PREVIDENCIARIO (CONTRIBUICAO PATRONAL)`,
      `  VALOR DA CONTRIBUICAO: R$ ${totInssPat.toFixed(2)}`,
      ``,
      `CNP: 0072 - IRRF - FOLHA DE PAGAMENTO`,
      `  VALOR RETIDO: R$ ${totIrrf.toFixed(2)}`,
      ``,
      `INSS DESCONTADO DOS EMPREGADOS: R$ ${folhas.reduce((s, f) => s + num(f.inss_value), 0).toFixed(2)}`,
      `BASE INSS TOTAL: R$ ${totInss.toFixed(2)}`,
      `FGTS A DEPOSITAR: R$ ${totFgts.toFixed(2)}`,
      ``,
      `TOTAL DE EMPREGADOS NA COMPETENCIA: ${folhas.length}`,
    ].join("\r\n");
  };

  const generate = () => {
    const ext = fileType === "esocial" ? "xml" : "txt";
    const content = fileType === "sefip" ? generateSefip() : fileType === "esocial" ? generateESocial() : generateDctf();
    const name = `${fileType.toUpperCase()}-${String(month).padStart(2, "0")}${year}.${ext}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="bg-white rounded-xl border p-4 max-w-2xl space-y-3">
      <h3 className="font-semibold text-sm">Geração de Arquivos para a Receita</h3>
      <p className="text-xs text-gray-500">Gera arquivos com base nas folhas lançadas na competência {MONTHS[month]}/{year} ({folhas.length} lançamento(s)). Layouts simplificados para conferência — não substituem a transmissão oficial via Conectividade Social / Receitanet.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tipo de arquivo</Label>
          <select value={fileType} onChange={e => setFileType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
            <option value="sefip">SEFIP / GFIP</option>
            <option value="esocial">eSocial — S-1200 (XML)</option>
            <option value="dctf">DCTF</option>
          </select>
        </div>
        <div className="flex items-end"><Button size="sm" onClick={generate} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Download className="w-4 h-4" /> Gerar e Baixar Arquivo</Button></div>
      </div>
      <div className="border rounded-lg p-3 bg-gray-50 text-xs space-y-1">
        <div className="flex justify-between"><span>Empresa:</span><b>{company?.razao_social || "não cadastrada"}</b></div>
        <div className="flex justify-between"><span>CNPJ:</span><b>{(company?.cnpj || "—")}</b></div>
        <div className="flex justify-between"><span>Folhas na competência:</span><b>{folhas.length}</b></div>
      </div>
    </div>
  );
}

// ─── Nova Folha Individual ───
function NewFolhaModal({ user, employees, rubricas, taxTables, month, year, blocked, onClose, onSaved, buildLines, calcFor }) {
  const [empId, setEmpId] = useState("");
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const employee = employees.find(e => e.id === empId);
  const calc = employee && lines.length ? calcFor(employee, lines) : null;

  const pickEmployee = (id) => {
    setEmpId(id);
    const emp = employees.find(e => e.id === id);
    setLines(emp ? buildLines(emp) : []);
  };
  const updLine = (i, v) => setLines(lines.map((l, idx) => idx === i ? { ...l, value: Number(v) } : l));
  const addLine = (rub) => {
    if (lines.some(l => l.rubric_id === rub.id)) return;
    setLines([...lines, { rubric_id: rub.id, code: rub.code, name: rub.name, kind: rub.kind, value: rub.auto_salary && employee ? num(employee.salary_base) : 0, inc_inss: !!rub.inc_inss, inc_irrf: !!rub.inc_irrf, inc_fgts: !!rub.inc_fgts, inc_13: !!rub.inc_13 }]);
  };

  const save = async () => {
    if (!employee) return alert("Selecione o funcionário.");
    if (!lines.some(l => l.value > 0)) return alert("Informe ao menos uma rubrica com valor.");
    setSaving(true);
    try {
      await base44.entities.ErpPayroll.create({
        user_email: user.email, employee_id: employee.id, employee_name: employee.name, employee_cpf: employee.cpf || "",
        job_title: employee.job_title || "", department_name: employee.department_name || "",
        month, year, payroll_type: "normal", status: "pendente", ...calc,
        gross_salary: calc.gross_provents, discounts: calc.total_discounts,
      });
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white"><h2 className="font-bold">Nova Folha Individual</h2><button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">✕</button></div>
        <div className="p-4 space-y-3">
          <div><Label>Funcionário *</Label>
            <select value={empId} onChange={e => pickEmployee(e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {fmtMoney(e.salary_base)}</option>)}
            </select>
          </div>
          {employee && (
            <>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-center">
                    <span className="font-mono text-xs col-span-1">{l.code}</span>
                    <span className="text-sm col-span-3">{l.name}</span>
                    <Input type="number" step="0.01" value={l.value} onChange={e => updLine(i, e.target.value)} className="col-span-2" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Label className="text-xs">Adicionar rubrica</Label>
                  <select onChange={e => { if (e.target.value) { addLine(rubricas.find(r => r.id === e.target.value)); e.target.value = ""; } }} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
                    <option value="">Selecione uma rubrica...</option>
                    {rubricas.filter(r => r.kind === "provento" || r.kind === "base" || r.kind === "desconto").map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}{r.kind === "desconto" ? " (desconto)" : ""}</option>)}
                  </select>
                </div>
              </div>
              {calc && (
                <div className="border rounded-lg p-3 text-sm space-y-1 bg-gray-50">
                  <div className="flex justify-between"><span>Base INSS / IRRF / FGTS</span><span className="text-xs">{fmtMoney(calc.base_inss)} / {fmtMoney(calc.base_irrf)} / {fmtMoney(calc.base_fgts)}</span></div>
                  <div className="flex justify-between"><span>Proventos</span><b>{fmtMoney(calc.gross_provents)}</b></div>
                  <div className="flex justify-between text-red-600"><span>Descontos (INSS {fmtMoney(calc.inss_value)} + IRRF {fmtMoney(calc.irrf_value)} + outros)</span><b>-{fmtMoney(calc.total_discounts)}</b></div>
                  <div className="flex justify-between border-t pt-1"><span><b>Líquido</b></span><b className="text-emerald-700">{fmtMoney(calc.net_salary)}</b></div>
                  <div className="flex justify-between text-xs text-gray-500"><span>Encargos do empregador</span><span>{fmtMoney(calc.employer_total)}</span></div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving || !employee || blocked} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Lançar Folha"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Hollerite ───
function HolleriteModal({ folha, company, month, year, onClose }) {
  const proventos = (folha.rubricas || []).filter(r => r.kind === "provento" || r.kind === "base");
  const descontos = (folha.rubricas || []).filter(r => r.kind === "desconto");
  const fmtData = (s) => (s || "").slice(0, 10).split("-").reverse().join("/");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Hollerite — {folha.employee_name}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5"><Printer className="w-4 h-4" /> Imprimir</Button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">✕</button>
          </div>
        </div>
        <div id="print-area" className="p-5 space-y-4 text-sm bg-white">
          <div className="flex justify-between border-b pb-2">
            <div><p className="font-bold">{company?.razao_social || "Empresa"}</p><p className="text-xs text-gray-500">CNPJ: {company?.cnpj || "—"}</p></div>
            <div className="text-right"><p className="font-bold">Comprovante de Rendimentos</p><p className="text-xs text-gray-500">{MONTHS[folha.month]}/{folha.year} — {(PAYROLL_TYPES.find(t => t.value === folha.payroll_type) || { label: folha.payroll_type }).label}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs border-b pb-2">
            <div><p className="text-gray-500">Funcionário</p><p className="font-medium">{folha.employee_name}</p></div>
            <div><p className="text-gray-500">CPF</p><p className="font-mono">{folha.employee_cpf || "—"}</p></div>
            <div><p className="text-gray-500">Cargo</p><p className="font-medium">{folha.job_title || "—"}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-xs"><tr><th className="p-2 text-left">Cód</th><th className="p-2 text-left">Proventos</th><th className="p-2 text-left">Ref</th><th className="p-2 text-left">Cód</th><th className="p-2 text-left">Descontos</th><th className="p-2 text-right">Valor</th></tr></thead>
            <tbody>
              {Array.from({ length: Math.max(proventos.length, descontos.length) }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 font-mono text-xs">{proventos[i]?.code || ""}</td>
                  <td className="p-2">{proventos[i]?.name || ""}</td>
                  <td className="p-2 text-xs text-gray-400">{proventos[i]?.inc_inss ? "INSS" : ""}</td>
                  <td className="p-2 font-mono text-xs">{descontos[i]?.code || ""}</td>
                  <td className="p-2">{descontos[i]?.name || ""}</td>
                  <td className="p-2 text-right">{fmtMoney(descontos[i]?.value || proventos[i]?.value || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Total de Proventos</span><b>{fmtMoney(folha.gross_provents || folha.gross_salary)}</b></div>
            <div className="flex justify-between"><span>Total de Descontos</span><b className="text-red-600">-{fmtMoney(folha.total_discounts || folha.discounts)}</b></div>
            <div className="flex justify-between text-lg border-t pt-1"><b>Líquido a Receber</b><b className="text-emerald-700">{fmtMoney(folha.net_salary)}</b></div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs border-t pt-2">
            <div><p className="text-gray-500">Base INSS</p><p className="font-medium">{fmtMoney(folha.base_inss)}</p></div>
            <div><p className="text-gray-500">Base IRRF</p><p className="font-medium">{fmtMoney(folha.base_irrf)}</p></div>
            <div><p className="text-gray-500">FGTS (depósito)</p><p className="font-medium">{fmtMoney(folha.fgts_value)}</p></div>
            <div><p className="text-gray-500">Encargos (empregador)</p><p className="font-medium">{fmtMoney(folha.employer_total)}</p></div>
          </div>
          {folha.vacation_days > 0 && (
            <div className="grid grid-cols-4 gap-2 text-xs border-t pt-2">
              <div><p className="text-gray-500">Dias de férias</p><p className="font-medium">{folha.vacation_days}</p></div>
              <div><p className="text-gray-500">Período</p><p className="font-medium">{fmtData(folha.vacation_start)} a {fmtData(folha.vacation_end)}</p></div>
              <div><p className="text-gray-500">1/3 constitucional</p><p className="font-medium">{fmtMoney(folha.ferias_um_terco)}</p></div>
              <div><p className="text-gray-500">Abono</p><p className="font-medium">{folha.abono_pecuniario ? "Sim" : "Não"}</p></div>
            </div>
          )}
          <p className="text-center text-[10px] text-gray-400">Documento gerado em {fmtData(todayISO())} — SoftPremier ERP</p>
        </div>
      </div>
    </div>
  );
}