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
    // Regra: CST_ICMS de 2 ou 3 dígitos é aceito pelo leiaute (ex: 049 é válido)
    // Regra: CST incompatível com CFOP (créditos 50-56, 60-66) — apenas para CST_PIS/COFINS
    // Não validamos CST_ICMS aqui pois o leiaute aceita 2 ou 3 dígitos
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

  if (registro === '0150') {
    // Layout: |0150|COD_PART|NOME|COD_PAIS|CNPJ|CPF|IE|COD_MUN|SU_FRAM|ENDERECO|NUM|COMPL|BAIRRO|
    // split por '|' gera: [0]='' [1]='0150' [2]=COD_PART [3]=NOME [4]=COD_PAIS [5]=CNPJ [6]=CPF [7]=IE [8]=COD_MUN
    const c = linha.split('|');
    const codPais = (c[4] || '').replace(/\D/g, ''); // remove formatação ex: "1058" ou "105"
    // Brasil: COD_PAIS = 105 ou 1058 ou vazio
    const isBrasil = codPais === '' || codPais === '105' || codPais === '1058';
    if (isBrasil) {
      const ie = (c[7] || '').toUpperCase().trim();
      // IE válida: vazia, "ISENTO", "PR", ou somente dígitos (ex: 103697446)
      if (ie !== '' && ie !== 'ISENTO' && ie !== 'PR' && !/^\d+$/.test(ie)) {
        erros.push({ linha: linhaAtual, registro: '0150', mensagem: `Inscrição Estadual inválida.`, severidade: 'erro' });
      }
    }
    // COD_MUN está em c[8]
    const codMun = (c[8] !== undefined ? c[8] : '').trim();
    if (codMun === '') {
      erros.push({ linha: linhaAtual, registro: '0150', mensagem: `Campo obrigatório para contribuintes domiciliados no Brasil. Preencher com "9999999" caso contrário.`, severidade: 'erro' });
    } else if (codMun !== '9999999' && !/^\d{7}$/.test(codMun)) {
      erros.push({ linha: linhaAtual, registro: '0150', mensagem: `Código do município inválido. Utilizar código da "Tabela de Municípios do IBGE".`, severidade: 'erro' });
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

  // Regra: C100 VL_PIS >= soma VL_PIS dos C170 onde CST_PIS != 05 e != 75
  // Regra: C100 VL_COFINS >= soma VL_COFINS dos C170 onde CST_COFINS != 05 e != 75
  // Regra: CNPJ da chave do documento eletrônico deve confere com CNPJ/CPF do participante
  // Regra: Número do documento na chave do CTe deve conferir com NUM_DOC do D100
  // Regra: D500/D501 NAT_REC inválida para CST 03/04
  {
    // Agrupa C170 por documento pai (C100)
    const c100Docs = {}; // { linhaC100: { vlPis, vlCofins, cnpjPart, numDoc, codPart, indOper } }
    let currentC100Linha = null;
    const d100Docs = {}; // { linhaD100: { numDoc, chvCte, codPart } }
    let currentD100Linha = null;
    const d500Records = [];

    for (let i = 0; i < linhas.length; i++) {
      const campos = linhas[i].split('|').filter((c) => c !== '');
      if (campos.length === 0) continue;
      const reg = campos[0];

      if (reg === 'C100') {
        // C100: split sem filtro para preservar índices
        const c = linhas[i].split('|');
        const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
        // f[1]=IND_OPER, f[3]=COD_PART, f[7]=NUM_DOC, f[14]=VL_PIS(TOTAL), f[18]=VL_COFINS(TOTAL)
        // CNPJ está em COD_PART (0150) — chave do documento está em f[12]=CHV_NFE
        currentC100Linha = i;
        c100Docs[i] = {
          linha: i + 1,
          indOper: f[1] || '',
          codPart: f[3] || '',
          numDoc: f[7] || '',
          chvNfe: f[12] || '',
          vlPisC100: f[14] ? parseNum(f[14]) : 0,
          vlCofinsC100: f[18] ? parseNum(f[18]) : 0,
          somaPisC170: 0,
          somaCofinsC170: 0,
          linhaC170s: []
        };
      } else if (reg === 'C170' && currentC100Linha !== null) {
        // C170: f[24]=CST_PIS, f[29]=VL_PIS, f[30]=CST_COFINS, f[35]=VL_COFINS
        const c = linhas[i].split('|');
        const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
        const cstPis = f[24] || '';
        const cstCofins = f[30] || '';
        const vlPis = f[29] ? parseNum(f[29]) : 0;
        const vlCofins = f[35] ? parseNum(f[35]) : 0;
        if (c100Docs[currentC100Linha]) {
          if (cstPis !== '05' && cstPis !== '75') {
            c100Docs[currentC100Linha].somaPisC170 += (isNaN(vlPis) ? 0 : vlPis);
          }
          if (cstCofins !== '05' && cstCofins !== '75') {
            c100Docs[currentC100Linha].somaCofinsC170 += (isNaN(vlCofins) ? 0 : vlCofins);
          }
          c100Docs[currentC100Linha].linhaC170s.push(i + 1);
        }
      } else if (reg === 'D100') {
        // D100: f[1]=IND_OPER, f[3]=COD_PART, f[5]=COD_MOD, f[7]=NUM_DOC, f[11]=CHV_CTE
        const c = linhas[i].split('|');
        const f = c.slice(1, c[c.length - 1] === '' ? -1 : undefined);
        currentD100Linha = i;
        d100Docs[i] = {
          linha: i + 1,
          numDoc: f[7] || '',
          chvCte: f[11] || '',
          codMod: f[5] || ''
        };
      } else if (reg === 'D500') {
        // D500: campos[1]=IND_OPER, campos[4]=COD_MOD, campos[7]=NUM_DOC, campos[10]=VL_DOC
        // D501: campos[1]=CST, campos[8]=NAT_REC
        d500Records.push({ linha: i + 1, campos });
      } else if (reg === 'D501') {
        // D501: 1=D501, 2=CST, 3=COD_REC, 4=VL_BC_PIS, 5=ALIQ_PIS, 6=VL_PIS, 7=VL_BC_COFINS, 8=ALIQ_COFINS, 9=VL_COFINS, 10=NAT_REC
        if (d500Records.length > 0) {
          d500Records[d500Records.length - 1].natRecD501 = campos[9] || '';
          d500Records[d500Records.length - 1].cstD501 = campos[1] || '';
        }
      }
    }

    // Validar C100 vs C170
    for (const key of Object.keys(c100Docs)) {
      const doc = c100Docs[key];
      // VL_PIS: C100 >= soma C170
      if (doc.vlPisC100 > 0 && doc.somaPisC170 > 0 && doc.vlPisC100 < doc.somaPisC170 - 0.02) {
        erros.push({ linha: doc.linha, registro: 'C100', mensagem: `Valor inválido. O valor deve ser maior ou igual à soma dos valores do PIS (VL_PIS) dos Itens do Documento (Registros C170) onde CST (CST_PIS) for diferente de 05 e 75.`, severidade: 'erro' });
      }
      // VL_COFINS: C100 >= soma C170
      if (doc.vlCofinsC100 > 0 && doc.somaCofinsC170 > 0 && doc.vlCofinsC100 < doc.somaCofinsC170 - 0.02) {
        erros.push({ linha: doc.linha, registro: 'C100', mensagem: `Valor inválido. O valor deve ser maior ou igual à soma dos valores da COFINS (VL_COFINS) dos Itens do Documento (Registros C170) onde CST (CST_COFINS) for diferente de 05 e 75.`, severidade: 'erro' });
      }
      // CHV_NFE: CNPJ na chave deve confecer com CNPJ do participante
      if (doc.chvNfe && doc.chvNfe.length >= 22) {
        const cnpjChave = doc.chvNfe.substring(6, 20);
        // Buscar CNPJ do participante no 0150
        const codPart = doc.codPart;
        if (codPart) {
          for (const linha of linhas) {
            const c = linha.split('|').filter((x) => x !== '');
            if (c[0] === '0150' && c[1] === codPart) {
              // 0150: 1=0150, 2=COD_PART, 3=NOME, 4=COD_PAIS, 5=CNPJ, 6=IE, 7=COD_MUN
              const cnpjPart = (c[4] || '').replace(/\D/g, '');
              if (cnpjPart && cnpjPart.length === 14 && cnpjChave !== cnpjPart) {
                erros.push({ linha: doc.linha, registro: 'C100', mensagem: `O CNPJ da chave do documento eletrônico (${cnpjChave}) não confere com o CNPJ ou CPF do participante informado (${cnpjPart}).`, severidade: 'erro' });
              }
              break;
            }
          }
        }
      }
    }

    // Validar D100 CHV_CTE
    for (const key of Object.keys(d100Docs)) {
      const doc = d100Docs[key];
      if (doc.chvCte && doc.chvCte.length >= 34) {
        const numDocChave = doc.chvCte.substring(25, 34).replace(/^0+/, '');
        const numDoc = (doc.numDoc || '').replace(/^0+/, '');
        if (numDocChave && numDoc && numDocChave !== numDoc) {
          erros.push({ linha: doc.linha, registro: 'D100', mensagem: `O número do documento informado na chave do CTe (${numDocChave}) não confere com o número do documento informado no documento fiscal (${numDoc}).`, severidade: 'erro' });
        }
      }
    }

    // Validar D500/D501 NAT_REC
    for (const d500 of d500Records) {
      const cst = d500.cstD501 || '';
      const natRec = d500.natRecD501 || '';
      if ((cst === '03' || cst === '04') && natRec !== '' && !/^\d{8}$/.test(natRec)) {
        erros.push({ linha: d500.linha, registro: 'D500', mensagem: `Natureza da Receita inválida. O valor informado no campo deverá existir em uma das tabelas de acordo com o Código de Situação Tributária: Tabela 4.3.10: Produtos Sujeitos à Incidência Monofásica.`, severidade: 'erro' });
      }
    }
  }

  // Regra: 0111 REC_BRU_CUM — deve ser 0 quando COD_INC_TRIB (0110) = 1 (exclusivamente não-cumulativo)
  // e maior que zero quando COD_INC_TRIB = 3 (ambos os regimes)
  if (estatisticas.registros['0110'] && estatisticas.registros['0111']) {
    let codIncTrib = '';
    for (const linha of linhas) {
      const campos = linha.split('|').filter((c) => c !== '');
      if (campos[0] === '0110') { codIncTrib = campos[1] || ''; break; }
    }
    if (codIncTrib === '1') {
      // COD_INC_TRIB=1 → REC_BRU_CUM no 0111 deve ser 0
      for (const linha of linhas) {
        const c = linha.split('|');
        if (c[1] === '0111') {
          const recBruCum = parseNum(c[5] || ''); // posição 5 no split com pipe
          if (!isNaN(recBruCum) && recBruCum > 0) {
            erros.push({ linha: 0, registro: '0111', mensagem: `O valor do campo deve ser igual a 0 (zero), se incidência tributária for igual a 1 - Escrituração de operações com incidência exclusivamente no regime não-cumulativo; ou maior que zero, se for 3 (ambos).`, severidade: 'erro' });
          }
          break;
        }
      }
    }
  }
}

// Correção automática de campos — chamada dentro de corrigirConteudo
export function corrigirContribuicoes(linhas) {
  return linhas.map(linha => {
    const partes = linha.split('|');
    const reg = partes[1];

    if (reg === 'A170') {
      // Pad array to at least 17 fields — trailing empty fields may be truncated
      while (partes.length < 17) partes.push('');
      // A170 layout: partes[9]=CST_PIS, [10]=VL_BC_PIS, [11]=ALIQ_PIS, [12]=VL_PIS
      //               partes[13]=CST_COFINS, [14]=VL_BC_COFINS, [15]=ALIQ_COFINS, [16]=VL_COFINS
      const cstSemCredito = ['04','05','06','07','08','09','49','98','99'];

      // CST_COFINS = CST_PIS
      if (partes[9] && partes[9] !== '' && (partes[13] === '' || partes[13] === undefined || partes[13] !== partes[9])) {
        partes[13] = partes[9];
      }
      // VL_BC_COFINS = VL_BC_PIS (sync when both filled but different, or COFINS empty)
      if (partes[10] && partes[10] !== '') {
        const bcPis = parseNum(partes[10]);
        if (!isNaN(bcPis) && bcPis > 0) {
          if (!partes[14] || partes[14] === '' || parseNum(partes[14]) !== bcPis) {
            partes[14] = partes[10];
          }
        }
      }
      // ALIQ_COFINS = ALIQ_PIS (when COFINS empty)
      if (partes[11] && partes[11] !== '' && (!partes[15] || partes[15] === '')) {
        partes[15] = partes[11];
      }
      // Zero VL_PIS/VL_COFINS for CST sem crédito
      if (cstSemCredito.includes(partes[9] || '')) {
        partes[12] = '0,00';
        partes[10] = ''; partes[11] = '';
      }
      if (cstSemCredito.includes(partes[13] || '')) {
        partes[16] = '0,00';
        partes[14] = ''; partes[15] = '';
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

    if (reg === 'C170') {
      // Pad array to at least 37 fields — many ERPs truncate trailing empty pipe fields
      while (partes.length < 37) partes.push('');
      // Layout: partes[25]=CST_PIS, [26]=VL_BC_PIS, [27]=ALIQ_PIS, [28]=QUANT_BC_PIS, [29]=ALIQ_PIS_QUANT, [30]=VL_PIS
      //         partes[31]=CST_COFINS, [32]=VL_BC_COFINS, [33]=ALIQ_COFINS, [34]=QUANT_BC_COFINS, [35]=ALIQ_COFINS_QUANT, [36]=VL_COFINS

      const cstSemCredito = ['04','05','06','07','08','09','49','98','99'];

      // Auto-fix: CST_COFINS = CST_PIS
      if (partes[25] && partes[25] !== '' && (!partes[31] || partes[31] === '' || partes[31] !== partes[25])) {
        partes[31] = partes[25];
      }
      // Auto-fix: VL_BC_COFINS = VL_BC_PIS (when both filled but different, or COFINS empty)
      if (partes[26] && partes[26] !== '') {
        const bcPis = parseNum(partes[26]);
        if (!isNaN(bcPis) && bcPis > 0) {
          if (!partes[32] || partes[32] === '' || parseNum(partes[32]) !== bcPis) {
            partes[32] = partes[26];
          }
        }
      }
      // Auto-fix: ALIQ_COFINS = ALIQ_PIS (when COFINS empty)
      if (partes[27] && partes[27] !== '' && (!partes[33] || partes[33] === '')) {
        partes[33] = partes[27];
      }
      // Auto-fix: Zero VL_PIS/VL_COFINS for CST sem crédito
      if (cstSemCredito.includes(partes[25] || '')) {
        partes[30] = '0,00';
        partes[26] = ''; partes[27] = ''; partes[28] = ''; partes[29] = '';
      }
      if (cstSemCredito.includes(partes[31] || '')) {
        partes[36] = '0,00';
        partes[32] = ''; partes[33] = ''; partes[34] = ''; partes[35] = '';
      }
      // Auto-fix: Alíquotas básicas para CST=01 (PIS=0.65%, COFINS=3.00%)
      if (partes[25] === '01' && (!partes[27] || partes[27] === '' || parseNum(partes[27]) === 0)) {
        partes[27] = '0,65';
      }
      if (partes[31] === '01' && (!partes[33] || partes[33] === '' || parseNum(partes[33]) === 0)) {
        partes[33] = '3,00';
      }

      // NOTA: NÃO zeramos ALIQ_PIS_QUANT/ALIQ_COFINS_QUANT para CST monofásico (03/04)
      // pois essas alíquotas são obrigatórias nesse caso (Tabela 4.3.11).
      // O PVA valida se a alíquota existe na tabela — não há como corrigir automaticamente
      // sem conhecer a tabela completa, então mantemos os valores do ERP intactos.

      // VL_PIS = VL_BC_PIS x ALIQ_PIS / 100
      if (partes[26] && partes[27] && partes[26] !== '' && partes[27] !== '') {
        const bc = parseNum(partes[26]); const aliq = parseNum(partes[27]);
        if (!isNaN(bc) && !isNaN(aliq) && aliq > 0) {
          partes[30] = ((bc * aliq) / 100).toFixed(2).replace('.', ',');
        }
      }
      // VL_PIS = QUANT_BC_PIS x ALIQ_PIS_QUANT (apenas se QUANT_BC ainda preenchida)
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
      // VL_COFINS = QUANT_BC_COFINS x ALIQ_COFINS_QUANT (apenas se QUANT_BC ainda preenchida)
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

    if (reg === '0150') {
      // Layout pipe-split: partes[0]='' partes[1]='0150' partes[2]=COD_PART partes[3]=NOME
      //   partes[4]=COD_PAIS partes[5]=CNPJ partes[6]=CPF partes[7]=IE partes[8]=COD_MUN
      // Garantir que o array tem campos suficientes
      while (partes.length < 10) partes.push('');
      // IE inválida (não-dígito, não-ISENTO, não-PR) → "ISENTO"
      if (partes[7] !== undefined && partes[7] !== '') {
        const ie = partes[7].toUpperCase().trim();
        if (ie !== 'ISENTO' && ie !== 'PR' && !/^\d+$/.test(ie)) {
          partes[7] = 'ISENTO';
        }
      }
      // COD_MUN ausente/inválido → "9999999"
      if (partes[8] === undefined || partes[8] === '' || !/^\d{7}$/.test(partes[8])) {
        partes[8] = '9999999';
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

// Correção do arredondamento de R$ 0,01 no C100: VL_PIS e VL_COFINS do C100
// devem ser >= soma dos VL_PIS/VL_COFINS dos C170 filhos (CST != 05 e != 75).
// O PVA rejeita qualquer diferença positiva (inclusive R$ 0,01) causada por arredondamento do ERP.
export function corrigirC100Totais(linhas) {
  // Acumula somas dos C170 por C100 pai — rastreia pelo índice do C100 atual
  const c100Map = new Map(); // idx_linha_C100 → { somaPis, somaCofins, temC170 }
  let currentC100Idx = -1;

  for (let i = 0; i < linhas.length; i++) {
    const partes = linhas[i].split('|');
    // partes[0] é '' (antes do primeiro pipe), partes[1] é o código do registro
    const reg = partes[1] || '';

    if (reg === 'C100') {
      currentC100Idx = i;
      c100Map.set(i, { somaPis: 0, somaCofins: 0, temC170: false });
    } else if (reg === 'C170' && currentC100Idx >= 0) {
      // Layout C170 (split com pipe): partes[25]=CST_PIS, partes[30]=VL_PIS
      //                               partes[31]=CST_COFINS, partes[36]=VL_COFINS
      const cstPis = partes[25] || '';
      const cstCofins = partes[31] || '';
      const vlPis = partes[30] ? parseNum(partes[30]) : 0;
      const vlCofins = partes[36] ? parseNum(partes[36]) : 0;
      const entry = c100Map.get(currentC100Idx);
      if (entry) {
        if (cstPis !== '05' && cstPis !== '75') {
          entry.somaPis += (isNaN(vlPis) ? 0 : vlPis);
        }
        if (cstCofins !== '05' && cstCofins !== '75') {
          entry.somaCofins += (isNaN(vlCofins) ? 0 : vlCofins);
        }
        entry.temC170 = true;
      }
    } else if (reg && reg.charAt(0) !== 'C' && reg !== '') {
      // Saiu do bloco C — resetar rastreador
      currentC100Idx = -1;
    }
  }

  // Corrigir C100 se soma dos C170 > VL_PIS/VL_COFINS declarado (qualquer diferença positiva)
  // Layout C100 (split com pipe): partes[0]='', partes[1]='C100', partes[15]=VL_PIS, partes[19]=VL_COFINS
  // Índices: |C100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|IND_PGTO|VL_DESC|VL_AB_NT|VL_PIS|VL_DESC_PIS|VL_PIS_ST|VL_COFINS|...
  // pos: [0]   [1]       [2]       [3]       [4]      [5]     [6] [7]     [8]     [9]    [10]   [11]  [12]     [13]    [14]    [15]    [16]         [17]      [18]      [19]=VL_COFINS
  // Atenção: VL_PIS está em partes[15], VL_COFINS em partes[19]
  for (const [idx, entry] of c100Map.entries()) {
    if (!entry.temC170) continue;
    const partes = linhas[idx].split('|');

    if (partes[15] !== undefined && partes[15] !== '') {
      const declarado = parseNum(partes[15]);
      // Corrigir se soma dos C170 > VL_PIS declarado no C100 (qualquer diferença, inclusive R$0,01)
      if (!isNaN(declarado) && entry.somaPis > declarado + 0.001) {
        partes[15] = entry.somaPis.toFixed(2).replace('.', ',');
        linhas[idx] = partes.join('|');
      }
    }

    // Re-split após possível modificação acima
    const partes2 = linhas[idx].split('|');
    if (partes2[19] !== undefined && partes2[19] !== '') {
      const declarado = parseNum(partes2[19]);
      if (!isNaN(declarado) && entry.somaCofins > declarado + 0.001) {
        partes2[19] = entry.somaCofins.toFixed(2).replace('.', ',');
        linhas[idx] = partes2.join('|');
      }
    }
  }

  return linhas;
}