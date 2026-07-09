import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { xmls, clienteId } = body;

    if (!xmls || xmls.length === 0) {
      return Response.json({ success: false, error: 'Nenhum arquivo XML enviado.' }, { status: 400 });
    }

    // Busca o cliente selecionado
    const clientes = await base44.entities.ClienteSped.list();
    const clienteAtivo = clientes.find(c => c.id === clienteId);
    if (!clienteAtivo) {
      return Response.json({ success: false, error: 'Cliente não localizado.' }, { status: 404 });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    let linhasSped = [];
    let contadorLinhas = 0;
    let mapaParticipantes = {};
    let mapaProdutos = {};
    let totalDebitosSaidas = 0;
    let totalCreditosEntradas = 0;

    const adicionarLinha = (conteudo) => {
      linhasSped.push(conteudo);
      contadorLinhas++;
    };

    const indPerfil = clienteAtivo.regime === 'SIMPLES' ? 'B' : 'A';

    // Registro 0000 - Abertura
    const r0000 = [
      '0000', '015', '0', '01062026', '30062026',
      clienteAtivo.razao_social, clienteAtivo.cnpj, clienteAtivo.uf,
      clienteAtivo.ie, clienteAtivo.municipio, '', indPerfil, '1'
    ];
    adicionarLinha(`|${r0000.join('|')}|`);

    let notasFiscaisProcessadas = [];

    // Loop 1: Participantes e Produtos
    xmls.forEach((xmlObj) => {
      try {
        const jsonObj = parser.parse(xmlObj.conteudo);
        const isEventoCancelamento = jsonObj.procEventoNFe !== undefined;
        const tpEvento = jsonObj.procEventoNFe?.evento?.infEvento?.tpEvento;
        const cStatEvento = jsonObj.procEventoNFe?.retEvento?.infEvento?.cStat;
        const nomeContemCancelado = xmlObj.nome.toLowerCase().includes('canc');

        let codSit = '00';
        let nfeObj = null;

        if (isEventoCancelamento && (tpEvento === 110111 || cStatEvento === 101 || cStatEvento === 155)) {
          codSit = '02';
          const chaveNfe = jsonObj.procEventoNFe?.evento?.infEvento?.chNFe || '';
          nfeObj = {
            ide: { tpNF: 1, mod: '55', serie: chaveNfe.substring(22, 25).replace(/^0+/, '') || '1', nNF: chaveNfe.substring(25, 34).replace(/^0+/, '') || '0', dhEmi: '2026-06-15' },
            total: { ICMSTot: { vNF: 0, vProd: 0, vBC: 0, vICMS: 0, vDesc: 0 } },
            det: []
          };
        } else {
          nfeObj = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
          if (nomeContemCancelado) codSit = '02';
          else if (nfeObj && nfeObj.ide?.finNFe === 2) codSit = '06';
        }

        if (!nfeObj) return;
        nfeObj.codSitSped = codSit;
        notasFiscaisProcessadas.push(nfeObj);

        if (codSit === '02' || codSit === '04') return;

        const emit = nfeObj.emit;
        if (emit && emit.CNPJ && !mapaParticipantes[emit.CNPJ]) {
          mapaParticipantes[emit.CNPJ] = { codPart: emit.CNPJ, nome: emit.xNome, cnpj: emit.CNPJ, ie: emit.IE || '', uf: emit.enderEmit?.UF || 'GO', codMun: emit.enderEmit?.cMun || '' };
        }

        const dest = nfeObj.dest;
        if (dest && (dest.CNPJ || dest.CPF)) {
          const docDest = dest.CNPJ || dest.CPF;
          if (!mapaParticipantes[docDest]) {
            mapaParticipantes[docDest] = { codPart: docDest, nome: dest.xNome || 'CONSUMIDOR FINAL', cnpj: dest.CNPJ || '', ie: '', uf: dest.enderDest?.UF || 'GO', codMun: dest.enderDest?.cMun || '' };
          }
        }

        const itens = Array.isArray(nfeObj.det) ? nfeObj.det : [nfeObj.det];
        itens.forEach((item) => {
          if (!item || !item.prod) return;
          const prod = item.prod;
          if (prod.cProd && !mapaProdutos[prod.cProd]) {
            mapaProdutos[prod.cProd] = { codItem: prod.cProd, descrItem: prod.xProd, codBarra: prod.cEAN && prod.cEAN !== 'SEM GTIN' ? prod.cEAN : '', unidInv: prod.uCom || 'UN', tipoItem: '09', codNcm: prod.NCM || '' };
          }
        });
      } catch (err) {
        console.error('Erro no Loop 1:', err.message);
      }
    });

    // Bloco 0 - Tabelas 0150 e 0200
    Object.values(mapaParticipantes).forEach((p) => adicionarLinha(`|0150|${p.codPart}|${p.nome}|1058|${p.cnpj}||${p.ie}|${p.codMun}|||`));
    Object.values(mapaProdutos).forEach((prod) => adicionarLinha(`|0200|${prod.codItem}|${prod.descrItem}|${prod.codBarra}||${prod.unidInv}|${prod.tipoItem}|${prod.codNcm}|||||`));

    // Loop 2: Bloco C - Registros Fiscais
    notasFiscaisProcessadas.forEach((nfeObj) => {
      const ide = nfeObj.ide;
      const total = nfeObj.total?.ICMSTot;
      if (!ide || !total) return;

      const codSit = nfeObj.codSitSped;
      const modeloNota = String(ide.mod);
      const indicadorOperacao = parseInt(ide.tpNF, 10);
      const dataEmissao = ide.dhEmi ? ide.dhEmi.substring(0, 10).replace(/-/g, '') : '';
      const codPartVinculado = indicadorOperacao === 0 ? nfeObj.emit?.CNPJ : (nfeObj.dest?.CNPJ || nfeObj.dest?.CPF || '');
      const isCancelada = (codSit === '02' || codSit === '04');

      const vNF = isCancelada ? '0,00' : (total.vNF?.toFixed(2).replace('.', ',') || '0,00');
      const vProd = isCancelada ? '0,00' : (total.vProd?.toFixed(2).replace('.', ',') || '0,00');
      const vBC = isCancelada ? '0,00' : (total.vBC?.toFixed(2).replace('.', ',') || '0,00');
      const vICMS = isCancelada ? '0,00' : (total.vICMS?.toFixed(2).replace('.', ',') || '0,00');
      const vDesc = isCancelada ? '0,00' : (total.vDesc?.toFixed(2).replace('.', ',') || '0,00');

      adicionarLinha(`|C100|${indicadorOperacao}|0|${isCancelada ? '' : codPartVinculado}|${modeloNota}|${codSit}|${ide.serie}|${ide.nNF}|${nfeObj['@_Id']?.replace('NFe', '') || ''}|${dataEmissao}|${dataEmissao}|${vNF}|0|${vDesc}|0,00|${vProd}|0,00|0,00|0,00|${vBC}|${vICMS}|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|`);

      if (isCancelada) return;

      const itens = Array.isArray(nfeObj.det) ? nfeObj.det : [nfeObj.det];
      let resumoAnalitico = {};

      itens.forEach((item) => {
        if (!item) return;
        const prod = item.prod;
        const imposto = item.imposto?.ICMS;
        let cst = '00', itemBc = 0, pICMS = 0, itemIcms = 0;

        if (imposto) {
          const subTagIcms = Object.values(imposto)[0];
          if (subTagIcms) {
            cst = subTagIcms.CST || subTagIcms.CSOSN || '00';
            itemBc = parseFloat(subTagIcms.vBC) || 0;
            pICMS = parseFloat(subTagIcms.pICMS) || 0;
            itemIcms = parseFloat(subTagIcms.vICMS) || 0;
          }
        }

        if (indicadorOperacao === 1) totalDebitosSaidas += itemIcms;
        else if (indicadorOperacao === 0) totalCreditosEntradas += itemIcms;

        const itemProdVal = parseFloat(prod.vProd) || 0;
        const cfop = prod.CFOP || '5102';

        if (modeloNota !== '65' && codSit !== '06') {
          adicionarLinha(`|C170|${item['@_nItem']}|${prod.cProd}|${prod.xProd}|${prod.NCM}||${prod.uCom}|${prod.qCom?.toFixed(5).replace('.', ',')}|${prod.vUnCom?.toFixed(5).replace('.', ',')}|${itemProdVal.toFixed(2).replace('.', ',')}|0,00|1|${cst}|${cfop}|${prod.cEAN || ''}|${itemBc.toFixed(2).replace('.', ',')}|${pICMS.toFixed(2).replace('.', ',')}|${itemIcms.toFixed(2).replace('.', ',')}|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|`);
        }

        const chaveAnalitica = `${cst}-${cfop}-${pICMS.toFixed(2)}`;
        if (!resumoAnalitico[chaveAnalitica]) {
          resumoAnalitico[chaveAnalitica] = { cst, cfop, aliquota: pICMS, vlrOperacao: 0, vlrBcIcms: 0, vlrIcms: 0 };
        }
        resumoAnalitico[chaveAnalitica].vlrOperacao += itemProdVal;
        resumoAnalitico[chaveAnalitica].vlrBcIcms += itemBc;
        resumoAnalitico[chaveAnalitica].vlrIcms += itemIcms;
      });

      Object.values(resumoAnalitico).forEach((analitico) => {
        adicionarLinha(`|C190|${analitico.cst}|${analitico.cfop}|${analitico.aliquota.toFixed(2).replace('.', ',')}|${analitico.vlrOperacao.toFixed(2).replace('.', ',')}|${analitico.vlrBcIcms.toFixed(2).replace('.', ',')}|${analitico.vlrIcms.toFixed(2).replace('.', ',')}|0,00|0,00|0,00|0,00||`);
      });
    });

    // Bloco E - Apuração do ICMS
    adicionarLinha('|E100|01062026|30062026|');

    let saldoApurado = totalDebitosSaidas - totalCreditosEntradas;
    let impostoARecolher = saldoApurado > 0 ? saldoApurado : 0;
    let saldoCredorTransportar = saldoApurado < 0 ? Math.abs(saldoApurado) : 0;

    const rE110 = [
      'E110', totalDebitosSaidas.toFixed(2).replace('.', ','),
      '0,00', '0,00', totalCreditosEntradas.toFixed(2).replace('.', ','),
      '0,00', '0,00', '0,00',
      saldoApurado > 0 ? '0,00' : saldoCredorTransportar.toFixed(2).replace('.', ','),
      impostoARecolher.toFixed(2).replace('.', ','),
      '0,00', impostoARecolher.toFixed(2).replace('.', ','),
      '0,00', '0,00'
    ];
    adicionarLinha(`|${rE110.join('|')}|`);

    if (impostoARecolher > 0) {
      const rE116 = ['E116', '000', impostoARecolher.toFixed(2).replace('.', ','), '10072026', '0462', '', '', '', '', '', ''];
      adicionarLinha(`|${rE116.join('|')}|`);
    }

    // Bloco 9 - Encerramento
    contadorLinhas++;
    adicionarLinha(`|9999|${contadorLinhas}|`);

    // Gera nome do arquivo
    const prefixoEmpresa = clienteAtivo.razao_social.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const nomeDoArquivoFinal = `SPED_${prefixoEmpresa}_${Date.now()}.txt`;
    const conteudoFinal = linhasSped.join('\r\n');
    const tamanhoKb = Math.round((conteudoFinal.length / 1024) * 100) / 100;

    const saldoTexto = impostoARecolher > 0
      ? `A RECOLHER: R$ ${impostoARecolher.toFixed(2)}`
      : `CREDOR TRANSPORTADO: R$ ${saldoCredorTransportar.toFixed(2)}`;

    // Salva no banco
    const spedRecord = await base44.entities.SpedFile.create({
      cliente_id: clienteAtivo.id,
      cliente_nome: clienteAtivo.razao_social,
      nome_arquivo: nomeDoArquivoFinal,
      conteudo: conteudoFinal,
      tamanho_kb: tamanhoKb,
      linhas: contadorLinhas,
      total_participantes: Object.keys(mapaParticipantes).length,
      total_produtos: Object.keys(mapaProdutos).length,
      debitos: totalDebitosSaidas.toFixed(2),
      creditos: totalCreditosEntradas.toFixed(2),
      saldo: saldoTexto
    });

    return Response.json({
      success: true,
      arquivoGerado: nomeDoArquivoFinal,
      linhasGeradas: contadorLinhas,
      totalParticipantes: Object.keys(mapaParticipantes).length,
      totalProdutos: Object.keys(mapaProdutos).length,
      apuracao: {
        debitos: totalDebitosSaidas.toFixed(2),
        creditos: totalCreditosEntradas.toFixed(2),
        saldo: saldoTexto
      },
      spedId: spedRecord.id
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});