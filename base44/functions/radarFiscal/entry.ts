import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DFE_URL, DFE_NS, DFE_WSDL, UF_CODE, getTag, decodeXml, signDistDFe, gunzipB64,
} from '../../shared/dfeUtils.ts';

// Radar Fiscal: consulta a caixa postal de documentos destinados à empresa no
// serviço nacional de Distribuição de Documentos Fiscais (distNSU) e devolve
// os resumos de todas as NF-e e CT-e emitidas contra o CNPJ da empresa — o
// painel do ERP compara com as entradas e CT-e já lançados para apontar os
// documentos que ainda não tiveram entrada no sistema.

const MAX_PAGES = 8;

// Chave de acesso (44 dígitos): [18-19] modelo, [20-21] série, [22-30] número
function chaveInfo(chave) {
  return { modelo: chave.slice(18, 20), serie: chave.slice(20, 22), numero: chave.slice(22, 31) };
}

// Converte o documento (resumo resNFe/resCTe ou XML completo procNFe/procCTe)
// em uma linha do radar
function parseDoc(tipo, xml, nsu) {
  const s = String(xml);
  const chave = getTag(s, 'chNFe') || getTag(s, 'chCTe') || (s.match(/Id="(?:NFe|CTe)(\d{44})"/) || [])[1] || '';
  const emitBlock = s.match(/<emit>[\s\S]*?<\/emit>/);
  const emitente_cnpj = emitBlock ? (getTag(emitBlock[0], 'CNPJ') || getTag(emitBlock[0], 'CPF')) : (getTag(s, 'CNPJ') || getTag(s, 'CPF'));
  const emitente_nome = emitBlock ? decodeXml(getTag(emitBlock[0], 'xNome')) : decodeXml(getTag(s, 'xNome'));
  const emissao = (getTag(s, 'dhEmi') || '').slice(0, 10);
  const valor = Math.round(((Number(getTag(s, 'vNF')) || Number(getTag(s, 'vTPrest')) || Number(getTag(s, 'vPrest')) || 0) * 100)) / 100;
  const sit = getTag(s, 'cSitNFe') || getTag(s, 'cSitCTe');
  let situacao = { '1': 'Autorizada', '2': 'Cancelada', '3': 'Denegada' }[sit];
  if (!situacao) {
    if (/<cStat>101</.test(s) || /<cStat>135</.test(s)) situacao = 'Cancelada';
    else if (/<cStat>30[12]</.test(s)) situacao = 'Denegada';
    else situacao = 'Autorizada';
  }
  const info = chaveInfo(chave);
  return { nsu, tipo, chave, numero: info.numero, serie: info.serie, modelo: info.modelo, emissao, emitente_cnpj, emitente_nome, valor, situacao };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Usuário não autenticado.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ambiente = String((body && body.ambiente) || '1');
    let nsu = Number((body && body.ultNsu) || 0) || 0;

    // Empresa destinatária (cadastro do ERP) — CNPJ autor da consulta
    const companies = await base44.entities.ErpCompany.filter({ user_email: user.email });
    const company = companies[0];
    if (!company) return Response.json({ success: false, error: 'Cadastro da empresa não encontrado — configure os dados da empresa no módulo Administrativo.' });
    const cnpj = String(company.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) return Response.json({ success: false, error: 'CNPJ da empresa não configurado no cadastro da empresa.' });
    const uf = String(company.uf || '').toUpperCase();
    if (!UF_CODE[uf]) return Response.json({ success: false, error: 'UF da empresa não configurada no cadastro da empresa.' });

    // Certificado digital A1 ativo (modelo NFe)
    const certs = await base44.entities.DigitalCertificate.filter({ user_email: user.email, is_active: true });
    const activeCert = certs.find(c => String(c.modelos || '').includes('NFe') && (!c.valid_to || new Date(c.valid_to) > new Date()));
    if (!activeCert) return Response.json({ success: false, error: 'Nenhum certificado digital A1 ativo (modelo NFe) configurado.' });
    const signedUrl = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: activeCert.file_uri, expires_in: 120 });
    const pfxResp = await fetch(signedUrl.signed_url);
    if (!pfxResp.ok) return Response.json({ success: false, error: 'Falha ao ler o arquivo do certificado digital.' });
    const pfxBytes = new Uint8Array(await pfxResp.arrayBuffer());
    await base44.entities.DigitalCertificate.update(activeCert.id, { last_used_at: new Date().toISOString() });

    const url = ambiente === '2' ? DFE_URL.hom : DFE_URL.prod;
    const docs = [];
    let temMais = false;
    let maxNsu = '';
    let lastStatus = null;

    // distNSU: percorre a caixa postal em lotes de 50 documentos (resumos)
    for (let page = 0; page < MAX_PAGES; page++) {
      const distXml = '<distDFeInt xmlns="' + DFE_NS + '" versao="1.01"><tpAmb>' + ambiente + '</tpAmb><cUFAutor>' + UF_CODE[uf] + '</cUFAutor><CNPJ>' + cnpj + '</CNPJ><distNSU><ultNSU>' + String(nsu).padStart(15, '0') + '</ultNSU></distNSU></distDFeInt>';
      const signedDist = signDistDFe(distXml, pfxBytes, activeCert.password);
      const soap =
        '<?xml version="1.0" encoding="UTF-8?>' +
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
        '<soap:Header><nfeCabecMsg xmlns="' + DFE_WSDL + '"><cUF>' + UF_CODE[uf] + '</cUF><versaoDados>1.01</versaoDados></nfeCabecMsg></soap:Header>' +
        '<soap:Body><nfeDadosMsg xmlns="' + DFE_WSDL + '">' + signedDist + '</nfeDadosMsg></soap:Body>' +
        '</soap:Envelope>';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8; action="' + DFE_WSDL + '/nfeDistDFeInteresse"' },
        body: soap,
      });
      const respText = await resp.text();
      const cStat = getTag(respText, 'cStat');
      const xMotivo = decodeXml(getTag(respText, 'xMotivo'));
      lastStatus = { cStat, xMotivo };
      maxNsu = getTag(respText, 'maxNSU') || maxNsu;
      if (cStat !== '138') break;

      const zips = respText.match(/<docZip[^>]*>[^<]+<\/docZip>/g) || [];
      if (!zips.length) break;
      for (const z of zips) {
        const openTag = (z.match(/<docZip[^>]*>/) || [''])[0];
        const docNsu = (openTag.match(/NSU="(\d+)"/) || [])[1] || '';
        const schema = (openTag.match(/schema="([^"]+)"/) || [])[1] || '';
        if (docNsu) nsu = Math.max(nsu, Number(docNsu));
        if (/evento/i.test(schema)) continue; // eventos de cancelamento/ciência ficam fora do radar
        const isCte = /cte/i.test(schema) || z.includes('<CTe');
        const isNfe = /nfe/i.test(schema) || z.includes('<NFe');
        if (!isCte && !isNfe) continue;
        let xml = '';
        try { xml = await gunzipB64(z.replace(/<[^>]+>/g, '')); } catch (e) { continue; }
        docs.push(parseDoc(isCte ? 'cte' : 'nfe', xml, docNsu));
      }
      if (zips.length < 50) break;
      if (page === MAX_PAGES - 1) temMais = true; // caixa postal maior que o lote consultado
    }

    return Response.json({ success: true, docs, total: docs.length, lastNsu: nsu, maxNsu, temMais, status: lastStatus });
  } catch (e) {
    return Response.json({ success: false, error: 'Erro no radar fiscal: ' + (e && e.message ? e.message : String(e)) });
  }
}