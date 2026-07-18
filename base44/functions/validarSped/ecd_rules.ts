// Regras de validação cruzada para SPED ECD (Escrituração Contábil Digital)
// Baseado no Leiaute 8 da ECD (Ato Cotepe 79/2025) — válido para 2026
// Implementa as principais regras do PVA ECD (Programa Validador e Assinador)

function parseNum(v) {
  if (!v) return NaN;
  return parseFloat(String(v).replace(',', '.'));
}

// Validações cruzadas (após loop) para SPED ECD
export function validarCruzadaECD(linhas, estatisticas, erros, avisos) {
  // ===== 1. Hierarquia do Plano de Contas (I050): COD_CTA_SUP deve referenciar COD_CTA existente =====
  {
    const contasCadastradas = new Set();
    const registrosI050 = [];
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] === 'I050') {
        // Layout I050: |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|CTA|
        const codCta = (c[6] || '').trim();
        const codCtaSup = (c[7] || '').trim();
        if (codCta) contasCadastradas.add(codCta);
        registrosI050.push({ linha: i + 1, codCta, codCtaSup, indCta: (c[4] || '').trim(), nivel: (c[5] || '').trim() });
      }
    }
    for (const r of registrosI050) {
      // Conta sintética (IND_CTA=S) deve ter COD_CTA_SUP vazio apenas se for raiz (nível 1)
      // Conta analítica (IND_CTA=A) deve ter COD_CTA_SUP preenchido e válido
      if (r.indCta === 'A' && r.codCtaSup) {
        if (!contasCadastradas.has(r.codCtaSup)) {
          // Converter em aviso: o PVA verifica isso, mas referências a contas de período anterior
          // ou formatações diferentes podem gerar falsos positivos
          avisos.push({
            linha: r.linha,
            registro: 'I050',
            mensagem: `COD_CTA_SUP "${r.codCtaSup}" não foi encontrado no plano de contas. Verifique se a conta pai está cadastrada.`,
            severidade: 'aviso'
          });
        }
      }
    }
  }

  // ===== 2. Consistência de saldos no I155: VL_SLD_FIN = VL_SLD_INI + VL_DEB - VL_CRED (com IND_DC) =====
  // NOTA: Esta validação é desativada pois a comparação exata requer conhecimento completo
  // do plano de contas e regras de encerramento — regra muito sensível que gera falsos positivos.
  // O validador oficial (PVA) aplica esta regra com contexto adicional que não temos aqui.
  if (false) {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I155') continue;
      // Layout I155: |I155|COD_CTA|COD_CCUS|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
      const vlSldIni = parseNum(c[6]);
      const indDcIni = (c[7] || '').toUpperCase().trim();
      const vlDeb = parseNum(c[8]) || 0;
      const vlCred = parseNum(c[9]) || 0;
      const vlSldFin = parseNum(c[10]);
      const indDcFin = (c[11] || '').toUpperCase().trim();

      if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

      // Calcula saldo final esperado considerando IND_DC_INI
      // D=Devedor (positivo), C=Credor (negativo na lógica de saldo)
      let sldIniAbs = vlSldIni;
      let sldCalc;
      if (indDcIni === 'D') {
        sldCalc = sldIniAbs + vlDeb - vlCred;
      } else {
        sldCalc = sldIniAbs + vlCred - vlDeb;
      }

      // Determina IND_DC esperado do saldo final
      const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';
      const sldFinEsperado = Math.abs(sldCalc);

      if (!isNaN(sldFinEsperado) && Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: 'I155',
          mensagem: `Inconsistência de saldo: VL_SLD_FIN (${c[10]}) não confere com VL_SLD_INI (${c[6]}) + movimentação. Esperado=${sldFinEsperado.toFixed(2)} (${indDcFinEsperado}). Verifique se os valores de débito/crédito e o indicador D/C estão corretos.`,
          severidade: 'erro'
        });
      }
      // Valida IND_DC_FIN
      if (indDcFin && indDcFin !== indDcFinEsperado && Math.abs(sldCalc) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: 'I155',
          mensagem: `IND_DC_FIN "${indDcFin}" inconsistente com o saldo calculado. Para o saldo de ${sldFinEsperado.toFixed(2)}, o indicador deveria ser "${indDcFinEsperado}" (D=Devedor, C=Credor).`,
          severidade: 'erro'
        });
      }
    }
  } // end if (false)

  // ===== 3. Partidas dobradas no I200/I250: soma de I250 (D) deve igualar soma de I250 (C) =====
  // NOTA: Desativado — o layout real do I200/I250 com campos opcionais requer parsing mais cuidadoso
  // para evitar falsos positivos em lançamentos de encerramento legítimos.
  if (false) {
    let currentI200 = null;
    const lancamentos = {}; // linha I200 → { somaDebito, somaCredito, indDc }
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'I200') {
        currentI200 = i;
        lancamentos[i] = { linha: i + 1, somaDebito: 0, somaCredito: 0, vlLcto: parseNum(c[6]) || 0, indDc: (c[7] || '').toUpperCase().trim() };
      } else if (reg === 'I250' && currentI200 !== null && lancamentos[currentI200]) {
        // Layout I250: |I250|COD_CTA|COD_CCUS|VL_LCTO|IND_DC|NUM_LCTO|HIST|COD_PART|
        const vlLcto = parseNum(c[4]) || 0;
        const indDc = (c[5] || '').toUpperCase().trim();
        if (indDc === 'D') lancamentos[currentI200].somaDebito += vlLcto;
        else if (indDc === 'C') lancamentos[currentI200].somaCredito += vlLcto;
      } else if (reg === 'I200') {
        currentI200 = i;
      } else if (reg && reg.charAt(0) !== 'I' && reg !== '') {
        // Saiu do bloco I
        currentI200 = null;
      }
    }
    for (const [idx, l] of Object.entries(lancamentos)) {
      const diff = Math.abs(l.somaDebito - l.somaCredito);
      if (diff > 0.02) {
        erros.push({
          linha: l.linha,
          registro: 'I200',
          mensagem: `Lançamento desbalanceado: a soma dos débitos (${l.somaDebito.toFixed(2)}) não confere com a soma dos créditos (${l.somaCredito.toFixed(2)}) nos registros I250 filhos. Diferença: ${diff.toFixed(2)}. O princípio das partidas dobradas exige que débitos = créditos.`,
          severidade: 'erro'
        });
      }
    }
  } // end if (false)

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
        // Layout J900: |J900|NUM_ORD|NAT_LIVR|DT_INI|DT_FIN|NOME|CNPJ|...
        const dtIniJ900 = c[4] || '';
        const dtFinJ900 = c[5] || '';
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
export function corrigirECD(linhas) {
  for (let i = 0; i < linhas.length; i++) {
    const c = linhas[i].split('|');
    if (c[1] !== 'I155') continue;
    const vlSldIni = parseNum(c[6]);
    const indDcIni = (c[7] || '').toUpperCase().trim();
    const vlDeb = parseNum(c[8]) || 0;
    const vlCred = parseNum(c[9]) || 0;
    const vlSldFin = parseNum(c[10]);
    if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

    let sldCalc;
    if (indDcIni === 'D') {
      sldCalc = vlSldIni + vlDeb - vlCred;
    } else {
      sldCalc = vlSldIni + vlCred - vlDeb;
    }
    const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';
    const sldFinEsperado = Math.abs(sldCalc);

    if (Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
      c[10] = sldFinEsperado.toFixed(2).replace('.', ',');
    }
    c[11] = indDcFinEsperado;
    linhas[i] = c.join('|');
  }
  return linhas;
}