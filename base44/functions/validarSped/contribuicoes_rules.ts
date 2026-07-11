// Regras de validação e correção automática do PVA EFD-Contribuições
// Replica as regras do validador oficial da Receita Federal

function parseNum(v) {
  if (!v) return NaN;
  return parseFloat(String(v).replace(',', '.'));
}

// Validações para registros de detalhe (A170, C170, F500) — chamada dentro do loop de segunda passada
export function validarDetalheContribuicoes(registro, linha, campos, linhaAtual, erros, avisos) {
  if (registro === 'A170') {
    const c = linha.split('|');
    const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
    // A170: 1=A170, ..., 9=CST_PIS, 10=VL_BC_PIS, 11=ALIQ_PIS, 12=VL_PIS, 13=CST_COFINS, 14=VL_BC_COFINS, 15=ALIQ_COFINS, 16=VL_COFINS
    // Regra: CST_PIS deve ser igual a CST_COFINS
    if (f[8] && f[12] && f[8] !== f[12]) {
      erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `O CST referente ao PIS/PASEP (${f[8]}) deve ser igual ao CST referente a COFINS (${f[12]}), assim como o Valor da base de cálculo do PIS/PASEP deve ser igual ao Valor da base de cálculo da COFINS.`, severidade: 'erro' });
    }
    // Regra: VL_BC_PIS deve ser igual a VL_BC_COFINS
    if (f[9] && f[13]) {
      const bcPis = parseNum(f[9]); const bcCofins = parseNum(f[13]);
      if (!isNaN(bcPis) && !isNaN(bcCofins) && Math.abs(bcPis - bcCofins) > 0.02) {
        erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `O valor da base de cálculo do PIS/PASEP (${f[9]}) deve ser igual ao valor da base de cálculo da COFINS (${f[13]}).`, severidade: 'erro' });
      }
    }
    // Regra: VL_PIS = VL_BC_PIS x ALIQ_PIS (ERRO no PVA)
    if (f[9] && f[10] && f[11]) {
      const bc = parseNum(f[9]); const aliq = parseNum(f[10]); const vlPis = parseNum(f[11]);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vlPis)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vlPis - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_PIS=${f[11]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_COFINS = VL_BC_COFINS x ALIQ_COFINS (ERRO no PVA)
    if (f[13] && f[14] && f[15]) {
      const bc = parseNum(f[13]); const aliq = parseNum(f[14]); const vlCofins = parseNum(f[15]);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vlCofins)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vlCofins - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_COFINS=${f[15]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: Alíquotas básicas para CST=01
    if (f[8] === '01' && (!f[10] || parseNum(f[10]) === 0)) {
      erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `Devem ser informadas alíquotas básicas para operações com CST = 01, de acordo com o indicador da incidência tributária no período. ALIQ_PIS obrigatória (0,65%).`, severidade: 'erro' });
    }
    if (f[12] === '01' && (!f[14] || parseNum(f[14]) === 0)) {
      erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `Devem ser informadas alíquotas básicas para operações com CST = 01, de acordo com o indicador da incidência tributária no período. ALIQ_COFINS obrigatória (3,00%).`, severidade: 'erro' });
    }
    // Regra: Alíquota para CST=03/04 (monofásica) — Tabela 4.3.11
    if ((f[8] === '03' || f[8] === '04') && f[10] && parseNum(f[10]) === 0) {
      erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `A alíquota informada deverá existir na Tabela 4.3.11 - Produtos Sujeitos à Incidência Monofásica da Contribuição Social - Alíquotas por Unidade de Medida de Produto (CST 03 e 04).`, severidade: 'erro' });
    }
  }

  if (registro === 'C170') {
    const c = linha.split('|');
    const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
    // C170 Contribuições: VL_BC_PIS=24, ALIQ_PIS=25, QUANT_BC_PIS=26, ALIQ_PIS_QUANT=27, VL_PIS=28, VL_BC_COFINS=29, ALIQ_COFINS=30, QUANT_BC_COFINS=31, ALIQ_COFINS_QUANT=32, VL_COFINS=33
    // Regra: VL_PIS = VL_BC_PIS x ALIQ_PIS (ERRO no PVA)
    if (f[24] && f[25] && f[28]) {
      const bc = parseNum(f[24]); const aliq = parseNum(f[25]); const vlPis = parseNum(f[28]);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vlPis)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vlPis - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_PIS=${f[28]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_PIS = QUANT_BC_PIS x ALIQ_PIS_QUANT (ERRO no PVA)
    if (f[26] && f[27] && f[28]) {
      const qtdBc = parseNum(f[26]); const aliqQtd = parseNum(f[27]); const vlPis = parseNum(f[28]);
      if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0 && !isNaN(vlPis)) {
        const calc = qtdBc * aliqQtd;
        if (Math.abs(vlPis - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual ao valor da Quantidade - Base de Cálculo x Alíquota (em reais). VL_PIS=${f[28]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_COFINS = VL_BC_COFINS x ALIQ_COFINS (ERRO no PVA)
    if (f[29] && f[30] && f[33]) {
      const bc = parseNum(f[29]); const aliq = parseNum(f[30]); const vlCofins = parseNum(f[33]);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vlCofins)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vlCofins - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_COFINS=${f[33]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_COFINS = QUANT_BC_COFINS x ALIQ_COFINS_QUANT (ERRO no PVA)
    if (f[31] && f[32] && f[33]) {
      const qtdBc = parseNum(f[31]); const aliqQtd = parseNum(f[32]); const vlCofins = parseNum(f[33]);
      if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0 && !isNaN(vlCofins)) {
        const calc = qtdBc * aliqQtd;
        if (Math.abs(vlCofins - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual ao valor da Quantidade - Base de Cálculo x Alíquota (em reais). VL_COFINS=${f[33]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: CST incompatível com CFOP (créditos 50-56, 60-66)
    if (f[9] && f[10]) {
      const cstNum = parseInt(f[9], 10);
      if (!isNaN(cstNum) && cstNum >= 50 && cstNum <= 66) {
        const cfopFirst = f[10].charAt(0);
        if (!['1','2','3'].includes(cfopFirst)) {
          avisos.push({ linha: linhaAtual, registro: 'C170', mensagem: `CST informado (${f[9]}), referente a Operações com Direito a Crédito (50 a 56 - Créditos Básicos; ou 60 a 66 - Crédito Presumido) incompatível com CFOP informado (${f[10]}), não constante na Tabela CFOP.`, severidade: 'aviso' });
        }
      }
    }
  }

  if (registro === '0140') {
    // 0140: 1=0140, 2=COD_ESTAB, 3=NOME, 4=CNPJ, 5=UF, 6=IE, 7=COD_MUN
    // Regra: Inscrição Estadual inválida
    if (campos[5]) {
      const ie = campos[5].toUpperCase().trim();
      if (ie !== 'ISENTO' && ie !== 'PR' && ie !== '' && !/^\d+$/.test(ie)) {
        erros.push({ linha: linhaAtual, registro: '0140', mensagem: `Inscrição Estadual inválida.`, severidade: 'erro' });
      }
    }
    // Regra: Código do município inválido
    if (campos[6]) {
      if (!/^\d{7}$/.test(campos[6]) && campos[6] !== '9999999') {
        erros.push({ linha: linhaAtual, registro: '0140', mensagem: `Código do município inválido. Utilizar código da "Tabela de Municípios do IBGE".`, severidade: 'erro' });
      }
    } else {
      erros.push({ linha: linhaAtual, registro: '0140', mensagem: `Campo obrigatório para contribuintes domiciliados no Brasil. Preencher com "9999999" caso contrário.`, severidade: 'erro' });
    }
  }

  if (registro === 'F500') {
    // F500: 1=F500, 2=COD_REC, 3=VL_REC, 4=CST_PIS, 5=VL_BC_PIS, 6=ALIQ_PIS, 7=VL_PIS, 8=CST_COFINS, 9=VL_BC_COFINS, 10=ALIQ_COFINS, 11=VL_COFINS, 12=NAT_REC
    // Regra: Natureza da Receita inválida
    if (campos[11] && campos[3]) {
      const cstPis = campos[3]; const natRec = campos[11];
      if ((cstPis === '03' || cstPis === '04') && !/^\d{8}$/.test(natRec) && natRec !== '') {
        erros.push({ linha: linhaAtual, registro: 'F500', mensagem: `Natureza da Receita inválida. O valor informado no campo deverá existir em uma das tabelas de acordo com o Código de Situação Tributária: Tabela 4.3.10: Produtos Sujeitos à Incidência Monofásica.`, severidade: 'erro' });
      }
    }
    // Regra: VL_PIS = VL_BC_PIS x ALIQ_PIS (ERRO no PVA)
    if (campos[4] && campos[5] && campos[6]) {
      const bc = parseNum(campos[4]); const aliq = parseNum(campos[5]); const vlPis = parseNum(campos[6]);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vlPis)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vlPis - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'F500', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_PIS=${campos[6]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_COFINS = VL_BC_COFINS x ALIQ_COFINS (ERRO no PVA)
    if (campos[8] && campos[9] && campos[10]) {
      const bc = parseNum(campos[8]); const aliq = parseNum(campos[9]); const vlCofins = parseNum(campos[10]);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vlCofins)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vlCofins - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'F500', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_COFINS=${campos[10]}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
  }
}

// Validações cruzadas (após loop) — D500, 0110
export function validarCruzadaContribuicoes(linhas, estatisticas, erros, avisos) {
  // Regra: D500 apenas para CST 50-56
  if (estatisticas.registros['D500']) {
    const cstsD500 = new Set();
    for (const linha of linhas) {
      const campos = linha.split('|').filter((c) => c !== '');
      if (campos[0] === 'D510' && campos[5]) {
        cstsD500.add(campos[5]);
      }
    }
    let temIncompativel = false;
    for (const cst of cstsD500) {
      const cstNum = parseInt(cst, 10);
      if (isNaN(cstNum) || cstNum < 50 || cstNum > 56) {
        temIncompativel = true;
        break;
      }
    }
    if (temIncompativel) {
      avisos.push({ linha: 0, registro: 'D500', mensagem: `Devem ser informados registros D500 e filhos apenas para as Operações com Direito a Crédito (CST de 50 a 56).`, severidade: 'aviso' });
    }
  }

  // Regra: Incidência tributária 0110 — se = 1 (não-cumulativo), não deve har CST cumulativo
  if (estatisticas.registros['0110']) {
    for (const linha of linhas) {
      const campos = linha.split('|').filter((c) => c !== '');
      if (campos[0] === '0110' && campos[1] === '1') {
        let temCumulativo = false;
        for (const linha2 of linhas) {
          const c2 = linha2.split('|').filter((c) => c !== '');
          if (c2[0] === 'F500' && (c2[3] === '08' || c2[3] === '09')) {
            temCumulativo = true;
            break;
          }
        }
        if (temCumulativo) {
          erros.push({ linha: 0, registro: '0110', mensagem: `O valor do campo deve ser igual a 0 (zero), se incidência tributária for igual a 1 - Escrituração de operações com incidência exclusivamente no regime não-cumulativo; ou maior que zero, se for 3 (ambos).`, severidade: 'erro' });
        }
        break;
      }
    }
  }
}

// Correção automática de campos — chamada dentro de corrigirConteudo
export function corrigirContribuicoes(linhas) {
  return linhas.map(linha => {
    const partes = linha.split('|');
    const reg = partes[1];

    if (reg === 'A170' && partes.length >= 17) {
      // CST_COFINS = CST_PIS
      if (partes[9] && partes[9] !== '' && (partes[13] === '' || partes[13] === undefined || partes[13] !== partes[9])) {
        partes[13] = partes[9];
      }
      // VL_BC_COFINS = VL_BC_PIS
      if (partes[10] && partes[10] !== '' && (partes[14] === '' || partes[14] === undefined)) {
        partes[14] = partes[10];
      }
      // VL_PIS = VL_BC_PIS x ALIQ_PIS / 100
      if (partes[10] && partes[11] && partes[10] !== '' && partes[11] !== '') {
        const bc = parseNum(partes[10]); const aliq = parseNum(partes[11]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[12] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_COFINS = VL_BC_COFINS x ALIQ_COFINS / 100
      if (partes[14] && partes[15] && partes[14] !== '' && partes[15] !== '') {
        const bc = parseNum(partes[14]); const aliq = parseNum(partes[15]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[16] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      return partes.join('|');
    }

    if (reg === 'C170' && partes.length >= 30) {
      // VL_PIS = VL_BC_PIS x ALIQ_PIS / 100
      if (partes[25] && partes[26] && partes[25] !== '' && partes[26] !== '') {
        const bc = parseNum(partes[25]); const aliq = parseNum(partes[26]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[29] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_PIS = QUANT_BC_PIS x ALIQ_PIS_QUANT
      if (partes[27] && partes[28] && partes[27] !== '' && partes[28] !== '') {
        const qtdBc = parseNum(partes[27]); const aliqQtd = parseNum(partes[28]);
        if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0) {
          partes[29] = (qtdBc * aliqQtd).toFixed(2).replace('.', ',');
        }
      }
      // VL_COFINS = VL_BC_COFINS x ALIQ_COFINS / 100
      if (partes[30] && partes[31] && partes[30] !== '' && partes[31] !== '') {
        const bc = parseNum(partes[30]); const aliq = parseNum(partes[31]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[34] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_COFINS = QUANT_BC_COFINS x ALIQ_COFINS_QUANT
      if (partes[32] && partes[33] && partes[32] !== '' && partes[33] !== '') {
        const qtdBc = parseNum(partes[32]); const aliqQtd = parseNum(partes[33]);
        if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0) {
          partes[34] = (qtdBc * aliqQtd).toFixed(2).replace('.', ',');
        }
      }
      return partes.join('|');
    }

    if (reg === '0140' && partes.length >= 8) {
      // IE inválida → "ISENTO"
      if (partes[6] !== undefined && partes[6] !== '') {
        const ie = partes[6].toUpperCase().trim();
        if (ie !== 'ISENTO' && ie !== 'PR' && !/^\d+$/.test(ie)) {
          partes[6] = 'ISENTO';
        }
      }
      // COD_MUN ausente/inválido → "9999999"
      if (partes[7] === undefined || partes[7] === '' || !/^\d{7}$/.test(partes[7])) {
        partes[7] = '9999999';
      }
      return partes.join('|');
    }

    if (reg === 'F500' && partes.length >= 8) {
      // VL_PIS = VL_BC_PIS x ALIQ_PIS / 100
      if (partes[5] && partes[6] && partes[5] !== '' && partes[6] !== '') {
        const bc = parseNum(partes[5]); const aliq = parseNum(partes[6]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[7] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_COFINS = VL_BC_COFINS x ALIQ_COFINS / 100
      if (partes[9] && partes[10] && partes[9] !== '' && partes[10] !== '') {
        const bc = parseNum(partes[9]); const aliq = parseNum(partes[10]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[11] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      return partes.join('|');
    }

    return linha;
  });
}