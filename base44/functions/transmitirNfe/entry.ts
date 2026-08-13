import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const NFE_AUTH_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';

// Webservices NFeAutorizacao4 por sistema (homologação / produção).
const WS = {
  hom: {
    SP: 'https://homologacao.nfe.fazenda.sp.gov.br/wsdl/nfeautorizacao4.asmx',
    MG: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    PR: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    RS: 'https://nfe-homologacao.sefaz.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    MT: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    BA: 'https://hnfe.sefaz.ba.gov.br/webservices/NfeAutorizacao/NfeAutorizacao4.asmx',
    SVRS: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    SVAN: 'https://hom1.sefazvirtual.fazenda.gov.br/NfeAutorizacao4/NfeAutorizacao4.asmx',
  },
  prod: {
    SP: 'https://nfe.fazenda.sp.gov.br/wsdl/nfeautorizacao4.asmx',
    MG: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    PR: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    RS: 'https://nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    MT: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    BA: 'https://nfe.sefaz.ba.gov.br/webservices/NfeAutorizacao/NfeAutorizacao4.asmx',
    SVRS: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    SVAN: 'https://www.sefazvirtual.fazenda.gov.br/NfeAutorizacao4/NfeAutorizacao4.asmx',
  },
};

const UF_SYSTEM = {
  AC: 'SVRS', AL: 'SVRS', AP: 'SVRS', AM: 'SVRS', BA: 'SVRS', CE: 'SVRS', DF: 'SVRS',
  ES: 'SVRS', GO: 'SVRS', MA: 'SVAN', MG: 'MG', MS: 'SVRS', MT: 'MT', PA: 'SVAN',
  PB: 'SVRS', PE: 'SVRS', PI: 'SVAN', PR: 'PR', RJ: 'SVRS', RN: 'SVRS', RO: 'SVRS',
  RR: 'SVRS', RS: 'RS', SC: 'SVRS', SE: 'SVRS', SP: 'SP', TO: 'SVRS',
};
const UF_CODE = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '25', PB: '15', PE: '26',
  PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
  SE: '28', SP: '35', TO: '17',
};

