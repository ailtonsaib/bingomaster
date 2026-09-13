import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import forge from 'npm:node-forge@1.3.1';
import { loadPfx } from '../../shared/nfeSigner.ts';

// Consulta de NF-e pela chave de acesso no serviço nacional de Distribuição de
// Documentos Fiscais (NFeDistribuicaoDFe) — traz o XML completo da nota em que
// a empresa (CNPJ do cadastro) é destinatária. Usado pelo Recebimento NF do WMS.

const DFE_URL = {
  hom: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  prod: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};
const DFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const DFE_WSDL = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const SIG_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';

const UF_CODE = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26',
  PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
  SE: '28', SP: '35', TO: '17',
};

function getTag(text, tag) {
  const m = String(text).match(new RegExp('<' + tag + '>[^<]*</' + tag + '>'));
  return m ? m[0].replace(new RegExp('</?' + tag + '>'), '').replace(new RegExp('</?' + tag + '>$'), '') : '';
}

function decodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function sha256Base64(data) {
  const md = forge.md.sha256.create();
  md.update(data, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
}

// Assina o distDFeInt (enveloped, Reference URI vazia — digest do elemento sem a assinatura)
function signDistDFe(distXml, pfxBytes, password) {
  const { cert, key } = loadPfx(pfxBytes, password);
  const digestValue = sha256Base64(distXml);
  const signedInfo = '<SignedInfo xmlns="' + DSIG_NS + '"><CanonicalizationMethod Algorithm="' + C14N_ALG + '"></CanonicalizationMethod><SignatureMethod Algorithm="' + SIG_ALG + '"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="' + C14N_ALG + '"></Transform></Transforms><DigestMethod Algorithm="' + DIGEST_ALG + '"></DigestMethod><DigestValue>' + digestValue + '</DigestValue></Reference></SignedInfo>';
  const md = forge.md.sha256.create();
  md.update(signedInfo, 'utf8');
  const signatureValue = forge.util.encode64(key.sign(md));
  const certDerB64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
  const signature = '<Signature xmlns="' + DSIG_NS + '"><SignedInfo><CanonicalizationMethod Algorithm="' + C14N_ALG + '"></CanonicalizationMethod><SignatureMethod Algorithm="' + SIG_ALG + '"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="' + C14N_ALG + '"></Transform></Transforms><DigestMethod Algorithm="' + DIGEST_ALG + '"></DigestMethod><DigestValue>' + digestValue + '</DigestValue></Reference></SignedInfo><SignatureValue>' + signatureValue + '</SignatureValue><KeyInfo><X509Data><X509Certificate>' + certDerB64 + '</X509Certificate></X509Data></KeyInfo></Signature>';
  return distXml.replace('</distDFeInt>', signature + '</distDFeInt>');
}

async function gunzipB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder('utf-8').decode(buf);
}

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