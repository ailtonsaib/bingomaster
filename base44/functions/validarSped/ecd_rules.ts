// Regras de validação cruzada para SPED ECD (Escrituração Contábil Digital)
// Baseado no Leiaute 8 da ECD (Ato Cotepe 79/2025) — válido para 2026
// Implementa as regras do PVA ECD (Programa Validador e Assinador)
// Foco em validações estruturais/cruzadas — NÃO em checagens de campos obrigatórios individuais
// (que geram falsos positivos e não correspondem às regras do PVA oficial)

function parseNum(v) {
  if (!v || v === '') return NaN;
  const n = parseFloat(String(v).replace(',', '.'));
  return n;
}

// Validações cruzadas (após loop) para SPED ECD — alinhadas com o PVA oficial
export function validarCruzadaECD(linhas, estatisticas, erros, avisos) {

  // ===== 1. Consistência de saldos no I155: VL_SLD_FIN = VL_SLD_INI + VL_DEB - VL_CRED (com IND_DC) =====
  // Layout Leiaute 8: |I155|COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I155') continue;

      const vlSldIni = parseNum(c[4]);
      const indDcIni = (c[5] || '').toUpperCase().trim();
      const vlDeb = parseNum(c[6]) || 0;
      const vlCred = parseNum(c[7]) || 0;
      const vlSldFin = parseNum(c[8]);

      if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;
      if (!['D', 'C'].includes(indDcIni)) continue;

      let sldCalc;
      if (indDcIni === 'D') {
        sldCalc = vlSldIni + vlDeb - vlCred;
      } else {
        sldCalc = vlSldIni + vlCred - vlDeb;
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
    }
  }

  // ===== 2. Partidas dobradas no I200/I250: soma de I250 (D) deve igualar soma de I250 (C) =====
  {
    let currentI200 = -1;
    const lancamentos = {};
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'I200') {
        currentI200 = i;
        const vlLcto = parseNum(c[4]);
        lancamentos[i] = { linha: i + 1, somaDebito: 0, somaCredito: 0, vlLcto: isNaN(vlLcto) ? 0 : vlLcto };
      } else if (reg === 'I250' && currentI200 >= 0 && lancamentos[currentI200]) {
        const vl = parseNum(c[4]) || 0;
        const indDc = (c[5] || '').toUpperCase().trim();
        if (indDc === 'D') lancamentos[currentI200].somaDebito += vl;
        else if (indDc === 'C') lancamentos[currentI200].somaCredito += vl;
      } else if (reg && reg.charAt(0) !== 'I') {
        currentI200 = -1;
      }
    }
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

  // ===== 3. I355: Saldo da conta antes do encerramento não corresponde ao total dos lançamentos de encerramento =====
  // Para cada conta em I355, o saldo (VL_CTA) deve corresponder à soma dos lançamentos de encerramento (I250)
  // da mesma conta no período de encerramento.
  // Layout I355: |I355|COD_CTA|COD_CCUS|VL_CTA|IND_DC|
  // Layout I250: |I250|COD_CTA|COD_CCUS|VL_LCTO|IND_DC|NUM_LCTO|HIST|COD_PART|
  {
    // Coletar I355 por conta
    const saldosI355 = {}; // { 'COD_CTA': [{ linha, vlCta, indDc }] }
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I355') continue;
      const codCta = (c[2] || '').trim();
      const vlCta = parseNum(c[4]);
      const indDc = (c[5] || '').toUpperCase().trim();
      if (!codCta || isNaN(vlCta)) continue;
      if (!saldosI355[codCta]) saldosI355[codCta] = [];
      saldosI355[codCta].push({ linha: i + 1, vlCta, indDc });
    }

    // Coletar lançamentos de encerramento (I250 que pertencem a I200 com IND_LCTO=N e HIST contendo "encerramento")
    // Ou mais simples: somar todos I250 por conta e comparar com I355
    // O PVA verifica que o saldo da conta de resultado antes do encerramento (I355)
    // corresponde ao total dos lançamentos de encerramento (I250) para essa conta
    const lancamentosEncerramento = {}; // { 'COD_CTA': { debito: 0, credito: 0 } }
    let inEncerramento = false;
    let foundI350 = false;
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'I350') { foundI350 = true; inEncerramento = true; }
      if (reg === 'J005' || reg === 'J100' || reg === 'J900') inEncerramento = false;
      if (reg === 'I250' && inEncerramento) {
        const codCta = (c[2] || '').trim();
        const vl = parseNum(c[4]) || 0;
        const indDc = (c[5] || '').toUpperCase().trim();
        if (!lancamentosEncerramento[codCta]) lancamentosEncerramento[codCta] = { debito: 0, credito: 0, linha: i + 1 };
        if (indDc === 'D') lancamentosEncerramento[codCta].debito += vl;
        else if (indDc === 'C') lancamentosEncerramento[codCta].credito += vl;
      }
    }

    // Validar: saldo I355 deve corresponder ao total de lançamentos de encerramento
    for (const [codCta, saldos] of Object.entries(saldosI355)) {
      const lanc = lancamentosEncerramento[codCta];
      if (!lanc) continue; // sem lançamentos de encerramento para esta conta
      for (const s of saldos) {
        // O saldo antes do encerramento (I355) deve ser igual ao total que será zerado pelos lançamentos
        // Se IND_DC=D (devedor), os lançamentos de encerramento devem creditar esse valor
        // Se IND_DC=C (credor), os lançamentos de encerramento devem debitar esse valor
        const totalEncerramento = s.indDc === 'D' ? lanc.credito : lanc.debito;
        if (Math.abs(s.vlCta - totalEncerramento) > 0.02) {
          erros.push({
            linha: s.linha,
            registro: 'I355',
            mensagem: `Saldo da conta antes do encerramento não corresponde ao total dos lançamentos de encerramento. Conta: ${codCta}, Saldo I355: ${s.vlCta.toFixed(2)}, Total lançamentos de encerramento: ${totalEncerramento.toFixed(2)}.`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // ===== 4. I355: Saldo da conta de resultado antes do encerramento não foi informado =====
  // Se existem lançamentos de encerramento (I250) para uma conta, deve existir I355 correspondente
  {
    const contasI355 = new Set();
    for (const linha of linhas) {
      const c = linha.split('|');
      if (c[1] === 'I355') {
        const codCta = (c[2] || '').trim();
        if (codCta) contasI355.add(codCta);
      }
    }
    // Verificar lançamentos de encerramento sem I355 correspondente
    let inEncerramento = false;
    const contasSemI355Reportadas = new Set();
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'I350') inEncerramento = true;
      if (reg === 'J005' || reg === 'J100' || reg === 'J900') inEncerramento = false;
      if (reg === 'I250' && inEncerramento) {
        const codCta = (c[2] || '').trim();
        if (codCta && !contasI355.has(codCta) && !contasSemI355Reportadas.has(codCta)) {
          contasSemI355Reportadas.add(codCta);
          erros.push({
            linha: i + 1,
            registro: 'I355',
            mensagem: `O saldo da conta de resultado antes do encerramento não foi informado no registro correspondente (I355). Conta: ${codCta}.`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // ===== 5. Contas de resultado devem ter saldo zero nos meses de encerramento =====
  // "As contas de resultado, nos meses em que houver encerramento, devem ter saldo zero."
  // Contas de resultado = COD_NAT 03 (Receita), 04 (Despesa), 05 (Custo), 06 (Apuração de resultado)
  // Identificadas no I050. Nos meses de encerramento (onde existe I350), o I155 deve ter VL_SLD_FIN = 0
  {
    // Coletar contas de resultado do I050
    const contasResultado = new Set();
    for (const linha of linhas) {
      const c = linha.split('|');
      if (c[1] === 'I050') {
        const codNat = (c[3] || '').trim();
        const codCta = (c[6] || '').trim();
        // COD_NAT 03=Receita, 04=Despesa, 05=Custo, 06=Apuração
        if (['03', '04', '05', '06'].includes(codNat) && codCta) {
          contasResultado.add(codCta);
        }
      }
    }
    // Coletar meses de encerramento (datas do I350)
    const mesesEncerramento = new Set();
    for (const linha of linhas) {
      const c = linha.split('|');
      if (c[1] === 'I350' && c[2]) {
        // DT_RES no formato DDMMAAAA — extrair MMAAAA
        const dt = c[2].trim();
        if (dt.length === 8) {
          mesesEncerramento.add(dt.substring(2, 6)); // MMAAAA
        }
      }
    }
    // Verificar I155: contas de resultado em meses de encerramento devem ter VL_SLD_FIN = 0
    // Layout I155: |I155|COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
    // I155 está sob I150 (que tem DT_INI e DT_FIN)
    let dtIniI150 = '';
    let dtFinI150 = '';
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'I150') {
        dtIniI150 = (c[2] || '').trim();
        dtFinI150 = (c[3] || '').trim();
      } else if (reg === 'I155') {
        const codCta = (c[2] || '').trim();
        const vlSldFin = parseNum(c[8]);
        if (contasResultado.has(codCta) && !isNaN(vlSldFin) && Math.abs(vlSldFin) > 0.02) {
          // Verificar se o mês do I155 corresponde a um mês de encerramento
          // I150 DT_FIN = DDMMAAAA, mês = MMAAAA (posições 3-6)
          const mesI155 = dtFinI150.substring(2, 6);
          if (mesesEncerramento.has(mesI155)) {
            erros.push({
              linha: i + 1,
              registro: 'I155',
              mensagem: `As contas de resultado, nos meses em que houver encerramento, devem ter saldo zero. Conta: ${codCta}, Saldo final: ${vlSldFin.toFixed(2)}.`,
              severidade: 'erro'
            });
          }
        }
      }
    }
  }

  // ===== 6. Balanço deve conter apenas duas linhas com nível de aglutinação igual a 1 =====
  // "O Balanço deve conter apenas duas linhas com nível de aglutinação igual a 1, uma de ativo e outra de passivo."
  // J005 com COD_DEM=1 → J100 (Balanço). NIVEL=1 deve ter exatamente 2 linhas: A (Ativo) e P (Passivo)
  // Layout J100: |J100|COD_AGL|IND_GRP|NIVEL|COD_NAT|IND_CTA|DESC_COD_AGL|VL_SLD_INI|IND_DC_INI|VL_SLD_FIN|IND_DC_FIN|
  {
    let inBalancao = false;
    const linhasNivel1 = [];
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'J005' && c[4] === '1') { inBalancao = true; continue; }
      if (reg === 'J005') { inBalancao = false; continue; }
      if (reg === 'J100' && inBalancao) {
        const nivel = (c[4] || '').trim();
        const indGrp = (c[3] || '').toUpperCase().trim();
        if (nivel === '1') {
          linhasNivel1.push({ linha: i + 1, indGrp });
        }
      }
    }
    if (linhasNivel1.length > 0 && linhasNivel1.length !== 2) {
      for (const l of linhasNivel1) {
        erros.push({
          linha: l.linha,
          registro: 'J100',
          mensagem: `O Balanço deve conter apenas duas linhas com nível de aglutinação igual a 1, uma de ativo e outra de passivo. Encontradas ${linhasNivel1.length} linhas com nível 1.`,
          severidade: 'erro'
        });
      }
    } else if (linhasNivel1.length === 2) {
      const temAtivo = linhasNivel1.some(l => l.indGrp === 'A');
      const temPassivo = linhasNivel1.some(l => l.indGrp === 'P');
      if (!temAtivo || !temPassivo) {
        for (const l of linhasNivel1) {
          erros.push({
            linha: l.linha,
            registro: 'J100',
            mensagem: `O Balanço deve conter apenas duas linhas com nível de aglutinação igual a 1, uma de ativo (A) e outra de passivo (P).`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // ===== 7. DRE: saldo informado na linha de detalhe diferente do resultado calculado =====
  // "O valor do saldo informado na linha de detalhe da Demonstração de Resultado é diferente do resultado
  // calculado com base nos registros de saldos periódicos e de saldos de resultado."
  // J005 com COD_DEM=2 → J150 (DRE). Linhas de detalhe (IND_CTA=A) devem ter saldo = soma de I155 + I355
  // Layout J150: |J150|COD_AGL|COD_AGL_RES|IND_GRP|NIVEL|COD_NAT|DESC_COD_AGL|VL_DEB|IND_DC|VL_CRED|IND_DC_FIN|IND_VL|
  {
    // Coletar saldos por conta do I155 e I355
    const saldosPorConta = {}; // { 'COD_CTA': { debito: 0, credito: 0 } }
    for (const linha of linhas) {
      const c = linha.split('|');
      if (c[1] === 'I155') {
        const codCta = (c[2] || '').trim();
        const vlDeb = parseNum(c[6]) || 0;
        const vlCred = parseNum(c[7]) || 0;
        if (!saldosPorConta[codCta]) saldosPorConta[codCta] = { debito: 0, credito: 0 };
        saldosPorConta[codCta].debito += vlDeb;
        saldosPorConta[codCta].credito += vlCred;
      }
      if (c[1] === 'I355') {
        const codCta = (c[2] || '').trim();
        const vlCta = parseNum(c[4]) || 0;
        const indDc = (c[5] || '').toUpperCase().trim();
        if (!saldosPorConta[codCta]) saldosPorConta[codCta] = { debito: 0, credito: 0 };
        if (indDc === 'D') saldosPorConta[codCta].debito += vlCta;
        else if (indDc === 'C') saldosPorConta[codCta].credito += vlCta;
      }
    }

    // Para cada linha de detalhe da DRE (IND_CTA=A), verificar se o saldo corresponde
    let inDRE = false;
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'J005' && c[4] === '2') { inDRE = true; continue; }
      if (reg === 'J005') { inDRE = false; continue; }
      if (reg === 'J150' && inDRE) {
        const indCta = (c[6] || '').toUpperCase().trim(); // IND_CTA no layout real é posição 6
        const codAgl = (c[2] || '').trim();
        const vlDeb = parseNum(c[8]) || 0;
        const vlCred = parseNum(c[10]) || 0;
        // Apenas linhas de detalhe (analíticas) que referenciam contas
        if (indCta === 'A' && codAgl) {
          // Tentar encontrar o saldo da conta correspondente
          // O COD_AGL na DRE geralmente corresponde ao COD_CTA do plano de contas
          const saldo = saldosPorConta[codAgl];
          if (saldo) {
            const saldoCalculado = Math.abs(saldo.credito - saldo.debito);
            const saldoInformado = Math.abs(vlCred - vlDeb);
            if (Math.abs(saldoCalculado - saldoInformado) > 0.02 && saldoCalculado > 0) {
              erros.push({
                linha: i + 1,
                registro: 'J150',
                mensagem: `O valor do saldo informado na linha de detalhe da Demonstração de Resultado é diferente do resultado calculado com base nos registros de saldos periódicos e de saldos de resultado. Código: ${codAgl}, Informado: ${saldoInformado.toFixed(2)}, Calculado: ${saldoCalculado.toFixed(2)}.`,
                severidade: 'erro'
              });
            }
          }
        }
      }
    }
  }

  // ===== 8. DRE: totalizador diferente do somatório de nível imediatamente inferior =====
  // "Na Demonstração de Resultado, o saldo do código de aglutinação totalizador está diferente
  // do somatório do saldo de todos os registros de nível imediatamente inferior."
  {
    let inDRE = false;
    const dreRecords = [];
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'J005' && c[4] === '2') { inDRE = true; continue; }
      if (reg === 'J005') { inDRE = false; continue; }
      if (reg === 'J150' && inDRE) {
        const codAgl = (c[2] || '').trim();
        const nivel = parseInt(c[5] || '0', 10);
        const vlDeb = parseNum(c[8]) || 0;
        const vlCred = parseNum(c[10]) || 0;
        const indDc = (c[9] || '').toUpperCase().trim();
        const saldo = indDc === 'D' ? vlDeb : vlCred;
        dreRecords.push({ linha: i + 1, codAgl, nivel, saldo, vlDeb, vlCred });
      }
    }
    // Para cada totalizador (NIVEL > 1), somar registros de nível imediatamente inferior
    // que aparecem antes do próximo registro de mesmo nível ou superior
    for (let i = 0; i < dreRecords.length; i++) {
      const rec = dreRecords[i];
      if (rec.nivel <= 1) continue;
      const nivelInferior = rec.nivel - 1;
      let somaInferior = 0;
      let encontrouInferior = false;
      for (let j = i + 1; j < dreRecords.length; j++) {
        if (dreRecords[j].nivel >= rec.nivel) break;
        if (dreRecords[j].nivel === nivelInferior) {
          somaInferior += dreRecords[j].vlCred - dreRecords[j].vlDeb;
          encontrouInferior = true;
        }
      }
      if (encontrouInferior) {
        const saldoTotalizador = rec.vlCred - rec.vlDeb;
        if (Math.abs(saldoTotalizador - somaInferior) > 0.02) {
          erros.push({
            linha: rec.linha,
            registro: 'J150',
            mensagem: `Na Demonstração de Resultado, o saldo do código de aglutinação totalizador está diferente do somatório do saldo de todos os registros de nível imediatamente inferior. Código: ${rec.codAgl}, Saldo: ${saldoTotalizador.toFixed(2)}, Somatório: ${somaInferior.toFixed(2)}.`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // ===== 9. DRE: VL_CTA_INI diferente do VL_CTA_FIN do período imediatamente anterior =====
  // "O valor do saldo inicial (VL_CTA_INI) do código de aglutinação informado na DRE é diferente
  // do saldo final do código (VL_CTA_FIN) informado na DRE do período imediatamente anterior."
  // J005 pode ter múltiplas DREs (períodos diferentes). A VL_SLD_INI de um período deve ser igual
  // à VL_SLD_FIN do mesmo COD_AGL no período anterior.
  {
    const dresPorPeriodo = []; // [{ dtIni, dtFin, registros: [{ codAgl, vlSldIni, vlSldFin }] }]
    let dreAtual = null;
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg === 'J005' && c[4] === '2') {
        dreAtual = { dtIni: (c[2] || '').trim(), dtFin: (c[3] || '').trim(), registros: [] };
        dresPorPeriodo.push(dreAtual);
      } else if (reg === 'J005') {
        dreAtual = null;
      } else if (reg === 'J150' && dreAtual) {
        const codAgl = (c[2] || '').trim();
        const vlSldIni = parseNum(c[8]) || 0;
        const vlSldFin = parseNum(c[10]) || 0;
        dreAtual.registros.push({ linha: i + 1, codAgl, vlSldIni, vlSldFin });
      }
    }
    // Comparar período atual com período anterior
    for (let p = 1; p < dresPorPeriodo.length; p++) {
      const dreAtual = dresPorPeriodo[p];
      const dreAnterior = dresPorPeriodo[p - 1];
      const mapAnterior = {};
      for (const r of dreAnterior.registros) {
        mapAnterior[r.codAgl] = r.vlSldFin;
      }
      for (const r of dreAtual.registros) {
        const vlFinAnterior = mapAnterior[r.codAgl];
        if (vlFinAnterior !== undefined && Math.abs(r.vlSldIni - vlFinAnterior) > 0.02) {
          erros.push({
            linha: r.linha,
            registro: 'J150',
            mensagem: `O valor do saldo inicial (VL_CTA_INI) do código de aglutinação informado na DRE é diferente do saldo final do código (VL_CTA_FIN) informado na DRE do período imediatamente anterior. Código: ${r.codAgl}, VL_CTA_INI: ${r.vlSldIni.toFixed(2)}, VL_CTA_FIN anterior: ${vlFinAnterior.toFixed(2)}.`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // ===== 10. Número da ordem (J900) deve ser igual ao informado no Registro I030 =====
  // "Número da ordem deverá ser igual ao informado no Registro I030."
  // I030: |I030|TERMO_DE_ABERTURA|NUM_ORD|NAT_LIVRO|QTD_LINHAS|NOME|...
  // J900: |J900|TERMO_DE_ENCERRAMENTO|NUM_ORD|NAT_LIVRO|NOME|QTD_LINHAS|DT_INI|DT_FIN|
  {
    let numOrdI030 = '';
    let linhaI030 = 0;
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] === 'I030') {
        numOrdI030 = (c[3] || '').trim();
        linhaI030 = i + 1;
        break;
      }
    }
    if (numOrdI030) {
      for (let i = 0; i < linhas.length; i++) {
        const c = linhas[i].split('|');
        if (c[1] === 'J900') {
          const numOrdJ900 = (c[3] || '').trim();
          if (numOrdJ900 && numOrdJ900 !== numOrdI030) {
            erros.push({
              linha: i + 1,
              registro: 'J900',
              mensagem: `Número da ordem deverá ser igual ao informado no Registro I030. J900 NUM_ORD: "${numOrdJ900}", I030 NUM_ORD: "${numOrdI030}".`,
              severidade: 'erro'
            });
          }
        }
      }
    }
  }

  // ===== 11. Campo obrigatório para o código de qualificação do contador como assinante =====
  // "Campo obrigatório para o código de qualificação do contador como assinante."
  // J930: |J930|NOME|CPF|IDENT_QUALIF|QUALIF|COD_ASSIN|
  // Quando COD_ASSIN=2 (Contador), o campo QUALIF deve ser preenchido
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J930') continue;
      const qualif = (c[5] || '').trim();
      const codAssin = (c[6] || '').trim();
      // COD_ASSIN=2 → Contador → QUALIF obrigatório
      if (codAssin === '2' && !qualif) {
        erros.push({
          linha: i + 1,
          registro: 'J930',
          mensagem: `Campo obrigatório para o código de qualificação do contador como assinante. QUALIF não informado para COD_ASSIN=2 (Contador).`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 12. Qualificação inválida para responsável legal =====
  // "Qualificação inválida para responsável legal."
  // J930 com COD_ASSIN=1 (Diretor/Responsável legal) deve ter QUALIF válida
  // Tabela de qualificações válidas para responsável legal: 203, 204, 205, 206, 207, 208, etc.
  // (conforme tabela de qualificação de signatários da RFB)
  {
    // Qualificações válidas para responsável legal (COD_ASSIN=1)
    const QUALIF_VALIDAS_RESPONSAVEL = ['05', '08', '09', '10', '11', '203', '204', '205', '206', '207', '208', '222', '226'];
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'J930') continue;
      const qualif = (c[5] || '').trim();
      const codAssin = (c[6] || '').trim();
      // COD_ASSIN=1 → Diretor/Responsável legal → QUALIF deve ser válida
      if (codAssin === '1' && qualif && !QUALIF_VALIDAS_RESPONSAVEL.includes(qualif)) {
        erros.push({
          linha: i + 1,
          registro: 'J930',
          mensagem: `Qualificação inválida para responsável legal. QUALIF: "${qualif}" não é um código válido para COD_ASSIN=1 (Diretor/Responsável legal).`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 13. I051: COD_ENT_REF válido (apenas aviso — não temos tabela completa) =====
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'I051') continue;
      const codEntRef = (c[2] || '').toUpperCase().trim();
      if (codEntRef && !['S50','S51','S52','S53','SPED','ECF'].includes(codEntRef)) {
        avisos.push({
          linha: i + 1,
          registro: 'I051',
          mensagem: `COD_ENT_REF "${codEntRef}" não é um código de entidade referencial reconhecido. Verifique a Tabela 3.0 do plano de contas referencial.`,
          severidade: 'aviso'
        });
      }
    }
  }
}

// Correção automática para ECD: corrige IND_DC e VL_SLD_FIN no I155 quando há inconsistência
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