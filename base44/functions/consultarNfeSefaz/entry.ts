import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  DFE_URL, DFE_NS, DFE_WSDL, UF_CODE, getTag, decodeXml, signDistDFe, gunzipB64,
} from '../../shared/dfeUtils.ts';

function parseProcNfe(xml) {
  const emitM = String(xml).match(/<emit>[\s\S]*?<\/emit>/);
  const emit = emitM ? emitM[0] : '';
  const enderM = emit.match(/<enderEmit>[\s\S]*?<\/enderEmit>/);
  const detBlocks = String(xml).match(/<det[\s\S]*?<\/det>/g) || [];
  return {
    chave_acesso: getTag(xml, 'chNFe'),
    nota_number: getTag(xml, 'nNF'),
    nota_series: getTag(xml, 'serie'),
    issue_date: getTag(xml, 'dhEmi'),
    supplier_name: decodeXml(getTag(emit, 'xNome')),
    supplier_cnpj: getTag(emit, 'CNPJ') || getTag(emit, 'CPF'),
    supplier_uf: enderM ? getTag(enderM[0], 'UF') : '',
    total_nota: Number(getTag(xml, 'vNF')) || 0,
    items: detBlocks.map(b => ({
      product_code: decodeXml(getTag(b, 'cProd')),
      barcode: getTag(b, 'cEAN'),
      product_name: decodeXml(getTag(b, 'xProd')),
      ncm: getTag(b, 'NCM'),
      cfop: getTag(b, 'CFOP'),
      unit: getTag(b, 'uCom') || getTag(b, 'uTrib'),
      quantity: Number(getTag(b, 'qCom')) || 0,
      unit_price: Number(getTag(b, 'vUnCom')) || 0,
      total: Number(getTag(b, 'vProd')) || 0,
    })),
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Usuário não autenticado.' }, { status: 401 });

    const body = await req.json();
    const chave = String((body && body.chave) || '').replace(/\D/g, '');
    const ambiente = String((body && body.ambiente) || '1');
    if (chave.length !== 44) {
      return Response.json({ success: false, error: 'Chave de acesso inválida — informe os 44 dígitos da NF-e.' });
    }

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

    // distDFeInt — consulta pela chave de acesso
    const distXml = '<distDFeInt xmlns="' + DFE_NS + '" versao="1.01"><tpAmb>' + ambiente + '</tpAmb><cUFAutor>' + UF_CODE[uf] + '</cUFAutor><CNPJ>' + cnpj + '</CNPJ><consChave><chNFe>' + chave + '</chNFe></consChave></distDFeInt>';
    const signedDist = signDistDFe(distXml, pfxBytes, activeCert.password);

    const soap =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap:Header><nfeCabecMsg xmlns="' + DFE_WSDL + '"><cUF>' + UF_CODE[uf] + '</cUF><versaoDados>1.01</versaoDados></nfeCabecMsg></soap:Header>' +
      '<soap:Body><nfeDadosMsg xmlns="' + DFE_WSDL + '">' + signedDist + '</nfeDadosMsg></soap:Body>' +
      '</soap:Envelope>';

    const url = ambiente === '2' ? DFE_URL.hom : DFE_URL.prod;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8; action="' + DFE_WSDL + '/nfeDistDFeInteresse"' },
      body: soap,
    });
    const respText = await resp.text();

    const cStat = getTag(respText, 'cStat');
    const xMotivo = decodeXml(getTag(respText, 'xMotivo'));
    if (cStat !== '138') {
      return Response.json({ success: false, cStat, xMotivo: xMotivo || 'Documento não localizado na SEFAZ (http ' + resp.status + ').' });
    }

    // loteDistDFeInt → docZip (procNFe compactado em gzip base64)
    const zips = respText.match(/<docZip[^>]*>[^<]+<\/docZip>/g) || [];
    if (!zips.length) {
      return Response.json({ success: false, cStat, xMotivo: 'Resposta da SEFAZ sem documento (docZip).' });
    }
    const procZip = zips.find(z => z.includes('procNFe')) || zips[0];
    const procXml = await gunzipB64(procZip.replace(/<[^>]+>/g, ''));

    const nota = parseProcNfe(procXml);
    return Response.json({ success: true, cStat, xMotivo, nota });
  } catch (e) {
    return Response.json({ success: false, error: 'Erro na consulta SEFAZ: ' + (e && e.message ? e.message : String(e)) });
  }
}