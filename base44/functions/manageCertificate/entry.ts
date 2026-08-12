import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import forge from 'npm:node-forge@1.3.1';
import { signNFe } from '../../shared/nfeSigner.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation, email } = body;

    // ─── Auth (modo público: valida sessão PortalUser) ───
    if (!email) return Response.json({ error: 'Email obrigatório' }, { status: 400 });
    const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
    if (users.length === 0) return Response.json({ error: 'Usuário não encontrado' }, { status: 403 });
    const portalUser = users[0];
    if (!portalUser.is_active) return Response.json({ error: 'Usuário inativo' }, { status: 403 });

    // ─── LISTAR ───
    if (operation === 'list') {
      const certs = await base44.asServiceRole.entities.DigitalCertificate.filter({ user_email: email });
      const now = new Date();
      const enriched = certs.map((c) => {
        let status = c.status || 'valid';
        if (c.valid_to && new Date(c.valid_to) < now) status = 'expired';
        return { ...c, status };
      });
      return Response.json({ success: true, certificates: enriched });
    }

    // ─── UPLOAD (importar A1) ───
    if (operation === 'upload') {
      const { file_uri, password, alias, modelos, file_name } = body;
      if (!file_uri || !password || !alias) {
        return Response.json({ error: 'Arquivo, senha e nome são obrigatórios' }, { status: 400 });
      }
      // Busca o conteúdo binário do PFX via URL assinada
      const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 120 });
      const resp = await fetch(signed.signed_url);
      if (!resp.ok) return Response.json({ error: 'Não foi possível ler o arquivo do certificado.' }, { status: 400 });
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);

      // Parseia o PFX (PKCS#12) com node-forge
      let pfx;
      try {
        const asn1 = forge.asn1.fromDer(forge.util.createBuffer(bytes));
        pfx = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      } catch (_e) {
        return Response.json({ error: 'Senha do certificado incorreta ou arquivo PFX inválido.' }, { status: 400 });
      }

      const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = pfx.getBags({ bagType: forge.pki.oids.keyBag });
      const pkcs8Bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
      const keyBag = (keyBags[forge.pki.oids.keyBag] || [])[0] || (pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
      if (!certBag || !keyBag) {
        return Response.json({ error: 'Certificado ou chave privada não encontrados no PFX.' }, { status: 400 });
      }

      const cert = certBag.cert;
      const dnFromAttrs = (attrs) => attrs.map((a) => `${a.shortName || a.name || a.type}=${a.value}`).join(', ');
      const subjectDn = dnFromAttrs(cert.subject.attributes);
      const issuerDn = dnFromAttrs(cert.issuer.attributes);
      const cnpjMatch = subjectDn.match(/(\d{14})/);
      const cnpj = cnpjMatch ? cnpjMatch[1] : '';
      const validFrom = cert.validity.notBefore.toISOString();
      const validTo = cert.validity.notAfter.toISOString();
      const serialNumber = cert.serialNumber || '';
      const now = new Date();
      const status = new Date(validTo) < now ? 'expired' : 'valid';

      const created = await base44.asServiceRole.entities.DigitalCertificate.create({
        user_email: email,
        alias,
        type: 'A1',
        file_uri,
        file_name: file_name || 'certificado.pfx',
        password,
        subject_dn: subjectDn,
        issuer_dn: issuerDn,
        cnpj,
        serial_number: serialNumber,
        valid_from: validFrom,
        valid_to: validTo,
        modelos: modelos && modelos.length ? modelos : ['NFe'],
        is_active: false,
        status,
      });

      return Response.json({ success: true, certificate: created });
    }

    // ─── ATIVAR (apenas um ativo por conjunto de modelos sobrepostos) ───
    if (operation === 'activate') {
      const { certificate_id } = body;
      let cert = null;
      try {
        const list = await base44.asServiceRole.entities.DigitalCertificate.filter({ id: certificate_id });
        if (list.length > 0) cert = list[0];
      } catch (_) { /* id inválido */ }
      if (!cert || cert.user_email !== email) {
        return Response.json({ error: 'Certificado não encontrado' }, { status: 404 });
      }
      await base44.asServiceRole.entities.DigitalCertificate.update(certificate_id, { is_active: true });
      const all = await base44.asServiceRole.entities.DigitalCertificate.filter({ user_email: email });
      const overlaps = all.filter((c) => c.id !== certificate_id && c.modelos && cert.modelos.some((m) => c.modelos.includes(m)));
      for (const c of overlaps) {
        await base44.asServiceRole.entities.DigitalCertificate.update(c.id, { is_active: false });
      }
      return Response.json({ success: true });
    }

    // ─── DESATIVAR ───
    if (operation === 'deactivate') {
      const { certificate_id } = body;
      await base44.asServiceRole.entities.DigitalCertificate.update(certificate_id, { is_active: false });
      return Response.json({ success: true });
    }

    // ─── EXCLUIR ───
    if (operation === 'delete') {
      const { certificate_id } = body;
      let cert = null;
      try {
        const list = await base44.asServiceRole.entities.DigitalCertificate.filter({ id: certificate_id });
        if (list.length > 0) cert = list[0];
      } catch (_) { /* id inválido */ }
      if (!cert || cert.user_email !== email) {
        return Response.json({ error: 'Certificado não encontrado' }, { status: 404 });
      }
      await base44.asServiceRole.entities.DigitalCertificate.delete(certificate_id);
      return Response.json({ success: true });
    }

    // ─── OBTER ATIVO (para a função de emissão) ───
    if (operation === 'getActive') {
      const { modelo } = body;
      const certs = await base44.asServiceRole.entities.DigitalCertificate.filter({ user_email: email, is_active: true });
      const active = certs.find((c) => c.modelos && c.modelos.includes(modelo));
      return Response.json({ success: true, certificate: active || null });
    }

    // ─── SELF TEST: valida o assinador XMLDSig com um certificado de teste ───
    if (operation === 'selfTest') {
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000);
      const attrs = [
        { name: 'commonName', value: 'TESTE NF-e SELF TEST' },
        { name: 'organizationName', value: '12345678000190' },
      ];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey);

      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'teste123');
      const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
      const pfxBytes = new Uint8Array(Array.from(p12Der).map((c) => c.charCodeAt(0)));

      const sampleXml =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
        '<infNFe Id="NFe35080912345678000190550010000000011000000012" versao="4.00">' +
        '<ide><cUF>35</cUF><mod>55</mod><serie>1</serie><nNF>1</nNF></ide>' +
        '</infNFe></NFe>';

      const signedXml = signNFe(sampleXml, pfxBytes, 'teste123');

      const hasDigest = signedXml.includes('<DigestValue>');
      const hasSig = signedXml.includes('<SignatureValue>');
      const hasX509 = signedXml.includes('<X509Certificate>');

      let rsaOk = false;
      try {
        const sigMatch = signedXml.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);
        const siStart = signedXml.indexOf('<SignedInfo>');
        const siEnd = signedXml.indexOf('</SignedInfo>') + '</SignedInfo>'.length;
        const siInDoc = signedXml.slice(siStart, siEnd);
        const siCanonical = siInDoc.replace('<SignedInfo>', '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">');
        const md = forge.md.sha256.create().update(siCanonical, 'utf8');
        const sigBytes = forge.util.decode64(sigMatch[1]);
        rsaOk = keys.publicKey.verify(md.digest().getBytes(), sigBytes);
      } catch (_) { rsaOk = false; }

      return Response.json({
        success: true,
        signRan: true,
        digestPresent: hasDigest,
        signaturePresent: hasSig,
        x509Present: hasX509,
        rsaSignatureValid: rsaOk,
        signedXmlPreview: signedXml.slice(0, 400),
      });
    }

    return Response.json({ error: 'Operação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});