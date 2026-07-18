// Regras de validação cruzada para SPED Fiscal (EFD-ICMS/IPI)
// Baseado no Guia Prático 3.2.2 (vigência a partir de janeiro/2026)
// Exceção nº 11 do C100: documentos fiscais que carreguem informações exclusivamente
// acerca dos novos tributos da Reforma Tributária do Consumo (IBS/CBS) e que não
// versem sobre ICMS ou IPI NÃO devem ser escriturados na EFD.
// Documentos que envolvam tanto os novos tributos quanto ICMS/IPI devem ser escriturados
// em relação a estes tributos (Ajuste SINIEF 49/25).

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
// IND_EMIT=0 (Emissão própria) → a empresa é a emitente → CNPJ da chave é da empresa, NÃO do participante → NÃO comparar
// IND_EMIT=1 (Terceiros) → o participante é o emitente (terceiro) → CNPJ da chave deve conferir com participante
export function validarCruzadaFiscal(
  c100ChvNfeMap: Array<{linha: number; codPart: string; cnpjChave: string; indEmit: string}>,
  part0150Map: Record<string, string>,
  erros: Array<{linha: number; registro: string; mensagem: string; severidade: string}>
) {
  for (const item of c100ChvNfeMap) {
    if (item.indEmit !== '1') continue;
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