// Regras de validação cruzada para SPED Fiscal (EFD-ICMS/IPI)

// Constrói mapa COD_PART → CNPJ/CPF a partir dos registros 0150
export function construirMapaParticipantes(linhas: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of linhas) {
    const p = l.split('|');
    if ((p[1] || '') === '0150' && p[2]) {
      const cnpj = (p[5] || '').replace(/\D/g, '');
      const cpf  = (p[6] || '').replace(/\D/g, '');
      map[p[2]] = cnpj.length === 14 ? cnpj : cpf;
    }
  }
  return map;
}

// Validação CHV_NFE × participante 0150
export function validarCruzadaFiscal(
  c100ChvNfeMap: Array<{linha: number; codPart: string; cnpjChave: string}>,
  part0150Map: Record<string, string>,
  erros: Array<{linha: number; registro: string; mensagem: string; severidade: string}>
) {
  for (const item of c100ChvNfeMap) {
    const cnpjPart = part0150Map[item.codPart] || '';
    if (!cnpjPart || cnpjPart.length < 11) continue;
    if (item.cnpjChave !== cnpjPart.substring(0, 14)) {
      erros.push({
        linha: item.linha,
        registro: 'C100',
        mensagem: `O CNPJ/CPF da chave do documento eletrônico (${item.cnpjChave}) não confere com o CNPJ/CPF do participante informado (${cnpjPart}). Registro/Campo não informado ou inválido.`,
        severidade: 'erro'
      });
    }
  }
}