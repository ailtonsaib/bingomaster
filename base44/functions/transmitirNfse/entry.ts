import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Endpoints do Portal Nacional da NFS-e (Sefin Nacional / Emissor Público).
// Produção: https://sefin.nfse.gov.br/SefinNacional
// Produção Restrita (homologação): https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional
const ENDPOINTS: Record<string, string> = {
  '1': 'https://sefin.nfse.gov.br/SefinNacional',
  '2': 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional',
};

function getTags(text: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>', 'g');
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
    if (!nfse.rps_xml) return Response.json({ error: 'DPS não gerada. Gere a NFS-e primeiro.' }, { status: 400 });
    if (!nfse.rps_xml.includes('<Signature')) return Response.json({ error: 'DPS não está assinada. Cadastre um certificado A1 ativo com modelo NFS-e.' }, { status: 400 });

    const cfgs = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({ user_email: email });
    const company: any = cfgs[0];
    if (!company) return Response.json({ error: 'Empresa não configurada.' }, { status: 400 });
    if (!company.nfse_token) {
      return Response.json({ error: 'Token de acesso do Portal Nacional NFS-e não configurado. Obtenha no portal nfs-e.gov.br e cadastre em "Configurar NFS-e".' }, { status: 400 });
    }

    const amb = String(company.nfse_environment || '2');
    const base = ENDPOINTS[amb] || ENDPOINTS['2'];
    const url = base + '/nfse';

    let resp: Response;
    let respText = '';
    let httpStatus = 0;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + company.nfse_token,
          'Content-Type': 'application/xml',
          'Accept': 'application/json',
        },
        body: nfse.rps_xml,
      });
      httpStatus = resp.status;
      respText = await resp.text();
    } catch (e) {
      return Response.json({ success: false, error: 'Falha ao conectar ao Portal Nacional NFS-e: ' + (e as Error).message });
    }

    // Resposta síncrona: pode vir em JSON ou XML.
    let parsed: any = null;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('json')) {
      try { parsed = JSON.parse(respText); } catch (_) { parsed = null; }
    }

    const chaveAcesso = parsed?.chaveAcesso || parsed?.chave || getTags(respText, 'chaveAcesso')[0] || getTags(respText, 'ChaveAcesso')[0] || '';
    const numero = parsed?.numero || parsed?.numeroNfse || parsed?.numeroNFS_e || getTags(respText, 'Numero')[0] || getTags(respText, 'nNFS')[0] || '';

    const erros: any[] = parsed?.mensagens || parsed?.erros || parsed?.errosDetalhados || [];
    const sucesso = (httpStatus === 200 || httpStatus === 201) && (!!chaveAcesso || !!numero) && erros.length === 0;

    const statusText = sucesso
      ? 'Autorizada — NFS-e ' + (numero || chaveAcesso)
      : (erros.length ? erros.map((e: any) => `${e.codigo || e.codigoErro || 'X'}: ${e.descricao || e.mensagem || JSON.stringify(e)}`).join('; ')
         : (parsed?.erro || parsed?.message || `Resposta ${httpStatus}`));

    if (sucesso) {
      await base44.asServiceRole.entities.Nfse.update(nfse_id, {
        nfse_number: numero || chaveAcesso,
        nfse_protocol: chaveAcesso,
        nfse_status: statusText,
        nfse_auth_date: new Date().toISOString(),
        status: 'emitida',
        nfse_xml: respText,
      });
      return Response.json({ success: true, nfse_number: numero || chaveAcesso, protocolo: chaveAcesso, status: statusText });
    }

    await base44.asServiceRole.entities.Nfse.update(nfse_id, { nfse_status: statusText });
    return Response.json({
      success: false,
      statusText,
      httpStatus,
      erros,
      rawResponse: respText.slice(0, 2000),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});