import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SALT = '_ticket_salt_2024';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const STATUS_TS = { aberto: 'aberto_at', em_analise: 'em_analise_at', iniciado: 'iniciado_at', em_teste: 'em_teste_at', concluido: 'concluido_at' };
const STATUS_FLOW = ['aberto', 'em_analise', 'iniciado', 'em_teste', 'concluido'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation } = body;

    // ─── AUTH: login (CNPJ + email + password) ───
    if (operation === 'login') {
      const { cnpj, email, password } = body;
      const cnpjClean = (cnpj || '').replace(/\D/g, '');
      const companies = await base44.asServiceRole.entities.SupportCompany.filter({ cnpj: cnpjClean });
      if (!companies.length) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      const company = companies[0];
      if (!company.is_active) return Response.json({ error: 'Empresa inativa' }, { status: 403 });
      const users = await base44.asServiceRole.entities.SupportUser.filter({ email, company_id: company.id });
      if (!users.length) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      const user = users[0];
      if (!user.is_active) return Response.json({ error: 'Usuário inativo' }, { status: 403 });
      const hash = await hashPassword(password);
      if (user.password_hash !== hash) return Response.json({ error: 'Senha incorreta' }, { status: 401 });
      await base44.asServiceRole.entities.SupportUser.update(user.id, { last_login_at: new Date().toISOString() });
      return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: company.id, company_name: company.razao_social } });
    }

    // ─── AUTH: login by email only (client) ───
    if (operation === 'loginByEmail') {
      const { email, password } = body;
      const users = await base44.asServiceRole.entities.SupportUser.filter({ email });
      if (!users.length) return Response.json({ error: 'Email não encontrado' }, { status: 404 });
      const user = users[0];
      if (!user.is_active) return Response.json({ error: 'Usuário inativo' }, { status: 403 });
      const company = await base44.asServiceRole.entities.SupportCompany.get(user.company_id);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      if (!company.is_active) return Response.json({ error: 'Empresa inativa' }, { status: 403 });
      const hash = await hashPassword(password);
      if (user.password_hash !== hash) return Response.json({ error: 'Senha incorreta' }, { status: 401 });
      await base44.asServiceRole.entities.SupportUser.update(user.id, { last_login_at: new Date().toISOString() });
      return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: company.id, company_name: company.razao_social } });
    }

    // ─── AUTH: find user by email (lookup company) ───
    if (operation === 'findUserByEmail') {
      const { email } = body;
      const users = await base44.asServiceRole.entities.SupportUser.filter({ email });
      if (!users.length) return Response.json({ error: 'Email não encontrado' }, { status: 404 });
      const user = users[0];
      const company = await base44.asServiceRole.entities.SupportCompany.get(user.company_id);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      return Response.json({ company: { id: company.id, razao_social: company.razao_social, is_active: company.is_active }, user_name: user.name, user_role: user.role });
    }

    // ─── AUTH: request password reset (envia senha temporária por email) ───
    if (operation === 'requestPasswordReset') {
      const { email } = body;
      if (!email) return Response.json({ error: 'Email é obrigatório' }, { status: 400 });
      const users = await base44.asServiceRole.entities.SupportUser.filter({ email });
      if (!users.length) return Response.json({ error: 'Email não cadastrado no sistema de chamados' }, { status: 404 });
      const user = users[0];
      if (!user.is_active) return Response.json({ error: 'Usuário inativo. Contate o administrador.' }, { status: 403 });

      // Gera senha temporária de 8 caracteres
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let tempPassword = '';
      for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
      const password_hash = await hashPassword(tempPassword);
      await base44.asServiceRole.entities.SupportUser.update(user.id, { password_hash, must_change_password: true });

      // Envia email via Gmail (alcança qualquer endereço, não apenas usuários registrados)
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
        const subjectLine = 'Recuperação de Senha - Central de Chamados';
        const subject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subjectLine)))}?=`;
        const bodyText = `Olá, ${user.name}!\n\nRecebemos uma solicitação de recuperação de senha para sua conta na Central de Chamados.\n\nSua nova senha temporária é: ${tempPassword}\n\nUse-a para acessar o sistema. Recomendamos que você altere a senha após o login.\n\nSe você não solicitou esta recuperação, ignore este email.\n\nAtenciosamente,\nCentral de Chamados SoftPremier`;
        const message = [
          `To: ${email}`,
          `Subject: ${subject}`,
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
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: encoded }),
        });
        if (!res.ok) {
          const err = await res.text();
          return Response.json({ error: 'Falha ao enviar email. Tente novamente.' }, { status: 500 });
        }
      } catch (e) {
        return Response.json({ error: 'Falha ao enviar email de recuperação' }, { status: 500 });
      }
      return Response.json({ success: true, message: 'Senha temporária enviada para seu email' });
    }

    // ─── AUTH: change password (verifica senha atual/temporária e define nova) ───
    if (operation === 'changePassword') {
      const { email, current_password, new_password } = body;
      if (!email || !current_password || !new_password) {
        return Response.json({ error: 'Email, senha atual e nova senha são obrigatórios' }, { status: 400 });
      }
      if (new_password.length < 6) {
        return Response.json({ error: 'A nova senha deve ter ao menos 6 caracteres' }, { status: 400 });
      }
      const users = await base44.asServiceRole.entities.SupportUser.filter({ email });
      if (!users.length) return Response.json({ error: 'Email não encontrado' }, { status: 404 });
      const user = users[0];
      const currentHash = await hashPassword(current_password);
      if (user.password_hash !== currentHash) {
        return Response.json({ error: 'Senha atual incorreta' }, { status: 401 });
      }
      if (current_password === new_password) {
        return Response.json({ error: 'A nova senha deve ser diferente da atual' }, { status: 400 });
      }
      const newHash = await hashPassword(new_password);
      await base44.asServiceRole.entities.SupportUser.update(user.id, { password_hash: newHash, must_change_password: false });
      return Response.json({ success: true });
    }

    // ─── COMPANY: create ───
    if (operation === 'createCompany') {
      const { razao_social, cnpj, endereco } = body;
      const cnpjClean = (cnpj || '').replace(/\D/g, '');
      const existing = await base44.asServiceRole.entities.SupportCompany.filter({ cnpj: cnpjClean });
      if (existing.length) return Response.json({ error: 'CNPJ já cadastrado' }, { status: 409 });
      const company = await base44.asServiceRole.entities.SupportCompany.create({ razao_social, cnpj: cnpjClean, endereco, is_active: true });
      return Response.json({ company });
    }

    // ─── COMPANY: list ───
    if (operation === 'getCompanies') {
      const companies = await base44.asServiceRole.entities.SupportCompany.list();
      return Response.json({ companies });
    }

    // ─── COMPANY: update ───
    if (operation === 'updateCompany') {
      const { company_id, ...updates } = body;
      if (updates.cnpj) updates.cnpj = updates.cnpj.replace(/\D/g, '');
      const company = await base44.asServiceRole.entities.SupportCompany.update(company_id, updates);
      return Response.json({ company });
    }

    // ─── COMPANY: delete ───
    if (operation === 'deleteCompany') {
      await base44.asServiceRole.entities.SupportCompany.delete(body.company_id);
      return Response.json({ success: true });
    }

    // ─── USER: create ───
    if (operation === 'createUser') {
      const { name, email, password, company_id, role, created_by_role } = body;
      if (created_by_role === 'company_admin' || created_by_role === 'admin') {
        if (role === 'system_admin' || role === 'company_admin') {
          return Response.json({ error: 'Sem permissão para criar usuário administrador' }, { status: 403 });
        }
      }
      const company = await base44.asServiceRole.entities.SupportCompany.get(company_id);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      // master_agent é exclusivo (um por empresa)
      if (role === 'master_agent') {
        const existingMasters = await base44.asServiceRole.entities.SupportUser.filter({ company_id, role: 'master_agent', is_active: true });
        if (existingMasters.length > 0) return Response.json({ error: 'Já existe um atendente master para esta empresa' }, { status: 409 });
      }
      const existing = await base44.asServiceRole.entities.SupportUser.filter({ email });
      if (existing.length) return Response.json({ error: 'Email já cadastrado no sistema' }, { status: 409 });
      const password_hash = await hashPassword(password);
      const user = await base44.asServiceRole.entities.SupportUser.create({
        name, email, password_hash, company_id, company_name: company.razao_social,
        role: role || 'agent', is_active: true
      });
      return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id, company_name: user.company_name } });
    }

    // ─── USER: list by company ───
    if (operation === 'getUsers') {
      const { company_id, user_role } = body;
      const users = user_role === 'system_admin'
        ? await base44.asServiceRole.entities.SupportUser.list()
        : await base44.asServiceRole.entities.SupportUser.filter({ company_id });
      const safeUsers = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id, company_name: u.company_name, is_active: u.is_active, last_login_at: u.last_login_at }));
      return Response.json({ users: safeUsers });
    }

    // ─── USER: update ───
    if (operation === 'updateUser') {
      const { user_id, updated_by_role, ...updates } = body;
      if (updates.role) {
        if (updated_by_role === 'company_admin' || updated_by_role === 'admin') {
          if (['system_admin', 'company_admin', 'admin'].includes(updates.role)) {
            return Response.json({ error: 'Sem permissão para atribuir papel administrativo' }, { status: 403 });
          }
        }
        if (updated_by_role !== 'system_admin' && updates.role === 'system_admin') {
          return Response.json({ error: 'Sem permissão para atribuir admin do sistema' }, { status: 403 });
        }
      }
      if (updates.email) {
        const dup = await base44.asServiceRole.entities.SupportUser.filter({ email: updates.email });
        if (dup.length && dup[0].id !== user_id) {
          return Response.json({ error: 'Email já cadastrado no sistema' }, { status: 409 });
        }
      }
      if (updates.password) {
        updates.password_hash = await hashPassword(updates.password);
        delete updates.password;
      }
      const user = await base44.asServiceRole.entities.SupportUser.update(user_id, updates);
      return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    // ─── USER: delete ───
    if (operation === 'deleteUser') {
      await base44.asServiceRole.entities.SupportUser.delete(body.user_id);
      return Response.json({ success: true });
    }

    // ─── COMPANY: get with plan info ───
    if (operation === 'getCompanyPlan') {
      const { company_id, user_role } = body;
      const company = await base44.asServiceRole.entities.SupportCompany.get(company_id);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ company_id });
      const ticketCount = tickets.length;
      const isAdmin = user_role === 'system_admin' || user_role === 'company_admin' || user_role === 'admin';
      const fullAccess = company.ticket_full_access || company.ticket_plan === 'full' || isAdmin;
      const limit = company.ticket_limit ?? 10;
      return Response.json({ company: { id: company.id, razao_social: company.razao_social, cnpj: company.cnpj, ticket_plan: company.ticket_plan || 'free', ticket_limit: limit, ticket_full_access: fullAccess, is_active: company.is_active, logo_url: company.logo_url }, ticket_count: ticketCount, limit_reached: !fullAccess && ticketCount >= limit });
    }

    // ─── COMPANY: list with plan info (admin) ───
    if (operation === 'getCompaniesWithPlan') {
      if (body.user_role !== 'system_admin') return Response.json({ error: 'Acesso negado ao painel de planos' }, { status: 403 });
      const companies = await base44.asServiceRole.entities.SupportCompany.list();
      const result = [];
      for (const c of companies) {
        const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ company_id: c.id });
        result.push({ id: c.id, razao_social: c.razao_social, cnpj: c.cnpj, is_active: c.is_active, ticket_plan: c.ticket_plan || 'free', ticket_limit: c.ticket_limit ?? 10, ticket_full_access: c.ticket_full_access || false, ticket_count: tickets.length, logo_url: c.logo_url, endereco: c.endereco });
      }
      return Response.json({ companies: result });
    }

    // ─── COMPANY: update plan (admin) ───
    if (operation === 'updateCompanyPlan') {
      if (body.user_role !== 'system_admin') return Response.json({ error: 'Acesso negado ao painel de planos' }, { status: 403 });
      const { company_id, ticket_full_access, ticket_limit, ticket_plan } = body;
      const updates = {};
      if (ticket_full_access !== undefined) updates.ticket_full_access = ticket_full_access;
      if (ticket_limit !== undefined) updates.ticket_limit = ticket_limit;
      if (ticket_plan !== undefined) updates.ticket_plan = ticket_plan;
      const company = await base44.asServiceRole.entities.SupportCompany.update(company_id, updates);
      return Response.json({ company });
    }

    // ─── TICKET: create ───
    if (operation === 'createTicket') {
      const { title, description, company_id, company_name, type_id, type_name, module_id, module_name, submodule_id, submodule_name, priority_id, priority_name, priority_level, created_by_id, created_by_name, assigned_to_id, assigned_to_name, attachments, created_by_role } = body;
      // Admin tem acesso ilimitado por padrão
      const isAdmin = ['system_admin', 'company_admin', 'admin'].includes(created_by_role);
      // Verifica limite do plano
      const company = await base44.asServiceRole.entities.SupportCompany.get(company_id);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      const fullAccess = company.ticket_full_access || company.ticket_plan === 'full' || isAdmin;
      if (!fullAccess) {
        const existingTickets = await base44.asServiceRole.entities.SupportTicket.filter({ company_id });
        const limit = company.ticket_limit ?? 10;
        if (existingTickets.length >= limit) {
          return Response.json({ error: `Limite de ${limit} chamados atingido no plano Free. Contate o administrador para liberar acesso completo.` }, { status: 403 });
        }
      }
      // Se nenhum responsável foi atribuído, busca o atendente master da empresa
      let finalAssignedToId = assigned_to_id || '';
      let finalAssignedToName = assigned_to_name || '';
      if (!finalAssignedToId) {
        const masterAgents = await base44.asServiceRole.entities.SupportUser.filter({ company_id, role: 'master_agent', is_active: true });
        if (masterAgents.length > 0) {
          finalAssignedToId = masterAgents[0].id;
          finalAssignedToName = masterAgents[0].name;
        }
      }
      const now = new Date().toISOString();
      const ticket = await base44.asServiceRole.entities.SupportTicket.create({
        title, description, company_id, company_name, type_id, type_name, module_id: module_id || '', module_name: module_name || '', submodule_id: submodule_id || '', submodule_name: submodule_name || '', priority_id, priority_name, priority_level,
        status: 'aberto', created_by_id, created_by_name,
        assigned_to_id: finalAssignedToId, assigned_to_name: finalAssignedToName,
        aberto_at: now,
        history: [{ from_status: '', to_status: 'aberto', moved_at: now, moved_by_id: created_by_id, moved_by_name: created_by_name, direction: 'forward' }]
      });
      if (attachments && attachments.length > 0) {
        try {
          await base44.asServiceRole.entities.TicketComment.create({
            ticket_id: ticket.id, ticket_title: title, company_id,
            author_id: created_by_id, author_name: created_by_name,
            content: description || '', attachments, is_system: false
          });
        } catch (e) { /* não falha o chamado se o comentário falhar */ }
      }
      return Response.json({ ticket });
    }

    // ─── TICKET: list by company ───
    if (operation === 'getTickets') {
      const { company_id, user_role } = body;
      const tickets = user_role === 'system_admin'
        ? await base44.asServiceRole.entities.SupportTicket.list()
        : await base44.asServiceRole.entities.SupportTicket.filter({ company_id });
      return Response.json({ tickets });
    }

    // ─── TICKET: update ───
    if (operation === 'updateTicket') {
      const { ticket_id, ...updates } = body;
      const ticket = await base44.asServiceRole.entities.SupportTicket.update(ticket_id, updates);
      return Response.json({ ticket });
    }

    // ─── TICKET: delete ───
    if (operation === 'deleteTicket') {
      await base44.asServiceRole.entities.SupportTicket.delete(body.ticket_id);
      return Response.json({ success: true });
    }

    // ─── TICKET: move (forward/backward) ───
    if (operation === 'moveTicket') {
      const { ticket_id, new_status, moved_by_id, moved_by_name, direction } = body;
      const ticket = await base44.asServiceRole.entities.SupportTicket.get(ticket_id);
      if (!ticket) return Response.json({ error: 'Chamado não encontrado' }, { status: 404 });
      const now = new Date().toISOString();
      const updates = {
        status: new_status,
        history: [...(ticket.history || []), { from_status: ticket.status, to_status: new_status, moved_at: now, moved_by_id, moved_by_name, direction }]
      };
      const tsField = STATUS_TS[new_status];
      if (tsField) updates[tsField] = now;
      const updated = await base44.asServiceRole.entities.SupportTicket.update(ticket_id, updates);
      return Response.json({ ticket: updated });
    }

    // ─── TICKET: transfer ───
    if (operation === 'transferTicket') {
      const { ticket_id, assigned_to_id, assigned_to_name, moved_by_id, moved_by_name } = body;
      const ticket = await base44.asServiceRole.entities.SupportTicket.get(ticket_id);
      if (!ticket) return Response.json({ error: 'Chamado não encontrado' }, { status: 404 });
      const now = new Date().toISOString();
      const history = [...(ticket.history || []), { from_status: ticket.status, to_status: ticket.status, moved_at: now, moved_by_id, moved_by_name, direction: 'transfer', note: 'Transferido para ' + assigned_to_name }];
      const updated = await base44.asServiceRole.entities.SupportTicket.update(ticket_id, { assigned_to_id, assigned_to_name, history });
      return Response.json({ ticket: updated });
    }

    // ─── COMMENT: add ───
    if (operation === 'addComment') {
      const { ticket_id, ticket_title, company_id, author_id, author_name, author_role, content, attachments } = body;
      const comment = await base44.asServiceRole.entities.TicketComment.create({
        ticket_id, ticket_title, company_id,
        author_id, author_name, author_role: author_role || '',
        content: content || '', attachments: attachments || [], is_system: false
      });
      return Response.json({ comment });
    }

    // ─── COMMENT: list by ticket ───
    if (operation === 'getComments') {
      const { ticket_id } = body;
      const comments = await base44.asServiceRole.entities.TicketComment.filter({ ticket_id });
      return Response.json({ comments });
    }

    // ─── COMMENT: delete ───
    if (operation === 'deleteComment') {
      await base44.asServiceRole.entities.TicketComment.delete(body.comment_id);
      return Response.json({ success: true });
    }

    // ─── MODULES: CRUD ───
    if (operation === 'getModules') {
      const modules = await base44.asServiceRole.entities.TicketModule.list();
      return Response.json({ modules });
    }
    if (operation === 'createModule') {
      const m = await base44.asServiceRole.entities.TicketModule.create({ name: body.name, description: body.description || '', is_active: true });
      return Response.json({ module: m });
    }
    if (operation === 'deleteModule') {
      await base44.asServiceRole.entities.TicketModule.delete(body.module_id);
      return Response.json({ success: true });
    }

    // ─── SUBMODULES: CRUD ───
    if (operation === 'getSubModules') {
      const submodules = await base44.asServiceRole.entities.TicketSubModule.list();
      return Response.json({ submodules });
    }
    if (operation === 'createSubModule') {
      const { name, module_id } = body;
      if (!name || !module_id) return Response.json({ error: 'Nome e módulo são obrigatórios' }, { status: 400 });
      const mod = await base44.asServiceRole.entities.TicketModule.get(module_id);
      if (!mod) return Response.json({ error: 'Módulo não encontrado' }, { status: 404 });
      const sm = await base44.asServiceRole.entities.TicketSubModule.create({ name, module_id, module_name: mod.name, is_active: true });
      return Response.json({ submodule: sm });
    }
    if (operation === 'deleteSubModule') {
      await base44.asServiceRole.entities.TicketSubModule.delete(body.submodule_id);
      return Response.json({ success: true });
    }

    // ─── TYPES: CRUD ───
    if (operation === 'getTypes') {
      const types = await base44.asServiceRole.entities.TicketType.list();
      return Response.json({ types });
    }
    if (operation === 'createType') {
      const t = await base44.asServiceRole.entities.TicketType.create({ name: body.name, description: body.description || '', is_active: true });
      return Response.json({ type: t });
    }
    if (operation === 'updateType') {
      const { type_id, ...updates } = body;
      const t = await base44.asServiceRole.entities.TicketType.update(type_id, updates);
      return Response.json({ type: t });
    }
    if (operation === 'deleteType') {
      await base44.asServiceRole.entities.TicketType.delete(body.type_id);
      return Response.json({ success: true });
    }

    // ─── PRIORITIES: CRUD ───
    if (operation === 'getPriorities') {
      const priorities = await base44.asServiceRole.entities.TicketPriority.list();
      return Response.json({ priorities });
    }
    if (operation === 'createPriority') {
      const p = await base44.asServiceRole.entities.TicketPriority.create({ name: body.name, level: body.level || 1, color: body.color || 'gray', is_active: true });
      return Response.json({ priority: p });
    }
    if (operation === 'updatePriority') {
      const { priority_id, ...updates } = body;
      const p = await base44.asServiceRole.entities.TicketPriority.update(priority_id, updates);
      return Response.json({ priority: p });
    }
    if (operation === 'deletePriority') {
      await base44.asServiceRole.entities.TicketPriority.delete(body.priority_id);
      return Response.json({ success: true });
    }

    // ─── PROMOTE TO SYSTEM ADMIN (one-time, exclusive) ───
    if (operation === 'promoteSystemAdmin') {
      const { user_id } = body;
      const existingAdmins = await base44.asServiceRole.entities.SupportUser.filter({ role: 'system_admin' });
      if (existingAdmins.length > 0) return Response.json({ error: 'Já existe um administrador do sistema' }, { status: 403 });
      const targetUser = await base44.asServiceRole.entities.SupportUser.get(user_id);
      if (!targetUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (targetUser.role !== 'admin' && targetUser.role !== 'company_admin') return Response.json({ error: 'Apenas administradores podem ser promovidos' }, { status: 403 });
      const updated = await base44.asServiceRole.entities.SupportUser.update(user_id, { role: 'system_admin' });
      return Response.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, company_id: updated.company_id, company_name: updated.company_name } });
    }

    return Response.json({ error: 'Operação não reconhecida: ' + operation }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});