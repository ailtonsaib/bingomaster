import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser, XMLBuilder } from 'npm:fast-xml-parser@4.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { xmls, clienteId, periodo } = body;

    if (!xmls || xmls.length === 0) {
      return Response.json({ success: false, error: 'Nenhuma NFS-e enviada.' }, { status: 400 });
    }

    const clientes = await base44.entities.ClienteSped.list();
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) {
      return Response.json({ success: false, error: 'Cliente não localizado.' }, { status: 404 });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: true,
      trimValues: true
    });

    const periodCompet = periodo || ''; // formato AAAA-MM
    if (!periodCompet) {
      return Response.json({ success: false, error: 'Período (AAAA-MM) é obrigatório.' }, { status: 400 });
    }
    const [ano, mes] = periodCompet.split('-');
    const periodoApuracao = `${ano}-${mes}`;

    // Helpers
    const num = (v) => {
      const n = parseFloat(String(v || '0').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };

    const limparDoc = (v) => String(v || '').replace(/\D/g, '');

    // Extrai a primeira NFS-e de um XML (pode conter uma ou várias)
    const extrairNfses = (jsonObj) => {
      const lista = [];

      const buscar = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (key === 'Nfse' || key === 'CompNfse') {
            const item = obj[key];
            if (Array.isArray(item)) {
              item.forEach(i => { if (i.InfNfse) lista.push(i); });
            } else if (item.InfNfse) {
              lista.push(item);
            }
          }
          if (key === 'InfNfse') {
            lista.push(obj);
          }
          if (typeof obj[key] === 'object') {
            buscar(obj[key]);
          }
        }
      };

      // Tenta caminhos comuns primeiro
      const caminhos = [
        jsonObj?.ListaNfse?.CompNfse,
        jsonObj?.ListaNfse?.Nfse,
        jsonObj?.CompNfse,
        jsonObj?.Nfse,
        jsonObj?.nfseProc?.Nfse
      ];

      for (const c of caminhos) {
        if (!c) continue;
        if (Array.isArray(c)) {
          c.forEach(item => {
            if (item.InfNfse) lista.push({ InfNfse: item.InfNfse });
          });
        } else if (c.InfNfse) {
          lista.push({ InfNfse: c.InfNfse });
        }
      }

      if (lista.length === 0) {
        buscar(jsonObj);
      }

      return lista;
    };

    // Extrai CNPJ/CPF de um nó de identificação
    const extrairDoc = (noIdent) => {
      if (!noIdent) return { cnpj: '', cpf: '' };
      const cpfCnpj = noIdent.CpfCnpj;
      if (cpfCnpj) {
        return {
          cnpj: limparDoc(cpfCnpj.Cnpj),
          cpf: limparDoc(cpfCnpj.Cpf)
        };
      }
      return {
        cnpj: limparDoc(noIdent.Cnpj),
        cpf: limparDoc(noIdent.Cpf)
      };
    };

    let nfseProcessadas = 0;
    let totalRetencoes = {
      pis: 0, cofins: 0, csll: 0, irrf: 0, cpp: 0
    };

    // Mapa de beneficiários por CNPJ/CPF (tomador ou prestador)
    // R-2010: retenções na fonte (PIS/COFINS/CSLL/IRRF)
    // R-2020: retenção previdenciária (CPP/INSS)
    const beneficiarios = {}; // chave: doc => { tipoDoc, doc, nome, pis, cofins, csll, irrf, cpp, valorServico, itensServico: {} }

    xmls.forEach((xmlObj) => {
      try {
        const jsonObj = parser.parse(xmlObj.conteudo);
        const nfses = extrairNfses(jsonObj);

        if (nfses.length === 0) return;

        nfses.forEach((nfseWrap) => {
          const inf = nfseWrap.InfNfse;
          if (!inf) return;

          nfseProcessadas++;

          // Prestador (quem emitiu a NFS-e)
          const prestador = inf.PrestadorServico || inf.Prestador || {};
          const docPrest = extrairDoc(prestador.IdentificacaoPrestador || prestador.Identificacao);
          const docPrestFinal = docPrest.cnpj || docPrest.cpf;
          const nomePrestador = prestador.RazaoSocial || prestador.xNome || '';

          // Tomador (quem recebeu o serviço e reteve impostos)
          const tomador = inf.TomadorServico || inf.Tomador || {};
          const docTom = extrairDoc(tomador.IdentificacaoTomador || tomador.Identificacao);
          const docTomFinal = docTom.cnpj || docTom.cpf;
          const nomeTomador = tomador.RazaoSocial || tomador.xNome || '';

          // O declarante (cliente cadastrado) pode ser o tomador (retenção) ou o prestador
          // Para REINF, normalmente o declarante é o tomador que reteve impostos
          const cnpjDeclarante = limparDoc(cliente.cnpj);

          // Determina o beneficiário (a outra parte)
          let docBenef, tipoDocBenef, nomeBenef, indObra;
          if (docPrestFinal === cnpjDeclarante) {
            // Declarante é o prestador, beneficiário é o tomador
            docBenef = docTomFinal;
            tipoDocBenef = docTom.cnpj ? '1' : '2'; // 1=CNPJ, 2=CPF
            nomeBenef = nomeTomador || 'Não informado';
          } else {
            // Declarante é o tomador, beneficiário é o prestador
            docBenef = docPrestFinal;
            tipoDocBenef = docPrest.cnpj ? '1' : '2';
            nomeBenef = nomePrestador || 'Não informado';
          }

          if (!docBenef) return;

          // Valores e retenções
          const valores = inf.Servico?.Valores || inf.ValoresNfse || {};
          const valorServico = num(valores.ValorServicos || inf.Servico?.Valores?.ValorServicos);
          const vlrPis = num(valores.ValorPis || valores.ValorPIS);
          const vlrCofins = num(valores.ValorCofins || valores.ValorCOFINS);
          const vlrCsll = num(valores.ValorCsll || valores.ValorCSLL);
          const vlrIrrf = num(valores.ValorIr || valores.ValorIRRF || valores.ValorIrrf);
          const vlrInss = num(valores.ValorInss || valores.ValorINSS || inf.Servico?.Valores?.ValorInss);

          // Item de serviço (lista)
          const itemLista = inf.Servico?.ItemListaServico || inf.Servico?.CodigoServico || '';
          const codAtivEcon = inf.Servico?.CodigoCnae || inf.Servico?.CodigoTributacaoMunicipio || '';

          totalRetencoes.pis += vlrPis;
          totalRetencoes.cofins += vlrCofins;
          totalRetencoes.csll += vlrCsll;
          totalRetencoes.irrf += vlrIrrf;
          totalRetencoes.cpp += vlrInss;

          // Agrupa por beneficiário
          if (!beneficiarios[docBenef]) {
            beneficiarios[docBenef] = {
              tipoDoc: tipoDocBenef,
              doc: docBenef,
              nome: nomeBenef,
              pis: 0, cofins: 0, csll: 0, irrf: 0, cpp: 0,
              valorServico: 0,
              itensServico: {},
              indObra: '2' // 2 = não é obra
            };
          }

          const ben = beneficiarios[docBenef];
          ben.pis += vlrPis;
          ben.cofins += vlrCofins;
          ben.csll += vlrCsll;
          ben.irrf += vlrIrrf;
          ben.cpp += vlrInss;
          ben.valorServico += valorServico;

          // Agrupa por item de serviço
          const chaveItem = String(itemLista || '0000');
          if (!ben.itensServico[chaveItem]) {
            ben.itensServico[chaveItem] = { itemListaServico: chaveItem, valorServico: 0, pis: 0, cofins: 0, csll: 0, irrf: 0, cpp: 0, codAtivEcon: String(codAtivEcon || '') };
          }
          ben.itensServico[chaveItem].valorServico += valorServico;
          ben.itensServico[chaveItem].pis += vlrPis;
          ben.itensServico[chaveItem].cofins += vlrCofins;
          ben.itensServico[chaveItem].csll += vlrCsll;
          ben.itensServico[chaveItem].irrf += vlrIrrf;
          ben.itensServico[chaveItem].cpp += vlrInss;
        });
      } catch (err) {
        console.error('Erro ao processar NFS-e:', err.message);
      }
    });

    if (nfseProcessadas === 0) {
      return Response.json({ success: false, error: 'Nenhuma NFS-e válida encontrada nos arquivos enviados.' }, { status: 400 });
    }

    // Geração dos eventos REINF em XML
    const formatValor = (v) => v.toFixed(2);
    const cnpjDeclarante = limparDoc(cliente.cnpj);

    // R-1000 — Informações do Contribuinte
    const r1000 = {
      evento: {
        '@_id': `ID1${cnpjDeclarante}${ano}${mes}`,
        Reinf: {
          evtInfoContri: {
            '@_id': `ID1${cnpjDeclarante}${ano}${mes}`,
            ideEvento: {
              indRetif: '1',
              tpAmb: '2',
              procEmi: '1',
              verProc: '1.0.0'
            },
            ideContri: {
              tpInsc: '1',
              nrInsc: cnpjDeclarante.substring(0, 8)
            },
            infoContri: {
              idePeriodo: { iniValid: periodoApuracao },
              infoCadastro: {
                classTrib: cliente.regime === 'SIMPLES' ? '03' : (cliente.perfil === 'REAL' ? '02' : '03'),
                indEscrituracao: '1',
                indDesoneracao: '0',
                indAcordoIsenMulta: '0',
                indSitPJ: '0',
                contato: { nmCtt: cliente.razao_social.substring(0, 70), cpfCtt: '00000000000' }
              }
            }
          }
        }
      }
    };

    // R-2010 — Retenções na Fonte (PIS/COFINS/CSLL/IRRF)
    const temRetencoesNaoPrevid = Object.values(beneficiarios).some(b => b.pis > 0 || b.cofins > 0 || b.csll > 0 || b.irrf > 0);

    const eventosR2010 = [];
    if (temRetencoesNaoPrevid) {
      let seqR2010 = 1;
      Object.values(beneficiarios).forEach((ben) => {
        // Só gera R-2010 se houver retenção de PIS/COFINS/CSLL/IRRF
        if (ben.pis === 0 && ben.cofins === 0 && ben.csll === 0 && ben.irrf === 0) return;

        const ideEvtAdicional = {
          indRetif: '1',
          tpAmb: '2',
          procEmi: '1',
          verProc: '1.0.0'
        };

        const ideContri = {
          tpInsc: '1',
          nrInsc: cnpjDeclarante.substring(0, 8)
        };

        const ideEstab = {
          tpInscEstab: ben.tipoDoc,
          nrInscEstab: ben.doc,
          ideEstabObra: { indObra: ben.indObra }
        };

        const nfses = [];
        Object.values(ben.itensServico).forEach((item) => {
          if (item.pis === 0 && item.cofins === 0 && item.csll === 0 && item.irrf === 0) return;
          nfses.push({
            serie: '1',
            numDocto: `${ben.doc}-${item.itemListaServico.substring(0, 5)}`,
            dtEmissao: `${ano}-${mes}-01`,
            vlrBruto: formatValor(item.valorServico),
            vlrBaseRet: formatValor(item.valorServico),
            vlrRetencao: formatValor(item.pis + item.cofins + item.csll + item.irrf),
            vlrRetPC: {
              vlrBaseRetPC: formatValor(item.valorServico),
              vlrRetencaoPC: formatValor(item.pis + item.cofins + item.csll + item.irrf),
              indNatRet: '1'
            },
            infoServicos: {
              itemListaServico: item.itemListaServico.substring(0, 5),
              vlrBaseRet: formatValor(item.valorServico),
              vlrRetencao: formatValor(item.pis + item.cofins + item.csll + item.irrf),
              vlrRetSub: '0.00',
              vlrNRetPrinc: '0.00',
              vlrServicos15: '0.00',
              vlrServicos20: '0.00',
              vlrServicos25: '0.00',
              vlrAdicional: '0.00',
              vlrNRetAdic: '0.00'
            }
          });
        });

        if (nfses.length === 0) return;

        eventosR2010.push({
          Reinf: {
            evtRetPF: {
              '@_id': `ID1${seqR2010}${cnpjDeclarante}${ano}${mes}`,
              ideEvento: ideEvtAdicional,
              ideContri,
              ideEstab,
              nfses: { nfs: nfses }
            }
          }
        });
        seqR2010++;
      });
    }

    // R-2020 — Retenção Previdenciária (CPP/INSS)
    const temRetencoesPrevid = Object.values(beneficiarios).some(b => b.cpp > 0);

    const eventosR2020 = [];
    if (temRetencoesPrevid) {
      let seqR2020 = 1;
      Object.values(beneficiarios).forEach((ben) => {
        if (ben.cpp === 0) return;

        const ideEstab = {
          tpInscEstab: ben.tipoDoc,
          nrInscEstab: ben.doc
        };

        const nfses = [];
        Object.values(ben.itensServico).forEach((item) => {
          if (item.cpp === 0) return;
          nfses.push({
            serie: '1',
            numDocto: `${ben.doc}-${item.itemListaServico.substring(0, 5)}`,
            dtEmissao: `${ano}-${mes}-01`,
            vlrBruto: formatValor(item.valorServico),
            vlrBaseRet: formatValor(item.valorServico),
            vlrRetencao: formatValor(item.cpp),
            vlrRetSub: '0.00',
            vlrNRetPrinc: '0.00',
            vlrServicos15: '0.00',
            vlrServicos20: '0.00',
            vlrServicos25: '0.00',
            vlrAdicional: '0.00',
            vlrNRetAdic: '0.00'
          });
        });

        if (nfses.length === 0) return;

        eventosR2020.push({
          Reinf: {
            evtTomadorServicos: {
              '@_id': `ID2${seqR2020}${cnpjDeclarante}${ano}${mes}`,
              ideEvento: {
                indRetif: '1',
                tpAmb: '2',
                procEmi: '1',
                verProc: '1.0.0'
              },
              ideContri: {
                tpInsc: '1',
                nrInsc: cnpjDeclarante.substring(0, 8)
              },
              ideEstab,
              nfses: { nfs: nfses }
            }
          }
        });
        seqR2020++;
      });
    }

    // R-2099 — Fechamento
    const r2099 = {
      Reinf: {
        evtFechamento: {
          '@_id': `ID9${cnpjDeclarante}${ano}${mes}`,
          ideEvento: {
            indRetif: '1',
            tpAmb: '2',
            procEmi: '1',
            verProc: '1.0.0'
          },
          ideContri: {
            tpInsc: '1',
            nrInsc: cnpjDeclarante.substring(0, 8)
          },
          ideRespInf: {
            nmResp: cliente.razao_social.substring(0, 70),
            cpfResp: '00000000000'
          },
          infoFech: {
            evtServTm: eventosR2020.length > 0 ? 'S' : 'N',
            evtServPr: 'N',
            evtAssDespRec: 'N',
            evtAssDespRep: 'N',
            evtComProd: 'N',
            evtCPRB: 'N',
            evtPgtos: 'N'
          }
        }
      }
    };

    // Monta o XML completo
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  '
    });

    const xmlR1000 = builder.build(r1000);
    const xmlR2099 = builder.build(r2099);

    let xmlsEventos = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlsEventos += `<!-- EFD-REINF - ${cliente.razao_social} - Periodo: ${periodoApuracao} -->\n\n`;
    xmlsEventos += '<!-- ====== R-1000: Evento de Informações do Contribuinte ====== -->\n';
    xmlsEventos += xmlR1000 + '\n\n';

    eventosR2010.forEach((evt, i) => {
      xmlsEventos += `<!-- ====== R-2010 (${i + 1}/${eventosR2010.length}): Retenção na Fonte - PIS/COFINS/CSLL/IRRF ====== -->\n`;
      xmlsEventos += builder.build(evt) + '\n\n';
    });

    eventosR2020.forEach((evt, i) => {
      xmlsEventos += `<!-- ====== R-2020 (${i + 1}/${eventosR2020.length}): Retenção Previdenciária (CPP/INSS) ====== -->\n`;
      xmlsEventos += builder.build(evt) + '\n\n';
    });

    xmlsEventos += '<!-- ====== R-2099: Fechamento ====== -->\n';
    xmlsEventos += xmlR2099;

    const totalBeneficiarios = Object.keys(beneficiarios).length;
    const totalRetido = totalRetencoes.pis + totalRetencoes.cofins + totalRetencoes.csll + totalRetencoes.irrf + totalRetencoes.cpp;

    const nomeArquivo = `REINF_${cliente.razao_social.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${ano}${mes}.xml`;
    const tamanhoKb = Math.round((xmlsEventos.length / 1024) * 100) / 100;
    const linhas = xmlsEventos.split('\n').length;

    const spedRecord = await base44.entities.SpedFile.create({
      cliente_id: cliente.id,
      cliente_nome: cliente.razao_social,
      nome_arquivo: nomeArquivo,
      conteudo: xmlsEventos,
      tamanho_kb: tamanhoKb,
      linhas: linhas,
      total_participantes: totalBeneficiarios,
      total_produtos: nfseProcessadas,
      debitos: formatValor(totalRetido),
      creditos: '0.00',
      saldo: `REINF ${periodoApuracao} - ${eventosR2010.length + eventosR2020.length + 2} eventos`,
      sped_type: 'REINF'
    });

    return Response.json({
      success: true,
      arquivoGerado: nomeArquivo,
      spedId: spedRecord.id,
      conteudo: xmlsEventos,
      periodo: periodoApuracao,
      nfseProcessadas: nfseProcessadas,
      totalBeneficiarios: totalBeneficiarios,
      eventosR2010: eventosR2010.length,
      eventosR2020: eventosR2020.length,
      retencoes: {
        pis: formatValor(totalRetencoes.pis),
        cofins: formatValor(totalRetencoes.cofins),
        csll: formatValor(totalRetencoes.csll),
        irrf: formatValor(totalRetencoes.irrf),
        cpp: formatValor(totalRetencoes.cpp),
        total: formatValor(totalRetido)
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});