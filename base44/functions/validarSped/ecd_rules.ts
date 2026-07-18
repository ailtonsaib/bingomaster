// Regras de validação cruzada para SPED ECD (Escrituração Contábil Digital)
// Baseado no Leiaute 8 da ECD (Ato Cotepe 79/2025) — válido para 2026
// Implementa as principais regras do PVA ECD (Programa Validador e Assinador)

function parseNum(v) {
  if (!v) return NaN;
  return parseFloat(String(v).replace(',', '.'));
}

// Validações cruzadas (após loop) para SPED ECD
export function validarCruzadaECD(linhas, estatisticas, erros, avisos) {
  // ===== 1. Hierarquia do Plano de Contas (I050): validada na seção 3b abaixo =====

  // ===== 2. Consistência de saldos no I155: VL_SLD_FIN = VL_SLD_INI + VL_DEB - VL_CRED (com IND_DC) =====
  // Layout real Leiaute 8: |I155|COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
  // c[1]=I155 c[2]=COD_CTA c[3]=COD_CCUS c[4]=VL_SLD_INI c[5]=IND_DC_INI c[6]=VL_DEB c[7]=VL_CRED c[8]=VL_SLD_FIN c[9]=IND_DC_FIN
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I155') continue;

      // Campos obrigatórios
      const codCta = (c[2] || '').trim();
      const vlSldIni = parseNum(c[4]);
      const indDcIni = (c[5] || '').toUpperCase().trim();
      const vlDeb = parseNum(c[6]) || 0;
      const vlCred = parseNum(c[7]) || 0;
      const vlSldFin = parseNum(c[8]);
      const indDcFin = (c[9] || '').toUpperCase().trim();

      // Obrigatoriedade: COD_CTA, VL_SLD_INI, IND_DC_INI, VL_SLD_FIN, IND_DC_FIN
      if (!codCta) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `Campo obrigatório não informado: COD_CTA.`, severidade: 'erro' });
      }
      if (c[4] === undefined || c[4] === '') {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `Campo obrigatório não informado: VL_SLD_INI.`, severidade: 'erro' });
      }
      if (!indDcIni) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `Campo obrigatório não informado: IND_DC_INI (D=Devedor ou C=Credor).`, severidade: 'erro' });
      } else if (!['D', 'C'].includes(indDcIni)) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `IND_DC_INI inválido: "${c[5]}" (deve ser D=Devedor ou C=Credor).`, severidade: 'erro' });
      }
      if (c[8] === undefined || c[8] === '') {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `Campo obrigatório não informado: VL_SLD_FIN.`, severidade: 'erro' });
      }
      if (!indDcFin) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `Campo obrigatório não informado: IND_DC_FIN (D=Devedor ou C=Credor).`, severidade: 'erro' });
      } else if (!['D', 'C'].includes(indDcFin)) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `IND_DC_FIN inválido: "${c[9]}" (deve ser D=Devedor ou C=Credor).`, severidade: 'erro' });
      }

      // Validação numérica
      if (c[4] && isNaN(vlSldIni)) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `VL_SLD_INI inválido: "${c[4]}" não é um valor numérico válido.`, severidade: 'erro' });
      }
      if (c[6] && !isNaN(c[6]) && isNaN(vlDeb)) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `VL_DEB inválido: "${c[6]}" não é um valor numérico válido.`, severidade: 'erro' });
      }
      if (c[7] && !isNaN(c[7]) && isNaN(vlCred)) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `VL_CRED inválido: "${c[7]}" não é um valor numérico válido.`, severidade: 'erro' });
      }
      if (c[8] && isNaN(vlSldFin)) {
        erros.push({ linha: i + 1, registro: 'I155', mensagem: `VL_SLD_FIN inválido: "${c[8]}" não é um valor numérico válido.`, severidade: 'erro' });
      }

      if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

      // Calcula saldo final esperado: D=+débito, C=+crédito
      let sldCalc;
      if (indDcIni === 'D') {
        sldCalc = vlSldIni + vlDeb - vlCred;
      } else if (indDcIni === 'C') {
        sldCalc = vlSldIni + vlCred - vlDeb;
      } else {
        continue; // IND_DC_INI inválido já reportado acima
      }

      const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';
      const sldFinEsperado = Math.abs(sldCalc);

      if (Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: 'I155',
          mensagem: `Inconsistência de saldo: VL_SLD_FIN (${c[8]}) não confere com VL_SLD_INI (${c[4]}) + movimentação (Débitos=${c[6]||'0'}, Créditos=${c[7]||'0'}). Esperado=${sldFinEsperado.toFixed(2)} (${indDcFinEsperado}).`,
          severidade: 'erro'
        });
      }
      if (indDcFin && indDcFin !== indDcFinEsperado && Math.abs(sldCalc) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: 'I155',
          mensagem: `IND_DC_FIN "${indDcFin}" inconsistente com o saldo calculado. Para o saldo de ${sldFinEsperado.toFixed(2)}, o indicador deveria ser "${indDcFinEsperado}".`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 3. Partidas dobradas no I200/I250: soma de I250 (D) deve igualar soma de I250 (C) =====
  // Layout real Leiaute 8:
  //   I200: |I200|NUM_LCTO|DT_LCTO|VL_LCTO|IND_LCTO|HIST|COD_PART|
  //         c[1]=I200 c[2]=NUM_LCTO c[3]=DT_LCTO c[4]=VL_LCTO c[5]=IND_LCTO c[6]=HIST c[7]=COD_PART
  //   I250: |I250|COD_CTA|COD_CCUS|VL_LCTO|IND_DC|NUM_LCTO|HIST|COD_PART|
  //         c[1]=I250 c[2]=COD_CTA c[3]=COD_CCUS c[4]=VL_LCTO c[5]=IND_DC c[6]=NUM_LCTO c[7]=HIST c[8]=COD_PART
  {
    let currentI200 = -1;
    const lancamentos: Record<number, { linha: number; somaDebito: number; somaCredito: number; vlLcto: number; numLcto: string }> = {};
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'I200') {
        currentI200 = i;
        const numLcto = (c[2] || '').trim();
        const dtLcto = (c[3] || '').trim();
        const vlLcto = parseNum(c[4]);
        const indLcto = (c[5] || '').toUpperCase().trim();
        // Campos obrigatórios do I200
        if (!numLcto) erros.push({ linha: i + 1, registro: 'I200', mensagem: `Campo obrigatório não informado: NUM_LCTO.`, severidade: 'erro' });
        if (!dtLcto) erros.push({ linha: i + 1, registro: 'I200', mensagem: `Campo obrigatório não informado: DT_LCTO.`, severidade: 'erro' });
        else if (!/^\d{8}$/.test(dtLcto)) erros.push({ linha: i + 1, registro: 'I200', mensagem: `DT_LCTO inválida: "${dtLcto}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
        if (c[4] === undefined || c[4] === '') erros.push({ linha: i + 1, registro: 'I200', mensagem: `Campo obrigatório não informado: VL_LCTO.`, severidade: 'erro' });
        else if (isNaN(vlLcto)) erros.push({ linha: i + 1, registro: 'I200', mensagem: `VL_LCTO inválido: "${c[4]}" não é um valor numérico válido.`, severidade: 'erro' });
        if (!indLcto) erros.push({ linha: i + 1, registro: 'I200', mensagem: `Campo obrigatório não informado: IND_LCTO (N=Normal, E=Extemporal ou R=Reclassificação).`, severidade: 'erro' });
        else if (!['N', 'E', 'R'].includes(indLcto)) erros.push({ linha: i + 1, registro: 'I200', mensagem: `IND_LCTO inválido: "${c[5]}" (deve ser N=Normal, E=Extemporal ou R=Reclassificação).`, severidade: 'erro' });
        lancamentos[i] = { linha: i + 1, somaDebito: 0, somaCredito: 0, vlLcto: isNaN(vlLcto) ? 0 : vlLcto, numLcto };
      } else if (reg === 'I250' && currentI200 >= 0 && lancamentos[currentI200]) {
        // Campos obrigatórios do I250
        const codCta = (c[2] || '').trim();
        const vlLcto250 = c[4] || '';
        const indDc = (c[5] || '').toUpperCase().trim();
        if (!codCta) erros.push({ linha: i + 1, registro: 'I250', mensagem: `Campo obrigatório não informado: COD_CTA.`, severidade: 'erro' });
        if (!vlLcto250) erros.push({ linha: i + 1, registro: 'I250', mensagem: `Campo obrigatório não informado: VL_LCTO.`, severidade: 'erro' });
        else if (isNaN(parseNum(vlLcto250))) erros.push({ linha: i + 1, registro: 'I250', mensagem: `VL_LCTO inválido: "${vlLcto250}" não é um valor numérico válido.`, severidade: 'erro' });
        if (!indDc) erros.push({ linha: i + 1, registro: 'I250', mensagem: `Campo obrigatório não informado: IND_DC (D=Devedor ou C=Credor).`, severidade: 'erro' });
        else if (!['D', 'C'].includes(indDc)) erros.push({ linha: i + 1, registro: 'I250', mensagem: `IND_DC inválido: "${c[5]}" (deve ser D=Devedor ou C=Credor).`, severidade: 'erro' });
        // Acumular para partidas dobradas
        const vl = parseNum(vlLcto250) || 0;
        if (indDc === 'D') lancamentos[currentI200].somaDebito += vl;
        else if (indDc === 'C') lancamentos[currentI200].somaCredito += vl;
      } else if (reg && reg.charAt(0) !== 'I') {
        currentI200 = -1;
      }
    }
    // Validar partidas dobradas
    for (const [idx, l] of Object.entries(lancamentos)) {
      const diff = Math.abs(l.somaDebito - l.somaCredito);
      if (diff > 0.02) {
        erros.push({
          linha: l.linha,
          registro: 'I200',
          mensagem: `Lançamento desbalanceado: a soma dos débitos (${l.somaDebito.toFixed(2)}) não confere com a soma dos créditos (${l.somaCredito.toFixed(2)}) nos registros I250 filhos. Diferença: ${diff.toFixed(2)}.`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 3b. I050: Campos obrigatórios e formatos =====
  // Layout: |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|CTA|
  // c[1]=I050 c[2]=DT_ALT c[3]=COD_NAT c[4]=IND_CTA c[5]=NIVEL c[6]=COD_CTA c[7]=COD_CTA_SUP c[8]=CTA
  {
    const contasCadastradasI050 = new Set();
    const regsI050 = [];
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I050') continue;
      const linha = i + 1;
      const dtAlt = (c[2] || '').trim();
      const codNat = (c[3] || '').trim();
      const indCta = (c[4] || '').toUpperCase().trim();
      const nivel = (c[5] || '').trim();
      const codCta = (c[6] || '').trim();
      const codCtaSup = (c[7] || '').trim();
      const cta = (c[8] || '').trim();

      // Obrigatoriedade
      if (!dtAlt) erros.push({ linha, registro: 'I050', mensagem: `Campo obrigatório não informado: DT_ALT.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtAlt)) erros.push({ linha, registro: 'I050', mensagem: `DT_ALT inválida: "${dtAlt}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
      if (!codNat) erros.push({ linha, registro: 'I050', mensagem: `Campo obrigatório não informado: COD_NAT (01-10).`, severidade: 'erro' });
      else if (!/^0[1-9]$|^10$/.test(codNat)) erros.push({ linha, registro: 'I050', mensagem: `COD_NAT inválido: "${codNat}" (deve estar entre 01 e 10).`, severidade: 'erro' });
      if (!indCta) erros.push({ linha, registro: 'I050', mensagem: `Campo obrigatório não informado: IND_CTA (S=Sintética ou A=Analítica).`, severidade: 'erro' });
      else if (!['S', 'A'].includes(indCta)) erros.push({ linha, registro: 'I050', mensagem: `IND_CTA inválido: "${c[4]}" (deve ser S=Sintética ou A=Analítica).`, severidade: 'erro' });
      if (!nivel) erros.push({ linha, registro: 'I050', mensagem: `Campo obrigatório não informado: NIVEL.`, severidade: 'erro' });
      if (!codCta) erros.push({ linha, registro: 'I050', mensagem: `Campo obrigatório não informado: COD_CTA.`, severidade: 'erro' });
      if (!cta) erros.push({ linha, registro: 'I050', mensagem: `Campo obrigatório não informado: CTA (nome da conta).`, severidade: 'erro' });

      // Conta analítica deve ter COD_CTA_SUP preenchido
      if (indCta === 'A' && !codCtaSup) {
        erros.push({ linha, registro: 'I050', mensagem: `COD_CTA_SUP obrigatório para conta analítica (IND_CTA=A).`, severidade: 'erro' });
      }

      if (codCta) contasCadastradasI050.add(codCta);
      regsI050.push({ linha, codCta, codCtaSup, indCta });
    }
    // Validar hierarquia: COD_CTA_SUP deve existir
    for (const r of regsI050) {
      if (r.codCtaSup && !contasCadastradasI050.has(r.codCtaSup)) {
        erros.push({ linha: r.linha, registro: 'I050', mensagem: `COD_CTA_SUP "${r.codCtaSup}" não foi encontrado no plano de contas. Verifique se a conta pai está cadastrada.`, severidade: 'erro' });
      }
    }
  }

  // ===== 3c. I030: Campos obrigatórios =====
  // Layout: |I030|TERMO_DE_ABERTURA|NUM_ORD|NAT_LIVRO|QTD_LINHAS|NOME|ASSINANTE|CNPJ|CPF|IE|MUNICIPIO|DT_FIN|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I030') continue;
      const linha = i + 1;
      const numOrd = (c[3] || '').trim();
      const natLivro = (c[4] || '').trim();
      const qtdLinhas = (c[5] || '').trim();
      const nome = (c[6] || '').trim();
      const dtFin = (c[12] || '').trim();
      if (!numOrd) erros.push({ linha, registro: 'I030', mensagem: `Campo obrigatório não informado: NUM_ORD.`, severidade: 'erro' });
      if (!natLivro) erros.push({ linha, registro: 'I030', mensagem: `Campo obrigatório não informado: NAT_LIVRO.`, severidade: 'erro' });
      if (!qtdLinhas) erros.push({ linha, registro: 'I030', mensagem: `Campo obrigatório não informado: QTD_LINHAS.`, severidade: 'erro' });
      else if (isNaN(parseInt(qtdLinhas, 10))) erros.push({ linha, registro: 'I030', mensagem: `QTD_LINHAS inválido: "${qtdLinhas}" não é numérico.`, severidade: 'erro' });
      if (!nome) erros.push({ linha, registro: 'I030', mensagem: `Campo obrigatório não informado: NOME.`, severidade: 'erro' });
      if (!dtFin) erros.push({ linha, registro: 'I030', mensagem: `Campo obrigatório não informado: DT_FIN.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtFin)) erros.push({ linha, registro: 'I030', mensagem: `DT_FIN inválida: "${dtFin}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
    }
  }

  // ===== 3d. J005: Campos obrigatórios e COD_DEM válido =====
  // Layout: |J005|DT_INI|DT_FIN|COD_DEM|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J005') continue;
      const linha = i + 1;
      const dtIni = (c[2] || '').trim();
      const dtFin = (c[3] || '').trim();
      const codDem = (c[4] || '').trim();
      if (!dtIni) erros.push({ linha, registro: 'J005', mensagem: `Campo obrigatório não informado: DT_INI.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtIni)) erros.push({ linha, registro: 'J005', mensagem: `DT_INI inválida: "${dtIni}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
      if (!dtFin) erros.push({ linha, registro: 'J005', mensagem: `Campo obrigatório não informado: DT_FIN.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtFin)) erros.push({ linha, registro: 'J005', mensagem: `DT_FIN inválida: "${dtFin}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
      if (!codDem) erros.push({ linha, registro: 'J005', mensagem: `Campo obrigatório não informado: COD_DEM (1=Balanço, 2=DRE, 3=DLPA/DMPL, 4=Fluxo de Caixa, 5=Valor Adicionado).`, severidade: 'erro' });
      else if (!['1', '2', '3', '4', '5'].includes(codDem)) erros.push({ linha, registro: 'J005', mensagem: `COD_DEM inválido: "${codDem}" (deve ser 1=Balanço, 2=DRE, 3=DLPA/DMPL, 4=Fluxo de Caixa ou 5=Valor Adicionado).`, severidade: 'erro' });
    }
  }

  // ===== 3e. J100: Campos obrigatórios e IND_DC =====
  // Layout real: |J100|COD_AGL|IND_GRP|NIVEL|COD_NAT|IND_CTA|DESC_COD_AGL|VL_SLD_INI|IND_DC_INI|VL_SLD_FIN|IND_DC_FIN|
  // c[1]=J100 c[2]=COD_AGL c[3]=IND_GRP c[4]=NIVEL c[5]=COD_NAT c[6]=IND_CTA c[7]=DESC_COD_AGL
  // c[8]=VL_SLD_INI c[9]=IND_DC_INI c[10]=VL_SLD_FIN c[11]=IND_DC_FIN
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J100') continue;
      const linha = i + 1;
      const codAgl = (c[2] || '').trim();
      const indGrp = (c[3] || '').toUpperCase().trim();
      const codNat = (c[5] || '').trim();
      const indCta = (c[6] || '').toUpperCase().trim();
      const descAgl = (c[7] || '').trim();
      const vlSldIni = c[8] || '';
      const indDcIni = (c[9] || '').toUpperCase().trim();
      const vlSldFin = c[10] || '';
      const indDcFin = (c[11] || '').toUpperCase().trim();
      if (!codAgl) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: COD_AGL.`, severidade: 'erro' });
      if (!indGrp) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: IND_GRP (A=Ativo, P=Passivo, R=Receita, D=Despesa).`, severidade: 'erro' });
      else if (!['A', 'P', 'R', 'D'].includes(indGrp)) erros.push({ linha, registro: 'J100', mensagem: `IND_GRP inválido: "${c[3]}" (deve ser A=Ativo, P=Passivo, R=Receita ou D=Despesa).`, severidade: 'erro' });
      if (!codNat) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: COD_NAT (01-10).`, severidade: 'erro' });
      else if (!/^0[1-9]$|^10$/.test(codNat)) erros.push({ linha, registro: 'J100', mensagem: `COD_NAT inválido: "${codNat}" (deve estar entre 01 e 10).`, severidade: 'erro' });
      if (!indCta) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: IND_CTA (S ou A).`, severidade: 'erro' });
      else if (!['S', 'A'].includes(indCta)) erros.push({ linha, registro: 'J100', mensagem: `IND_CTA inválido: "${c[6]}" (deve ser S=Sintética ou A=Analítica).`, severidade: 'erro' });
      if (!descAgl) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: DESC_COD_AGL.`, severidade: 'erro' });
      if (!vlSldIni) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: VL_SLD_INI.`, severidade: 'erro' });
      else if (isNaN(parseNum(vlSldIni))) erros.push({ linha, registro: 'J100', mensagem: `VL_SLD_INI inválido: "${vlSldIni}".`, severidade: 'erro' });
      if (!indDcIni) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: IND_DC_INI (D ou C).`, severidade: 'erro' });
      else if (!['D', 'C'].includes(indDcIni)) erros.push({ linha, registro: 'J100', mensagem: `IND_DC_INI inválido: "${c[9]}" (deve ser D ou C).`, severidade: 'erro' });
      if (!vlSldFin) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: VL_SLD_FIN.`, severidade: 'erro' });
      else if (isNaN(parseNum(vlSldFin))) erros.push({ linha, registro: 'J100', mensagem: `VL_SLD_FIN inválido: "${vlSldFin}".`, severidade: 'erro' });
      else if (parseNum(vlSldFin) < 0) erros.push({ linha, registro: 'J100', mensagem: `VL_SLD_FIN não pode ser negativo (${vlSldFin}). Use IND_DC para expressar a natureza do saldo.`, severidade: 'erro' });
      if (!indDcFin) erros.push({ linha, registro: 'J100', mensagem: `Campo obrigatório não informado: IND_DC_FIN (D ou C).`, severidade: 'erro' });
      else if (!['D', 'C'].includes(indDcFin)) erros.push({ linha, registro: 'J100', mensagem: `IND_DC_FIN inválido: "${c[11]}" (deve ser D ou C).`, severidade: 'erro' });
    }
  }

  // ===== 3f. J150: Campos obrigatórios =====
  // Layout real: |J150|COD_AGL|COD_AGL_RES|IND_GRP|NIVEL|COD_NAT|DESC_COD_AGL|VL_DEB|IND_DC|VL_CRED|IND_DC_FIN|IND_VL|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J150') continue;
      const linha = i + 1;
      const codAgl = (c[2] || '').trim();
      const indGrp = (c[4] || '').toUpperCase().trim();
      const codNat = (c[6] || '').trim();
      const descAgl = (c[7] || '').trim();
      const vlDeb = c[8] || '';
      const indDc = (c[9] || '').toUpperCase().trim();
      const vlCred = c[10] || '';
      const indDcFin = (c[11] || '').toUpperCase().trim();
      const indVl = (c[12] || '').toUpperCase().trim();
      if (!codAgl) erros.push({ linha, registro: 'J150', mensagem: `Campo obrigatório não informado: COD_AGL.`, severidade: 'erro' });
      if (!indGrp) erros.push({ linha, registro: 'J150', mensagem: `Campo obrigatório não informado: IND_GRP (A=Ativo, P=Passivo, R=Receita, D=Despesa).`, severidade: 'erro' });
      else if (!['A', 'P', 'R', 'D'].includes(indGrp)) erros.push({ linha, registro: 'J150', mensagem: `IND_GRP inválido: "${c[4]}" (deve ser A, P, R ou D).`, severidade: 'erro' });
      if (!codNat) erros.push({ linha, registro: 'J150', mensagem: `Campo obrigatório não informado: COD_NAT (01-10).`, severidade: 'erro' });
      else if (!/^0[1-9]$|^10$/.test(codNat)) erros.push({ linha, registro: 'J150', mensagem: `COD_NAT inválido: "${codNat}" (deve estar entre 01 e 10).`, severidade: 'erro' });
      if (!descAgl) erros.push({ linha, registro: 'J150', mensagem: `Campo obrigatório não informado: DESC_COD_AGL.`, severidade: 'erro' });
      if (vlDeb && isNaN(parseNum(vlDeb))) erros.push({ linha, registro: 'J150', mensagem: `VL_DEB inválido: "${vlDeb}".`, severidade: 'erro' });
      if (vlCred && isNaN(parseNum(vlCred))) erros.push({ linha, registro: 'J150', mensagem: `VL_CRED inválido: "${vlCred}".`, severidade: 'erro' });
      if (indDc && !['D', 'C'].includes(indDc)) erros.push({ linha, registro: 'J150', mensagem: `IND_DC inválido: "${c[9]}" (deve ser D ou C).`, severidade: 'erro' });
      if (indDcFin && !['D', 'C'].includes(indDcFin)) erros.push({ linha, registro: 'J150', mensagem: `IND_DC_FIN inválido: "${c[11]}" (deve ser D ou C).`, severidade: 'erro' });
      if (indVl && !['D', 'C', 'R'].includes(indVl)) erros.push({ linha, registro: 'J150', mensagem: `IND_VL inválido: "${c[12]}" (deve ser D, C ou R).`, severidade: 'erro' });
    }
  }

  // ===== 3g. J930: Campos obrigatórios =====
  // Layout: |J930|NOME|CPF|IDENT_QUALIF|QUALIF|COD_ASSIN|
  // c[1]=J930 c[2]=NOME c[3]=CPF c[4]=IDENT_QUALIF c[5]=QUALIF c[6]=COD_ASSIN
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J930') continue;
      const linha = i + 1;
      const nome = (c[2] || '').trim();
      const cpf = (c[3] || '').replace(/\D/g, '');
      const qualif = (c[5] || '').trim();
      const codAssin = (c[6] || '').trim();
      if (!nome) erros.push({ linha, registro: 'J930', mensagem: `Campo obrigatório não informado: NOME.`, severidade: 'erro' });
      if (!cpf) erros.push({ linha, registro: 'J930', mensagem: `Campo obrigatório não informado: CPF.`, severidade: 'erro' });
      else if (cpf.length !== 11) erros.push({ linha, registro: 'J930', mensagem: `CPF inválido: "${c[3]}" (esperado 11 dígitos, encontrado ${cpf.length}).`, severidade: 'erro' });
      if (!qualif) erros.push({ linha, registro: 'J930', mensagem: `Campo obrigatório não informado: QUALIF.`, severidade: 'erro' });
      if (!codAssin) erros.push({ linha, registro: 'J930', mensagem: `Campo obrigatório não informado: COD_ASSIN (1-9).`, severidade: 'erro' });
      else if (!['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(codAssin)) erros.push({ linha, registro: 'J930', mensagem: `COD_ASSIN inválido: "${codAssin}" (deve estar entre 1 e 9).`, severidade: 'erro' });
    }
  }

  // ===== 3h. I010: Campos obrigatórios =====
  // Layout: |I010|IND_ESC|COD_VER_LC|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I010') continue;
      const linha = i + 1;
      const indEsc = (c[2] || '').toUpperCase().trim();
      const codVerLc = (c[3] || '').trim();
      if (!indEsc) erros.push({ linha, registro: 'I010', mensagem: `Campo obrigatório não informado: IND_ESC (G, R, A, B ou Z).`, severidade: 'erro' });
      else if (!['G', 'R', 'A', 'B', 'Z'].includes(indEsc)) erros.push({ linha, registro: 'I010', mensagem: `IND_ESC inválido: "${c[2]}" (deve ser G, R, A, B ou Z).`, severidade: 'erro' });
      if (!codVerLc) erros.push({ linha, registro: 'I010', mensagem: `Campo obrigatório não informado: COD_VER_LC.`, severidade: 'erro' });
    }
  }

  // ===== 3i. I012: Campos obrigatórios =====
  // Layout: |I012|NUM_ORD|NAT_LIVR|TIPO|COD_HASH_AUX|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I012') continue;
      const linha = i + 1;
      const numOrd = (c[2] || '').trim();
      const natLivr = (c[3] || '').trim();
      const tipo = (c[4] || '').trim();
      if (!numOrd) erros.push({ linha, registro: 'I012', mensagem: `Campo obrigatório não informado: NUM_ORD.`, severidade: 'erro' });
      if (!natLivr) erros.push({ linha, registro: 'I012', mensagem: `Campo obrigatório não informado: NAT_LIVR.`, severidade: 'erro' });
      if (!tipo) erros.push({ linha, registro: 'I012', mensagem: `Campo obrigatório não informado: TIPO (0=Digital ou 1=Outros).`, severidade: 'erro' });
      else if (!['0', '1'].includes(tipo)) erros.push({ linha, registro: 'I012', mensagem: `TIPO inválido: "${c[4]}" (deve ser 0=Digital ou 1=Outros).`, severidade: 'erro' });
    }
  }

  // ===== 3j. I150: Campos obrigatórios =====
  // Layout: |I150|DT_INI|DT_FIN|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I150') continue;
      const linha = i + 1;
      const dtIni = (c[2] || '').trim();
      const dtFin = (c[3] || '').trim();
      if (!dtIni) erros.push({ linha, registro: 'I150', mensagem: `Campo obrigatório não informado: DT_INI.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtIni)) erros.push({ linha, registro: 'I150', mensagem: `DT_INI inválida: "${dtIni}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
      if (!dtFin) erros.push({ linha, registro: 'I150', mensagem: `Campo obrigatório não informado: DT_FIN.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtFin)) erros.push({ linha, registro: 'I150', mensagem: `DT_FIN inválida: "${dtFin}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
    }
  }

  // ===== 3k. J900: Campos obrigatórios =====
  // Layout: |J900|TERMO_DE_ENCERRAMENTO|NUM_ORD|NAT_LIVRO|NOME|QTD_LINHAS|DT_INI|DT_FIN|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J900') continue;
      const linha = i + 1;
      const numOrd = (c[3] || '').trim();
      const natLivro = (c[4] || '').trim();
      const nome = (c[5] || '').trim();
      const qtdLinhas = (c[6] || '').trim();
      const dtIni = (c[7] || '').trim();
      const dtFin = (c[8] || '').trim();
      if (!numOrd) erros.push({ linha, registro: 'J900', mensagem: `Campo obrigatório não informado: NUM_ORD.`, severidade: 'erro' });
      if (!natLivro) erros.push({ linha, registro: 'J900', mensagem: `Campo obrigatório não informado: NAT_LIVRO.`, severidade: 'erro' });
      if (!nome) erros.push({ linha, registro: 'J900', mensagem: `Campo obrigatório não informado: NOME.`, severidade: 'erro' });
      if (!qtdLinhas) erros.push({ linha, registro: 'J900', mensagem: `Campo obrigatório não informado: QTD_LINHAS.`, severidade: 'erro' });
      else if (isNaN(parseInt(qtdLinhas, 10))) erros.push({ linha, registro: 'J900', mensagem: `QTD_LINHAS inválido: "${qtdLinhas}" não é numérico.`, severidade: 'erro' });
      if (!dtIni) erros.push({ linha, registro: 'J900', mensagem: `Campo obrigatório não informado: DT_INI.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtIni)) erros.push({ linha, registro: 'J900', mensagem: `DT_INI inválida: "${dtIni}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
      if (!dtFin) erros.push({ linha, registro: 'J900', mensagem: `Campo obrigatório não informado: DT_FIN.`, severidade: 'erro' });
      else if (!/^\d{8}$/.test(dtFin)) erros.push({ linha, registro: 'J900', mensagem: `DT_FIN inválida: "${dtFin}" (formato esperado DDMMAAAA).`, severidade: 'erro' });
    }
  }

  // ===== 4. I051: COD_CTA_REF deve referenciar conta do plano referencial (J051 da ECD ou tabela SPED) =====
  // Apenas aviso — não temos a tabela completa de plano referencial
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I051') continue;
      // Layout I051: |I051|COD_ENT_REF|COD_CCUS|COD_CTA_REF|
      const codEntRef = c[2] || '';
      const codCtaRef = c[4] || '';
      if (codEntRef && !['S50','S51','S52','S53','SPED','ECF'].includes(codEntRef.toUpperCase().trim())) {
        avisos.push({
          linha: i + 1,
          registro: 'I051',
          mensagem: `COD_ENT_REF "${codEntRef}" não é um código de entidade referencial reconhecido. Verifique a Tabela 3.0 do plano de contas referencial.`,
          severidade: 'aviso'
        });
      }
    }
  }

  // ===== 5. J100 (Balanço Patrimonial): VL_SLD_FIN deve ter IND_DC compatível =====
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J100') continue;
      // Layout J100: |J100|DT_INI|DT_FIN|COD_CTA|COD_CTA_RES|VL_SLD_FIN|IND_DC|...
      const vlSldFin = parseNum(c[6]);
      const indDc = (c[7] || '').toUpperCase().trim();
      if (!isNaN(vlSldFin) && vlSldFin === 0 && indDc) {
        // Saldo zero — IND_DC pode ser D ou C (ambos aceitos)
      } else if (!isNaN(vlSldFin) && vlSldFin < 0) {
        erros.push({
          linha: i + 1,
          registro: 'J100',
          mensagem: `VL_SLD_FIN não pode ser negativo (${c[6]}). Use o indicador IND_DC (D=Devedor, C=Credor) para expressar a natureza do saldo, mantendo o valor sempre positivo.`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 6. J900 (Termo de Encerramento): datas devem estar dentro do período da escrituração =====
  {
    let dtIniEsc = '';
    let dtFinEsc = '';
    // Extrai período do registro 0000
    for (const linha of linhas) {
      const c = linha.split('|');
      if (c[1] === '0000') {
        // ECD: |0000|LECD|DT_INI|DT_FIN|NOME|CNPJ|...
        dtIniEsc = (c[3] || '').trim();
        dtFinEsc = (c[4] || '').trim();
        break;
      }
    }
    if (dtIniEsc && dtFinEsc) {
      for (let i = 0; i < linhas.length; i++) {
        const c = linhas[i].split('|');
        if (c[1] !== 'J900') continue;
        // Layout real: |J900|TERMO_DE_ENCERRAMENTO|NUM_ORD|NAT_LIVRO|NOME|QTD_LINHAS|DT_INI|DT_FIN|
        const dtIniJ900 = c[7] || '';
        const dtFinJ900 = c[8] || '';
        if (dtIniJ900 && dtIniEsc && dtIniJ900 !== dtIniEsc) {
          avisos.push({
            linha: i + 1,
            registro: 'J900',
            mensagem: `DT_INI do termo de encerramento (${dtIniJ900}) difere da data de início da escrituração no registro 0000 (${dtIniEsc}).`,
            severidade: 'aviso'
          });
        }
        if (dtFinJ900 && dtFinEsc && dtFinJ900 !== dtFinEsc) {
          avisos.push({
            linha: i + 1,
            registro: 'J900',
            mensagem: `DT_FIN do termo de encerramento (${dtFinJ900}) difere da data de fim da escrituração no registro 0000 (${dtFinEsc}).`,
            severidade: 'aviso'
          });
        }
      }
    }
  }
}

// Correção automática para ECD: corrige IND_DC e VL_SLD_FIN no I155 quando há inconsistência
// Layout real Leiaute 8: |I155|COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
// c[1]=I155 c[2]=COD_CTA c[3]=COD_CCUS c[4]=VL_SLD_INI c[5]=IND_DC_INI c[6]=VL_DEB c[7]=VL_CRED c[8]=VL_SLD_FIN c[9]=IND_DC_FIN
export function corrigirECD(linhas) {
  for (let i = 0; i < linhas.length; i++) {
    const c = linhas[i].split('|');
    if (c[1] !== 'I155') continue;
    const vlSldIni = parseNum(c[4]);
    const indDcIni = (c[5] || '').toUpperCase().trim();
    const vlDeb = parseNum(c[6]) || 0;
    const vlCred = parseNum(c[7]) || 0;
    const vlSldFin = parseNum(c[8]);
    if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

    let sldCalc;
    if (indDcIni === 'D') {
      sldCalc = vlSldIni + vlDeb - vlCred;
    } else if (indDcIni === 'C') {
      sldCalc = vlSldIni + vlCred - vlDeb;
    } else {
      continue;
    }
    const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';
    const sldFinEsperado = Math.abs(sldCalc);

    if (Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
      c[8] = sldFinEsperado.toFixed(2).replace('.', ',');
    }
    c[9] = indDcFinEsperado;
    linhas[i] = c.join('|');
  }
  return linhas;
}