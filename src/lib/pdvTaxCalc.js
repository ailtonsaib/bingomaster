// Cálculo fiscal de itens de saída (NF-e/NFC-e) — extraído da lógica do ExitOrderForm.
// Usado no checkout do PDV para montar os itens fiscais do cupom (NFC-e).

export const num = (v) => Number(v) || 0;

export function computeRegime(companyConfig) {
  const isSimples = companyConfig?.crt === 1 || companyConfig?.crt === 2;
  const isRegimeNormal = companyConfig?.crt === 3;
  const isRegimeCaixa = isRegimeNormal && companyConfig?.regime_caixa === true;
  const isLucroPresumido = isRegimeNormal && companyConfig?.lucro_type === "presumido";
  const pisNormalRate = isLucroPresumido ? 0.65 : 1.65;
  const cofinsNormalRate = isLucroPresumido ? 3.00 : 7.60;
  return { isSimples, isRegimeNormal, isRegimeCaixa, isLucroPresumido, pisNormalRate, cofinsNormalRate };
}

export function lookupTaxParam(taxParams, ncm, uf) {
  if (!ncm) return null;
  let param = taxParams.find(p => p.ncm === ncm && p.uf === uf && p.is_active !== false);
  if (!param) param = taxParams.find(p => p.ncm === ncm && p.uf === "*" && p.is_active !== false);
  return param;
}

export function recalcItem(item) {
  item.total = num(item.quantity) * num(item.unit_price);
  item.icms_value = item.total * num(item.icms_rate) / 100;
  item.ipi_value = item.total * num(item.ipi_rate) / 100;
  item.pis_value = item.total * num(item.pis_rate) / 100;
  item.cofins_value = item.total * num(item.cofins_rate) / 100;
}

// product: { id, name, barcode, ncm, unit, price, monofasic, category, quantity, unit_price }
// (quantity/unit_price opcionais — padrão 1 / product.price)
export function buildFiscalItem(product, { companyConfig, taxParams, monofasicTaxes, customer, defaultCfop = "5102" }) {
  const reg = computeRegime(companyConfig);
  const uf = customer?.uf || "";
  const taxParam = lookupTaxParam(taxParams, product.ncm, uf);
  const isMonofasic = product.monofasic === true;
  const monofasicTax = isMonofasic ? (monofasicTaxes || []).find(m => m.ncm === product.ncm && m.is_active !== false) : null;
  const isBifasico = isMonofasic && monofasicTax?.tax_regime === "bifasico";
  const isDistributor = (customer?.buyer_type || "consumidor_final") === "distribuidor";
  const useDistributorRates = isBifasico && isDistributor;

  const item = {
    product_id: product.id,
    product_code: product.barcode || product.id,
    barcode: product.barcode || "",
    product_name: product.name,
    ncm: product.ncm || "",
    cfop: taxParam?.cfop_default || defaultCfop,
    unit: product.unit || "UN",
    quantity: product.quantity || 1,
    unit_price: product.unit_price != null ? product.unit_price : product.price,
    total: 0,
    origin: taxParam?.origin || 0,
    monofasic: isMonofasic,
    tax_regime: monofasicTax?.tax_regime || null,
    product_category: monofasicTax?.product_category || null,
    csosn: taxParam?.csosn || "102",
    cst_icms: taxParam?.cst_icms || "00",
    icms_rate: num(taxParam?.icms_rate),
    icms_value: 0,
    cst_ipi: isMonofasic ? (monofasicTax?.cst_ipi || "99") : (taxParam?.cst_ipi || "99"),
    ipi_rate: isMonofasic ? num(monofasicTax?.effective_ipi_rate) : num(taxParam?.ipi_rate),
    ipi_value: 0,
    cst_pis: isMonofasic
      ? (useDistributorRates ? (monofasicTax?.cst_pis_distributor || "02") : (monofasicTax?.cst_pis || "04"))
      : reg.isSimples ? "49" : reg.isRegimeCaixa ? "98" : (taxParam?.cst_pis || "01"),
    pis_rate: isMonofasic
      ? (useDistributorRates ? num(monofasicTax?.pis_rate_distributor) : num(monofasicTax?.effective_pis_rate))
      : reg.isSimples ? 0 : reg.pisNormalRate,
    pis_value: 0,
    cst_cofins: isMonofasic
      ? (useDistributorRates ? (monofasicTax?.cst_cofins_distributor || "02") : (monofasicTax?.cst_cofins || "04"))
      : reg.isSimples ? "49" : reg.isRegimeCaixa ? "98" : (taxParam?.cst_cofins || "01"),
    cofins_rate: isMonofasic
      ? (useDistributorRates ? num(monofasicTax?.cofins_rate_distributor) : num(monofasicTax?.effective_cofins_rate))
      : reg.isSimples ? 0 : reg.cofinsNormalRate,
    cofins_value: 0,
  };
  recalcItem(item);
  return item;
}

export function computeTotals(items) {
  const t = items.reduce((acc, item) => {
    acc.total_products += item.total;
    acc.total_icms += item.icms_value;
    acc.total_ipi += item.ipi_value;
    acc.total_pis += item.pis_value;
    acc.total_cofins += item.cofins_value;
    return acc;
  }, { total_products: 0, total_icms: 0, total_ipi: 0, total_pis: 0, total_cofins: 0 });
  t.total_nota = t.total_products + t.total_ipi;
  return t;
}