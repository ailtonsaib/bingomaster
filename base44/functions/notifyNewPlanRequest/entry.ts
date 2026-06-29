import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { data } = body;
    if (!data) return Response.json({ error: 'No data' }, { status: 400 });

    const adminUser = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminEmail = adminUser?.[0]?.email;
    if (!adminEmail) return Response.json({ error: 'Admin email not found' }, { status: 404 });

    const planNames = {
      free: 'Grátis', basic: 'Basic', pro: 'Pro', max: 'Max', ultra: 'Ultra', enterprise: 'Enterprise', mega: 'Mega'
    };

    const requestedPlan = planNames[data.requested_plan_key] || data.requested_plan_key || '—';
    const currentPlan = planNames[data.current_plan_key] || data.current_plan_key || '—';
    const price = data.requested_plan_price ? `R$ ${Number(data.requested_plan_price).toFixed(2).replace('.', ',')}` : '—';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: adminEmail,
      subject: `🎯 Nova Solicitação de Plano: ${data.user_name || data.user_email} → ${requestedPlan}`,
      body: `
        <h2 style="color:#7c3aed;">Nova Solicitação de Upgrade de Plano</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;font-size:14px;">
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Usuário</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${data.user_name || '—'}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">E-mail</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.user_email || '—'}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Plano Atual</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${currentPlan}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Plano Solicitado</td><td style="padding:8px;font-weight:700;color:#7c3aed;border-bottom:1px solid #e5e7eb;">${requestedPlan}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Valor</td><td style="padding:8px;font-weight:600;color:#059669;border-bottom:1px solid #e5e7eb;">${price}</td></tr>
          ${data.message ? `<tr><td style="padding:8px;color:#6b7280;">Mensagem</td><td style="padding:8px;">${data.message}</td></tr>` : ''}
        </table>
        <p style="margin-top:20px;font-size:13px;color:#9ca3af;">Acesse o painel administrativo para aprovar ou recusar esta solicitação.</p>
      `
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});