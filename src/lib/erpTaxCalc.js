// Cálculo fiscal do ERP (NF-e/NFC-e) com base nas regras fiscais (ErpTaxRule).
// Aplica ICMS, DIFAL (interestadual a consumidor final) e Substituição Tributária
// (MVA / Pauta / Base agregada) automaticamente conforme NCM do produto, UF e
// tipo da operação (entrada/saída).

export const num = (v) => Number(v) || 0;

// Arredonda valores monetários para 2 casas decimais
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Alíquotas internas de ICMS por UF (valores comuns praticados em 2024/2025).
export const ICMS_INTERNAL_RATES = {
  AC: 19, AL: 18, AP: 18, AM: 18, BA: 18, CE: 18, DF: 18, ES: 17, GO: 17, MA: 18,
  MT: 17, MS: 17, MG: 18, PA: 18, PB: 18, PR: 19, PE: 18, PI: 18, RJ: 20, RN: 18,
  RS: 18, RO: 17.5, RR: 18, SC: 17, SE: 18, SP: 18, TO: 18,
};

// Regiões com alíquota interestadual de 12% (Norte/Nordeste/Centro-Oeste/ES); demais 7%.
const REG12 = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","PA","PB","PI","RN","RO","RR","SE","TO"];
export function interestadualRate(destUF) {
  if (!destUF) return 0;
  return REG12.includes(destUF) ? 12 : 7;
}

// Verifica se a operação é interestadual (CFOP 2.x/6.x) ou por UFs distintas.
export function isInterestadual(cfopOrOperation, companyUF, customerUF) {
  const cfop = String(
    typeof cfopOrOperation === "string" ? cfopOrOperation : (cfopOrOperation?.cfop || "")
  );
  if (cfop.startsWith("6") || cfop.startsWith("2")) return true;
  if (companyUF && customerUF && companyUF !== customerUF) return true;
  return false;
}

// Seleciona a regra fiscal pelo NCM do produto (+ tipo de operação, UF e
// destinatário). A regra é cadastrada por NCM — vale para entrada e saída:
//   - NCM completo (8 dígitos) = regra específica do produto;
//   - NCM parcial (ex: "84", "8412") = regra do capítulo/posição (prefixo do NCM);
//   - NCM vazio = regra geral (fallback).
// Regra com tipo de operação (entrada/saida) só vale para esse tipo; regra com UF
// só vale para essa UF. A regra mais específica (NCM mais longo, com UF e com o
// tipo de destinatário exato) tem prioridade.
export function lookupErpTaxRule(rules, operationId, ncm, uf, destinatarioTipo, operationType) {
  if (!rules?.length) return null;
  const prodNcm = String(ncm || "").replace(/\D/g, "");
  const pool = rules
    .filter(r => r.is_active !== false)
    .filter(r => !r.operation_type || !operationType || r.operation_type === operationType)
    .filter(r => !r.uf || r.uf === uf)
    .filter(r => {
      const rn = String(r.ncm || "").replace(/\D/g, "");
      return !rn || (!!prodNcm && prodNcm.startsWith(rn));
    });
  if (!pool.length) return null;
  const hasDest = destinatarioTipo ? pool.some(r => r.destinatario_tipo === destinatarioTipo) : false;
  const rank = (r) => {
    const rn = String(r.ncm || "").replace(/\D/g, "");
    return (rn.length * 100) + (r.uf ? 10 : 0) + (hasDest && r.destinatario_tipo === destinatarioTipo ? 5 : 0);
  };
  return pool.reduce((best, r) => (!best || rank(r) > rank(best) ? r : best), null);
}

