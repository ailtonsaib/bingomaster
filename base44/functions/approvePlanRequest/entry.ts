import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { request_id, action, admin_notes } = body; // action: "approve" | "reject"

    if (!request_id || !action) return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });

    const planReqs = await base44.asServiceRole.entities.PlanRequest.filter({ id: request_id });
    if (!planReqs.length) return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    const planReq = planReqs[0];

    if (action === "approve") {
      // Update plan request
      await base44.asServiceRole.entities.PlanRequest.update(request_id, {
        status: "approved",
        admin_notes: admin_notes || "",
        approved_at: new Date().toISOString(),
      });

      // Get plan config for max_cards
      const planConfigs = await base44.asServiceRole.entities.PlanConfig.filter({ plan_key: planReq.requested_plan_key });
      const maxCards = planConfigs[0]?.max_cards || 50;

      // Update or create user license
      const licenses = await base44.asServiceRole.entities.UserLicense.filter({ user_id: planReq.user_id });
      if (licenses.length > 0) {
        await base44.asServiceRole.entities.UserLicense.update(licenses[0].id, {
          plan_key: planReq.requested_plan_key,
          plan_name: planReq.requested_plan_name,
          max_cards: maxCards,
        });
      } else {
        await base44.asServiceRole.entities.UserLicense.create({
          user_id: planReq.user_id,
          user_email: planReq.user_email,
          user_name: planReq.user_name,
          plan_key: planReq.requested_plan_key,
          plan_name: planReq.requested_plan_name,
          max_cards: maxCards,
          first_access_at: new Date().toISOString(),
          last_access_at: new Date().toISOString(),
        });
      }

      // Notify user
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: planReq.user_email,
        from_name: "BingoMaster — Ailton Aires",
        subject: `🎉 Plano ${planReq.requested_plan_name} ativado com sucesso!`,
        body: `
Olá, ${planReq.user_name}!

Seu plano foi ativado com sucesso!

✅ Plano ativo: ${planReq.requested_plan_name}
🃏 Cartelas disponíveis: ${maxCards.toLocaleString("pt-BR")}

${admin_notes ? `Observação do administrador: ${admin_notes}\n` : ""}
Acesse o sistema agora e aproveite todos os recursos do seu plano.

Obrigado pela confiança!
Ailton Aires — BingoMaster
WhatsApp: (62) 99609-9697
        `.trim()
      });

    } else if (action === "reject") {
      await base44.asServiceRole.entities.PlanRequest.update(request_id, {
        status: "rejected",
        admin_notes: admin_notes || "",
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: planReq.user_email,
        from_name: "BingoMaster — Ailton Aires",
        subject: `❌ Solicitação de plano ${planReq.requested_plan_name} não aprovada`,
        body: `
Olá, ${planReq.user_name}!

Infelizmente sua solicitação para o plano ${planReq.requested_plan_name} não pôde ser processada.

${admin_notes ? `Motivo: ${admin_notes}\n` : ""}
Caso queira tentar novamente ou tirar dúvidas, entre em contato:
WhatsApp: (62) 99609-9697
E-mail: ailtonsaib@gmail.com

Atenciosamente,
Ailton Aires — BingoMaster
        `.trim()
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});