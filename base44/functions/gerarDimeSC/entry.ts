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
    const linhas = conteudoLimpo.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
    if (linhas.length === 0) {
      return Response.json({ success: false, error: 'Arquivo SPED Fiscal vazio.' }, { status: 400 });
    }

    // Procura o registro 0000
    let primLinha = linhas[0].trim();
    if (!primLinha.startsWith('|')) {
      const idx0000 = linhas.findIndex((l: string) => l.trim().startsWith('|') && l.split('|').filter((c: string) => c !== '')[0] === '0000');
      if (idx0000 === -1) {
        return Response.json({ success: false, error: 'O arquivo não é um SPED Fiscal válido (registro 0000 não encontrado).' }, { status: 400 });
      }
      primLinha = linhas[idx0000].trim();
    }

    const camposPrim = primLinha.split('|').filter((c: string) => c !== '');
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

    const temMovimento = entradas.length > 0 || saidas.length > 0 || (rE110 && (rE110.totDebitos > 0 || rE110.totCreditos > 0));

    // =============================================
    // Helper functions — conforme convenções do PDF
    // =============================================

    // Tipo $: valor monetário em centavos, 17 dígitos, zeros à esquerda
    const fmtVal = (val: number, width = 17): string => {
      const cents = Math.round(Math.abs(val || 0) * 100);
      return String(cents).padStart(width, '0').slice(-width);
    };

    // Tipo C: alfanumérico, alinhado à esquerda, brancos à direita, maiúsculas
    const fmtC = (text: string, width: number): string =>
      (text || '').toUpperCase().replace(/[^A-Z0-9 \-\/\.]/g, ' ').substring(0, width).padEnd(width, ' ');

    // Tipo N: inteiro, alinhado à direita, zeros à esquerda
    const fmtN = (val: number | string, width: number): string =>
      String(Math.abs(parseInt(String(val)) || 0)).padStart(width, '0').slice(-width);

    // Item de quadro: 3 dígitos (ex: 010, 020, 990)
    const fmtItem = (item: number): string => String(item).padStart(3, '0');

    // =============================================
    // Generate DIME-SC lines
    // Layout OFICIAL conforme Portaria SEF 153/2012 Anexo II
    // =============================================
    const linhasDime: string[] = [];

    // Contagem de registros por declaração (para o Reg 98)
    // O Reg 20 NÃO entra na contagem da declaração — é único por arquivo
    let totalRegsArquivo = 0;   // todos incluindo 20 e 99
    let totalRegsDecl = 0;      // apenas os da declaração (21 até 98, inclusive o 98)

    // -----------------------------------------------
    // Registro 20 - Dados do Contabilista
    // Pos 001/002 = "20" (N, 2)
    // Pos 003/004 = brancos (C, 2)
    // Pos 005/015 = CPF (N, 11)
    // Pos 016/065 = Nome Contabilista (C, 50)
    // Pos 066/079 = Data e Hora AAAAMMDDHHMMSS (N, 14)
    // Total = 79 chars
    // -----------------------------------------------
    const cpfCont = (r0100?.cpf || '00000000000').replace(/\D/g, '').padStart(11, '0').slice(-11);
    const nomeCont = r0100?.nome || 'CONTABILISTA';
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    // Formato: AAAAMMDDHHMMSS (14 chars)
    const dataHora = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;

    // Campo 01: "20" (N,2) | Campo 02: brancos (C,2) | Campo 03: CPF (N,11) | Campo 04: Nome (C,50) | Campo 05: DataHora (N,14)
    linhasDime.push(`20  ${cpfCont}${fmtC(nomeCont, 50)}${dataHora}`);
    totalRegsArquivo++;

    // -----------------------------------------------
    // Registro 21 - Dados Iniciais da Declaração (Quadro 00)
    // Pos 001/002 = "21" (N, 2)
    // Pos 003/004 = "00" (N, 2)
    // Pos 005/013 = IE (N, 9)
    // Pos 014/063 = Nome Contribuinte (C, 50)
    // Pos 064/069 = Período MMAAAA (N, 6)
    // Pos 070/070 = Tipo Declaração (N, 1): 1=Normal
    // Pos 071/071 = Regime Apuração (N, 1): 2=Normal
    // Pos 072/072 = Porte (N, 1): 1=Não se aplica
    // Pos 073/073 = Apuração consolidada (N, 1): 1=Não é consolidada
    // Pos 074/074 = Apuração centralizada (N, 1): 1=Não se aplica
    // Pos 075/075 = Transferência créditos (N, 1): 1=Não apurou nem recebeu
    // Pos 076/076 = Créditos presumidos (N, 1): 1=Não se aplica
    // Pos 077/077 = Créditos incentivos fiscais (N, 1): 1=Não se aplica
    // Pos 078/078 = Movimento (N, 1): 1=Sem mov/sem saldo, 2=Sem mov/com saldo, 3=Com movimento
    // Pos 079/079 = Substituto Tributário (N, 1): 2=Não
    // Pos 080/080 = Escrita Contábil (N, 1): 1=Sim estabelecimento principal
    // Pos 081/085 = Qtd Trabalhadores (N, 5)
    // Total = 85 chars
    // -----------------------------------------------
    const dtFim = r0000.dataFim; // DDMMAAAA
    // Período no formato MMAAAA: pega MM (pos 2-4) e AAAA (pos 4-8) da data DDMMAAAA
    const mesAno = dtFim.length === 8
      ? dtFim.substring(2, 4) + dtFim.substring(4, 8)
      : '000000';
    const ie = r0000.ie.replace(/\D/g, '').padStart(9, '0').slice(-9);

    const movimento = temMovimento ? '3' : '1'; // 3=Com movimento, 1=Sem movimento e sem saldos

    // Montagem posicional exata conforme layout PDF:
    // [001-002]="21" [003-004]="00" [005-013]=IE(9) [014-063]=Nome(50) [064-069]=Período(6)
    // [070]=TipoDecl [071]=Regime [072]=Porte [073]=ApurConsolidada [074]=ApurCentralizada
    // [075]=TransfCred [076]=CredPresumido [077]=CredIncentivo [078]=Movimento
    // [079]=Substituto [080]=EscritaContabil [081-085]=QtdTrab
    const reg21 =
      '21' +           // pos 001-002: Tipo N(2)
      '00' +           // pos 003-004: Quadro N(2)
      ie +             // pos 005-013: IE N(9)
      fmtC(r0000.razao, 50) + // pos 014-063: Nome C(50)
      mesAno +         // pos 064-069: Período N(6)
      '1' +            // pos 070: Tipo Declaração N(1) - 1=Normal
      '2' +            // pos 071: Regime Apuração N(1) - 2=Normal
      '1' +            // pos 072: Porte N(1) - 1=Não se aplica
      '1' +            // pos 073: Apuração consolidada N(1) - 1=Não é consolidada
      '1' +            // pos 074: Apuração centralizada N(1) - 1=Não se aplica
      '1' +            // pos 075: Transferência créditos N(1) - 1=Não apurou nem recebeu
      '1' +            // pos 076: Créditos presumidos N(1) - 1=Não se aplica
      '1' +            // pos 077: Créditos incentivos N(1) - 1=Não se aplica
      movimento +      // pos 078: Movimento N(1)
      '2' +            // pos 079: Substituto Tributário N(1) - 2=Não
      '1' +            // pos 080: Escrita Contábil N(1) - 1=Sim estabelecimento principal
      '00001';         // pos 081-085: Qtd Trabalhadores N(5) — mínimo 1 (zero é rejeitado pela SEF)

    linhasDime.push(reg21);
    totalRegsArquivo++;
    totalRegsDecl++;

    // Registros 22-33: SOMENTE quando há movimento
    if (temMovimento) {

      // -----------------------------------------------
      // Registro 22 - Valores Fiscais Entradas (Quadro 01)
      // Pos 001/002 = "22" (N, 2)
      // Pos 003/004 = "01" (C, 2)  ← formato C conforme PDF
      // Pos 005/009 = CFOP (N, 5)
      // Pos 010/026 = Valor Contábil ($, 17)
      // Pos 027/043 = Base Cálculo ($, 17)
      // Pos 044/060 = Imposto Creditado ($, 17)
      // Pos 061/077 = Isentas/Não Tributadas ($, 17)
      // Pos 078/094 = Outras ($, 17)
      // Pos 095/111 = BC Imposto Retido ($, 17)
      // Pos 112/128 = Imposto Retido ($, 17)
      // Pos 129/145 = Diferença Alíquota ($, 17)
      // Total = 145 chars
      // -----------------------------------------------
      for (const c of entradas) {
        const cfop = fmtN((c as any).cfop, 5);
        const reg22 =
          '22' +
          '01' +                          // Quadro C(2) = "01"
          cfop +                          // CFOP N(5)
          fmtVal((c as any).vlCont) +     // Valor Contábil $(17)
          fmtVal((c as any).vlBc) +       // Base Cálculo $(17)
          fmtVal((c as any).vlIcms) +     // Imposto Creditado $(17)
          fmtVal((c as any).isentas) +    // Isentas $(17)
          fmtVal((c as any).outras) +     // Outras $(17)
          fmtVal((c as any).vlBcSt) +     // BC Retido $(17)
          fmtVal((c as any).vlIcmsSt) +   // Imposto Retido $(17)
          fmtVal(0);                       // Diferença Alíquota $(17)
        linhasDime.push(reg22);
        totalRegsArquivo++;
        totalRegsDecl++;
      }

      // -----------------------------------------------
      // Registro 23 - Valores Fiscais Saídas (Quadro 02)
      // Pos 001/002 = "23" (N, 2)
      // Pos 003/004 = "02" (C, 2)  ← formato C conforme PDF
      // Pos 005/009 = CFOP (N, 5)
      // Pos 010/026 = Valor Contábil ($, 17)
      // Pos 027/043 = Base Cálculo ($, 17)
      // Pos 044/060 = Imposto Debitado ($, 17)
      // Pos 061/077 = Isentas/Não Tributadas ($, 17)
      // Pos 078/094 = Outras ($, 17)
      // Pos 095/111 = BC Imposto Retido ($, 17)
      // Pos 112/128 = Imposto Retido ($, 17)
      // Pos 129/145 = Branco/zeros ($, 17)
      // Total = 145 chars
      // -----------------------------------------------
      for (const c of saidas) {
        const cfop = fmtN((c as any).cfop, 5);
        const reg23 =
          '23' +
          '02' +                          // Quadro C(2) = "02"
          cfop +                          // CFOP N(5)
          fmtVal((c as any).vlCont) +     // Valor Contábil $(17)
          fmtVal((c as any).vlBc) +       // Base Cálculo $(17)
          fmtVal((c as any).vlIcms) +     // Imposto Debitado $(17)
          fmtVal((c as any).isentas) +    // Isentas $(17)
          fmtVal((c as any).outras) +     // Outras $(17)
          fmtVal((c as any).vlBcSt) +     // BC Retido $(17)
          fmtVal((c as any).vlIcmsSt) +   // Imposto Retido $(17)
          fmtVal(0);                       // Branco/zeros $(17)
        linhasDime.push(reg23);
        totalRegsArquivo++;
        totalRegsDecl++;
      }

      // -----------------------------------------------
      // Registro 24 - Resumo dos Valores Fiscais (Quadro 03)
      // Pos 001/002 = "24" (N, 2)
      // Pos 003/004 = "03" (C, 2)
      // Pos 005/007 = Item (N, 3)
      // Pos 008/024 = Valor ($, 17)
      // Total = 24 chars por linha
      // -----------------------------------------------
      if (rE110) {
        const totalEntradasVC = entradas.reduce((s: number, c: any) => s + c.vlCont, 0);
        const totalEntradasBC = entradas.reduce((s: number, c: any) => s + c.vlBc, 0);
        const totalEntradasICMS = entradas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const totalEntradasIsentas = entradas.reduce((s: number, c: any) => s + c.isentas, 0);
        const totalEntradasOutras = entradas.reduce((s: number, c: any) => s + c.outras, 0);
        const totalSaidasVC = saidas.reduce((s: number, c: any) => s + c.vlCont, 0);
        const totalSaidasBC = saidas.reduce((s: number, c: any) => s + c.vlBc, 0);
        const totalSaidasICMS = saidas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const totalSaidasIsentas = saidas.reduce((s: number, c: any) => s + c.isentas, 0);
        const totalSaidasOutras = saidas.reduce((s: number, c: any) => s + c.outras, 0);

        // Quadro 03 — Itens conforme layout oficial DIME-SC:
        // 10=VC entradas, 20=BC entradas, 30=ICMS creditado entradas,
        // 40=isentas entradas, 50=outras entradas,
        // 60=VC saídas, 70=BC saídas, 80=ICMS debitado saídas,
        // 90=isentas saídas, 100=outras saídas
        const itens24: Array<{ item: number; valor: number }> = [
          { item: 10, valor: totalEntradasVC },
          { item: 20, valor: totalEntradasBC },
          { item: 30, valor: totalEntradasICMS },
          { item: 40, valor: totalEntradasIsentas },
          { item: 50, valor: totalEntradasOutras },
          { item: 60, valor: totalSaidasVC },
          { item: 70, valor: totalSaidasBC },
          { item: 80, valor: totalSaidasICMS },
          { item: 90, valor: totalSaidasIsentas },
          { item: 100, valor: totalSaidasOutras },
        ];

        for (const item of itens24) {
          if (item.valor > 0) {
            linhasDime.push(`24` + `03` + fmtItem(item.item) + fmtVal(item.valor));
            totalRegsArquivo++;
            totalRegsDecl++;
          }
        }
      }

      // -----------------------------------------------
      // Registro 25 - Resumo Apuração Débitos (Quadro 04)
      // Pos 001/002 = "25" (N, 2)
      // Pos 003/004 = "04" (C, 2)
      // Pos 005/007 = Item (N, 3)
      // Pos 008/024 = Valor ($, 17)
      // Total = 24 chars por linha
      // -----------------------------------------------
      if (rE110) {
        // Quadro 04 — Apuração dos Débitos:
        // 010 = ICMS debitado nas saídas (= Quadro 03 item 080)
        // 070 = Outros débitos
        // 990 = Subtotal (010 + 070)
        const debSaidas = saidas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const outrosDebitos = rE110.debAjDocFiscal + rE110.debAjustes;
        const subtotalDebitos = debSaidas + outrosDebitos;

        if (debSaidas > 0) {
          linhasDime.push(`25` + `04` + fmtItem(10) + fmtVal(debSaidas));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
        if (outrosDebitos > 0) {
          linhasDime.push(`25` + `04` + fmtItem(70) + fmtVal(outrosDebitos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
        if (subtotalDebitos > 0) {
          linhasDime.push(`25` + `04` + fmtItem(990) + fmtVal(subtotalDebitos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
      }

      // -----------------------------------------------
      // Registro 26 - Resumo Apuração Créditos (Quadro 05)
      // Pos 001/002 = "26" (N, 2)
      // Pos 003/004 = "05" (C, 2)
      // Pos 005/007 = Item (N, 3)
      // Pos 008/024 = Valor ($, 17)
      // Total = 24 chars por linha
      // -----------------------------------------------
      if (rE110) {
        // Quadro 05 — Apuração dos Créditos (layout oficial SEF-SC):
        // 010 = Saldo credor do mês anterior (NÃO gerar — o SEF valida contra a DIME anterior;
        //       se não houver DIME anterior ou 998=0, deve ser 0. O saldo credor anterior do
        //       SPED só é reconhecido se a DIME do mês anterior o informou em 998.)
        // 020 = ICMS creditado nas entradas
        // 150 = Outros créditos
        // 990 = Subtotal (020 + 150) — DEVE bater com Quadro 09 item 050
        const credEntradas = entradas.reduce((s: number, c: any) => s + c.vlIcms, 0);
        const outrosCred = rE110.credAjDocFiscal + rE110.credAjustes;
        const subtotalCreditos = credEntradas + outrosCred;

        if (credEntradas > 0) {
          linhasDime.push(`26` + `05` + fmtItem(20) + fmtVal(credEntradas));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
        if (outrosCred > 0) {
          linhasDime.push(`26` + `05` + fmtItem(150) + fmtVal(outrosCred));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
        if (subtotalCreditos > 0) {
          linhasDime.push(`26` + `05` + fmtItem(990) + fmtVal(subtotalCreditos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
      }

      // -----------------------------------------------
      // Registro 30 - Cálculo do Imposto a Pagar ou Saldo Credor (Quadro 09)
      // Pos 001/002 = "30" (C, 2)  ← layout diz C
      // Pos 003/004 = "09" (C, 2)
      // Pos 005/007 = Item (N, 3)
      // Pos 008/024 = Valor ($, 17)
      // Total = 24 chars por linha
      // -----------------------------------------------
      if (rE110) {
        // =====================================================
        // Quadro 09 — Cálculo do Imposto a Pagar ou Saldo Credor
        // Layout oficial DIME-SC (Portaria SEF 153/2012)
        //
        // Itens do Quadro 09 (conforme layout oficial SEF-SC):
        //   010 = Subtotal de débitos (transportado do Quadro 04, item 990)
        //   040 = Total de débitos
        //   050 = Subtotal de créditos (transportado do Quadro 05, item 990)
        //   080 = Total de créditos
        //   120 = Imposto a Recolher (se saldo devedor > 0)
        //   999 = Imposto a Recolher — total final (se saldo devedor > 0)
        //   140 = Saldo Credor p/ Mês Seguinte (se saldo credor > 0)
        //   998 = Saldo Credor p/ Mês Seguinte — total final (OBRIGATÓRIO se saldo credor > 0)
        //
        // NÃO EXISTEM no Quadro 09: itens 099, 100, 105, 110
        // =====================================================
        // saldoCredorAnt NÃO é incluído aqui — o SEF valida item 010 contra a DIME do mês
        // anterior. Se não houve DIME anterior (ou 998=0), item 010 deve ser 0,00.
        const totalDebitos = saidas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.debAjDocFiscal + rE110.debAjustes;
        const totalCreditos = entradas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.credAjDocFiscal + rE110.credAjustes;
        const saldoDevedor = Math.max(0, totalDebitos - totalCreditos);
        const saldoCredorTransportar = Math.max(0, totalCreditos - totalDebitos);

        // Item 010 — Subtotal de débitos (transportado do Quadro 04)
        if (totalDebitos > 0) {
          linhasDime.push(`30` + `09` + fmtItem(10) + fmtVal(totalDebitos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 040 — Total de débitos
        if (totalDebitos > 0) {
          linhasDime.push(`30` + `09` + fmtItem(40) + fmtVal(totalDebitos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 050 — Subtotal de créditos (transportado do Quadro 05)
        if (totalCreditos > 0) {
          linhasDime.push(`30` + `09` + fmtItem(50) + fmtVal(totalCreditos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 080 — Total de créditos
        if (totalCreditos > 0) {
          linhasDime.push(`30` + `09` + fmtItem(80) + fmtVal(totalCreditos));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 120 — Imposto a Recolher (se saldo devedor > 0)
        if (saldoDevedor > 0) {
          linhasDime.push(`30` + `09` + fmtItem(120) + fmtVal(saldoDevedor));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 999 — Imposto a Recolher — total final (se saldo devedor > 0)
        if (saldoDevedor > 0) {
          linhasDime.push(`30` + `09` + fmtItem(999) + fmtVal(saldoDevedor));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 140 — Saldo Credor p/ Mês Seguinte (se saldo credor > 0)
        if (saldoCredorTransportar > 0) {
          linhasDime.push(`30` + `09` + fmtItem(140) + fmtVal(saldoCredorTransportar));
          totalRegsArquivo++;
          totalRegsDecl++;
        }

        // Item 998 — Saldo Credor p/ Mês Seguinte — total final (OBRIGATÓRIO se saldo credor > 0)
        if (saldoCredorTransportar > 0) {
          linhasDime.push(`30` + `09` + fmtItem(998) + fmtVal(saldoCredorTransportar));
          totalRegsArquivo++;
          totalRegsDecl++;
        }
      }

      // -----------------------------------------------
      // Registro 33 - Discriminação dos Pagamentos (Quadro 12)
      // SÓ gerar pagamentos de origem 1 (ICMS) quando há imposto a recolher
      // (saldo devedor > 0). Quando há saldo credor, NÃO gerar pagamentos.
      // -----------------------------------------------
      const saldoDevedor33 = rE110 ? Math.max(0,
        (saidas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.debAjDocFiscal + rE110.debAjustes) -
        (entradas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.credAjDocFiscal + rE110.credAjustes)
      ) : 0;

      if (saldoDevedor33 > 0) {
        const e116Validos = e116Records.filter((e: any) => e.vlOr > 0);
        const totalE116 = e116Validos.reduce((s: number, e: any) => s + e.vlOr, 0);
        let somaPagamentos = 0;

        // Se não há E116, gerar um pagamento único com o valor do imposto a recolher
        if (e116Validos.length === 0) {
          const codRec = '1449';
          const dtVcto = '00000000';
          const valor = fmtVal(saldoDevedor33, 17);
          const classeVcto = '10014';
          const acordo = '000000000000000';
          linhasDime.push(`33` + `12` + `1` + codRec + dtVcto + valor + classeVcto + acordo);
          totalRegsArquivo++;
          totalRegsDecl++;
        } else {
          for (let idxE = 0; idxE < e116Validos.length; idxE++) {
            const e = e116Validos[idxE];
            const isLast = idxE === e116Validos.length - 1;

            const origem = '1'; // 1=Imposto ICMS

            const codRecRaw = (e.codRec || '').replace(/\D/g, '');
            const codRec = codRecRaw.length >= 4
              ? codRecRaw.padStart(4, '0').slice(-4)
              : codRecRaw.length > 0
                ? codRecRaw.padStart(4, '0')
                : '1449';

            let dtVcto = (e.dtVcto || '').replace(/\D/g, '');
            if (dtVcto.length === 8) {
              const anoPos0 = parseInt(dtVcto.substring(0, 4));
              if (anoPos0 >= 1900 && anoPos0 <= 2100) {
                dtVcto = dtVcto.substring(6, 8) + dtVcto.substring(4, 6) + dtVcto.substring(0, 4);
              }
            } else {
              dtVcto = '00000000';
            }

            // Valor ajustado para que a soma dos pagamentos seja igual ao saldo devedor (item 999)
            let valorPgto: number;
            if (totalE116 > 0) {
              if (isLast) {
                valorPgto = saldoDevedor33 - somaPagamentos;
              } else {
                valorPgto = e.vlOr * (saldoDevedor33 / totalE116);
              }
            } else {
              valorPgto = e.vlOr;
            }
            somaPagamentos += valorPgto;
            const valor = fmtVal(valorPgto, 17);

            const classeVcto = '10014';
            const acordo = '000000000000000';

            linhasDime.push(`33` + `12` + origem + codRec + dtVcto + valor + classeVcto + acordo);
            totalRegsArquivo++;
            totalRegsDecl++;
          }
        }
      } // fim if (saldoDevedor33 > 0)

    } // fim if(temMovimento)

    // -----------------------------------------------
    // Registro 98 - Encerramento da Declaração
    // Pos 001/002 = "98" (N, 2)
    // Pos 003/004 = brancos (C, 2)  ← BRANCOS conforme PDF
    // Pos 005/009 = Quantidade registros da declaração, INCLUINDO este (N, 5)  ← 5 DÍGITOS
    // Total = 9 chars
    // -----------------------------------------------
    // +1 para incluir o próprio reg 98 na contagem
    totalRegsDecl++; // conta o reg 98 antes de calcular
    const qtdReg98 = fmtN(totalRegsDecl, 5);
    linhasDime.push(`98  ` + qtdReg98);
    totalRegsArquivo++;

    // -----------------------------------------------
    // Registro 99 - Fechamento do Arquivo
    // Pos 001/002 = "99" (C, 2)
    // Pos 003/004 = brancos (C, 2)  ← BRANCOS conforme PDF
    // Pos 005/009 = Quantidade total de registros no arquivo, INCLUINDO este (N, 5)  ← 5 DÍGITOS
    // Pos 010/014 = Quantidade de declarações de ICMS (N, 5)
    // Total = 14 chars
    // -----------------------------------------------
    totalRegsArquivo++; // conta o próprio reg 99
    const qtdTotal99 = fmtN(totalRegsArquivo, 5);
    linhasDime.push(`99  ` + qtdTotal99 + `00001`);

    // === Final file ===
    // Final de registros: códigos decimais 13 e 10 (CR+LF) conforme item 1.1.3 do PDF
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
      linhas: totalRegsArquivo,
      total_participantes: 0,
      total_produtos: 0,
      debitos: rE110 ? (saidas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.debAjDocFiscal + rE110.debAjustes).toFixed(2).replace('.', ',') : '0,00',
      creditos: rE110 ? (entradas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.credAjDocFiscal + rE110.credAjustes + (rE110.saldoCredorAnt || 0)).toFixed(2).replace('.', ',') : '0,00',
      saldo: 'DIME-SC GERADO',
      sped_type: 'DIMESC'
    });

    const debitosApur = rE110 ? (saidas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.debAjDocFiscal + rE110.debAjustes) : 0;
    const creditosApur = rE110 ? (entradas.reduce((s: number, c: any) => s + c.vlIcms, 0) + rE110.credAjDocFiscal + rE110.credAjustes + (rE110.saldoCredorAnt || 0)) : 0;
    const saldoApur = rE110 ? Math.max(0, debitosApur - creditosApur) : 0;
    const saldoCredor = rE110 ? Math.max(0, creditosApur - debitosApur) : 0;

    return Response.json({
      success: true,
      arquivoGerado: nomeDime,
      conteudo: conteudoFinal,
      linhasGeradas: totalRegsArquivo,
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
        format: 'Portaria SEF 153/2012 Anexo II - layout posicional oficial'
      },
      spedId: spedRecord.id
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});