// product: { ncm, quantity, unit_price (ou sale_price) }
// operation: ErpOperation (com cfop, type)
// rules: lista de ErpTaxRule do operador
// customerUF, companyUF: siglas
// ipiRate: % IPI opcional (sobrescreve a regra)
export function computeErpFiscalItem(product, { rules, operation, customerUF, companyUF, ipiRate, destinatarioTipo }) {
  const rule = lookupErpTaxRule(rules, operation?.id, product.ncm, customerUF, destinatarioTipo, operation?.type);
  const cfop = String(rule?.cfop || operation?.cfop || "");
  const qty = num(product.quantity || 1);
  const unit = num(product.unit_price != null ? product.unit_price : product.sale_price || 0);
  const total = qty * unit;
  const ipiPct = ipiRate != null ? num(ipiRate) : num(rule?.ipi_rate);
  const ipiValue = r2(total * ipiPct / 100);

  const icmsRate = num(rule?.icms_rate);
  const icmsRed = num(rule?.icms_reduction_base) || 100;
  const baseICMS = r2(total * (icmsRed / 100));
  const icmsValue = r2(baseICMS * icmsRate / 100);
  const fcpValue = r2(baseICMS * num(rule?.fcp_rate) / 100);

  // PIS/COFINS — base deduz o ICMS destacado quando deduz_icms_pis_cofins = true (Tema 69 STJ)
  const pisRate = num(rule?.pis_rate);
  const pisRed = num(rule?.pis_reduction_base) || 100;
  const cofinsRate = num(rule?.cofins_rate);
  const cofinsRed = num(rule?.cofins_reduction_base) || 100;
  const deduzIcms = !!rule?.deduz_icms_pis_cofins;
  const baseSemIcms = deduzIcms ? Math.max(0, total - icmsValue) : total;
  const pisBase = r2(baseSemIcms * (pisRed / 100));
  const cofinsBase = r2(baseSemIcms * (cofinsRed / 100));
  const pisValue = r2(pisBase * pisRate / 100);
  const cofinsValue = r2(cofinsBase * cofinsRate / 100);

  // CBS/IBS — reforma tributária (base = valor da operação * redução)
  const cbsRate = num(rule?.cbs_rate);
  const cbsRed = num(rule?.cbs_reduction_base) || 100;
  const ibsRate = num(rule?.ibs_rate);
  const ibsRed = num(rule?.ibs_reduction_base) || 100;
  const cbsBase = r2(total * (cbsRed / 100));
  const ibsBase = r2(total * (ibsRed / 100));
  const cbsValue = r2(cbsBase * cbsRate / 100);
  const ibsValue = r2(ibsBase * ibsRate / 100);

  const result = {
    rule_id: rule?.id || null,
    ncm: product.ncm || "",
    cfop: cfop,
    quantity: qty, unit_price: unit, total,
    cst_icms: rule?.cst_icms || "00",
    icms_rate: icmsRate, icms_base: baseICMS, icms_value: icmsValue,
    fcp_value: fcpValue,
    cst_pis: rule?.cst_pis || "", pis_rate: pisRate, pis_base: pisBase, pis_value: pisValue,
    cst_cofins: rule?.cst_cofins || "", cofins_rate: cofinsRate, cofins_base: cofinsBase, cofins_value: cofinsValue,
    cst_cbs: rule?.cst_cbs || "", cbs_rate: cbsRate, cbs_base: cbsBase, cbs_value: cbsValue,
    cst_ibs: rule?.cst_ibs || "", ibs_rate: ibsRate, ibs_base: ibsBase, ibs_value: ibsValue,
    ipi_rate: ipiPct, ipi_value: ipiValue,
    difal: null, st: null,
  };

  // DIFAL — somente em operação interestadual a consumidor final não contribuinte, com UF de destino.
  if (rule?.difal_enabled && customerUF && isInterestadual(cfop, companyUF, customerUF)) {
    const aliqInt = num(rule.aliq_interna_destino) || ICMS_INTERNAL_RATES[customerUF] || 0;
    const aliqInte = num(rule.aliq_interestadual) || interestadualRate(customerUF);
    const fcpDest = num(rule.fcp_destino_rate);
    const pctDest = num(rule.difal_percent_destination) || 100;
    const difalTotal = r2(baseICMS * (aliqInt - aliqInte) / 100);
    result.difal = {
      aliq_interna_destino: aliqInt,
      aliq_interestadual: aliqInte,
      difal_total: difalTotal,
      difal_origin: r2(difalTotal * (100 - pctDest) / 100),
      difal_destination: r2(difalTotal * pctDest / 100),
      fcp_destination: r2(baseICMS * fcpDest / 100),
    };
  }

  // Substituição Tributária (ICMS-ST) — MVA, Pauta ou Base agregada.
  if (rule?.st_enabled) {
    const method = rule.st_base_method || "mva";
    const mva = num(rule.mva_rate);
    const stRate = num(rule.icms_st_rate);
    const stRed = num(rule.icms_st_reduction_base) || 100;
    const pauta = num(rule.pauta_value);
    const fcpSt = num(rule.fcp_st_rate);
    let baseST =
      method === "pauta" ? pauta * qty :
      method === "agregada" ? (total + ipiValue) :
      (total + ipiValue) * (1 + mva / 100);
    baseST = r2(baseST * (stRed / 100));
    const icmsST = r2(baseST * stRate / 100);
    const icmsSTRecolher = r2(Math.max(0, icmsST - icmsValue));
    const fcpSTValue = r2(baseST * fcpSt / 100);
    result.st = {
      method,
      cst_icms_st: rule.cst_icms_st || "10",
      mva_rate: mva,
      icms_st_rate: stRate,
      base_st: baseST,
      icms_st_bruto: icmsST,
      icms_proprio_credit: icmsValue,
      icms_st_recolher: icmsSTRecolher,
      fcp_st: fcpSTValue,
      total_st: r2(icmsSTRecolher + fcpSTValue),
    };
  }

  return result;
}

