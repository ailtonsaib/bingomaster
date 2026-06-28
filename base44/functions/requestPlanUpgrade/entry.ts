import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Add business days to a date
function addBusinessDays(date, days) {
  let count = 0;
  const d = new Date(date);
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { requested_plan_key, requested_plan_name, requested_plan_price, message, device_ip } = body;

    if (!requested_plan_key) return Response.json({ error: 'Plano não informado' }, { status: 400 });

    // Check for existing pending request for same plan
    const existing = await base44.asServiceRole.entities.PlanRequest.filter({
      user_id: user.id,
      requested_plan_key,
      status: "pending"
    });

    if (existing.length > 0) {
      return Response.json({ error: 'Já existe uma solicitação pendente para este plano.' }, { status: 409 });
    }

    // Get current license
    const licenses = await base44.asServiceRole.entities.UserLicense.filter({ user_id: user.id });
    const currentPlan = licenses[0]?.plan_key || "free";

    const expiresAt = addBusinessDays(new Date(), 5).toISOString();

    // Create plan request
    const planReq = await base44.asServiceRole.entities.PlanRequest.create({
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      current_plan_key: currentPlan,
      requested_plan_key,
      requested_plan_name,
      requested_plan_price: Number(requested_plan_price) || 0,
      status: "pending",
      message: message || "",
      expires_at: expiresAt,
      device_ip: device_ip || "desconhecido",
    });

    const priceFormatted = requested_plan_price
      ? Number(requested_plan_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "Gratuito";

    const expiresFormatted = new Date(expiresAt).toLocaleDateString("pt-BR");

    // Email to admin
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: "ailtonsaib@gmail.com",
      from_name: "BingoMaster Sistema",
      subject: `💳 Solicitação de upgrade: ${user.full_name || user.email} → ${requested_plan_name}`,
      body: `
Nova solicitação de upgrade de plano recebida!

Usuário: ${user.full_name || "Não informado"}
Email: ${user.email}
IP: ${device_ip || "Não identificado"}
Plano atual: ${currentPlan.toUpperCase()}
Plano solicitado: ${requested_plan_name} — ${priceFormatted}
Mensagem do usuário: ${message || "Nenhuma mensagem"}
Expira em: ${expiresFormatted} (5 dias úteis)
ID da solicitação: ${planReq.id}

Acesse o painel administrativo para aprovar ou rejeitar esta solicitação e enviar as instruções de pagamento.
      `.trim()
    });

    // Email to user confirming receipt
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: "BingoMaster — Ailton Aires",
      subject: `✅ Solicitação de plano ${requested_plan_name} recebida`,
      body: `
Olá, ${user.full_name || ""}!

Sua solicitação de upgrade para o plano ${requested_plan_name} (${priceFormatted}) foi recebida com sucesso.

Em breve você receberá as instruções de pagamento por este e-mail ou via WhatsApp.

⚠️ Atenção: esta solicitação expira em ${expiresFormatted} (5 dias úteis). Caso o pagamento não seja confirmado até essa data, uma nova solicitação deverá ser enviada.

Dúvidas? Fale conosco:
WhatsApp: (62) 99609-9697
E-mail: ailtonsaib@gmail.com

Atenciosamente,
Ailton Aires — BingoMaster
      `.trim()
    });

    return Response.json({ success: true, request_id: planReq.id, expires_at: expiresAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});