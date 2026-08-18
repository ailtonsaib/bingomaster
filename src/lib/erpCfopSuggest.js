// Sugestão automática de CFOP conforme tipo da operação, natureza (kind),
// escopo (dentro/fora do estado/exterior) e aplicação de Substituição Tributária.
//
// O CFOP deixou de ser cadastrado na operação e passou a ser definido na regra fiscal,
// onde o sistema sugere o código correto de acordo com o NCM (ST) e a UF de destino.

// Escopo: "dentro" (mesmo estado), "fora" (interestadual) ou "exterior" (import/export).
// stEnabled: se a operação aplica ICMS-ST (define CFOP da série 4xx).

const SAIDA = {
  comercializacao:    { dentro_no: "5102", dentro_st: "5405", fora_no: "6102", fora_st: "6405", exterior: "7102" },
  industrializacao:   { dentro_no: "5101", dentro_st: "5401", fora_no: "6101", fora_st: "6401", exterior: "7101" },
  devolucao_compra:   { dentro_no: "5202", dentro_st: "5202", fora_no: "6202", fora_st: "6202", exterior: "" },
  transferencia:      { dentro_no: "5109", dentro_st: "5109", fora_no: "6109", fora_st: "6109", exterior: "" },
  outra:              { dentro_no: "", dentro_st: "", fora_no: "", fora_st: "", exterior: "" },
};
const ENTRADA = {
  comercializacao:    { dentro_no: "1102", dentro_st: "1403", fora_no: "2102", fora_st: "2403", exterior: "3102" },
  industrializacao:   { dentro_no: "1101", dentro_st: "1401", fora_no: "2101", fora_st: "2401", exterior: "3101" },
  devolucao_venda:    { dentro_no: "1202", dentro_st: "1202", fora_no: "2202", fora_st: "2202", exterior: "" },
  transferencia:      { dentro_no: "1109", dentro_st: "1109", fora_no: "2109", fora_st: "2109", exterior: "" },
  outra:              { dentro_no: "", dentro_st: "", fora_no: "", fora_st: "", exterior: "" },
};

// Determina o escopo a partir da UF de destino e da UF da empresa.
export function resolveScope(destUF, companyUF) {
  if (!destUF) return "fora"; // sem UF definida → assume interestadual como padrão
  if (destUF === "EX") return "exterior";
  if (companyUF && destUF === companyUF) return "dentro";
  return "fora";
}

// Retorna o CFOP sugerido (4 dígitos) ou "" quando não há sugestão.
export function suggestCfop({ type, kind, scope, stEnabled }) {
  const table = type === "entrada" ? ENTRADA : SAIDA;
  const row = table[kind];
  if (!row) return "";
  if (scope === "exterior") return row.exterior || "";
  const st = !!stEnabled;
  if (scope === "dentro") return st ? row.dentro_st : row.dentro_no;
  return st ? row.fora_st : row.fora_no;
}

// Prefixos válidos para o picker conforme tipo (permite escolha manual de dentro/fora/exterior).
export function cfopPrefixesFor(type) {
  return type === "entrada" ? ["1", "2", "3"] : ["5", "6", "7"];
}

export const KIND_LABELS = {
  comercializacao: "Compra/Venda de mercadoria (comercialização)",
  industrializacao: "Compra/Venda de produção (industrialização)",
  devolucao_venda: "Devolução de venda",
  devolucao_compra: "Devolução de compra",
  transferencia: "Transferência",
  outra: "Outra",
};