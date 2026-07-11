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
    // A170 (layout simplificado): f[8]=CST_PIS, f[9]=VL_BC_PIS, f[10]=ALIQ_PIS, f[11]=VL_PIS
    //                            f[12]=CST_COFINS, f[13]=VL_BC_COFINS, f[14]=ALIQ_COFINS, f[15]=VL_COFINS
    const cstSemCredito = ['04','05','06','07','08','09','49','98','99'];
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
    // Regra: VL_PIS deve ser 0 para CST sem direito a crédito
    if (cstSemCredito.includes(f[8]) && f[11]) {
      const vlPis = parseNum(f[11]);
      if (!isNaN(vlPis) && vlPis > 0.02) {
        erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `O valor informado no campo VL_PIS deve ser igual a 0 (zero) se o CST for 04, 05, 06, 07, 08, 09, 49 ou 99.`, severidade: 'erro' });
      }
    }
    if (cstSemCredito.includes(f[12]) && f[15]) {
      const vlCofins = parseNum(f[15]);
      if (!isNaN(vlCofins) && vlCofins > 0.02) {
        erros.push({ linha: linhaAtual, registro: 'A170', mensagem: `O valor informado no campo VL_COFINS deve ser igual a 0 (zero) se o CST for 04, 05, 06, 07, 08, 09, 49 ou 99.`, severidade: 'erro' });
      }
    }
  }

  if (registro === 'C170') {
    const c = linha.split('|');
    const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
    // C170 Contribuições (leiaute oficial):
    // f[9]=CST_ICMS, f[10]=CFOP
    // f[24]=CST_PIS, f[25]=VL_BC_PIS, f[26]=ALIQ_PIS, f[27]=QUANT_BC_PIS, f[28]=ALIQ_PIS_QUANT, f[29]=VL_PIS
    // f[30]=CST_COFINS, f[31]=VL_BC_COFINS, f[32]=ALIQ_COFINS, f[33]=QUANT_BC_COFINS, f[34]=ALIQ_COFINS_QUANT, f[35]=VL_COFINS
    const cstSemCredito = ['04','05','06','07','08','09','49','98','99'];
    const cstComCredito = ['01','02','05','06','50','51','52','53','54','55','56','60','61','62','63','64','65','66'];

    const cstPis = f[24] || '';
    const vlBcPis = f[25] || '';
    const aliqPis = f[26] || '';
    const quantBcPis = f[27] || '';
    const aliqPisQuant = f[28] || '';
    const vlPis = f[29] || '';
    const cstCofins = f[30] || '';
    const vlBcCofins = f[31] || '';
    const aliqCofins = f[32] || '';
    const quantBcCofins = f[33] || '';
    const aliqCofinsQuant = f[34] || '';
    const vlCofins = f[35] || '';

    // Regra: CST_PIS deve ser igual a CST_COFINS
    if (cstPis && cstCofins && cstPis !== cstCofins) {
      erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O CST referente ao PIS/PASEP (${cstPis}) deve ser igual ao CST referente a COFINS (${cstCofins}), assim como o Valor da base de cálculo do PIS/PASEP deve ser igual ao Valor da base de cálculo da COFINS.`, severidade: 'erro' });
    }
    // Regra: VL_BC_PIS deve ser igual a VL_BC_COFINS
    if (vlBcPis && vlBcCofins) {
      const bcPis = parseNum(vlBcPis); const bcCofins = parseNum(vlBcCofins);
      if (!isNaN(bcPis) && !isNaN(bcCofins) && Math.abs(bcPis - bcCofins) > 0.02) {
        erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor da base de cálculo do PIS/PASEP (${vlBcPis}) deve ser igual ao valor da base de cálculo da COFINS (${vlBcCofins}).`, severidade: 'erro' });
      }
    }
    // Regra: VL_PIS = VL_BC_PIS x ALIQ_PIS / 100 (ERRO no PVA)
    if (vlBcPis && aliqPis && vlPis) {
      const bc = parseNum(vlBcPis); const aliq = parseNum(aliqPis); const vl = parseNum(vlPis);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vl)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vl - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_PIS=${vlPis}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_PIS = QUANT_BC_PIS x ALIQ_PIS_QUANT (ERRO no PVA)
    if (quantBcPis && aliqPisQuant && vlPis) {
      const qtdBc = parseNum(quantBcPis); const aliqQtd = parseNum(aliqPisQuant); const vl = parseNum(vlPis);
      if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0 && !isNaN(vl)) {
        const calc = qtdBc * aliqQtd;
        if (Math.abs(vl - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual ao valor da Quantidade - Base de Cálculo x Alíquota (em reais). VL_PIS=${vlPis}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_COFINS = VL_BC_COFINS x ALIQ_COFINS / 100 (ERRO no PVA)
    if (vlBcCofins && aliqCofins && vlCofins) {
      const bc = parseNum(vlBcCofins); const aliq = parseNum(aliqCofins); const vl = parseNum(vlCofins);
      if (!isNaN(bc) && !isNaN(aliq) && aliq > 0 && !isNaN(vl)) {
        const calc = (bc * aliq) / 100;
        if (Math.abs(vl - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual a Base de Cálculo x Alíquota. VL_COFINS=${vlCofins}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_COFINS = QUANT_BC_COFINS x ALIQ_COFINS_QUANT (ERRO no PVA)
    if (quantBcCofins && aliqCofinsQuant && vlCofins) {
      const qtdBc = parseNum(quantBcCofins); const aliqQtd = parseNum(aliqCofinsQuant); const vl = parseNum(vlCofins);
      if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0 && !isNaN(vl)) {
        const calc = qtdBc * aliqQtd;
        if (Math.abs(vl - calc) > 0.02) {
          erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor deste campo deve ser igual ao valor da Quantidade - Base de Cálculo x Alíquota (em reais). VL_COFINS=${vlCofins}, esperado=${calc.toFixed(2)}.`, severidade: 'erro' });
        }
      }
    }
    // Regra: VL_PIS deve ser 0 para CST sem direito a crédito
    if (cstSemCredito.includes(cstPis) && vlPis) {
      const vl = parseNum(vlPis);
      if (!isNaN(vl) && vl > 0.02) {
        erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor informado no campo VL_PIS deve ser igual a 0 (zero) se o CST for 04, 05, 06, 07, 08, 09, 49 ou 99.`, severidade: 'erro' });
      }
    }
    if (cstSemCredito.includes(cstCofins) && vlCofins) {
      const vl = parseNum(vlCofins);
      if (!isNaN(vl) && vl > 0.02) {
        erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `O valor informado no campo VL_COFINS deve ser igual a 0 (zero) se o CST for 04, 05, 06, 07, 08, 09, 49 ou 99.`, severidade: 'erro' });
      }
    }
    // Regra: CST com crédito mas sem base de cálculo (VL_BC+ALIQ ou QUANT_BC+ALIQ_QUANT)
    if (cstComCredito.includes(cstPis)) {
      const hasValorBase = vlBcPis && aliqPis && parseNum(aliqPis) > 0;
      const hasQuantBase = quantBcPis && aliqPisQuant && parseNum(aliqPisQuant) > 0;
      if (!hasValorBase && !hasQuantBase) {
        erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `Devem ser informadas as bases de cálculo do PIS/PASEP (VL_BC_PIS+ALIQ_PIS ou QUANT_BC_PIS+ALIQ_PIS_QUANT) para CST ${cstPis} (operação com direito a crédito).`, severidade: 'erro' });
      }
    }
    if (cstComCredito.includes(cstCofins)) {
      const hasValorBase = vlBcCofins && aliqCofins && parseNum(aliqCofins) > 0;
      const hasQuantBase = quantBcCofins && aliqCofinsQuant && parseNum(aliqCofinsQuant) > 0;
      if (!hasValorBase && !hasQuantBase) {
        erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `Devem ser informadas as bases de cálculo da COFINS (VL_BC_COFINS+ALIQ_COFINS ou QUANT_BC_COFINS+ALIQ_COFINS_QUANT) para CST ${cstCofins} (operação com direito a crédito).`, severidade: 'erro' });
      }
    }
    // Regra: Alíquotas básicas para CST=01
    if (cstPis === '01' && (!aliqPis || parseNum(aliqPis) === 0)) {
      erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `Devem ser informadas alíquotas básicas para operações com CST = 01, de acordo com o indicador da incidência tributária no período. ALIQ_PIS obrigatória (0,65%).`, severidade: 'erro' });
    }
    if (cstCofins === '01' && (!aliqCofins || parseNum(aliqCofins) === 0)) {
      erros.push({ linha: linhaAtual, registro: 'C170', mensagem: `Devem ser informadas alíquotas básicas para operações com CST = 01, de acordo com o indicador da incidência tributária no período. ALIQ_COFINS obrigatória (3,00%).`, severidade: 'erro' });
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

    if (reg === 'C170' && partes.length >= 37) {
      // Layout: partes[25]=CST_PIS, [26]=VL_BC_PIS, [27]=ALIQ_PIS, [28]=QUANT_BC_PIS, [29]=ALIQ_PIS_QUANT, [30]=VL_PIS
      //         partes[31]=CST_COFINS, [32]=VL_BC_COFINS, [33]=ALIQ_COFINS, [34]=QUANT_BC_COFINS, [35]=ALIQ_COFINS_QUANT, [36]=VL_COFINS
      // VL_PIS = VL_BC_PIS x ALIQ_PIS / 100
      if (partes[26] && partes[27] && partes[26] !== '' && partes[27] !== '') {
        const bc = parseNum(partes[26]); const aliq = parseNum(partes[27]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[30] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_PIS = QUANT_BC_PIS x ALIQ_PIS_QUANT
      if (partes[28] && partes[29] && partes[28] !== '' && partes[29] !== '') {
        const qtdBc = parseNum(partes[28]); const aliqQtd = parseNum(partes[29]);
        if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0) {
          partes[30] = (qtdBc * aliqQtd).toFixed(2).replace('.', ',');
        }
      }
      // VL_COFINS = VL_BC_COFINS x ALIQ_COFINS / 100
      if (partes[32] && partes[33] && partes[32] !== '' && partes[33] !== '') {
        const bc = parseNum(partes[32]); const aliq = parseNum(partes[33]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[36] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_COFINS = QUANT_BC_COFINS x ALIQ_COFINS_QUANT
      if (partes[34] && partes[35] && partes[34] !== '' && partes[35] !== '') {
        const qtdBc = parseNum(partes[34]); const aliqQtd = parseNum(partes[35]);
        if (!isNaN(qtdBc) && !isNaN(aliqQtd) && aliqQtd > 0) {
          partes[36] = (qtdBc * aliqQtd).toFixed(2).replace('.', ',');
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