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
        const debImposto = parseNum(p[2]);
        const debAjDocFiscal = parseNum(p[3]);
        const debAjustes = parseNum(p[4]);
        const saldoCredorAnt = parseNum(p[6]);
        const credImposto = parseNum(p[7]);
        const credAjDocFiscal = parseNum(p[8]);
        const credAjustes = parseNum(p[9]);
        const debEspeciais = parseNum(p[13]);

        const totDebitos = debImposto + debAjDocFiscal + debAjustes;
        const totCreditos = saldoCredorAnt + credImposto + credAjDocFiscal + credAjustes;
        const saldoDevedor = Math.max(0, totDebitos - totCreditos);
        const saldoCredorTransportar = Math.max(0, totCreditos - totDebitos);

        rE110 = {
          debImposto, debAjDocFiscal, debAjustes, totDebitos,
          saldoCredorAnt, credImposto, credAjDocFiscal, credAjustes, totCreditos,
          saldoDevedor, saldoCredorTransportar, debEspeciais
        };
      }

      if (reg === 'E116') {
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
      g.vlCont += c.vlOpr + c.vlIpi;
      g.vlBc += c.vlBc;
      g.vlIcms += c.vlIcms;
      g.vlBcSt += c.vlBcSt;
      g.vlIcmsSt += c.vlIcmsSt;
      if (['40', '41', '50', '60'].includes(c.cst)) {
        g.isentas += c.vlOpr;
      }
    }
    for (const g of Object.values(cfopsMap)) {
      g.outras = Math.max(0, (g as any).vlCont - (g as any).vlBc - (g as any).isentas);
    }

    const entradas = Object.values(cfopsMap)
      .filter((c: any) => c.cfop.startsWith('1') || c.cfop.startsWith('2') || c.cfop.startsWith('3'))
      .sort((a: any, b: any) => a.cfop.localeCompare(b.cfop));
    const saidas = Object.values(cfopsMap)
      .filter((c: any) => c.cfop.startsWith('5') || c.cfop.startsWith('6') || c.cfop.startsWith('7'))
      .sort((a: any, b: any) => a.cfop.localeCompare(b.cfop));

    const temMovimento = entradas.length > 0 || saidas.length > 0;

    // === Helper functions ===
    // Valor em centavos, largura variável
    const fmtVal = (val: number, width = 17) => {
      const cents = Math.round((val || 0) * 100);
      return String(Math.abs(cents)).padStart(width, '0').slice(-width);
    };
    const fmtVal18 = (val: number) => fmtVal(val, 18);

    const fmtTxt = (text: string, width: number) =>
      (text || '').substring(0, width).padEnd(width, ' ');

    // === Generate DIME-SC lines ===
    const linhasDime: string[] = [];
    let totalRegistros = 0;

    // --- Registro 20: Contabilista ---
    // Formato: "20" + "  " + CPF(11) + NOME(50) + DATA_HORA(14) = 79 chars
    const cpfCont = (r0100?.cpf || '00000000000').padStart(11, '0').slice(-11);
    const nomeCont = r0100?.nome || 'CONTABILISTA';
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dataHora = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    linhasDime.push(`20  ${cpfCont}${fmtTxt(nomeCont, 50)}${dataHora}`);
    totalRegistros++;

    // --- Registro 21: Cabeçalho da Declaração ---
    // Formato: "21" + SEQ(2) + IE(9) + RAZAO(50) + MMAAAA(6) + TIPO_DECL(1) + REGIME(1) + PORTE(1)
    //          + APURACAO_CENTRALIZADA(1) + TRANSF_CREDITO(1) + CREDITO_PRESUMIDO(1) + CREDITO_INCENTIVO(1)
    //          + MOVIMENTO(1) + SUBSTITUTO_TRIBUT(1) + ESCRITA_FISCAL(1) + QTD_TRAB(5)
    // Valores válidos:
    //   TIPO_DECL: 1=Normal, 2=Retificadora, 3=Com Encerramento, 4=Retificadora com Encerramento
    //   REGIME: 1=Simples Nacional, 2=Normal, 9=Produtor Primário
    //   PORTE: 1=EPP (até 360k), 2=MPP (360k-2.4M), 3=PP (2.4M-3.6M), 4=MP (3.6M-12M), 5=Grande (>12M)
    //   APURACAO_CENTRALIZADA: 1=Sim, 2=Não
    //   TRANSF_CREDITO: 1=Sim, 2=Não
    //   CREDITO_PRESUMIDO: 1=Sim, 2=Não
    //   CREDITO_INCENTIVO: 1=Sim, 2=Não
    //   MOVIMENTO: 1=Com movimento, 2=Sem movimento
    //   SUBSTITUTO_TRIBUT: 1=Sim, 2=Não
    //   ESCRITA_FISCAL: 1=Com Escrita Fiscal, 2=Sem Escrita Fiscal
    const dtFim = r0000.dataFim;
    const mesAno = dtFim.length === 8 ? dtFim.substring(2, 4) + dtFim.substring(4) : '000000';
    const ie = r0000.ie.replace(/\D/g, '').padStart(9, '0').slice(-9);
    const tipoDecl = '1';      // Normal
    const regimeApur = '2';    // Normal
    const porte = '4';         // Médio Porte (padrão genérico válido)
    const apurCent = '2';      // Não centralizada
    const transfCred = '2';    // Não
    const credPresumido = '2'; // Não
    const credIncentivo = '2'; // Não
    const movimento = temMovimento ? '1' : '2';
    const substituto = '2';    // Não substituto
    const escritaFiscal = '1'; // Com escrita fiscal
    const qtdTrab = '00000';
    linhasDime.push(`2100${ie}${fmtTxt(r0000.razao, 50)}${mesAno}${tipoDecl}${regimeApur}${porte}${apurCent}${transfCred}${credPresumido}${credIncentivo}${movimento}${substituto}${escritaFiscal}${qtdTrab}`);
    totalRegistros++;

    // Os registros 22, 23, 24, 25, 26, 30, 33 só são gerados quando há movimento (movimento=1)
    if (temMovimento) {

      // --- Registro 22: Entradas (Quadro 1) ---
      // Formato: "22" + "01" + CFOP(5) + 8×valor(17) = 145 chars
      for (const c of entradas) {
        const cfop = (c as any).cfop.padStart(5, '0').slice(-5);
        const campos = [
          fmtVal((c as any).vlCont),   // Valor Contábil
          fmtVal((c as any).vlBc),     // Base de Cálculo
          fmtVal((c as any).vlIcms),   // Imposto Creditado
          fmtVal((c as any).isentas),  // Isentas/Não Tributadas
          fmtVal((c as any).outras),   // Outras
          fmtVal((c as any).vlBcSt),   // BC Retido (ST)
          fmtVal((c as any).vlIcmsSt), // Imposto Retido (ST)
          fmtVal(0)                     // Dif. Alíquota
        ].join('');
        linhasDime.push(`2201${cfop}${campos}`);
        totalRegistros++;
      }

      // --- Registro 23: Saídas (Quadro 2) ---
      // Formato: "23" + "02" + CFOP(5) + 8×valor(17) = 145 chars
      for (const c of saidas) {
        const cfop = (c as any).cfop.padStart(5, '0').slice(-5);
        const campos = [
          fmtVal((c as any).vlCont),
          fmtVal((c as any).vlBc),
          fmtVal((c as any).vlIcms),
          fmtVal((c as any).isentas),
          fmtVal((c as any).outras),
          fmtVal((c as any).vlBcSt),
          fmtVal((c as any).vlIcmsSt),
          fmtVal(0)
        ].join('');
        linhasDime.push(`2302${cfop}${campos}`);
        totalRegistros++;
      }

      // --- Registro 24: Apuração do ICMS (Quadro 3) ---
      // Formato: "24" + "03" + LINHA(2) + VALOR(18) = 24 chars
      // Regra: NÃO emitir linhas com valor zero (erro da validação)
      if (rE110) {
        const totalEntradasVC = entradas.reduce((s: number, c: any) => s + c.vlCont, 0);
        const totalSaidasVC = saidas.reduce((s: number, c: any) => s + c.vlCont, 0);

        // Apenas linhas com valor não-zero
        const linhas24: Array<{ linha: string; valor: number }> = [
          { linha: '01', valor: totalEntradasVC },          // Total entradas (Quadro 1)
          { linha: '02', valor: totalSaidasVC },            // Total saídas (Quadro 2)
          { linha: '08', valor: rE110.totDebitos },         // Total débitos
          { linha: '09', valor: rE110.totCreditos },        // Total créditos
          { linha: '10', valor: rE110.saldoDevedor > 0 ? rE110.saldoDevedor : 0 }, // Saldo a recolher
        ];

        for (const item of linhas24) {
          if (item.valor > 0) {
            linhasDime.push(`2403${item.linha}${fmtVal18(item.valor)}`);
            totalRegistros++;
          }
        }
      }

      // --- Registro 25: Totais do Quadro 1 (Entradas) ---
      // Formato: "25" + "01" + 8×valor(17) = 138 chars
      if (entradas.length > 0) {
        const tot25 = entradas.reduce((acc: any, c: any) => {
          acc.vlCont += c.vlCont;
          acc.vlBc += c.vlBc;
          acc.vlIcms += c.vlIcms;
          acc.isentas += c.isentas;
          acc.outras += c.outras;
          acc.vlBcSt += c.vlBcSt;
          acc.vlIcmsSt += c.vlIcmsSt;
          return acc;
        }, { vlCont: 0, vlBc: 0, vlIcms: 0, isentas: 0, outras: 0, vlBcSt: 0, vlIcmsSt: 0 });

        const campos25 = [
          fmtVal(tot25.vlCont),
          fmtVal(tot25.vlBc),
          fmtVal(tot25.vlIcms),
          fmtVal(tot25.isentas),
          fmtVal(tot25.outras),
          fmtVal(tot25.vlBcSt),
          fmtVal(tot25.vlIcmsSt),
          fmtVal(0)
        ].join('');
        linhasDime.push(`2501${campos25}`);
        totalRegistros++;
      }

      // --- Registro 26: Totais do Quadro 2 (Saídas) ---
      // Formato: "26" + "02" + 8×valor(17) = 138 chars
      if (saidas.length > 0) {
        const tot26 = saidas.reduce((acc: any, c: any) => {
          acc.vlCont += c.vlCont;
          acc.vlBc += c.vlBc;
          acc.vlIcms += c.vlIcms;
          acc.isentas += c.isentas;
          acc.outras += c.outras;
          acc.vlBcSt += c.vlBcSt;
          acc.vlIcmsSt += c.vlIcmsSt;
          return acc;
        }, { vlCont: 0, vlBc: 0, vlIcms: 0, isentas: 0, outras: 0, vlBcSt: 0, vlIcmsSt: 0 });

        const campos26 = [
          fmtVal(tot26.vlCont),
          fmtVal(tot26.vlBc),
          fmtVal(tot26.vlIcms),
          fmtVal(tot26.isentas),
          fmtVal(tot26.outras),
          fmtVal(tot26.vlBcSt),
          fmtVal(tot26.vlIcmsSt),
          fmtVal(0)
        ].join('');
        linhasDime.push(`2602${campos26}`);
        totalRegistros++;
      }

      // --- Registro 30: Outros Débitos/Créditos do ICMS ---
      // Formato: "30" + "03" + LINHA(2) + valor(17) = 23 chars
      // Registra os ajustes (se existirem) de forma separada
      if (rE110) {
        const ajustes30: Array<{ linha: string; valor: number }> = [
          { linha: '01', valor: rE110.debImposto },        // Débito do imposto
          { linha: '02', valor: rE110.debAjDocFiscal },    // Débito por ajuste (doc fiscal)
          { linha: '03', valor: rE110.debAjustes },        // Outros ajustes débito
          { linha: '04', valor: rE110.saldoCredorAnt },    // Saldo credor período anterior
          { linha: '05', valor: rE110.credImposto },       // Crédito do imposto
          { linha: '06', valor: rE110.credAjDocFiscal },   // Crédito por ajuste (doc fiscal)
          { linha: '07', valor: rE110.credAjustes },       // Outros ajustes crédito
        ];

        let emitiu30 = false;
        for (const item of ajustes30) {
          if (item.valor > 0) {
            linhasDime.push(`3003${item.linha}${fmtVal(item.valor)}`);
            totalRegistros++;
            emitiu30 = true;
          }
        }

        // Registro 30 é obrigatório quando há movimento; emite ao menos o débito principal
        if (!emitiu30 && rE110.totDebitos > 0) {
          linhasDime.push(`3003${'01'}${fmtVal(rE110.totDebitos)}`);
          totalRegistros++;
        }
      }

      // --- Registro 33: Guias de Pagamento (Quadro 3) ---
      // Formato: "33" + "03" + ORIGEM(1) + COD_RECEITA(4) + DT_VCTO(8) + VALOR(17) + CLASSE_VCTO(1) + ACORDO(15)
      // Regras:
      //   ORIGEM: 1=Imposto, 2=Multa, 3=Juros, 4=Atualização, 5=Honorários
      //   COD_RECEITA: código SEFAZ/SC (ex: 1147 para ICMS mensal)
      //   CLASSE_VCTO: 1=Normal, 2=Em atraso, 3=Antecipado
      //   DT_VCTO: formato DDMMAAAA
      for (const e of e116Records) {
        if (e.vlOr <= 0) continue; // Não emitir guias com valor zero

        const origem = '1'; // 1=Imposto (padrão ICMS)
        // COD_RECEITA: usar o do SPED se válido (4 dígitos numéricos), senão usar 1147 (ICMS mensal SC)
        const codRecRaw = (e.codRec || '').replace(/\D/g, '');
        const codRec = codRecRaw.length === 4 ? codRecRaw : '1147';
        // DT_VCTO: SPED usa DDMMAAAA; se vier AAAAMMDD, converter
        let dtVcto = (e.dtVcto || '').replace(/\D/g, '');
        if (dtVcto.length === 8) {
          // Detectar formato AAAAMMDD vs DDMMAAAA pelo ano (AAAA seria >1900)
          const anoPos0 = parseInt(dtVcto.substring(0, 4));
          if (anoPos0 >= 1900 && anoPos0 <= 2100) {
            // Está em AAAAMMDD → converter para DDMMAAAA
            dtVcto = dtVcto.substring(6, 8) + dtVcto.substring(4, 6) + dtVcto.substring(0, 4);
          }
        } else {
          dtVcto = '00000000';
        }
        const valor = fmtVal(e.vlOr);
        const classeVcto = '1'; // Normal (1 char)
        const acordo = '000000000000000'; // 15 zeros

        linhasDime.push(`3303${origem}${codRec}${dtVcto}${valor}${classeVcto}${acordo}`);
        totalRegistros++;
      }

    } // fim if(temMovimento)

    // --- Registro 98: Fim da Declaração (total de registros ANTES do 98 e 99) ---
    // Formato: "98" + "  " + QTD(6) = 10 chars
    const qtdReg = String(totalRegistros + 1).padStart(6, '0');
    linhasDime.push(`98  ${qtdReg}`);
    totalRegistros++;

    // --- Registro 99: Fechamento do Arquivo ---
    // Formato: "99" + "  " + QTD_TOTAL(6) + QTD_DECLARACOES(5) = 15 chars
    const qtdTotal = String(totalRegistros + 1).padStart(6, '0');
    linhasDime.push(`99  ${qtdTotal}00001`);
    totalRegistros++;

    // === Final file ===
    const conteudoFinal = linhasDime.join('\r\n') + '\r\n';
    const mm = (r0000.dataFim || '').length >= 6 ? r0000.dataFim.substring(2, 4) : '01';
    const yyyy = (r0000.dataFim || '').length >= 8 ? r0000.dataFim.substring(4) : '2026';
    const nomeDime = `DIME_${mm}${yyyy}.txt`;

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