function getTags(text, tag) {
  const out = [];
  const re = new RegExp('<' + tag + '>([^<]*)</' + tag + '>', 'g');
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Usuário não autenticado.' });

    const body = await req.json();
    const { order_id, uf: ufOverride, ambiente: ambOverride, system: sysOverride } = body;

    if (!order_id) return Response.json({ success: false, error: 'order_id não informado.' });

    const order = await base44.entities.PDVExitOrder.get(order_id);
    if (!order) return Response.json({ success: false, error: 'Pedido não encontrado.' });
    if (order.user_email && order.user_email !== user.email && user.role !== 'admin')
      return Response.json({ success: false, error: 'Sem permissão sobre este pedido.' });
    if (!order.nfe_xml) return Response.json({ success: false, error: 'NF-e ainda não gerada para este pedido.' });
    if (!order.nfe_xml.includes('<Signature'))
      return Response.json({ success: false, error: 'NF-e não está assinada. Gere a NF-e com um certificado A1 ativo antes de transmitir.' });

    // Configuração da empresa emitente
    const configs = await base44.entities.PDVCompanyConfig.filter({ user_email: user.email });
    const company = configs[0];
    if (!company) return Response.json({ success: false, error: 'Configuração da empresa emitente não encontrada.' });

    const uf = (ufOverride || company.uf || '').toUpperCase();
    const ambiente = (ambOverride || company.nfe_environment || '2').toString();
    if (!uf) return Response.json({ success: false, error: 'UF da empresa emitente não definida.' });
    if (!UF_CODE[uf]) return Response.json({ success: false, error: 'UF inválida: ' + uf });

    const system = (sysOverride || UF_SYSTEM[uf] || 'SVRS').toUpperCase();
    const url = (ambiente === '1' ? WS.prod : WS.hom)[system];
    if (!url) return Response.json({ success: false, error: 'Webservice não mapeado para UF ' + uf + ' (sistema ' + system + ').' });

    // Extrai o bloco <NFe>...</NFe> (sem o prolog XML) para embutir no lote.
    const nfeStart = order.nfe_xml.indexOf('<NFe');
    const nfeEnd = order.nfe_xml.indexOf('</NFe>') + '</NFe>'.length;
    if (nfeStart === -1 || nfeEnd <= nfeStart)
      return Response.json({ success: false, error: 'XML da NF-e malformado (bloco <NFe> não encontrado).' });
    const nfeBlock = order.nfe_xml.slice(nfeStart, nfeEnd);

    const idLote = String(Date.now()).slice(-15);
    const enviNFe = '<enviNFe xmlns="' + NFE_NS + '" versao="4.00"><idLote>' + idLote + '</idLote><indSinc>1</indSinc>' + nfeBlock + '</enviNFe>';

    const soap =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">\n' +
      '<soap:Header><nfeCabecMsg xmlns="' + NFE_AUTH_NS + '"><cUF>' + UF_CODE[uf] + '</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap:Header>\n' +
      '<soap:Body><nfeDadosMsg xmlns="' + NFE_AUTH_NS + '">' + enviNFe + '</nfeDadosMsg></soap:Body>\n' +
      '</soap:Envelope>';

    let respText = '';
    let httpStatus = 0;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="' + NFE_AUTH_NS + '/nfeAutorizacaoLote"',
        },
        body: soap,
      });
      httpStatus = resp.status;
      respText = await resp.text();
    } catch (e) {
      return Response.json({ success: false, error: 'Falha ao conectar à SEFAZ: ' + e.message, url });
    }

    // Extrai o bloco <protNFe> da resposta.
    const protStart = respText.indexOf('<protNFe');
    let protBlock = '';
    if (protStart !== -1) {
      const protEnd = respText.indexOf('</protNFe>', protStart);
      protBlock = protEnd !== -1 ? respText.slice(protStart, protEnd + '</protNFe>'.length) : '';
    }

    const loteCStat = getTags(respText, 'cStat')[0] || '';
    const loteXMotivo = getTags(respText, 'xMotivo')[0] || '';
    const protCStat = protBlock ? getTags(protBlock, 'cStat')[0] : '';
    const protXMotivo = protBlock ? getTags(protBlock, 'xMotivo')[0] : '';
    const nProt = protBlock ? getTags(protBlock, 'nProt')[0] : '';
    const chNFe = protBlock ? getTags(protBlock, 'chNFe')[0] : '';
    const dhRecbto = protBlock ? getTags(protBlock, 'dhRecbto')[0] : '';

    const authorized = protCStat === '100' || protCStat === '150';

    if (authorized) {
      await base44.entities.PDVExitOrder.update(order_id, {
        nfe_protocol: nProt,
        nfe_status: protCStat + ' - ' + protXMotivo,
        nfe_auth_date: dhRecbto,
        nfe_environment: ambiente,
      });
      return Response.json({
        success: true,
        authorized: true,
        cStat: protCStat,
        xMotivo: protXMotivo,
        nProt,
        chNFe,
        dhRecbto,
        ambiente,
        uf,
        system,
      });
    }

    // Não autorizado (rejeição, denegação ou ainda em processamento).
    const statusText = protCStat
      ? protCStat + ' - ' + protXMotivo
      : loteCStat
        ? loteCStat + ' - ' + loteXMotivo
        : 'Sem resposta de protocolo (http ' + httpStatus + ')';
    await base44.entities.PDVExitOrder.update(order_id, {
      nfe_status: statusText,
      nfe_environment: ambiente,
    });

    return Response.json({
      success: false,
      authorized: false,
      httpStatus,
      loteCStat,
      loteXMotivo,
      protCStat,
      protXMotivo,
      statusText,
      ambiente,
      uf,
      system,
      rawResponse: respText.slice(0, 2000),
    });
  } catch (e) {
    return Response.json({ success: false, error: 'Erro interno: ' + (e && e.message ? e.message : String(e)) });
  }
});