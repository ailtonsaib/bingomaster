import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function encodeEmail(to, subject, htmlBody, fromName) {
  const subjectEncoded = `=?utf-8?B?${encodeBase64(subject)}?=`;
  const email = `To: ${to}\r\nSubject: ${subjectEncoded}\r\nContent-Type: text/html; charset=utf-8\r\nFrom: ${fromName}\r\n\r\n${htmlBody}`;
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
    const { event, data, changed_fields, payload_too_large } = body;

    // Only proceed on status change to "concluida"
    if (!changed_fields || !changed_fields.includes('status')) {
      return Response.json({ skipped: true, reason: 'status not changed' });
    }

    let order = data;
    if (!order || payload_too_large) {
      order = await base44.asServiceRole.entities.ServiceOrder.get(event.entity_id);
    }
    if (!order) return Response.json({ skipped: true, reason: 'order not found' });

    if (order.status !== 'concluida') {
      return Response.json({ skipped: true, reason: `status is ${order.status}, not concluida` });
    }

    // Look up client email via DiagnosticClient
    let clientEmail = null;
    if (order.client_cpf_cnpj && order.user_email) {
      try {
        const clients = await base44.asServiceRole.entities.DiagnosticClient.filter({
          user_email: order.user_email,
          cpf_cnpj: order.client_cpf_cnpj
        });
        if (clients.length > 0 && clients[0].email) {
          clientEmail = clients[0].email;
        }
      } catch (e) { /* client not found */ }
    }

    // Look up company name
    let companyName = 'Oficina';
    try {
      const companies = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({
        user_email: order.user_email
      });
      if (companies.length > 0) {
        companyName = companies[0].nome_fantasia || companies[0].razao_social || 'Oficina';
      }
    } catch (e) { /* keep default */ }

    if (!clientEmail) {
      return Response.json({ skipped: true, reason: 'client has no email registered', order_number: order.order_number });
    }

    // Build email
    const subject = `${companyName} — Sua Ordem de Serviço foi concluída`;
    const osNum = order.order_number || '—';
    const vehicle = `${order.vehicle_brand || ''} ${order.vehicle_model || ''}`.trim() || '—';
    const plate = order.vehicle_plate || '—';
    const clientName = order.client_name || 'Cliente';

    const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#16a34a;margin-bottom:8px;">✅ Ordem de Serviço Concluída</h2>
  <p style="color:#555;font-size:14px;">Olá <strong>${clientName}</strong>,</p>
  <p style="color:#555;font-size:14px;">Informamos que a sua ordem de serviço foi <strong>concluída</strong> por nossa equipe.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0 0 8px;"><strong>OS:</strong> ${osNum}</p>
    <p style="margin:0 0 8px;"><strong>Veículo:</strong> ${vehicle}</p>
    <p style="margin:0 0 8px;"><strong>Placa:</strong> ${plate}</p>
    <p style="margin:0;"><strong>Status:</strong> <span style="color:#16a34a;font-weight:bold;">Concluída</span></p>
  </div>
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:16px 0;">
    <p style="margin:0;font-size:14px;color:#1e40af;">🚗 Entre em contato com a oficina para retirar o seu veículo.</p>
  </div>
  <p style="font-size:13px;color:#999;margin-top:24px;">Você recebeu este e-mail porque está cadastrado como cliente desta ordem de serviço.</p>
  <p style="font-size:13px;color:#999;">— ${companyName}</p>
</div>`;

    const raw = encodeEmail(clientEmail, subject, htmlBody, companyName);

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

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

    return Response.json({ success: true, sent_to: clientEmail, order_number: osNum, company: companyName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});