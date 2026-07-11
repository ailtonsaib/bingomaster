import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CYCLE_DAYS = 90;
const NOTIFY_DAYS_BEFORE = 10;
const SUPPORT_PHONE = "(62) 99609-9697";
const SUPPORT_EMAIL = "ailtonsaib@gmail.com";

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDateBR(isoStr) {
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

async function sendGmail(base44, to, subject, bodyText) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    bodyText
  ].join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API error: ${err}`);
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_) {}

    const action = body.action || 'list';

    // ── LIST ──────────────────────────────────────
    if (action === 'list') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      if (user.role === 'admin') {
        const subs = await base44.asServiceRole.entities.SpedSubscription.list('-approved_at', 200);
        return Response.json({ success: true, subscriptions: subs });
      } else {
        const subs = await base44.asServiceRole.entities.SpedSubscription.filter({ user_email: user.email });
        return Response.json({ success: true, subscriptions: subs });
      }
    }

    // ── APPROVE (admin only) ──────────────────────
    if (action === 'approve') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Acesso negado.' }, { status: 403 });
      }

      const { user_email, user_name, plan_key, plan_name, notes } = body;
      if (!user_email || !plan_key) {
        return Response.json({ error: 'user_email e plan_key são obrigatórios.' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const expiresAt = addDays(now, CYCLE_DAYS);

      // Check if subscription already exists
      const existing = await base44.asServiceRole.entities.SpedSubscription.filter({ user_email });
      if (existing.length > 0) {
        const updated = await base44.asServiceRole.entities.SpedSubscription.update(existing[0].id, {
          plan_key, plan_name: plan_name || plan_key.toUpperCase(),
          approved_at: now, expires_at: expiresAt,
          status: 'active', notification_sent_at: null,
          blocked_at: null, renewal_count: (existing[0].renewal_count || 0) + 1,
          user_name: user_name || existing[0].user_name || '',
          notes: notes || existing[0].notes || ''
        });
        return Response.json({ success: true, subscription: updated, message: `Assinatura renovada por ${CYCLE_DAYS} dias. Vence em ${formatDateBR(expiresAt)}.` });
      }

      const created = await base44.asServiceRole.entities.SpedSubscription.create({
        user_email, user_name: user_name || '',
        plan_key, plan_name: plan_name || plan_key.toUpperCase(),
        approved_at: now, expires_at: expiresAt,
        status: 'active', notification_sent_at: null,
        renewal_count: 0, notes: notes || ''
      });
      return Response.json({ success: true, subscription: created, message: `Assinatura aprovada! Vence em ${formatDateBR(expiresAt)} (${CYCLE_DAYS} dias).` });
    }

    // ── BLOCK (admin only) ────────────────────────
    if (action === 'block') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Acesso negado.' }, { status: 403 });
      }
      const { subscription_id } = body;
      if (!subscription_id) return Response.json({ error: 'subscription_id obrigatório.' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.SpedSubscription.update(subscription_id, {
        status: 'blocked', blocked_at: new Date().toISOString()
      });
      return Response.json({ success: true, subscription: updated });
    }

    // ── UNBLOCK (admin only) ──────────────────────
    if (action === 'unblock') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Acesso negado.' }, { status: 403 });
      }
      const { subscription_id } = body;
      if (!subscription_id) return Response.json({ error: 'subscription_id obrigatório.' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.SpedSubscription.update(subscription_id, {
        status: 'active', blocked_at: null
      });
      return Response.json({ success: true, subscription: updated });
    }

    // ── DELETE (admin only) ───────────────────────
    if (action === 'delete') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Acesso negado.' }, { status: 403 });
      }
      const { subscription_id } = body;
      if (!subscription_id) return Response.json({ error: 'subscription_id obrigatório.' }, { status: 400 });
      await base44.asServiceRole.entities.SpedSubscription.delete(subscription_id);
      return Response.json({ success: true });
    }

    // ── CHECK EXPIRATIONS (scheduled) ─────────────
    if (action === 'check_expirations') {
      const now = new Date();
      const notifyBefore = new Date(now.getTime() + NOTIFY_DAYS_BEFORE * 24 * 60 * 60 * 1000);

      // 1. Send 10-day warning emails
      const activeSubs = await base44.asServiceRole.entities.SpedSubscription.filter({ status: 'active' });
      let emailsSent = 0;
      let blockedCount = 0;

      for (const sub of activeSubs) {
        const expires = new Date(sub.expires_at);
        const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        // If already expired, block it
        if (expires <= now) {
          await base44.asServiceRole.entities.SpedSubscription.update(sub.id, {
            status: 'expired', blocked_at: now.toISOString()
          });
          blockedCount++;
          continue;
        }

        // If within 10 days and notification not yet sent, send warning
        if (daysLeft <= NOTIFY_DAYS_BEFORE && !sub.notification_sent_at) {
          const dueDate = formatDateBR(sub.expires_at);
          const subject = `⚠ Aviso de Vencimento — Validador SPED (${daysLeft} dias restantes)`;
          const emailBody = `Olá${sub.user_name ? ', ' + sub.user_name : ''}!\n\n` +
            `Sua assinatura do plano ${sub.plan_name || sub.plan_key.toUpperCase()} do Validador SPED vence em ${daysLeft} dia(s), no dia ${dueDate}.\n\n` +
            `Favor efetuar o pagamento até a data ${dueDate}.\n` +
            `Caso contrário, o sistema será bloqueado automaticamente.\n\n` +
            `Dúvidas? Entre em contato:\n` +
            `WhatsApp: ${SUPPORT_PHONE}\n` +
            `E-mail: ${SUPPORT_EMAIL}\n\n` +
            `Atenciosamente,\nEquipe SoftPremier`;

          try {
            await sendGmail(base44, sub.user_email, subject, emailBody);
            await base44.asServiceRole.entities.SpedSubscription.update(sub.id, {
              notification_sent_at: now.toISOString()
            });
            emailsSent++;
          } catch (e) {
            console.error(`Failed to send email to ${sub.user_email}: ${e.message}`);
          }
        }
      }

      return Response.json({
        success: true,
        emailsSent,
        blockedCount,
        checked: activeSubs.length
      });
    }

    // ── GET MY SUBSCRIPTION ───────────────────────
    if (action === 'my') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const subs = await base44.asServiceRole.entities.SpedSubscription.filter({ user_email: user.email });
      if (subs.length === 0) return Response.json({ success: true, subscription: null });
      return Response.json({ success: true, subscription: subs[0] });
    }

    return Response.json({ error: 'Ação não suportada.' }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});