// Módulo compartilhado de assinatura digital XMLDSig para NF-e/NFC-e.
// Implementa canonicalização C14N (Canonical XML 1.0 sem comentários) focada
// no elemento infNFe e assinatura RSA-SHA256 (PKCS#1 v1.5) com node-forge.
import forge from 'npm:node-forge@1.3.1';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const SIG_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';

/**
 * Extrai e canonicaliza o elemento infNFe do XML da NF-e.
 * Como o elemento infNFe herda o namespace default de <NFe>, a forma canônica
 * isolada deve incluir xmlns="http://www.portalfiscal.inf.br/nfe".
 */
function canonicalizeInfNFe(xml: string): string {
  const startIdx = xml.indexOf('<infNFe');
  if (startIdx === -1) throw new Error('Elemento infNFe não encontrado no XML');
  const endTag = '</infNFe>';
  const endIdx = xml.indexOf(endTag, startIdx);
  if (endIdx === -1) throw new Error('Fim do elemento infNFe não encontrado');
  const block = xml.slice(startIdx, endIdx + endTag.length);

  // Substitui a tag de abertura adicionando o namespace default herdado
  // (removendo qualquer xmlns já presente para evitar duplicidade).
  return block.replace(/<infNFe([^>]*)>/, (_m, attrs: string) => {
    const cleanAttrs = attrs.replace(/\s+xmlns="[^"]*"/g, '');
    return `<infNFe xmlns="${NFE_NS}"${cleanAttrs}>`;
  });
}

function sha256Base64(data: string): string {
  const md = forge.md.sha256.create();
  md.update(data, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
}

/**
 * Carrega certificado + chave privada de um buffer PFX (PKCS#12).
 */
export function loadPfx(pfxBytes: Uint8Array, password: string) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBytes));
  const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.keyBag });
  const pkcs8Bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const cert = (certBags[forge.pki.oids.certBag] || [])[0]?.cert;
  const key = (keyBags[forge.pki.oids.keyBag] || [])[0]?.key ||
    (pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]?.key;
  if (!cert || !key) throw new Error('Certificado ou chave privada não encontrados no PFX');
  return { cert, key };
}

/**
 * Assina o XML da NF-e (não assinado) inserindo o elemento <Signature> XMLDSig
 * logo após </infNFe>. Retorna o XML assinado.
 */
export function signNFe(xml: string, pfxBytes: Uint8Array, password: string): string {
  const { cert, key } = loadPfx(pfxBytes, password);

  const infNFeCanonical = canonicalizeInfNFe(xml);
  const digestValue = sha256Base64(infNFeCanonical);

  const idMatch = infNFeCanonical.match(/Id="([^"]+)"/);
  const infId = idMatch ? idMatch[1] : '';
  if (!infId) throw new Error('Id do infNFe não encontrado');

  // SignedInfo na forma canônica (namespace default herdado de <Signature>).
  const signedInfo = `<SignedInfo xmlns="${DSIG_NS}"><CanonicalizationMethod Algorithm="${C14N_ALG}"></CanonicalizationMethod><SignatureMethod Algorithm="${SIG_ALG}"></SignatureMethod><Reference URI="#${infId}"><Transforms><Transform Algorithm="${C14N_ALG}"></Transform></Transforms><DigestMethod Algorithm="${DIGEST_ALG}"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  // Assina o SignedInfo canonicalizado com RSA-SHA256 (PKCS#1 v1.5).
  const md = forge.md.sha256.create();
  md.update(signedInfo, 'utf8');
  const signatureValue = forge.util.encode64(key.sign(md));

  // Certificado X509 em base64 (DER).
  const certDerB64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  );

  const signature = `<Signature xmlns="${DSIG_NS}"><SignedInfo><CanonicalizationMethod Algorithm="${C14N_ALG}"></CanonicalizationMethod><SignatureMethod Algorithm="${SIG_ALG}"></SignatureMethod><Reference URI="#${infId}"><Transforms><Transform Algorithm="${C14N_ALG}"></Transform></Transforms><DigestMethod Algorithm="${DIGEST_ALG}"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo><SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  // Insere a assinatura imediatamente após </infNFe>.
  const endIdx = xml.indexOf('</infNFe>');
  if (endIdx === -1) throw new Error('Fim do infNFe não encontrado para inserir assinatura');
  return xml.slice(0, endIdx + '</infNFe>'.length) + signature + xml.slice(endIdx + '</infNFe>'.length);
}