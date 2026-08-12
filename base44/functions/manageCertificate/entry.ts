import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import forge from 'npm:node-forge@1.3.1';

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

    return Response.json({ error: 'Operação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});