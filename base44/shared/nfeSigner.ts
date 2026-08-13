// Módulo compartilhado de assinatura digital XMLDSig (RSA-SHA256 / PKCS#1 v1.5)
// para NF-e, NFC-e e NFS-e (Abrasf). Usa canonicalização C14N isolada do elemento
// assinado (infNFe / InfRps) injetando o namespace default herdado.
import forge from 'npm:node-forge@1.3.1';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const SIG_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';

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
 * Assina um elemento XML genérico (com atributo Id) inserindo <Signature>
 * imediatamente após </elementTag>. `ns` é o namespace default herdado pelo
 * elemento (incluído na canonicalização isolada). Retorna o XML assinado.
 */
export function signElement(xml: string, elementTag: string, ns: string, pfxBytes: Uint8Array, password: string): string {
  const { cert, key } = loadPfx(pfxBytes, password);

  const startIdx = xml.indexOf('<' + elementTag);
  if (startIdx === -1) throw new Error('Elemento ' + elementTag + ' não encontrado no XML');
  const endTag = '</' + elementTag + '>';
  const endIdx = xml.indexOf(endTag, startIdx);
  if (endIdx === -1) throw new Error('Fim do elemento ' + elementTag + ' não encontrado');
  const block = xml.slice(startIdx, endIdx + endTag.length);

  // Canonicalização: injeta o namespace default herdado na tag de abertura
  // (remove xmlns já presente para evitar duplicidade).
  const canonical = block.replace(new RegExp('<' + elementTag + '([^>]*)>'), (_m, attrs: string) => {
    const cleanAttrs = attrs.replace(/\s+xmlns="[^"]*"/g, '');
    return '<' + elementTag + ' xmlns="' + ns + '"' + cleanAttrs + '>';
  });

  const digestValue = sha256Base64(canonical);
  const idMatch = canonical.match(/Id="([^"]+)"/);
  const infId = idMatch ? idMatch[1] : '';
  if (!infId) throw new Error('Id não encontrado em ' + elementTag);

  const signedInfo = `<SignedInfo xmlns="${DSIG_NS}"><CanonicalizationMethod Algorithm="${C14N_ALG}"></CanonicalizationMethod><SignatureMethod Algorithm="${SIG_ALG}"></SignatureMethod><Reference URI="#${infId}"><Transforms><Transform Algorithm="${C14N_ALG}"></Transform></Transforms><DigestMethod Algorithm="${DIGEST_ALG}"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  const md = forge.md.sha256.create();
  md.update(signedInfo, 'utf8');
  const signatureValue = forge.util.encode64(key.sign(md));

  const certDerB64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  );

  const signature = `<Signature xmlns="${DSIG_NS}"><SignedInfo><CanonicalizationMethod Algorithm="${C14N_ALG}"></CanonicalizationMethod><SignatureMethod Algorithm="${SIG_ALG}"></SignatureMethod><Reference URI="#${infId}"><Transforms><Transform Algorithm="${C14N_ALG}"></Transform></Transforms><DigestMethod Algorithm="${DIGEST_ALG}"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo><SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  return xml.slice(0, endIdx + endTag.length) + signature + xml.slice(endIdx + endTag.length);
}

/**
 * Compatibilidade: assina o infNFe de NF-e/NFC-e.
 */
export function signNFe(xml: string, pfxBytes: Uint8Array, password: string): string {
  return signElement(xml, 'infNFe', NFE_NS, pfxBytes, password);
}