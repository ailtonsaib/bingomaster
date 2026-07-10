import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Entity automation payload: { event, data, old_data, changed_fields }
    const data = body.data;
    const oldData = body.old_data || {};

    // Only fire when status changed TO "approved"
    if (data?.status !== 'approved' || oldData?.status === 'approved') {
      return Response.json({ skipped: true, reason: 'Status did not change to approved' });
    }

    // Find admin email
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminEmail = adminUsers?.[0]?.email;
    if (!adminEmail) return Response.json({ error: 'Admin email not found' }, { status: 404 });

    const planNames = {
      free: 'Grátis', basic: 'Basic', pro: 'Pro', max: 'Max',
      ultra: 'Ultra', enterprise: 'Enterprise', mega: 'Mega'
    };

    const planName = planNames[data.requested_plan_key] || data.requested_plan_name || data.requested_plan_key || '—';
    const price = data.requested_plan_price
      ? `R$ ${Number(data.requested_plan_price).toFixed(2).replace('.', ',')}`
      : '—';
    const userName = data.user_name || '—';
    const userEmail = data.user_email || '—';
    const approvedAt = data.approved_at
      ? new Date(data.approved_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: adminEmail,
      from_name: 'BingoMaster — Pagamentos',
      subject: `💰 Pagamento confirmado: ${userName} → ${planName}`,
      body: `
        <h2 style="color:#059669;">✅ Pagamento de Plano Confirmado</h2>
        <p style="font-size:14px;font-family:sans-serif;color:#374151;">
          Um usuário acabou de concluir o pagamento de um plano. Detalhes abaixo:
        </p>
        <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;font-size:14px;margin-top:12px;">
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Usuário</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${userName}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">E-mail</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${userEmail}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Plano</td><td style="padding:8px;font-weight:700;color:#7c3aed;border-bottom:1px solid #e5e7eb;">${planName}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Valor</td><td style="padding:8px;font-weight:600;color:#059669;border-bottom:1px solid #e5e7eb;">${price}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Aprovado em</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${approvedAt}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:13px;color:#9ca3af;">
          Este aviso foi gerado automaticamente quando o status da solicitação mudou para "Aprovado".
        </p>
      `
    });

    return Response.json({ ok: true, notified: adminEmail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});