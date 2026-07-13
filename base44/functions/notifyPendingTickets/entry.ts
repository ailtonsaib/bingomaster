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

    // Buscar todos os chamados com status "aberto"
    const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ status: 'aberto' });
    if (!tickets.length) {
      return Response.json({ success: true, message: 'Nenhum chamado aberto encontrado.' });
    }

    const agora = new Date();
    const doisDiasMs = 2 * 24 * 60 * 60 * 1000;

    // Filtrar chamados parados há mais de 2 dias
    const pendentes = tickets.filter((t) => {
      const dataRef = t.aberto_at || t.created_date;
      if (!dataRef) return false;
      const diff = agora.getTime() - new Date(dataRef).getTime();
      return diff > doisDiasMs;
    });

    if (!pendentes.length) {
      return Response.json({ success: true, message: 'Nenhum chamado pendente há mais de 2 dias.' });
    }

    // Agrupar por empresa para encontrar o master_agent
    const companyIds = [...new Set(pendentes.map((t) => t.company_id).filter(Boolean))];

    // Buscar master_agent de cada empresa
    const masterAgents: Record<string, any> = {};
    for (const cid of companyIds) {
      const agents = await base44.asServiceRole.entities.SupportUser.filter({
        company_id: cid,
        role: 'master_agent',
        is_active: true
      });
      if (agents.length > 0) {
        masterAgents[cid] = agents[0];
      }
    }

    // Obter token do Gmail
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    let enviados = 0;
    let erros = 0;

    for (const ticket of pendentes) {
      const master = masterAgents[ticket.company_id];
      if (!master || !master.email) {
        erros++;
        continue;
      }

      const ticketShortId = ticket.id.slice(-6).toUpperCase();
      const dataRef = ticket.aberto_at || ticket.created_date;
      const diasParado = Math.floor((agora.getTime() - new Date(dataRef).getTime()) / (24 * 60 * 60 * 1000));

      const subject = `[ALERTA] Chamado #${ticketShortId} parado há ${diasParado} dia(s)`;

      const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#dc2626;margin-bottom:8px;">⚠️ Chamado Parado há mais de 2 dias</h2>
  <p style="color:#666;font-size:14px;">Olá <strong>${master.name}</strong>,</p>
  <p style="color:#666;font-size:14px;">Você é o atendente master da empresa <strong>${ticket.company_name || 'N/D'}</strong> e o chamado abaixo está parado no status <strong>Aberto</strong> há <strong>${diasParado} dia(s)</strong>.</p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0 0 8px;"><strong>Chamado:</strong> #${ticketShortId}</p>
    <p style="margin:0 0 8px;"><strong>Título:</strong> ${ticket.title || 'Sem título'}</p>
    <p style="margin:0 0 8px;"><strong>Empresa:</strong> ${ticket.company_name || 'N/D'}</p>
    <p style="margin:0 0 8px;"><strong>Status:</strong> ${STATUS_LABELS[ticket.status] || ticket.status}</p>
    <p style="margin:0;"><strong>Aberto em:</strong> ${new Date(dataRef).toLocaleString('pt-BR')}</p>
  </div>
  <p style="font-size:14px;color:#666;">Por favor, verifique o chamado e providencie o atendimento ou distribua para um agente responsável.</p>
  <p style="font-size:13px;color:#999;margin-top:24px;">Este é um aviso automático do sistema de chamados.</p>
</div>`;

      try {
        const raw = encodeEmail(master.email, subject, htmlBody);
        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw })
        });

        if (gmailRes.ok) {
          enviados++;
        } else {
          erros++;
        }
      } catch (e) {
        erros++;
      }
    }

    return Response.json({
      success: true,
      total_pendentes: pendentes.length,
      emails_enviados: enviados,
      erros
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});