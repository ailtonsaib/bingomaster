// Regras de validação cruzada para SPED ECF (Escrituração Contábil Fiscal)
// Baseado no Leiaute 12 da ECF (ADE Cofis 2/2026) — ano-calendário 2025 e situações especiais 2026
// Implementa as principais regras do PVA ECF (Programa Validador e Assinador)

function parseNum(v) {
  if (!v) return NaN;
  return parseFloat(String(v).replace(',', '.'));
}

// Validações cruzadas (após loop) para SPED ECF
export function validarCruzadaECF(linhas, estatisticas, erros, avisos) {
  // ===== 1. Consistência de saldos no L100/P100: VL_SLD_FIN = VL_SLD_INI + débitos - créditos =====
  // Layout L100: |L100|COD_CTA|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|...
  // Layout P100: idêntico ao L100
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg !== 'L100' && reg !== 'P100') continue;
      // Layout: |REG|COD_CTA|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|...
      // Split sem filtro: c[1]=REG, c[2]=COD_CTA, c[3]=DT_INI, c[4]=DT_FIN
      //                   c[5]=VL_SLD_INI, c[6]=IND_DC_INI, c[7]=VL_DEB, c[8]=VL_CRED
      //                   c[9]=VL_SLD_FIN, c[10]=IND_DC_FIN
      const vlSldIni = parseNum(c[5]);
      const indDcIni = (c[6] || '').toUpperCase().trim();
      const vlDeb = parseNum(c[7]) || 0;
      const vlCred = parseNum(c[8]) || 0;
      const vlSldFin = parseNum(c[9]);
      const indDcFin = (c[10] || '').toUpperCase().trim();

      if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

      let sldCalc;
      if (indDcIni === 'D') {
        sldCalc = vlSldIni + vlDeb - vlCred;
      } else {
        sldCalc = vlSldIni + vlCred - vlDeb;
      }
      const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';
      const sldFinEsperado = Math.abs(sldCalc);

      if (!isNaN(sldFinEsperado) && Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: reg,
          mensagem: `Inconsistência de saldo: VL_SLD_FIN (${c[9]}) não confere com VL_SLD_INI (${c[5]}) + movimentação (débitos=${c[7]}, créditos=${c[8]}). Esperado=${sldFinEsperado.toFixed(2)} (${indDcFinEsperado}).`,
          severidade: 'erro'
        });
      }
      if (indDcFin && indDcFin !== indDcFinEsperado && Math.abs(sldCalc) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: reg,
          mensagem: `IND_DC_FIN "${indDcFin}" inconsistente com o saldo calculado. Para o saldo de ${sldFinEsperado.toFixed(2)}, o indicador deveria ser "${indDcFinEsperado}" (D=Devedor, C=Credor).`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 2. Consistência de saldos no K155/E155: VL_SLD_FIN = VL_SLD_INI + débitos - créditos =====
  // Layout K155: |K155|COD_CTA|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|...
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg !== 'K155' && reg !== 'E155' && reg !== 'C155') continue;
      // Layout K155: |K155|COD_CTA|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|...
      // Índices podem variar — usar o campo IND_DC (D/C) como guia
      const vlSldIni = parseNum(c[5]);
      const indDcIni = (c[6] || '').toUpperCase().trim();
      const vlDeb = parseNum(c[7]) || 0;
      const vlCred = parseNum(c[8]) || 0;
      const vlSldFin = parseNum(c[9]);
      const indDcFin = (c[10] || '').toUpperCase().trim();

      if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

      let sldCalc;
      if (indDcIni === 'D') {
        sldCalc = vlSldIni + vlDeb - vlCred;
      } else {
        sldCalc = vlSldIni + vlCred - vlDeb;
      }
      const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';
      const sldFinEsperado = Math.abs(sldCalc);

      if (!isNaN(sldFinEsperado) && Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: reg,
          mensagem: `Inconsistência de saldo: VL_SLD_FIN (${c[9]}) não confere com VL_SLD_INI (${c[5]}) + movimentação. Esperado=${sldFinEsperado.toFixed(2)} (${indDcFinEsperado}).`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 3. M300/M350 (e-Lalur): VL_SLD_FIN deve ser consistente com VL_SLD_INI + ajustes =====
  // Layout M300: |M300|COD_CONTA|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_AJUS_ACRES|VL_AJUS_REDUC|VL_SLD_FIN|IND_DC_FIN|...
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      const reg = c[1] || '';
      if (reg !== 'M300' && reg !== 'M350' && reg !== 'M410' && reg !== 'M500') continue;
      // M300/M350: |REG|COD_CONTA|DT_INI|DT_FIN|VL_SLD_INI|IND_DC_INI|VL_AJUS_ACRES|VL_AJUS_REDUC|VL_SLD_FIN|IND_DC_FIN|...
      const vlSldIni = parseNum(c[5]);
      const indDcIni = (c[6] || '').toUpperCase().trim();
      const vlAjusAcres = parseNum(c[7]) || 0;
      const vlAjusReduc = parseNum(c[8]) || 0;
      const vlSldFin = parseNum(c[9]);
      const indDcFin = (c[10] || '').toUpperCase().trim();

      if (isNaN(vlSldIni) || isNaN(vlSldFin)) continue;

      let sldCalc;
      if (indDcIni === 'D') {
        sldCalc = vlSldIni + vlAjusAcres - vlAjusReduc;
      } else {
        sldCalc = vlSldIni + vlAjusReduc - vlAjusAcres;
      }
      const sldFinEsperado = Math.abs(sldCalc);
      const indDcFinEsperado = sldCalc >= 0 ? 'D' : 'C';

      if (Math.abs(sldFinEsperado - vlSldFin) > 0.02) {
        erros.push({
          linha: i + 1,
          registro: reg,
          mensagem: `Inconsistência de saldo no e-Lalur/e-Lacs: VL_SLD_FIN (${c[9]}) não confere com VL_SLD_INI (${c[5]}) + ajustes de acréscimo (${c[7]}) - ajustes de redução (${c[8]}). Esperado=${sldFinEsperado.toFixed(2)} (${indDcFinEsperado}).`,
          severidade: 'erro'
        });
      }
    }
  }

  // ===== 4. Q100 (Livro Caixa): IND_SLD_FIN deve ser compatível com o saldo calculado =====
  // Layout Q100: |Q100|DT_DOC|NAT_LAN|IND_LAN|VL_LCTO|IND_SLD_FIN|...
  {
    let saldoAcumulado = 0;
    let currentDt = '';
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'Q100') continue;
      // Layout: |Q100|DT_DOC|NAT_LAN|IND_LAN|VL_LCTO|IND_SLD_FIN|...
      const dtDoc = c[2] || '';
      const natLan = c[3] || '';
      const indLan = (c[4] || '').toUpperCase().trim();
      const vlLcto = parseNum(c[5]);
      const indSldFin = (c[6] || '').toUpperCase().trim();

      if (isNaN(vlLcto)) continue;
      // IND_LAN: D=Débito (despesa), C=Crédito (receita)
      if (indLan === 'D') saldoAcumulado -= vlLcto;
      else if (indLan === 'C') saldoAcumulado += vlLcto;

      const indSldFinEsperado = saldoAcumulado >= 0 ? 'D' : 'C';
      if (indSldFin && indSldFin !== indSldFinEsperado && Math.abs(saldoAcumulado) > 0.02) {
        avisos.push({
          linha: i + 1,
          registro: 'Q100',
          mensagem: `IND_SLD_FIN "${indSldFin}" pode estar inconsistente com o saldo acumulado (${saldoAcumulado.toFixed(2)}). Para o saldo calculado, o indicador esperado seria "${indSldFinEsperado}".`,
          severidade: 'aviso'
        });
      }
    }
  }

  // ===== 5. 0010 (FORMA_APUR + FORMA_TRIB): combinações válidas =====
  // FORMA_APUR (campo 1): T=Trimestral, A=Anual
  // FORMA_TRIB (campo 2): 1=Lucro Real, 2=Lucro Presumido, 3=Lucro Arbitrado, 4=Simples, 5=Imune, 6=Isenta
  {
    const combinacoesValidas = {
      'T': ['1', '2', '3'],  // Trimestral: Real, Presumido, Arbitrado
      'A': ['1', '5', '6'],  // Anual: Real, Imune, Isenta
    };
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== '0010') continue;
      const formaApur = (c[2] || '').toUpperCase().trim();
      const formaTrib = (c[3] || '').trim();
      if (formaApur && formaTrib) {
        const validas = combinacoesValidas[formaApur];
        if (validas && !validas.includes(formaTrib)) {
          erros.push({
            linha: i + 1,
            registro: '0010',
            mensagem: `Combinação FORMA_APUR="${formaApur}" + FORMA_TRIB="${formaTrib}" é inválida. Para apuração ${formaApur === 'T' ? 'trimestral' : 'anual'}, as formas de tributação válidas são: ${validas.join(', ')}.`,
            severidade: 'erro'
          });
        }
      }
    }
  }

  // ===== 6. Y612 (Lucro Inflacionário): consistência entre registros do mesmo período =====
  {
    const y612PorPeriodo = {};
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== 'Y612') continue;
      // Layout: |Y612|DT_INI|DT_FIN|VL_LUCRO_INFL|...|IND_VAL_LUCRO|...
      const dtIni = c[2] || '';
      const dtFin = c[3] || '';
      const chave = `${dtIni}-${dtFin}`;
      if (!y612PorPeriodo[chave]) y612PorPeriodo[chave] = [];
      y612PorPeriodo[chave].push({ linha: i + 1, dtIni, dtFin });
    }
    // Múltiplos Y612 para o mesmo período são aceitos (diferentes métodos)
    // Mas períodos sobrepostos geram aviso
    const periodos = Object.keys(y612PorPeriodo);
    for (let a = 0; a < periodos.length; a++) {
      for (let b = a + 1; b < periodos.length; b++) {
        const [iniA, finA] = periodos[a].split('-');
        const [iniB, finB] = periodos[b].split('-');
        // Verifica sobreposição simples (datas em formato AAAAMMDD para comparação)
        if (iniA < finB && iniB < finA) {
          avisos.push({
            linha: 0,
            registro: 'Y612',
            mensagem: `Períodos sobrepostos detectados nos registros Y612 (${periodos[a]} e ${periodos[b]}). Verifique se há duplicidade indevida de períodos de apuração de lucro inflacionário.`,
            severidade: 'aviso'
          });
        }
      }
    }
  }

  // ===== 7. 0930 (Signatários): CPF deve ser válido e COD_ASSIN entre 1-9 =====
  {
    for (let i = 0; i < linhas.length; i++) {
      const c = linhas[i].split('|');
      if (c[1] !== '0930') continue;
      // Layout: |0930|IDENT_NOM|IDENT_CPFCNPJ|IDENT_QUALIF|COD_ASSIN|IND_CRC|...
      const cpf = (c[3] || '').replace(/\D/g, '');
      const codAssin = (c[5] || '').trim();
      if (cpf && cpf.length !== 11) {
        erros.push({
          linha: i + 1,
          registro: '0930',
          mensagem: `CPF do signatário inválido: "${c[3]}" (esperado 11 dígitos, encontrado ${cpf.length}).`,
          severidade: 'erro'
        });
      }
      if (codAssin && !['1','2','3','4','5','6','7','8','9'].includes(codAssin)) {
        erros.push({
          linha: i + 1,
          registro: '0930',
          mensagem: `COD_ASSIN inválido: "${codAssin}" (deve estar entre 1 e 9 conforme Tabela de Qualificação do Assinante).`,
          severidade: 'erro'
        });
      }
    }
  }
}

// Correção automática para ECF: corrige IND_DC e VL_SLD_FIN no L100/P100/K155 quando há inconsistência
export function corrigirECF(linhas) {
  for (let i = 0; i < linhas.length; i++) {
    const c = linhas[i].split('|');
    const reg = c[1] || '';
    if (reg !== 'L100' && reg !== 'P100' && reg !== 'K155' && reg !== 'E155' && reg !== 'C155') continue;
    const vlSldIni = parseNum(c[5]);
    const indDcIni = (c[6] || '').toUpperCase().trim();
    const vlDeb = parseNum(c[7]) || 0;
    const vlCred = parseNum(c[8]) || 0;
    const vlSldFin = parseNum(c[9]);
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
      c[9] = sldFinEsperado.toFixed(2).replace('.', ',');
    }
    c[10] = indDcFinEsperado;
    linhas[i] = c.join('|');
  }
  return linhas;
}