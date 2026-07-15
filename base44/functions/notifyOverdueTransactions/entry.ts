import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function encodeEmail(to, subject, htmlBody) {
  const subjectEncoded = `=?utf-8?B?${encodeBase64(subject)}?=`;
  const email = `To: ${to}\r\nSubject: ${subjectEncoded}\r\nContent-Type: text/html; charset=utf-8\r\nFrom: SoftPremier Finance\r\n\r\n${htmlBody}`;
  const bytes = new TextEncoder().encode(email);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fmtMoney(v) {
  return `R$ ${parseFloat(v || 0).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verifica se é admin (para chamadas manuais) — automações agendadas não enviam auth
    let isAdmin = true;
    try {
      const user = await base44.auth.me();
      if (user && user.role && user.role !== 'admin' && user.role !== 'system_admin') {
        return Response.json({ error: 'Apenas administradores' }, { status: 403 });
      }
      if (user) isAdmin = true;
    } catch (_e) {
      // Chamada sem auth (automação agendada) — permite
    }

    // Busca todas as transações pendentes/parciais
    const allPending = await base44.asServiceRole.entities.PortalFinanceTransaction.filter({
      status: { $in: ['pending', 'partial'] }
    }, '-due_date', 500);

    const hoje = new Date(new Date().toDateString()); // meia-noite de hoje
    const vencidos = allPending.filter((t) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      if (isNaN(due.getTime())) return false;
      return due < hoje;
    });

    if (vencidos.length === 0) {
      return Response.json({ success: true, message: 'Nenhum documento vencido pendente.', total: 0 });
    }

    // Agrupa por user_email
    const porUsuario = {};
    for (const tx of vencidos) {
      const email = tx.user_email || 'sem_email';
      if (!porUsuario[email]) {
        porUsuario[email] = { email, itens: [], total: 0 };
      }
      const valor = tx.status === 'partial' && parseFloat(tx.remaining_amount) > 0
        ? parseFloat(tx.remaining_amount)
        : parseFloat(tx.amount) || 0;
      porUsuario[email].itens.push(tx);
      porUsuario[email].total += valor;
    }

    // Busca nomes dos usuários
    const userEmails = Object.keys(porUsuario);
    for (const email of userEmails) {
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length > 0) {
        porUsuario[email].name = users[0].name || email;
      } else {
        porUsuario[email].name = email;
      }
    }

    // Obtém token do Gmail
    let gmailToken = null;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      gmailToken = conn.accessToken;
    } catch (_e) {
      // Gmail não configurado
    }

    let emailsEnviados = 0;
    let whatsappEnviado = 0;
    let erros = 0;

    for (const email of userEmails) {
      const grupo = porUsuario[email];
      if (!email || email === 'sem_email') {
        erros += grupo.itens.length;
        continue;
      }

      const diasTotal = grupo.itens.reduce((max, t) => {
        const d = Math.floor((hoje.getTime() - new Date(t.due_date).getTime()) / (24 * 60 * 60 * 1000));
        return Math.max(max, d);
      }, 0);

      const listaHtml = grupo.itens
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .map((t) => {
          const dias = Math.floor((hoje.getTime() - new Date(t.due_date).getTime()) / (24 * 60 * 60 * 1000));
          const valor = t.status === 'partial' && parseFloat(t.remaining_amount) > 0
            ? parseFloat(t.remaining_amount)
            : parseFloat(t.amount) || 0;
          const badge = t.status === 'partial'
            ? '<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:11px;">Parcial</span>'
            : '';
          return `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${t.description || '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${t.contact_name || '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${fmtDate(t.due_date)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#dc2626;font-weight:bold;">${dias} dia(s)</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${t.type === 'income' ? '+' : '-'} ${fmtMoney(valor)} ${badge}</td>
          </tr>`;
        })
        .join('');

      const subject = `[ALERTA] ${grupo.itens.length} documento(s) vencido(s) — ${fmtMoney(grupo.total)}`;

      const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;padding:20px;">
  <h2 style="color:#dc2626;margin-bottom:8px;">⚠️ Documentos Vencidos Pendentes</h2>
  <p style="color:#666;font-size:14px;">Olá <strong>${grupo.name}</strong>,</p>
  <p style="color:#666;font-size:14px;">Você possui <strong>${grupo.itens.length} documento(s) financeiro(s)</strong> que já passaram da data de vencimento e ainda não foram baixados no sistema. O vencimento mais antigo está há <strong>${diasTotal} dia(s)</strong>.</p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0 0 4px;font-size:14px;"><strong>Valor total vencido:</strong> <span style="color:#dc2626;font-size:18px;font-weight:bold;">${fmtMoney(grupo.total)}</span></p>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Descrição</th>
        <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Contato</th>
        <th style="padding:8px;text-align:center;border-bottom:2px solid #e5e7eb;">Vencimento</th>
        <th style="padding:8px;text-align:center;border-bottom:2px solid #e5e7eb;">Atraso</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb;">Valor</th>
      </tr>
    </thead>
    <tbody>${listaHtml}</tbody>
  </table>
  <p style="font-size:14px;color:#666;margin-top:16px;">Acesse o módulo de Financeiro → Caixa &amp; Banco para regularizar os títulos pendentes.</p>
  <p style="font-size:13px;color:#999;margin-top:24px;">Este é um aviso automático diário do SoftPremier Finance.</p>
</div>`;

      // Envia e-mail via Gmail
      if (gmailToken) {
        try {
          const raw = encodeEmail(email, subject, htmlBody);
          const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${gmailToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ raw })
          });
          if (gmailRes.ok) emailsEnviados++;
          else erros++;
        } catch (_e) {
          erros++;
        }
      }
    }

    // Notificação WhatsApp para o admin
    const waToken = Deno.env.get('WHATSAPP_TOKEN');
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const waRecipient = Deno.env.get('WHATSAPP_RECIPIENT_PHONE') || '5562996099697';

    if (waToken && waPhoneId) {
      const totalVencido = vencidos.reduce((s, t) => {
        const v = t.status === 'partial' && parseFloat(t.remaining_amount) > 0
          ? parseFloat(t.remaining_amount)
          : parseFloat(t.amount) || 0;
        return s + v;
      }, 0);

      const waMsg = `⚠️ *ALERTA DIÁRIO - Documentos Vencidos*\n\n` +
        `📊 ${vencidos.length} documento(s) vencido(s) pendente(s)\n` +
        `💰 Valor total: ${fmtMoney(totalVencido)}\n` +
        `👥 ${userEmails.length} usuário(s) afetado(s)\n` +
        `📧 ${emailsEnviados} e-mail(s) enviado(s)\n\n` +
        `Acesse o Financeiro → Caixa & Banco para regularizar.`;

      try {
        const waRes = await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${waToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: waRecipient,
            type: 'text',
            text: { body: waMsg }
          })
        });
        if (waRes.ok) whatsappEnviado = 1;
      } catch (_e) {
        // WhatsApp falhou silenciosamente
      }
    }

    return Response.json({
      success: true,
      total_vencidos: vencidos.length,
      usuarios_afetados: userEmails.length,
      emails_enviados: emailsEnviados,
      whatsapp_enviado: whatsappEnviado,
      erros
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});