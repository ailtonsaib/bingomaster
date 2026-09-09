// Motor de cálculo de folha de pagamento (simplificado, conforme tabelas cadastradas)
// INSS/IRRF progressivos, FGTS, salário-família, férias (1/3 + abono), 13º (2 parcelas), encargos do empregador.

const num = (v) => (Number(v) || 0);

// INSS progressivo por faixas (cada faixa incide só sobre a fatia dentro dela)
export function calcINSS(base, table) {
  const b = num(base);
  if (!table || !Array.isArray(table.brackets) || table.brackets.length === 0) return 0;
  const ceiling = num(table.inss_ceiling);
  const baseCalc = ceiling > 0 ? Math.min(b, ceiling) : b;
  let inss = 0;
  for (const faixa of table.brackets) {
    if (baseCalc <= num(faixa.min)) break;
    const limite = num(faixa.max) > 0 ? Math.min(baseCalc, num(faixa.max)) : baseCalc;
    const fatia = limite - num(faixa.min);
    if (fatia > 0) inss += fatia * (num(faixa.rate) / 100);
  }
  return Math.round(inss * 100) / 100;
}

// IRRF: base = rendimentos - INSS - (dependentes * deducao); aplica faixa progressiva.
// Lei 15.270/2025 (tabelas 2026+): rendimento mensal até irrf_isento_limit => IRRF zero;
// entre isento e irrf_reduction_limit => desconta redução linear decrescente:
// reducao = irrf_reduction_base - (irrf_reduction_factor x rendimento bruto)
export function calcIRRF(baseIRRF, inssValue, dependentCount, table) {
  const gross = num(baseIRRF); // rendimentos tributáveis (bruto)
  const dedDep = num(dependentCount) * num(table?.dependent_deduction);
  const base = gross - num(inssValue) - dedDep;
  if (!table || !Array.isArray(table.brackets) || base <= 0) return 0;
  const isentoLimit = num(table.irrf_isento_limit);
  const redLimit = num(table.irrf_reduction_limit);
  if (isentoLimit > 0 && gross <= isentoLimit) return 0;
  let irrf = 0;
  for (const faixa of table.brackets) {
    const min = num(faixa.min), max = num(faixa.max);
    const inFaixa = (max > 0 && base > min && base <= max) || (max === 0 && base > min);
    if (inFaixa) {
      irrf = base * (num(faixa.rate) / 100) - num(faixa.deduction);
      break;
    }
  }
  if (isentoLimit > 0 && redLimit > 0 && gross > isentoLimit && gross <= redLimit) {
    const reducao = num(table.irrf_reduction_base || 978.62) - num(table.irrf_reduction_factor || 0.133145) * gross;
    irrf -= Math.max(0, reducao);
  }
  return Math.max(0, Math.round(irrf * 100) / 100);
}

export function calcFGTS(base, table) {
  const rate = num(table?.fgts_rate) || 8;
  return Math.round(num(base) * (rate / 100) * 100) / 100;
}

export function calcSalarioFamilia(base, dependentCount, table) {
  const limit = num(table?.salario_familia_limit);
  const value = num(table?.salario_familia_value);
  if (limit > 0 && num(base) > limit) return 0;
  return Math.round(num(dependentCount) * value * 100) / 100;
}

export function calcEmployerCharges(baseINSS, baseFGTS, table) {
  const inssPatronal = Math.round(num(baseINSS) * (num(table?.inss_employer_rate) / 100) * 100) / 100;
  const fgts = Math.round(num(baseFGTS) * (num(table?.fgts_rate) / 100) * 100) / 100;
  const sat = Math.round(num(baseINSS) * (num(table?.sat_rate) / 100) * 100) / 100;
  const terceiros = Math.round(num(baseINSS) * (num(table?.terceiros_rate) / 100) * 100) / 100;
  return { inssPatronal, fgts, sat, terceiros, total: Math.round((inssPatronal + fgts + sat + terceiros) * 100) / 100 };
}

