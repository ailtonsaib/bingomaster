import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function getTags(text: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp('<' + tag + '>([^<]*)</' + tag + '>', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { email, nfse_id } = body;

    if (!email || !nfse_id) return Response.json({ error: 'Email e nfse_id obrigatórios' }, { status: 400 });
    const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
    if (users.length === 0) return Response.json({ error: 'Usuário não encontrado' }, { status: 403 });

    let nfse: any = null;
    try { const l = await base44.asServiceRole.entities.Nfse.filter({ id: nfse_id }); if (l.length) nfse = l[0]; } catch (_) { /* id inválido */ }
    if (!nfse || nfse.user_email !== email) return Response.json({ error: 'NFS-e não encontrada' }, { status: 404 });
    if (!nfse.rps_xml) return Response.json({ error: 'RPS não gerado. Gere a NFS-e primeiro.' }, { status: 400 });
    if (!nfse.rps_xml.includes('<Signature')) return Response.json({ error: 'RPS não está assinado. Cadastre um certificado A1 ativo com modelo NFS-e.' }, { status: 400 });

    const cfgs = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({ user_email: email });
    const company: any = cfgs[0];
    if (!company || !company.nfse_webservice_url) {
      return Response.json({ error: 'URL do webservice NFS-e da prefeitura não configurada. Defina em "Configurar NFS-e".' }, { status: 400 });
    }

    // Extrai o bloco EnviarLoteRpsEnvio (sem o prolog) para o corpo SOAP.
    const start = nfse.rps_xml.indexOf('<EnviarLoteRpsEnvio');
    const end = nfse.rps_xml.indexOf('</EnviarLoteRpsEnvio>') + '</EnviarLoteRpsEnvio>'.length;
    if (start === -1 || end <= start) return Response.json({ error: 'RPS XML malformado.' }, { status: 400 });
    const loteBlock = nfse.rps_xml.slice(start, end);

    // Envelope SOAP genérico Abrasf (RecepcionarLoteRps). Cidades variam; a URL
    // e a action exata são definidas na configuração da prefeitura.
    const soap =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n' +
      '<soap:Body>\n' +
      loteBlock + '\n' +
      '</soap:Body>\n' +
      '</soap:Envelope>';

    let respText = '';
    let httpStatus = 0;
    try {
      const resp = await fetch(company.nfse_webservice_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"http://www.abrasf.org.br/nfse.xsd/RecepcionarLoteRps"',
        },
        body: soap,
      });
      httpStatus = resp.status;
      respText = await resp.text();
    } catch (e) {
      return Response.json({ success: false, error: 'Falha ao conectar à prefeitura: ' + (e as Error).message });
    }

    // Parse da resposta Abrasf
    const numeroNfse = getTags(respText, 'NumeroNfse')[0] || '';
    const protocolo = getTags(respText, 'Protocolo')[0] || '';
    const codigos = getTags(respText, 'Codigo');
    const mensagens = getTags(respText, 'Mensagem');
    const sucesso = !!numeroNfse && codigos.length === 0;

    const statusText = sucesso
      ? 'Autorizada — NFS-e ' + numeroNfse
      : (codigos.length ? codigos.map((c, i) => c + ': ' + (mensagens[i] || '')).join('; ') : 'Sem resposta de NFS-e (http ' + httpStatus + ')');

    if (sucesso) {
      await base44.asServiceRole.entities.Nfse.update(nfse_id, {
        nfse_number: numeroNfse,
        nfse_protocol: protocolo,
        nfse_status: statusText,
        nfse_auth_date: new Date().toISOString(),
        status: 'emitida',
        nfse_xml: respText,
      });
      return Response.json({ success: true, nfse_number: numeroNfse, protocolo, status: statusText });
    }

    await base44.asServiceRole.entities.Nfse.update(nfse_id, { nfse_status: statusText });
    return Response.json({
      success: false,
      statusText,
      httpStatus,
      codigos,
      mensagens,
      rawResponse: respText.slice(0, 2000),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});