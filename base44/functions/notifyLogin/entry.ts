import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { device_ip } = body;

    // Upsert UserLicense - create if not exists
    const existing = await base44.asServiceRole.entities.UserLicense.filter({ user_id: user.id });

    const now = new Date().toISOString();

    if (existing.length === 0) {
      // First access — create license with FREE plan and send email notification
      await base44.asServiceRole.entities.UserLicense.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name || user.email,
        plan_key: "free",
        plan_name: "FREE",
        max_cards: 50,
        device_ip: device_ip || "desconhecido",
        first_access_at: now,
        last_access_at: now,
      });

      // Notify admin of new user
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: "ailtonsaib@gmail.com",
        from_name: "BingoMaster Sistema",
        subject: `🆕 Novo usuário cadastrado: ${user.full_name || user.email}`,
        body: `
Novo usuário acessou o sistema pela primeira vez!

Nome: ${user.full_name || "Não informado"}
Email: ${user.email}
IP do dispositivo: ${device_ip || "Não identificado"}
Data/hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
Plano inicial: FREE (50 cartelas)

Acesse o painel administrativo para gerenciar este usuário.
        `.trim()
      });
    } else {
      // Update last access and ip
      await base44.asServiceRole.entities.UserLicense.update(existing[0].id, {
        last_access_at: now,
        device_ip: device_ip || existing[0].device_ip,
        user_email: user.email,
        user_name: user.full_name || user.email,
      });
    }

    const license = existing.length > 0 ? existing[0] : null;
    return Response.json({
      plan_key: license?.plan_key || "free",
      plan_name: license?.plan_name || "FREE",
      max_cards: license?.max_cards || 50,
      is_new: existing.length === 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});