// Cálculo da folha mensal a partir das linhas de rubricas (já com valores)
export function calcFolha(employee, lines, tables) {
  const inssTable = tables.inss, irrfTable = tables.irrf, fgtsTable = tables.fgts, famTable = tables.salario_familia, empTable = tables.employer_charges;
  let baseINSS = 0, baseIRRF = 0, baseFGTS = 0, base13 = 0;
  let proventos = [], descontos = [];
  lines.forEach(l => {
    const v = num(l.value);
    if (l.kind === "provento" || l.kind === "base") {
      proventos.push({ ...l, value: v });
      if (l.inc_inss) baseINSS += v;
      if (l.inc_irrf) baseIRRF += v;
      if (l.inc_fgts) baseFGTS += v;
      if (l.inc_13) base13 += v;
    } else if (l.kind === "desconto") {
      descontos.push({ ...l, value: v });
    }
  });
  const dependentCount = num(employee.dependents_irrf || employee.dependents_count);
  const salarioFamilia = calcSalarioFamilia(baseINSS, dependentCount, famTable);
  if (salarioFamilia > 0) proventos.push({ code: "SF", name: "Salário Família", kind: "provento", value: salarioFamilia });
  const inss = calcINSS(baseINSS, inssTable);
  const irrf = calcIRRF(baseIRRF, inss, dependentCount, irrfTable);
  const fgts = calcFGTS(baseFGTS, fgtsTable);
  descontos.push({ code: "INSS", name: "INSS", kind: "desconto", value: inss });
  descontos.push({ code: "IRRF", name: "IRRF", kind: "desconto", value: irrf });
  const grossProvents = Math.round(proventos.reduce((s, p) => s + p.value, 0) * 100) / 100;
  const totalDiscounts = Math.round(descontos.reduce((s, d) => s + d.value, 0) * 100) / 100;
  const net = Math.round((grossProvents - totalDiscounts) * 100) / 100;
  const charges = calcEmployerCharges(baseINSS, baseFGTS, empTable);
  return {
    rubricas: lines, proventos, descontos,
    base_inss: Math.round(baseINSS * 100) / 100, base_irrf: Math.round(baseIRRF * 100) / 100,
    base_fgts: Math.round(baseFGTS * 100) / 100, base_13: Math.round(base13 * 100) / 100,
    inss_value: inss, irrf_value: irrf, fgts_value: fgts, salario_familia_value: salarioFamilia,
    dependent_count: dependentCount,
    employer_inss: charges.inssPatronal, employer_fgts: charges.fgts, employer_sat: charges.sat,
    employer_terceiros: charges.terceiros, employer_total: charges.total,
    gross_provents: grossProvents, total_discounts: totalDiscounts, net_salary: net,
  };
}

// Férias: valor = salário/30 * dias; 1/3 constitucional; abono (1/3 isento); INSS e IRRF sobre (férias + 1/3)
export function calcFerias(employee, tables, days = 30, abono = false) {
  const salary = num(employee.salary_base);
  const vacationValue = Math.round((salary / 30) * days * 100) / 100;
  const umTerco = Math.round((vacationValue / 3) * 100) / 100;
  const abonoValue = abono ? umTerco : 0; // abono pecuniário = 1/3 (isento)
  const baseTributos = vacationValue + umTerco; // abono não integra base
  const inss = calcINSS(baseTributos, tables.inss);
  const irrf = calcIRRF(baseTributos, inss, num(employee.dependents_irrf || employee.dependents_count), tables.irrf);
  const fgts = calcFGTS(baseTributos, tables.fgts);
  const grossProvents = Math.round((vacationValue + umTerco + abonoValue) * 100) / 100;
  const totalDiscounts = Math.round((inss + irrf) * 100) / 100;
  const net = Math.round((grossProvents - totalDiscounts) * 100) / 100;
  const charges = calcEmployerCharges(baseTributos, baseTributos, tables.employer_charges);
  return {
    vacation_days: days, vacation_value: vacationValue, ferias_um_terco: umTerco,
    abono_pecuniario: abono, abono_value: abonoValue,
    base_inss: baseTributos, base_irrf: baseTributos, base_fgts: baseTributos,
    inss_value: inss, irrf_value: irrf, fgts_value: fgts,
    gross_provents: grossProvents, total_discounts: totalDiscounts, net_salary: net,
    employer_inss: charges.inssPatronal, employer_fgts: charges.fgts, employer_sat: charges.sat,
    employer_terceiros: charges.terceiros, employer_total: charges.total,
    proventos: [
      { code: "FER", name: "Férias", kind: "provento", value: vacationValue },
      { code: "1/3", name: "1/3 Constitucional", kind: "provento", value: umTerco },
      ...(abonoValue ? [{ code: "ABO", name: "Abono Pecuniário", kind: "provento", value: abonoValue }] : []),
    ],
    descontos: [
      { code: "INSS", name: "INSS", kind: "desconto", value: inss },
      { code: "IRRF", name: "IRRF", kind: "desconto", value: irrf },
    ],
  };
}

// 13º salário: total = salário * meses/12; 1ª parcela = 50% (sem descontos); 2ª parcela = 50% - INSS - IRRF
export function calcDecimoTerceiro(employee, tables, monthsWorked = 12) {
  const salary = num(employee.salary_base);
  const months = Math.min(12, Math.max(0, num(monthsWorked)));
  const total = Math.round((salary * months / 12) * 100) / 100;
  const first = Math.round((total / 2) * 100) / 100;
  const inss = calcINSS(total, tables.inss);
  const irrf = calcIRRF(total, inss, num(employee.dependents_irrf || employee.dependents_count), tables.irrf);
  const fgts = calcFGTS(total, tables.fgts);
  const second = Math.round((total - first - inss - irrf) * 100) / 100;
  const charges = calcEmployerCharges(total, total, tables.employer_charges);
  return {
    decimo_months: months, decimo_total: total,
    primeira_parcela: first, segunda_parcela: second,
    base_inss: total, base_irrf: total, base_fgts: total,
    inss_value: inss, irrf_value: irrf, fgts_value: fgts,
    gross_provents: total, total_discounts: Math.round((inss + irrf) * 100) / 100,
    net_salary: Math.round((first + second) * 100) / 100,
    employer_inss: charges.inssPatronal, employer_fgts: charges.fgts, employer_sat: charges.sat,
    employer_terceiros: charges.terceiros, employer_total: charges.total,
  };
}

export const fmtMoney = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });