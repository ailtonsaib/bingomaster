import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { conteudoSped, nomeArquivo } = body;

    if (!conteudoSped) {
      return Response.json({ success: false, error: 'Conteúdo do SPED Fiscal não fornecido.' }, { status: 400 });
    }

    // Divide em linhas e filtra vazias
    const linhas = conteudoSped.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (linhas.length === 0) {
      return Response.json({ success: false, error: 'Arquivo SPED Fiscal vazio.' }, { status: 400 });
    }

    // Valida se é realmente um SPED Fiscal (registro 0000)
    const camposPrim = linhas[0].split('|').filter((c) => c !== '');
    if (camposPrim[0] !== '0000') {
      return Response.json({
        success: false,
        error: 'O arquivo fornecido não é um SPED Fiscal válido (deve iniciar com |0000|).'
      }, { status: 400 });
    }

    // === Extração de dados do SPED Fiscal ===

    let r0000 = null;
    let rE110 = null;
    let rE210 = null;
    const registrosC190 = [];

    for (const linha of linhas) {
      const campos = linha.split('|').filter((c) => c !== '');
      const reg = campos[0];

      if (reg === '0000' && !r0000) {
        // |0000|COD_VERSAO|COD_FINALIDADE|DT_INI|DT_FIM|NOME|CNPJ|UF|IE|COD_MUN|SUFRAMA|IND_PERFIL|IND_ATIV|
        r0000 = {
          razao: campos[5] || '',
          cnpj: campos[6] || '',
          uf: campos[7] || 'SC',
          ie: campos[8] || '',
          municipio: campos[9] || '',
          dataIni: campos[3] || '',
          dataFim: campos[4] || '',
          perfil: campos[11] || 'A'
        };
      }

      if (reg === 'C190') {
        // |C190|CST|CFOP|ALIQ|VL_OPER|VL_BC_ICMS|VL_ICMS|VL_BC_ST|VL_ICMS_ST|VL_RED_BC|VL_BC_IPI|...|
        registrosC190.push({
          cst: campos[1] || '00',
          cfop: campos[2] || '0000',
          aliq: parseFloat((campos[3] || '0').replace(',', '.')) || 0,
          vlOper: parseFloat((campos[4] || '0').replace(',', '.')) || 0,
          vlBc: parseFloat((campos[5] || '0').replace(',', '.')) || 0,
          vlIcms: parseFloat((campos[6] || '0').replace(',', '.')) || 0,
          vlBcSt: parseFloat((campos[7] || '0').replace(',', '.')) || 0,
          vlIcmsSt: parseFloat((campos[8] || '0').replace(',', '.')) || 0
        });
      }

      if (reg === 'E110' && !rE110) {
        // |E110|VL_TOT_DEB_ICMS|VL_DEB_ANTEC|VL_DEB_DESC|VL_DEB_OUT|VL_TOT_CRED_ICMS|...
        rE110 = {
          totDebitos: parseFloat((campos[1] || '0').replace(',', '.')) || 0,
          debAntec: parseFloat((campos[2] || '0').replace(',', '.')) || 0,
          totCreditos: parseFloat((campos[5] || '0').replace(',', '.')) || 0
        };
      }

      if (reg === 'E210' && !rE210) {
        // |E210|IND_MOV_ST|VL_SLD_CRED_ST_ANT|VL_DEVOL_ST|VL_RESSARC_ST|VL_OUT_CRED_ST|VL_TOT_DEB_ST|VL_OUT_DEB_ST|VL_TOT_CRED_ST|VL_SLD_APUR_ST|VL_SLD_CRED_ST_TRANSP|...|
        rE210 = {
          slcCredAnt: parseFloat((campos[2] || '0').replace(',', '.')) || 0,
          totDebSt: parseFloat((campos[6] || '0').replace(',', '.')) || 0,
          totCredSt: parseFloat((campos[8] || '0').replace(',', '.')) || 0
        };
      }
    }

    if (!r0000) {
      return Response.json({ success: false, error: 'Registro 0000 (abertura) não encontrado no SPED Fiscal.' }, { status: 400 });
    }

    // === Mapeamento SPED Fiscal -> DIME-SC ===

    const linhasDime = [];
    let totalLinhas = 0;

    const fmt = (val, dec = 2) => {
      const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.')) || 0;
      return n.toFixed(dec).replace('.', ',');
    };

    // Mês/ano de apuração: extrair da data final do SPED (DDMMAAAA -> MMAAAA)
    const dtFim = r0000.dataFim;
    let mesAno = '';
    if (dtFim && dtFim.length === 8) {
      mesAno = dtFim.substring(2, 4) + dtFim.substring(4);
    }

    // --- Registro 01: Identificação do Contribuinte ---
    // |01|CNPJ|IE|Razão Social|UF|Município|Regime|Mês/Ano Apuração|...|
    // Regime: 1 = Normal, 2 = Simples (simplificado)
    const regimeDime = r0000.perfil === 'B' ? '2' : '1';
    const r01 = [
      '01',
      r0000.cnpj,
      r0000.ie,
      r0000.razao,
      r0000.uf,
      r0000.municipio,
      regimeDime,
      mesAno,
      '0', '0', '0'
    ];
    linhasDime.push(`|${r01.join('|')}|`);
    totalLinhas++;

    // --- Registro 04: Operações por CFOP ---
    // Agrupar C190 por CFOP
    const cfopsAgrupados = {};
    for (const c of registrosC190) {
      if (!cfopsAgrupados[c.cfop]) {
        cfopsAgrupados[c.cfop] = { cfop: c.cfop, valorContabil: 0, bcCalculo: 0, impostoDebitado: 0, isentas: 0, outras: 0, st: 0 };
      }
      const g = cfopsAgrupados[c.cfop];
      g.valorContabil += c.vlOper;
      g.bcCalculo += c.vlBc;
      g.impostoDebitado += c.vlIcms;
      g.st += c.vlIcmsSt;
      // Isentas: CST que indicam isenção/não tributado (40, 41, 50, 60)
      if (['40', '41', '50', '60'].includes(c.cst)) {
        g.isentas += c.vlOper;
      }
      // Outras: CST que indicam outras operações (70, 90, etc.)
      if (['70', '90', '30'].includes(c.cst)) {
        g.outras += c.vlOper;
      }
    }

    // Ordenar CFOPs numericamente
    const cfopsOrdenados = Object.values(cfopsAgrupados).sort((a, b) => a.cfop.localeCompare(b.cfop));

    for (const cfop of cfopsOrdenados) {
      // |04|CFOP|ValorContabil|BaseCalculo|ImpostoDebitado|IsentasNaoTrib|Outras|ImpostoRetidoST|
      const r04 = [
        '04',
        cfop.cfop,
        fmt(cfop.valorContabil),
        fmt(cfop.bcCalculo),
        fmt(cfop.impostoDebitado),
        fmt(cfop.isentas),
        fmt(cfop.outras),
        fmt(cfop.st)
      ];
      linhasDime.push(`|${r04.join('|')}|`);
      totalLinhas++;
    }

    // --- Registro 03: Apuração do ICMS (Operações Próprias) ---
    if (rE110 || registrosC190.length > 0) {
      const debitos = rE110 ? rE110.totDebitos : registrosC190
        .filter((c) => c.cfop.startsWith('5') || c.cfop.startsWith('6'))
        .reduce((s, c) => s + c.vlIcms, 0);
      const creditos = rE110 ? rE110.totCreditos : registrosC190
        .filter((c) => c.cfop.startsWith('1') || c.cfop.startsWith('2'))
        .reduce((s, c) => s + c.vlIcms, 0);

      const saldo = debitos - creditos;
      const impostoRecolher = saldo > 0 ? saldo : 0;
      const credorTransportar = saldo < 0 ? Math.abs(saldo) : 0;

      // |03|COD_APURACAO|DEBITOS|DEDUCOES|CREDITOS|...|SALDO_RECOLHER|CREDOR_TRANSPORTAR|
      const r03 = [
        '03',
        '01',
        fmt(debitos),
        '0,00',
        fmt(creditos),
        '0,00',
        '0,00',
        '0,00',
        fmt(credorTransportar),
        fmt(impostoRecolher),
        '0,00',
        '0,00'
      ];
      linhasDime.push(`|${r03.join('|')}|`);
      totalLinhas++;
    }

    // --- Registro 05: Apuração da Substituição Tributária ---
    if (rE210) {
      const saldoSt = rE210.totDebSt - rE210.totCredSt - rE210.slcCredAnt;
      const recolherSt = saldoSt > 0 ? saldoSt : 0;
      const credorSt = saldoSt < 0 ? Math.abs(saldoSt) : 0;

      const r05 = [
        '05',
        '01',
        fmt(rE210.slcCredAnt),
        fmt(rE210.totDebSt),
        '0,00',
        fmt(rE210.totCredSt),
        '0,00',
        '0,00',
        fmt(credorSt),
        fmt(recolherSt)
      ];
      linhasDime.push(`|${r05.join('|')}|`);
      totalLinhas++;
    } else if (registrosC190.some((c) => c.vlIcmsSt > 0)) {
      // Se há ICMS ST nos CFOPs mas não há E210, gerar registro 05 com valores do C190
      const debSt = registrosC190
        .filter((c) => c.cfop.startsWith('5') || c.cfop.startsWith('6'))
        .reduce((s, c) => s + c.vlIcmsSt, 0);
      const credSt = registrosC190
        .filter((c) => c.cfop.startsWith('1') || c.cfop.startsWith('2'))
        .reduce((s, c) => s + c.vlIcmsSt, 0);
      const saldoSt = debSt - credSt;
      const recolherSt = saldoSt > 0 ? saldoSt : 0;
      const credorSt = saldoSt < 0 ? Math.abs(saldoSt) : 0;

      const r05 = [
        '05',
        '01',
        '0,00',
        fmt(debSt),
        '0,00',
        fmt(credSt),
        '0,00',
        '0,00',
        fmt(credorSt),
        fmt(recolherSt)
      ];
      linhasDime.push(`|${r05.join('|')}|`);
      totalLinhas++;
    }

    // --- Registro 90: Encerramento ---
    // |90|TOTAL_REGISTROS|
    linhasDime.push(`|90|${totalLinhas + 1}|`);
    totalLinhas++;

    // === Gera arquivo final ===
    const conteudoFinal = linhasDime.join('\r\n');
    const prefixoEmpresa = (r0000.razao || 'EMPRESA').substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const nomeDime = `DIME_SC_${prefixoEmpresa}_${Date.now()}.txt`;

    // Salva registro no banco (SpedFile com sped_type DIMESC)
    const spedRecord = await base44.entities.SpedFile.create({
      cliente_id: r0000.cnpj,
      cliente_nome: r0000.razao,
      nome_arquivo: nomeDime,
      conteudo: conteudoFinal,
      tamanho_kb: Math.round((conteudoFinal.length / 1024) * 100) / 100,
      linhas: totalLinhas,
      total_participantes: 0,
      total_produtos: 0,
      debitos: rE110 ? fmt(rE110.totDebitos) : fmt(0),
      creditos: rE110 ? fmt(rE110.totCreditos) : fmt(0),
      saldo: 'DIME-SC GERADO',
      sped_type: 'DIMESC'
    });

    // Apuração para resumo
    const debitosApur = rE110 ? rE110.totDebitos : registrosC190
      .filter((c) => c.cfop.startsWith('5') || c.cfop.startsWith('6'))
      .reduce((s, c) => s + c.vlIcms, 0);
    const creditosApur = rE110 ? rE110.totCreditos : registrosC190
      .filter((c) => c.cfop.startsWith('1') || c.cfop.startsWith('2'))
      .reduce((s, c) => s + c.vlIcms, 0);
    const saldoApur = debitosApur - creditosApur;

    return Response.json({
      success: true,
      arquivoGerado: nomeDime,
      conteudo: conteudoFinal,
      linhasGeradas: totalLinhas,
      empresa: {
        razao: r0000.razao,
        cnpj: r0000.cnpj,
        uf: r0000.uf,
        mesAno
      },
      resumo: {
        totalCfops: cfopsOrdenados.length,
        debitos: fmt(debitosApur),
        creditos: fmt(creditosApur),
        saldo: saldoApur > 0 ? `A RECOLHER: R$ ${saldoApur.toFixed(2)}` : `CREDOR: R$ ${Math.abs(saldoApur).toFixed(2)}`,
        icmsSt: rE210 || registrosC190.some((c) => c.vlIcmsSt > 0) ? 'Sim' : 'Não'
      },
      spedId: spedRecord.id
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});