export function computeErpTotals(items) {
  const t = items.reduce((acc, it) => {
    acc.total_products += num(it.total);
    acc.total_icms += num(it.icms_value);
    acc.total_ipi += num(it.ipi_value);
    acc.total_fcp += num(it.fcp_value);
    acc.total_pis += num(it.pis_value);
    acc.total_cofins += num(it.cofins_value);
    acc.total_cbs += num(it.cbs_value);
    acc.total_ibs += num(it.ibs_value);
    if (it.difal) {
      acc.total_difal += num(it.difal.difal_total);
      acc.total_difal_destination += num(it.difal.difal_destination);
      acc.total_fcp_destination += num(it.difal.fcp_destination);
    }
    if (it.st) {
      acc.total_st += num(it.st.total_st);
      acc.total_st_recolher += num(it.st.icms_st_recolher);
    }
    return acc;
  }, {
    total_products: 0, total_icms: 0, total_ipi: 0, total_fcp: 0,
    total_pis: 0, total_cofins: 0, total_cbs: 0, total_ibs: 0,
    total_difal: 0, total_difal_destination: 0, total_fcp_destination: 0,
    total_st: 0, total_st_recolher: 0,
  });
  t.total_nota = r2(t.total_products + t.total_ipi);
  t.total_impostos = r2(t.total_icms + t.total_fcp + t.total_ipi + t.total_pis + t.total_cofins + t.total_cbs + t.total_ibs + t.total_difal + t.total_st);
  t.total_geral = r2(t.total_nota + t.total_impostos - t.total_ipi);
  Object.keys(t).forEach(k => { t[k] = r2(t[k]); });
  return t;
}

// Origem dos impostos de um item de XML de entrada:
// - "regra": recalcula pela regra fiscal (tax_source = "regra", ou XML sem
//   nenhum imposto destacado — fallback pela regra da operação)
// - "xml": mantém os impostos destacados na própria nota
export function resolveErpXmlTaxSource(xmlItem, { rules, operation, supplierUF }) {
  const rule = lookupErpTaxRule(rules, operation?.id, xmlItem.ncm, supplierUF, undefined, operation?.type);
  if (!rule) return { rule: null, source: "xml" };
  const hasXmlTaxes = ["icms_value", "pis_value", "cofins_value", "ipi_value", "difal_value"].some(k => num(xmlItem[k]) > 0);
  return { rule, source: rule.tax_source === "regra" || !hasXmlTaxes ? "regra" : "xml" };
}

// Aplica a regra fiscal a um item de XML de entrada quando a origem é "regra":
// recalcula CST, bases, alíquotas e valores (ICMS, DIFAL, IPI, PIS/COFINS, CBS/IBS)
// pela regra da operação — ignorando os impostos destacados no XML.
export function applyErpRuleToXmlItem(xmlItem, { rules, operation, supplierUF, companyUF }) {
  const { source } = resolveErpXmlTaxSource(xmlItem, { rules, operation, supplierUF });
  if (source !== "regra") return xmlItem;
  const calc = computeErpFiscalItem(
    { ncm: xmlItem.ncm, quantity: num(xmlItem.quantity), unit_price: num(xmlItem.unit_price) },
    { rules, operation, customerUF: supplierUF, companyUF }
  );
  return {
    ...xmlItem,
    cst_icms: calc.cst_icms || xmlItem.cst_icms || "",
    base_icms: calc.icms_base, icms_rate: calc.icms_rate, icms_value: calc.icms_value,
    difal_value: r2(calc.difal?.difal_total || 0),
    cst_pis: calc.cst_pis || "", cst_cofins: calc.cst_cofins || "",
    base_pis_cofins: calc.pis_base, aliq_pis_cofins: calc.pis_rate,
    aliq_pis: calc.pis_rate, aliq_cofins: calc.cofins_rate,
    pis_value: calc.pis_value, cofins_value: calc.cofins_value,
    ipi_value: calc.ipi_value,
    cst_cbs: calc.cst_cbs || "", cbs_rate: calc.cbs_rate, cbs_value: calc.cbs_value,
    cst_ibs: calc.cst_ibs || "", ibs_rate: calc.ibs_rate, ibs_value: calc.ibs_value,
  };
}