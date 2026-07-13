import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    const linhas = conteudoSped.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (linhas.length === 0) {
      return Response.json({ success: false, error: 'Arquivo SPED Fiscal vazio.' }, { status: 400 });
    }

    const camposPrim = linhas[0].split('|').filter((c) => c !== '');
    if (camposPrim[0] !== '0000') {
      return Response.json({ success: false, error: 'O arquivo não é um SPED Fiscal válido.' }, { status: 400 });
    }

    // === Parse SPED Fiscal ===
    let r0000: any = null;
    let r0100: any = null;
    let rE110: any = null;
    const e116Records: any[] = [];
    const c190Records: any[] = [];

    const parseNum = (v: string) => parseFloat((v || '0').replace(',', '.')) || 0;

    for (const linha of linhas) {
      const p = linha.split('|');
      const reg = p[1] || '';

      // 0000 layout: |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|IE|COD_MUN|SUFRAMA|IND_PERFIL|IND_ATIV|
      if (reg === '0000' && !r0000) {
        r0000 = {
          razao: (p[6] || '').trim(),
          cnpj: (p[7] || '').trim(),
          uf: (p[9] || 'SC').trim(),
          ie: (p[10] || '').trim(),
          municipio: (p[11] || '').trim(),
          dataIni: (p[4] || '').trim(),
          dataFim: (p[5] || '').trim(),
          perfil: (p[13] || 'A').trim()
        };
      }

      if (reg === '0100' && !r0100) {
        r0100 = {
          nome: (p[2] || '').trim(),
          cpf: (p[3] || '').replace(/\D/g, '')
        };
      }

      if (reg === 'C190') {
        // Raw split: p[2]=CST, p[3]=CFOP, p[4]=ALIQ, p[5]=VL_OPR, p[6]=VL_BC, p[7]=VL_ICMS,
        //            p[8]=VL_BC_ST, p[9]=VL_ICMS_ST, p[10]=VL_RED_BC, p[11]=VL_BC_IPI, p[12]=VL_IPI
        c190Records.push({
          cst: (p[2] || '00').trim(),
          cfop: (p[3] || '0000').trim(),
          vlOpr: parseNum(p[5]),
          vlBc: parseNum(p[6]),
          vlIcms: parseNum(p[7]),
          vlBcSt: parseNum(p[8]),
          vlIcmsSt: parseNum(p[9]),
          vlIpi: parseNum(p[12])
        });
      }

      if (reg === 'E110' && !rE110) {
        // Layout oficial E110:
        // p[2]=VL_TOT_DEB_ICMS, p[3]=VL_DEB_AJ, p[4]=VL_AJ, p[5]=VL_TOT_DEB
        // p[6]=VL_SLD_CRED_ANT, p[7]=VL_TOT_CRED_ICMS, p[8]=VL_CRED_AJ, p[9]=VL_AJ_CRED
        // p[10]=VL_TOT_CRED, p[11]=VL_SLD_DEVEDOR, p[12]=VL_SLD_CRED_TRANSPORTAR, p[13]=DEB_ESP
        const debImposto = parseNum(p[2]);
        const debAjustosDocFiscal = parseNum(p[3]);
        const debAjustos = parseNum(p[4]);
        const saldoCredorAnt = parseNum(p[6]);
        const credImposto = parseNum(p[7]);
        const credAjustosDocFiscal = parseNum(p[8]);
        const credAjustos = parseNum(p[9]);
        const saldoDevedor = parseNum(p[11]);
        const saldoCredorTransportar = parseNum(p[12]);
        const debEspeciais = parseNum(p[13]);

        // Alguns ERPs deixam p[5] e p[10] vazios — calcular a partir dos componentes
        const totDebitos = parseNum(p[5]) || (debImposto + debAjustosDocFiscal + debAjustos);
        // Fallback 1: somar componentes de crédito. Fallback 2: deduzir do saldo devedor
        const credFromComponents = credImposto + credAjustosDocFiscal + credAjustos;
        const totCreditos = parseNum(p[10]) || credFromComponents ||
          (totDebitos - saldoCredorAnt - saldoDevedor);

        rE110 = {
          debImposto,
          debAjustosDocFiscal,
          debAjustos,
          totDebitos,
          saldoCredorAnt,
          credImposto,
          credAjustosDocFiscal,
          credAjustos,
          totCreditos,
          saldoDevedor,
          saldoCredorTransportar,
          debEspeciais
        };
      }

      if (reg === 'E116') {
        // p[2]=COD_OR, p[3]=VL_OR, p[4]=DT_VCTO, p[5]=COD_REC
        e116Records.push({
          codOr: (p[2] || '').trim(),
          vlOr: parseNum(p[3]),
          dtVcto: (p[4] || '').trim(),
          codRec: (p[5] || '').trim()
        });
      }
    }

    if (!r0000) {
      return Response.json({ success: false, error: 'Registro 0000 não encontrado.' }, { status: 400 });
    }

    // === Aggregate C190 by CFOP ===
    const cfopsMap: Record<string, any> = {};
    for (const c of c190Records) {
      if (!cfopsMap[c.cfop]) {
        cfopsMap[c.cfop] = { cfop: c.cfop, vlCont: 0, vlBc: 0, vlIcms: 0, isentas: 0, outras: 0, vlBcSt: 0, vlIcmsSt: 0 };
      }
      const g = cfopsMap[c.cfop];
      // VL_CONT = VL_OPR + VL_IPI (valor contábil inclui IPI)
      g.vlCont += c.vlOpr + c.vlIpi;
      g.vlBc += c.vlBc;
      g.vlIcms += c.vlIcms;
      g.vlBcSt += c.vlBcSt;
      g.vlIcmsSt += c.vlIcmsSt;
      // Isentas: CST 40, 41, 50, 60 (isento/não tributado)
      if (['40', '41', '50', '60'].includes(c.cst)) {
        g.isentas += c.vlOpr;
      }
    }

    // Outras = VL_CONT - VL_BC - ISENTAS
    for (const g of Object.values(cfopsMap)) {
      g.outras = Math.max(0, g.vlCont - g.vlBc - g.isentas);
    }

    // Separate entradas (1xxx, 2xxx) and saídas (5xxx, 6xxx)
    const entradas = Object.values(cfopsMap)
      .filter((c: any) => c.cfop.startsWith('1') || c.cfop.startsWith('2') || c.cfop.startsWith('3'))
      .sort((a: any, b: any) => a.cfop.localeCompare(b.cfop));
    const saidas = Object.values(cfopsMap)
      .filter((c: any) => c.cfop.startsWith('5') || c.cfop.startsWith('6') || c.cfop.startsWith('7'))
      .sort((a: any, b: any) => a.cfop.localeCompare(b.cfop));

    // === Generate DIME-SC fixed-width file ===
    const linhasDime: string[] = [];
    let totalRegistros = 0;

    // Helper: format value as fixed-width (cents, zero-padded)
    const fmtVal = (val: number, width = 17) => {
      const cents = Math.round((val || 0) * 100);
      return String(Math.abs(cents)).padStart(width, '0').slice(-width);
    };

    // Helper: format text (left-justified, space-padded)
    const fmtTxt = (text: string, width: number) => {
      return (text || '').substring(0, width).padEnd(width, ' ');
    };

    // --- Record 20: Contabilista ---
    // "20" + "  " + CPF(11) + NOME(50) + DATA_HORA(14) = 79 chars
    const cpfCont = (r0100?.cpf || '00000000000').padStart(11, '0').slice(-11);
    const nomeCont = r0100?.nome || 'CONTABILISTA';
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dataHora = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    linhasDime.push(`20  ${cpfCont}${fmtTxt(nomeCont, 50)}${dataHora}`);
    totalRegistros++;

    // --- Record 21: Início da Declaração ---
    // "21" + "00" + IE(9) + RAZAO(50) + MMAAAA(6) + flags(11) + QTD_TRAB(5) = 85 chars
    const dtFim = r0000.dataFim;
    const mesAno = dtFim.length === 8 ? dtFim.substring(2, 4) + dtFim.substring(4) : '000000';
    const ie = r0000.ie.replace(/\D/g, '').padStart(9, '0').slice(-9);
    const regimeApur = '2'; // 2=Normal, 9=Produtor Primário
    const flags = `1${regimeApur}32222${c190Records.length > 0 ? '3' : '2'}221`; // tipoDecl=1, regime=2, porte=3, consolidada=2, centralizada=2, transCred=2, credPresumido=2, credIncentivo=2, movimento=3(com)/2(sem), substituto=2, escrita=1
    linhasDime.push(`2100${ie}${fmtTxt(r0000.razao, 50)}${mesAno}${flags}00000`);
    totalRegistros++;

    // --- Record 22: Entradas (CFOP 1xxx, 2xxx, 3xxx) ---
    // "22" + "01" + CFOP(5) + 8×value(17) = 145 chars
    for (const c of entradas) {
      const cfop = c.cfop.padStart(5, '0').slice(-5);
      const campos = [
        fmtVal(c.vlCont),    // Valor Contábil
        fmtVal(c.vlBc),      // Base de Cálculo
        fmtVal(c.vlIcms),    // Imposto Creditado
        fmtVal(c.isentas),   // Isentas/Não Tributadas
        fmtVal(c.outras),    // Outras
        fmtVal(c.vlBcSt),    // BC Retido
        fmtVal(c.vlIcmsSt),  // Imposto Retido
        fmtVal(0)             // Dif. Alíquota
      ].join('');
      linhasDime.push(`2201${cfop}${campos}`);
      totalRegistros++;
    }

    // --- Record 23: Saídas (CFOP 5xxx, 6xxx, 7xxx) ---
    // "23" + "02" + CFOP(5) + 8×value(17) = 145 chars
    for (const c of saidas) {
      const cfop = c.cfop.padStart(5, '0').slice(-5);
      const campos = [
        fmtVal(c.vlCont),    // Valor Contábil
        fmtVal(c.vlBc),      // Base de Cálculo
        fmtVal(c.vlIcms),    // Imposto Debitado
        fmtVal(c.isentas),   // Isentas/Não Tributadas
        fmtVal(c.outras),    // Outras
        fmtVal(c.vlBcSt),    // BC Retido
        fmtVal(c.vlIcmsSt),  // Imposto Retido
        fmtVal(0)             // Dif. Alíquota
      ].join('');
      linhasDime.push(`2302${cfop}${campos}`);
      totalRegistros++;
    }

    // --- Record 24: Resumo dos Valores Fiscais (Quadro 03) ---
    // "24" + "03" + line(2) + value(18) = 24 chars
    if (rE110) {
      const totalEntradasVC = entradas.reduce((s: number, c: any) => s + c.vlCont, 0);
      const totalSaidasVC = saidas.reduce((s: number, c: any) => s + c.vlCont, 0);
      const fmtVal18 = (val: number) => {
        const cents = Math.round((val || 0) * 100);
        return String(Math.abs(cents)).padStart(18, '0').slice(-18);
      };
      linhasDime.push(`240301${fmtVal18(totalEntradasVC)}`);   // Total entradas
      totalRegistros++;
      linhasDime.push(`240302${fmtVal18(totalSaidasVC)}`);    // Total saídas
      totalRegistros++;
      linhasDime.push(`240308${fmtVal18(rE110.totDebitos)}`); // Total débitos (com ajustes)
      totalRegistros++;
      linhasDime.push(`240309${fmtVal18(rE110.totCreditos)}`); // Total créditos (com ajustes)
      totalRegistros++;
      // Saldo devedor (A RECOLHER) — já calculado pelo ERP no campo VL_SLD_DEVEDOR
      const saldo = rE110.saldoDevedor > 0
        ? rE110.saldoDevedor
        : rE110.totDebitos - rE110.totCreditos - rE110.saldoCredorAnt;
      linhasDime.push(`240310${fmtVal18(saldo)}`);             // Saldo
      totalRegistros++;
    }

    // --- Record 33: Discriminação dos Pagamentos (Quadro 03) ---
    // "33" + "03" + origem(1) + cod_receita(4) + dt_vcto(8) + valor(17) + classe(5) + acordo(15) = 54 chars
    for (const e of e116Records) {
      const origem = '1'; // 1=Imposto
      const codRec = (e.codRec || '0000').replace(/\D/g, '').padStart(4, '0').slice(-4);
      const dtVcto = (e.dtVcto || '00000000').padStart(8, '0').slice(-8);
      const valor = fmtVal(e.vlOr);
      const classe = '00001';
      const acordo = ''.padStart(15, '0');
      linhasDime.push(`3303${origem}${codRec}${dtVcto}${valor}${classe}${acordo}`);
      totalRegistros++;
    }

    // --- Record 98: Fim da Declaração ---
    // "98" + "  " + qtd_registros(5) = 9 chars
    const qtdReg = String(totalRegistros + 1).padStart(5, '0');
    linhasDime.push(`98  ${qtdReg}`);
    totalRegistros++;

    // --- Record 99: Fechamento do Arquivo ---
    // "99" + "  " + qtd_registros(5) + qtd_declaracoes(5) = 14 chars
    const qtdTotal = String(totalRegistros + 1).padStart(5, '0');
    linhasDime.push(`99  ${qtdTotal}00001`);
    totalRegistros++;

    // === Generate final file ===
    const conteudoFinal = linhasDime.join('\r\n') + '\r\n';
    const mm = (r0000.dataFim || '').length >= 6 ? r0000.dataFim.substring(2, 4) : '01';
    const yyyy = (r0000.dataFim || '').length >= 8 ? r0000.dataFim.substring(4) : '2026';
    const nomeDime = `DIME_${mm}${yyyy}.txt`;

    // Save to database
    const spedRecord = await base44.entities.SpedFile.create({
      cliente_id: r0000.cnpj,
      cliente_nome: r0000.razao,
      nome_arquivo: nomeDime,
      conteudo: conteudoFinal,
      tamanho_kb: Math.round((conteudoFinal.length / 1024) * 100) / 100,
      linhas: totalRegistros,
      total_participantes: 0,
      total_produtos: 0,
      debitos: rE110 ? rE110.totDebitos.toFixed(2).replace('.', ',') : '0,00',
      creditos: rE110 ? rE110.totCreditos.toFixed(2).replace('.', ',') : '0,00',
      saldo: 'DIME-SC GERADO',
      sped_type: 'DIMESC'
    });

    // Summary for response — usa VL_SLD_DEVEDOR (p[11]) que já inclui todos os ajustes
    const debitosApur = rE110 ? rE110.totDebitos : 0;
    const creditosApur = rE110 ? rE110.totCreditos : 0;
    const saldoApur = rE110 ? rE110.saldoDevedor : 0;
    const saldoCredor = rE110 ? rE110.saldoCredorTransportar : 0;

    return Response.json({
      success: true,
      arquivoGerado: nomeDime,
      conteudo: conteudoFinal,
      linhasGeradas: totalRegistros,
      empresa: {
        razao: r0000.razao,
        cnpj: r0000.cnpj,
        uf: r0000.uf,
        mesAno
      },
      resumo: {
        totalCfops: entradas.length + saidas.length,
        totalEntradas: entradas.length,
        totalSaidas: saidas.length,
        debitos: debitosApur.toFixed(2).replace('.', ','),
        creditos: creditosApur.toFixed(2).replace('.', ','),
        saldo: saldoApur > 0
          ? `A RECOLHER: R$ ${saldoApur.toFixed(2)}`
          : `CREDOR: R$ ${Math.abs(saldoCredor).toFixed(2)}`,
        format: 'fixed-width (posição fixa)'
      },
      spedId: spedRecord.id
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});