import forge from 'npm:node-forge@1.3.1';
import { loadPfx } from './nfeSigner.ts';

// Utilitários compartilhados do serviço Nacional de Distribuição de Documentos
// Fiscais (NFeDistribuicaoDFe) — usados pela consulta por chave de acesso
// (consultarNfeSefaz) e pelo Radar Fiscal (radarFiscal).

export const DFE_URL = {
  hom: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  prod: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};
export const DFE_NS = 'http://www.portalfiscal.inf.br/nfe';
export const DFE_WSDL = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';
export const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
export const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
export const SIG_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
export const DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';

export const UF_CODE = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26',
  PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
  SE: '28', SP: '35', TO: '17',
};

export function getTag(text, tag) {
  const m = String(text).match(new RegExp('<' + tag + '>[^<]*</' + tag + '>'));
  return m ? m[0].replace(new RegExp('</?' + tag + '>'), '').replace(new RegExp('</?' + tag + '>$'), '') : '';
}

export function decodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function sha256Base64(data) {
  const md = forge.md.sha256.create();
  md.update(data, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
}

// Assina o distDFeInt (enveloped, Reference URI vazia — digest do elemento sem a assinatura)
export function signDistDFe(distXml, pfxBytes, password) {
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

export async function gunzipB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder('utf-8').decode(buf);
}