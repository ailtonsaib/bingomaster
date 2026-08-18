// Cálculo fiscal do ERP (NF-e/NFC-e) com base nas regras fiscais (ErpTaxRule).
// Aplica ICMS, DIFAL (interestadual a consumidor final) e Substituição Tributária
// (MVA / Pauta / Base agregada) automaticamente conforme UF e operação escolhidas.

export const num = (v) => Number(v) || 0;

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

// Verifica se a operação é interestadual (CFOP 1.x/6.x) ou por UFs distintas.
export function isInterestadual(operation, companyUF, customerUF) {
  const cfop = String(operation?.cfop || "");
  if (cfop.startsWith("6") || cfop.startsWith("1")) return true;
  if (companyUF && customerUF && companyUF !== customerUF) return true;
  return false;
}

// Seleciona a regra fiscal mais específica para a operação/NCM/UF.
export function lookupErpTaxRule(rules, operationId, ncm, uf) {
  if (!rules?.length || !operationId) return null;
  const active = rules.filter(r => r.operation_id === operationId && r.is_active !== false);
  if (!active.length) return null;
  return (
    active.find(r => r.ncm === ncm && r.uf === uf) ||
    active.find(r => r.ncm === ncm && !r.uf) ||
    active.find(r => !r.ncm && r.uf === uf) ||
    active.find(r => !r.ncm && !r.uf) ||
    active[0]
  );
}

// product: { ncm, quantity, unit_price (ou sale_price) }
// operation: ErpOperation (com cfop, type)
// rules: lista de ErpTaxRule do operador
// customerUF, companyUF: siglas
// ipiRate: % IPI opcional (sobrescreve a regra)
export function computeErpFiscalItem(product, { rules, operation, customerUF, companyUF, ipiRate }) {
  const rule = lookupErpTaxRule(rules, operation?.id, product.ncm, customerUF);
  const qty = num(product.quantity || 1);
  const unit = num(product.unit_price != null ? product.unit_price : product.sale_price || 0);
  const total = qty * unit;
  const ipiPct = ipiRate != null ? num(ipiRate) : num(rule?.ipi_rate);
  const ipiValue = total * ipiPct / 100;

  const icmsRate = num(rule?.icms_rate);
  const icmsRed = num(rule?.icms_reduction_base) || 100;
  const baseICMS = total * (icmsRed / 100);
  const icmsValue = baseICMS * icmsRate / 100;
  const fcpValue = baseICMS * num(rule?.fcp_rate) / 100;

  // PIS/COFINS — base deduz o ICMS destacado quando deduz_icms_pis_cofins = true (Tema 69 STJ)
  const pisRate = num(rule?.pis_rate);
  const pisRed = num(rule?.pis_reduction_base) || 100;
  const cofinsRate = num(rule?.cofins_rate);
  const cofinsRed = num(rule?.cofins_reduction_base) || 100;
  const deduzIcms = !!rule?.deduz_icms_pis_cofins;
  const baseSemIcms = deduzIcms ? Math.max(0, total - icmsValue) : total;
  const pisBase = baseSemIcms * (pisRed / 100);
  const cofinsBase = baseSemIcms * (cofinsRed / 100);
  const pisValue = pisBase * pisRate / 100;
  const cofinsValue = cofinsBase * cofinsRate / 100;

  const result = {
    rule_id: rule?.id || null,
    ncm: product.ncm || "",
    cfop: operation?.cfop || "",
    quantity: qty, unit_price: unit, total,
    cst_icms: rule?.cst_icms || "00",
    icms_rate: icmsRate, icms_base: baseICMS, icms_value: icmsValue,
    fcp_value: fcpValue,
    cst_pis: rule?.cst_pis || "", pis_rate: pisRate, pis_base: pisBase, pis_value: pisValue,
    cst_cofins: rule?.cst_cofins || "", cofins_rate: cofinsRate, cofins_base: cofinsBase, cofins_value: cofinsValue,
    ipi_rate: ipiPct, ipi_value: ipiValue,
    difal: null, st: null,
  };

  // DIFAL — somente em operação interestadual a consumidor final não contribuinte, com UF de destino.
  if (rule?.difal_enabled && customerUF && isInterestadual(operation, companyUF, customerUF)) {
    const aliqInt = num(rule.aliq_interna_destino) || ICMS_INTERNAL_RATES[customerUF] || 0;
    const aliqInte = num(rule.aliq_interestadual) || interestadualRate(customerUF);
    const fcpDest = num(rule.fcp_destino_rate);
    const pctDest = num(rule.difal_percent_destination) || 100;
    const difalTotal = baseICMS * (aliqInt - aliqInte) / 100;
    result.difal = {
      aliq_interna_destino: aliqInt,
      aliq_interestadual: aliqInte,
      difal_total: difalTotal,
      difal_origin: difalTotal * (100 - pctDest) / 100,
      difal_destination: difalTotal * pctDest / 100,
      fcp_destination: baseICMS * fcpDest / 100,
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
    baseST = baseST * (stRed / 100);
    const icmsST = baseST * stRate / 100;
    const icmsSTRecolher = Math.max(0, icmsST - icmsValue);
    const fcpSTValue = baseST * fcpSt / 100;
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
      total_st: icmsSTRecolher + fcpSTValue,
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
    total_pis: 0, total_cofins: 0,
    total_difal: 0, total_difal_destination: 0, total_fcp_destination: 0,
    total_st: 0, total_st_recolher: 0,
  });
  t.total_nota = t.total_products + t.total_ipi;
  return t;
}