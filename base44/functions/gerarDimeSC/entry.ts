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

    // Remove BOM e espaços invisíveis no início do conteúdo
    const conteudoLimpo = conteudoSped.replace(/^\uFEFF/, '').replace(/^\u200B/, '').trim();
    const linhas = conteudoLimpo.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (linhas.length === 0) {
      return Response.json({ success: false, error: 'Arquivo SPED Fiscal vazio.' }, { status: 400 });
    }

    // Procura o registro 0000
    let primLinha = linhas[0].trim();
    if (!primLinha.startsWith('|')) {
      const idx0000 = linhas.findIndex((l) => l.trim().startsWith('|') && l.split('|').filter((c) => c !== '')[0] === '0000');
      if (idx0000 === -1) {
        return Response.json({ success: false, error: 'O arquivo não é um SPED Fiscal válido (registro 0000 não encontrado).' }, { status: 400 });
      }
      primLinha = linhas[idx0000].trim();
    }

    const camposPrim = primLinha.split('|').filter((c) => c !== '');
    if (camposPrim[0] !== '0000') {
      return Response.json({ success: false, error: 'O arquivo não é um SPED Fiscal válido (registro 0000 não encontrado).' }, { status: 400 });
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

        const totDebitos = debImposto + debAjDocFiscal + debAjustes;
        const totCreditos = saldoCredorAnt + credImposto + credAjDocFiscal + credAjustes;
        const saldoDevedor = Math.max(0, totDebitos - totCreditos);
        const saldoCredorTransportar = Math.max(0, totCreditos - totDebitos);

        rE110 = {
          debImposto, debAjDocFiscal, debAjustes, totDebitos,
          saldoCredorAnt, credImposto, credAjDocFiscal, credAjustes, totCreditos,
          saldoDevedor, saldoCredorTransportar
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
    // Valor em centavos, largura variável (sem sinal, sem vírgula)
    const fmtVal = (val: number, width = 17) => {
      const cents = Math.round((val || 0) * 100);
      return String(Math.abs(cents)).padStart(width, '0').slice(-width);
    };

    const fmtTxt = (text: string, width: number) =>
      (text || '').substring(0, width).padEnd(width, ' ');

    // Item de quadro com 3 dígitos numéricos, ex: "010", "020", "990"
    const fmtItem = (item: number) => String(item).padStart(3, '0');

    // === Generate DIME-SC lines ===
    // Layout baseado no Manual Consolidado Portaria SEF 153/2012 (versão 153/12.29)
    const linhasDime: string[] = [];
    let totalRegistros = 0;

    // --- Registro 20: Contabilista ---
    // Layout: "20" + espaco(2) + CPF(11) + NOME(50) + DATA_HORA(14) = 79 chars
    const cpfCont = (r0100?.cpf || '00000000000').replace(/\D/g, '').padStart(11, '0').slice(-11);
    const nomeCont = r0100?.nome || 'CONTABILISTA';
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dataHora = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    linhasDime.push(`20  ${cpfCont}${fmtTxt(nomeCont, 50)}${dataHora}`);
    totalRegistros++;

    // --- Registro 21: Cabeçalho da Declaração (Quadro 00) ---
    // Campos conforme Manual Consolidado Portaria SEF 153/2012:
    //   "21" (2) + Quadro "00" (2) + IE(9) + RAZAO(50) + MMAAAA(6)
    //   + TIPO_DECL(1): 1=Normal
    //   + REGIME(1): 2=Normal
    //   + PORTE(1): 1=Não se aplica
    //   + APURACAO_CONSOLIDADA(1): 1=Não é apuração consolidada
    //   + APURACAO_CENTRALIZADA(1): 1=Não se aplica
    //   + TRANSF_CREDITO(1): 1=Não transferiu nem recebeu
    //   + CREDITO_PRESUMIDO(1): 1=Não se aplica
    //   + CREDITO_INCENTIVO(1): 1=Não se aplica
    //   + MOVIMENTO(1): 1=Sem mov/sem saldo, 2=Sem mov/com saldo, 3=Com movimento
    //   + SUBSTITUTO(1): 2=Não
    //   + ESCRITA_CONTABIL(1): 1=Sim é estabelecimento principal
    //   + QTD_TRAB(5)
    const dtFim = r0000.dataFim;
    const mesAno = dtFim.length === 8 ? dtFim.substring(2, 4) + dtFim.substring(4) : '000000';
    const ie = r0000.ie.replace(/\D/g, '').padStart(9, '0').slice(-9);

    const tipoDecl = '1';        // 1=Normal
    const regimeApur = '2';      // 2=Normal
    const porte = '1';           // 1=Não se aplica
    const apurConsolidada = '1'; // 1=Não é apuração consolidada
    const apurCentralizada = '1';// 1=Não se aplica
    const transfCred = '1';      // 1=Não transferiu nem recebeu
    const credPresumido = '1';   // 1=Não se aplica
    const credIncentivo = '1';   // 1=Não se aplica
    // MOVIMENTO: 3=Com movimento, 1=Sem movimento e sem saldos
    const movimento = temMovimento ? '3' : '1';
    const substituto = '2';      // 2=Não
    const escritaContabil = '1'; // 1=Sim é estabelecimento principal
    const qtdTrab = '00000';

    linhasDime.push(`2100${ie}${fmtTxt(r0000.razao, 50)}${mesAno}${tipoDecl}${regimeApur}${porte}${apurConsolidada}${apurCentralizada}${transfCred}${credPresumido}${credIncentivo}${movimento}${substituto}${escritaContabil}${qtdTrab}`);
    totalRegistros++;

    // Registros 22-33 SOMENTE quando há movimento (movimento = '3')
    if (temMovimento) {

      // --- Registro 22: Valores Fiscais Entradas (Quadro 01) ---
      // Layout: "22" + "01" + CFOP(5) + 8×valor(17) = 2+2+5+(8×17) = 145 chars
      for (const c of entradas) {
        const cfop = (c as any).cfop.padStart(5, '0').slice(-5);
        const campos = [
          fmtVal((c as any).vlCont),    // Valor Contábil
          fmtVal((c as any).vlBc),      // Base de Cálculo
          fmtVal((c as any).vlIcms),    // Imposto Creditado
          fmtVal((c as any).isentas),   // Isentas/Não Tributadas
          fmtVal((c as any).outras),    // Outras
          fmtVal((c as any).vlBcSt),    // BC Retido (ST)
          fmtVal((c as any).vlIcmsSt),  // Imposto Retido (ST)
          fmtVal(0)                      // Diferença de Alíquota
        ].join('');
        linhasDime.push(`2201${cfop}${campos}`);
        totalRegistros++;
      }

      // --- Registro 23: Valores Fiscais Saídas (Quadro 02) ---
      // Layout: "22" + "02" + CFOP(5) + 8×valor(17) = 145 chars
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

      // --- Registro 24: Resumo dos Valores Fiscais (Quadro 03) ---
      // Layout: "24" + "03" + ITEM(3) + VALOR(17) = 24 chars
      // Itens válidos do Quadro 03: 010 a 999 conforme manual
      if (rE110) {
        const totalEntradasVC = entradas.reduce((s: number, c: any) => s + c.vlCont, 0);
        const totalEntradasBC = entradas.reduce((s: number, c: any) => s + c.vlBc, 0);
        const totalEntradasICMS = entradas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const totalSaidasVC = saidas.reduce((s: number, c: any) => s + c.vlCont, 0);
        const totalSaidasBC = saidas.reduce((s: number, c: any) => s + c.vlBc, 0);
        const totalSaidasICMS = saidas.reduce((s: number, c: any) => s + c.vlIcms, 0);

        // Itens do Quadro 03 com valor > 0
        const itens24: Array<{ item: number; valor: number }> = [
          { item: 10, valor: totalEntradasVC },    // 010 - Total Valor Contábil Entradas
          { item: 20, valor: totalEntradasBC },    // 020 - Total Base Cálculo Entradas
          { item: 30, valor: totalEntradasICMS },  // 030 - Total ICMS Creditado Entradas
          { item: 50, valor: totalSaidasVC },      // 050 - Total Valor Contábil Saídas
          { item: 60, valor: totalSaidasBC },      // 060 - Total Base Cálculo Saídas
          { item: 70, valor: totalSaidasICMS },    // 070 - Total ICMS Debitado Saídas
        ];

        for (const item of itens24) {
          if (item.valor > 0) {
            linhasDime.push(`2403${fmtItem(item.item)}${fmtVal(item.valor)}`);
            totalRegistros++;
          }
        }
      }

      // --- Registro 25: Resumo da Apuração dos Débitos (Quadro 04) ---
      // Layout: "25" + "04" + ITEM(3) + VALOR(17) = 24 chars
      // Itens válidos: 010 = Débito pelas saídas, 990 = Subtotal de Débitos
      if (saidas.length > 0 && rE110) {
        const debSaidas = rE110.debImposto > 0 ? rE110.debImposto : saidas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const outrosDebitos = rE110.debAjDocFiscal + rE110.debAjustes;
        const subtotalDebitos = rE110.totDebitos;

        // Item 010 - Débito pelas saídas
        if (debSaidas > 0) {
          linhasDime.push(`2504${fmtItem(10)}${fmtVal(debSaidas)}`);
          totalRegistros++;
        }
        // Item 070 - Outros débitos (se houver ajustes)
        if (outrosDebitos > 0) {
          linhasDime.push(`2504${fmtItem(70)}${fmtVal(outrosDebitos)}`);
          totalRegistros++;
        }
        // Item 990 - Subtotal de Débitos (obrigatório quando há itens)
        if (subtotalDebitos > 0) {
          linhasDime.push(`2504${fmtItem(990)}${fmtVal(subtotalDebitos)}`);
          totalRegistros++;
        }
      }

      // --- Registro 26: Resumo da Apuração dos Créditos (Quadro 05) ---
      // Layout: "26" + "05" + ITEM(3) + VALOR(17) = 24 chars
      // Itens válidos: 010 = Saldo credor anterior, 020 = Crédito pelas entradas, 990 = Subtotal
      if (rE110) {
        const saldoAnt = rE110.saldoCredorAnt;
        const credEntradas = rE110.credImposto > 0 ? rE110.credImposto : entradas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const outrosCred = rE110.credAjDocFiscal + rE110.credAjustes;
        const subtotalCreditos = rE110.totCreditos;

        // Item 010 - Saldo credor do mês anterior
        if (saldoAnt > 0) {
          linhasDime.push(`2605${fmtItem(10)}${fmtVal(saldoAnt)}`);
          totalRegistros++;
        }
        // Item 020 - Crédito pelas entradas
        if (credEntradas > 0) {
          linhasDime.push(`2605${fmtItem(20)}${fmtVal(credEntradas)}`);
          totalRegistros++;
        }
        // Item 150 - Outros créditos (se houver ajustes)
        if (outrosCred > 0) {
          linhasDime.push(`2605${fmtItem(150)}${fmtVal(outrosCred)}`);
          totalRegistros++;
        }
        // Item 990 - Subtotal de Créditos (obrigatório quando há itens)
        if (subtotalCreditos > 0) {
          linhasDime.push(`2605${fmtItem(990)}${fmtVal(subtotalCreditos)}`);
          totalRegistros++;
        }
      }

      // --- Registro 30: Cálculo do Imposto a Pagar ou Saldo Credor (Quadro 09) ---
      // Layout: "30" + "09" + ITEM(3) + VALOR(17) = 24 chars
      // Itens do Quadro 09:
      //   010 = Subtotal de débitos (= item 990 do Quadro 04)
      //   040 = Total de débitos (= item 010 se não houver 020/030)
      //   050 = Subtotal de créditos (= item 990 do Quadro 05)
      //   080 = Total de créditos (= item 050 se não houver 060/070)
      //   120 = Saldo devedor (Total Débitos - Total Créditos, se > 0)
      //   999 = Imposto a recolher (= item 120 se não houver deduções)
      //   998 = Saldo credor para o mês seguinte (se saldo credor > 0)
      if (rE110) {
        const totDeb = rE110.totDebitos;
        const totCred = rE110.totCreditos;
        const saldoDevedor = rE110.saldoDevedor;
        const saldoCredor = rE110.saldoCredorTransportar;

        // Item 010 - Subtotal de débitos
        if (totDeb > 0) {
          linhasDime.push(`3009${fmtItem(10)}${fmtVal(totDeb)}`);
          totalRegistros++;
        }
        // Item 040 - Total de débitos
        if (totDeb > 0) {
          linhasDime.push(`3009${fmtItem(40)}${fmtVal(totDeb)}`);
          totalRegistros++;
        }
        // Item 050 - Subtotal de créditos
        if (totCred > 0) {
          linhasDime.push(`3009${fmtItem(50)}${fmtVal(totCred)}`);
          totalRegistros++;
        }
        // Item 080 - Total de créditos
        if (totCred > 0) {
          linhasDime.push(`3009${fmtItem(80)}${fmtVal(totCred)}`);
          totalRegistros++;
        }
        // Item 120 - Saldo devedor
        if (saldoDevedor > 0) {
          linhasDime.push(`3009${fmtItem(120)}${fmtVal(saldoDevedor)}`);
          totalRegistros++;
        }
        // Item 999 - Imposto a recolher (se há saldo devedor)
        if (saldoDevedor > 0) {
          linhasDime.push(`3009${fmtItem(999)}${fmtVal(saldoDevedor)}`);
          totalRegistros++;
        }
        // Item 998 - Saldo credor para mês seguinte (se há saldo credor)
        if (saldoCredor > 0) {
          linhasDime.push(`3009${fmtItem(998)}${fmtVal(saldoCredor)}`);
          totalRegistros++;
        }
      }

      // --- Registro 33: Discriminação dos Pagamentos (Quadro 12) ---
      // Layout: "33" + "12" + ORIGEM(1) + COD_RECEITA(5) + DT_VCTO(8) + VALOR(14) + CLASSE_VCTO(2) + ACORDO(15)
      // Total: 2+2+1+5+8+14+2+15 = 49 chars
      // ORIGEM: 1=Imposto ICMS
      // COD_RECEITA: 5 dígitos (ex: 14492 para ICMS mensal SC)
      // DT_VCTO: DDMMAAAA
      // CLASSE_VCTO: 2 dígitos (ex: "10" = Normal prazo)
      // ACORDO: 15 zeros
      for (const e of e116Records) {
        if (e.vlOr <= 0) continue;

        const origem = '1'; // 1=Imposto ICMS
        // Código de receita: 5 dígitos numéricos
        // Para ICMS SC mensal: 14492
        const codRecRaw = (e.codRec || '').replace(/\D/g, '');
        const codRec = codRecRaw.length >= 4 ? codRecRaw.padStart(5, '0').slice(-5) : '14492';

        // DT_VCTO: SPED usa DDMMAAAA
        let dtVcto = (e.dtVcto || '').replace(/\D/g, '');
        if (dtVcto.length === 8) {
          // Detectar formato AAAAMMDD vs DDMMAAAA pelo ano (AAAA > 1900 na posição 0)
          const anoPos0 = parseInt(dtVcto.substring(0, 4));
          if (anoPos0 >= 1900 && anoPos0 <= 2100) {
            // Está em AAAAMMDD → converter para DDMMAAAA
            dtVcto = dtVcto.substring(6, 8) + dtVcto.substring(4, 6) + dtVcto.substring(0, 4);
          }
        } else {
          dtVcto = '00000000';
        }

        // Valor: 14 dígitos em centavos
        const valor = fmtVal(e.vlOr, 14);
        // Classe de vencimento: 2 dígitos ("10" = Normal - prazo regular)
        const classeVcto = '10';
        const acordo = '000000000000000'; // 15 zeros

        linhasDime.push(`3312${origem}${codRec}${dtVcto}${valor}${classeVcto}${acordo}`);
        totalRegistros++;
      }

    } // fim if(temMovimento)

    // --- Registro 98: Fim da Declaração ---
    // Layout: "98" + "98" + QTD_REGISTROS(6) = 10 chars
    // Conta TODOS os registros desta declaração exceto o 98 e 99 (ou seja, totalRegistros atual)
    const qtdReg98 = String(totalRegistros).padStart(6, '0');
    linhasDime.push(`9898${qtdReg98}`);
    totalRegistros++;

    // --- Registro 99: Fechamento do Arquivo ---
    // Layout: "99" + "99" + QTD_TOTAL_REGISTROS(6) + QTD_DECLARACOES(5) = 15 chars
    // QTD_TOTAL inclui TODOS os registros do arquivo (incluindo o 98 já contado, mais o próprio 99)
    const qtdTotal99 = String(totalRegistros + 1).padStart(6, '0');
    linhasDime.push(`9999${qtdTotal99}00001`);
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
        format: 'fixed-width posicional (Manual SEF 153/2012)'
      },
      spedId: spedRecord.id
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});