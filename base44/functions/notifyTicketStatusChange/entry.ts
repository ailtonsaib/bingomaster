import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const STATUS_LABELS = {
  aberto: 'Aberto',
  em_analise: 'Em Análise',
  iniciado: 'Iniciado',
  em_teste: 'Em Teste',
  concluido: 'Concluído'
};

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function encodeEmail(to, subject, htmlBody) {
  const subjectEncoded = `=?utf-8?B?${encodeBase64(subject)}?=`;
  const email = `To: ${to}\r\nSubject: ${subjectEncoded}\r\nContent-Type: text/html; charset=utf-8\r\nFrom: Suporte de Chamados\r\n\r\n${htmlBody}`;
  const bytes = new TextEncoder().encode(email);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data, changed_fields, payload_too_large } = body;

    // Only proceed on status change
    if (!changed_fields || !changed_fields.includes('status')) {
      return Response.json({ skipped: true, reason: 'status not changed' });
    }

    let ticket = data;
    if (!ticket || payload_too_large) {
      ticket = await base44.asServiceRole.entities.SupportTicket.get(event.entity_id);
    }

    if (!ticket) return Response.json({ skipped: true, reason: 'ticket not found' });

    const oldStatus = old_data?.status || 'aberto';
    const newStatus = ticket.status;

    if (oldStatus === newStatus) {
      return Response.json({ skipped: true, reason: 'status unchanged' });
    }

    // Look up creator email
    let creatorEmail = null;
    if (ticket.created_by_id) {
      try {
        const creator = await base44.asServiceRole.entities.SupportUser.get(ticket.created_by_id);
        if (creator && creator.email) creatorEmail = creator.email;
      } catch (e) { /* creator not found */ }
    }

    if (!creatorEmail) {
      return Response.json({ skipped: true, reason: 'no creator email found' });
    }

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const ticketShortId = ticket.id.slice(-6).toUpperCase();
    const oldLabel = STATUS_LABELS[oldStatus] || oldStatus;
    const newLabel = STATUS_LABELS[newStatus] || newStatus;

    const subject = `[Chamado #${ticketShortId}] Status atualizado: ${newLabel}`;

    const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#6d28d9;margin-bottom:8px;">Atualização do seu Chamado</h2>
  <p style="color:#666;font-size:14px;">O status do seu chamado foi atualizado em nossa central de suporte.</p>
  <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0 0 8px;"><strong>Chamado:</strong> #${ticketShortId}</p>
    <p style="margin:0 0 8px;"><strong>Título:</strong> ${ticket.title || 'Sem título'}</p>
    ${ticket.company_name ? `<p style="margin:0 0 8px;"><strong>Empresa:</strong> ${ticket.company_name}</p>` : ''}
    <p style="margin:0 0 8px;"><strong>Status anterior:</strong> ${oldLabel}</p>
    <p style="margin:0;"><strong>Novo status:</strong> <span style="color:#6d28d9;font-weight:bold;font-size:16px;">${newLabel}</span></p>
  </div>
  <p style="font-size:13px;color:#999;margin-top:24px;">Você recebeu este e-mail porque está cadastrado como solicitante deste chamado.</p>
</div>`;

    const raw = encodeEmail(creatorEmail, subject, htmlBody);

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      return Response.json({ error: 'Gmail API error: ' + errText }, { status: 500 });
    }

    return Response.json({ success: true, sent_to: creatorEmail, old_status: oldStatus, new_status: newStatus });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});