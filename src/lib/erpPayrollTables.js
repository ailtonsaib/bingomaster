// Catálogo de tabelas oficiais de impostos (INSS / IRRF / FGTS / Salário-Família / Encargos)
// e verificação de vigência — usado pela tela de Tabelas de Impostos e pelo cálculo da folha.
// INSS: Portaria Interministerial MPS/MF; IRRF 2026: Lei 15.270/2025.

export const OFFICIAL_TABLES = [
  {
    name: "INSS 2024", tax_type: "inss", year: 2024, is_default: true, inss_ceiling: 7786.02,
    brackets: [
      { min: 0, max: 1412.00, rate: 7.5, deduction: 0 },
      { min: 1412.00, max: 2666.68, rate: 9, deduction: 0 },
      { min: 2666.68, max: 4000.03, rate: 12, deduction: 0 },
      { min: 4000.03, max: 0, rate: 14, deduction: 0 },
    ],
  },
  {
    name: "IRRF 2024", tax_type: "irrf", year: 2024, is_default: true, dependent_deduction: 189.59,
    brackets: [
      { min: 0, max: 2259.20, rate: 0, deduction: 0 },
      { min: 2259.20, max: 2826.65, rate: 7.5, deduction: 169.44 },
      { min: 2826.65, max: 3751.05, rate: 15, deduction: 381.44 },
      { min: 3751.05, max: 4664.68, rate: 22.5, deduction: 662.77 },
      { min: 4664.68, max: 0, rate: 27.5, deduction: 896.00 },
    ],
  },
  { name: "FGTS 2024", tax_type: "fgts", year: 2024, is_default: true, fgts_rate: 8, brackets: [] },
  { name: "Salário Família 2024", tax_type: "salario_familia", year: 2024, is_default: true, salario_familia_value: 62.04, salario_familia_limit: 1819.26, brackets: [] },
  { name: "Encargos Empregador 2024", tax_type: "employer_charges", year: 2024, is_default: true, inss_employer_rate: 20, fgts_rate: 8, sat_rate: 1, terceiros_rate: 5.8, brackets: [] },
  {
    name: "INSS 2026", tax_type: "inss", year: 2026, is_default: true, inss_ceiling: 8475.55,
    brackets: [
      { min: 0, max: 1621.00, rate: 7.5, deduction: 0 },
      { min: 1621.00, max: 2902.84, rate: 9, deduction: 0 },
      { min: 2902.84, max: 4354.27, rate: 12, deduction: 0 },
      { min: 4354.27, max: 0, rate: 14, deduction: 0 },
    ],
  },
  {
    name: "IRRF 2026 (Lei 15.270/2025)", tax_type: "irrf", year: 2026, is_default: true, dependent_deduction: 189.59,
    irrf_isento_limit: 5000, irrf_reduction_limit: 7350,
    brackets: [
      { min: 0, max: 2428.80, rate: 0, deduction: 0 },
      { min: 2428.80, max: 2826.65, rate: 7.5, deduction: 182.16 },
      { min: 2826.65, max: 3751.05, rate: 15, deduction: 394.16 },
      { min: 3751.05, max: 4664.68, rate: 22.5, deduction: 675.49 },
      { min: 4664.68, max: 0, rate: 27.5, deduction: 908.73 },
    ],
  },
  { name: "FGTS 2026", tax_type: "fgts", year: 2026, is_default: true, fgts_rate: 8, brackets: [] },
  { name: "Salário Família 2026", tax_type: "salario_familia", year: 2026, is_default: true, salario_familia_value: 67.54, salario_familia_limit: 1980.38, brackets: [] },
  { name: "Encargos Empregador 2026", tax_type: "employer_charges", year: 2026, is_default: true, inss_employer_rate: 20, fgts_rate: 8, sat_rate: 1, terceiros_rate: 5.8, brackets: [] },
];

const REQUIRED_TYPES = ["inss", "irrf", "fgts", "salario_familia", "employer_charges"];

// Verifica se há tabelas oficiais em vigor para o ano (padrão: ano atual) que ainda
// não foram importadas/cadastradas pelo usuário.
// registered: tabelas cadastradas (ErpPayrollTaxTable) do usuário.
// Retorna: { year, hasOfficialYear, missing (tipos), missingNames (nomes oficiais) }
export function checkOfficialTables(registered, year = new Date().getFullYear()) {
  const y = Number(year);
  const official = OFFICIAL_TABLES.filter(t => Number(t.year) === y);
  const has = (type) => (registered || []).some(t => t.tax_type === type && Number(t.year) === y);
  const missing = REQUIRED_TYPES.filter(type => official.some(o => o.tax_type === type) && !has(type));
  return {
    year: y,
    hasOfficialYear: official.length > 0,
    missing,
    missingNames: missing.map(type => (official.find(o => o.tax_type === type) || {}).name).filter(Boolean),
  };
}