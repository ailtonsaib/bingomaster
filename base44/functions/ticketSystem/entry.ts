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
      const { name, email, password, company_id, role } = body;
      const company = await base44.asServiceRole.entities.SupportCompany.get(company_id);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      const existing = await base44.asServiceRole.entities.SupportUser.filter({ email, company_id });
      if (existing.length) return Response.json({ error: 'Email já cadastrado nesta empresa' }, { status: 409 });
      const password_hash = await hashPassword(password);
      const user = await base44.asServiceRole.entities.SupportUser.create({
        name, email, password_hash, company_id, company_name: company.razao_social,
        role: role || 'agent', is_active: true
      });
      return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id, company_name: user.company_name } });
    }

    // ─── USER: list by company ───
    if (operation === 'getUsers') {
      const { company_id } = body;
      const users = await base44.asServiceRole.entities.SupportUser.filter({ company_id });
      const safeUsers = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id, company_name: u.company_name, is_active: u.is_active, last_login_at: u.last_login_at }));
      return Response.json({ users: safeUsers });
    }

    // ─── USER: update ───
    if (operation === 'updateUser') {
      const { user_id, ...updates } = body;
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
      const isAdmin = user_role === 'admin';
      const fullAccess = company.ticket_full_access || company.ticket_plan === 'full' || isAdmin;
      const limit = company.ticket_limit ?? 10;
      return Response.json({ company: { id: company.id, razao_social: company.razao_social, cnpj: company.cnpj, ticket_plan: company.ticket_plan || 'free', ticket_limit: limit, ticket_full_access: fullAccess, is_active: company.is_active }, ticket_count: ticketCount, limit_reached: !fullAccess && ticketCount >= limit });
    }

    // ─── COMPANY: list with plan info (admin) ───
    if (operation === 'getCompaniesWithPlan') {
      const companies = await base44.asServiceRole.entities.SupportCompany.list();
      const result = [];
      for (const c of companies) {
        const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ company_id: c.id });
        result.push({ id: c.id, razao_social: c.razao_social, cnpj: c.cnpj, is_active: c.is_active, ticket_plan: c.ticket_plan || 'free', ticket_limit: c.ticket_limit ?? 10, ticket_full_access: c.ticket_full_access || false, ticket_count: tickets.length });
      }
      return Response.json({ companies: result });
    }

    // ─── COMPANY: update plan (admin) ───
    if (operation === 'updateCompanyPlan') {
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
      const { title, description, company_id, company_name, type_id, type_name, priority_id, priority_name, priority_level, created_by_id, created_by_name, assigned_to_id, assigned_to_name, attachments, created_by_role } = body;
      // Admin tem acesso ilimitado por padrão
      const isAdmin = created_by_role === 'admin';
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
      const now = new Date().toISOString();
      const ticket = await base44.asServiceRole.entities.SupportTicket.create({
        title, description, company_id, company_name, type_id, type_name, priority_id, priority_name, priority_level,
        status: 'aberto', created_by_id, created_by_name,
        assigned_to_id: assigned_to_id || '', assigned_to_name: assigned_to_name || '',
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
      const { company_id } = body;
      const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ company_id });
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

    return Response.json({ error: 'Operação não reconhecida: ' + operation }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});