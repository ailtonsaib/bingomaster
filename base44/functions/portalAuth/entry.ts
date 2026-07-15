import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import bcrypt from 'npm:bcryptjs@2.4.3';

function stripPassword(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

async function verifyAdmin(base44, admin_email) {
  const admins = await base44.asServiceRole.entities.PortalUser.filter({ email: admin_email });
  return admins.length > 0 && admins[0].is_admin ? admins[0] : null;
}

// Extrai o IP real do cliente a partir dos headers do request
function getClientIp(req) {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return 'unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation } = body;

    // ─── SETUP: create admin + test user ───
    if (operation === 'setup') {
      let created = [];

      // Admin user
      const existingAdmin = await base44.asServiceRole.entities.PortalUser.filter({ email: 'ailtonsaib@gmail.com' });
      if (existingAdmin.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('premier2026', salt);
        await base44.asServiceRole.entities.PortalUser.create({
          email: 'ailtonsaib@gmail.com',
          password_hash: hash,
          name: 'Ailton Aires',
          is_admin: true,
          can_access_bingo: true,
          can_access_finance: true,
          can_access_sped: true,
          bingo_plan: 'free',
          sped_plan: 'max',
          finance_transaction_limit: 10,
          finance_transactions_used: 0,
          finance_full_access: true,
          finance_release_requested: false,
          finance_plan_price: 49.90,
          is_active: true,
        });
        created.push('admin');
      }

      // Test user
      const existingTest = await base44.asServiceRole.entities.PortalUser.filter({ email: 'teste@softpremier.com.br' });
      if (existingTest.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('teste123', salt);
        await base44.asServiceRole.entities.PortalUser.create({
          email: 'teste@softpremier.com.br',
          password_hash: hash,
          name: 'Usuário Teste',
          is_admin: false,
          can_access_bingo: true,
          can_access_finance: true,
          can_access_sped: false,
          bingo_plan: 'free',
          sped_plan: 'free',
          finance_transaction_limit: 10,
          finance_transactions_used: 0,
          finance_full_access: false,
          finance_release_requested: false,
          finance_plan_price: 49.90,
          is_active: true,
        });
        created.push('teste');
      }

      return Response.json({
        success: true,
        created,
        message: 'Setup concluído. Admin: ailtonsaib@gmail.com / premier2026 | Teste: teste@softpremier.com.br / teste123',
      });
    }

    // ─── LOGIN ───
    if (operation === 'login') {
      const { email, password } = body;
      if (!email || !password) {
        return Response.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
      }
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length === 0) {
        return Response.json({ error: 'Email ou senha inválidos' }, { status: 401 });
      }
      const user = users[0];
      if (!user.is_active) {
        return Response.json({ error: 'Usuário inativo. Contate o administrador.' }, { status: 403 });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return Response.json({ error: 'Email ou senha inválidos' }, { status: 401 });
      }
      // Registra IP da máquina e data/hora do login
      const clientIp = getClientIp(req);
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.PortalUser.update(user.id, {
        device_ip: clientIp,
        last_login_at: now,
        current_app: 'portal',
      });
      const updated = { ...user, device_ip: clientIp, last_login_at: now, current_app: 'portal' };
      return Response.json({ user: stripPassword(updated) });
    }

    // ─── TRACK APP USAGE ───
    if (operation === 'trackApp') {
      const { email, app } = body;
      if (!email || !app) {
        return Response.json({ error: 'Email e aplicativo obrigatórios' }, { status: 400 });
      }
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const clientIp = getClientIp(req);
      await base44.asServiceRole.entities.PortalUser.update(users[0].id, {
        current_app: app,
        device_ip: clientIp,
      });
      return Response.json({ success: true });
    }

    // ─── GET USER (refresh) ───
    if (operation === 'getUser') {
      const { email } = body;
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      return Response.json({ user: stripPassword(users[0]) });
    }

    // ─── ADMIN: list users ───
    if (operation === 'getUsers') {
      const { admin_email } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const users = await base44.asServiceRole.entities.PortalUser.list();
      return Response.json({ users: users.map(stripPassword) });
    }

    // ─── ADMIN: create user ───
    if (operation === 'createUser') {
      const { admin_email, email, password, name, can_access_bingo, can_access_finance, can_access_sped, can_access_diagnostic, diagnostic_plan, bingo_plan, sped_plan, finance_full_access, finance_transaction_limit, finance_transactions_used, finance_release_requested } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const existing = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (existing.length > 0) {
        return Response.json({ error: 'Email já cadastrado' }, { status: 409 });
      }
      const salt = await bcrypt.genSalt(10);
      const finalPassword = password || 'Premier@123';
      const hash = await bcrypt.hash(finalPassword, salt);
      const created = await base44.asServiceRole.entities.PortalUser.create({
        email,
        password_hash: hash,
        name,
        must_change_password: true,
        can_access_bingo: can_access_bingo ?? true,
        can_access_finance: can_access_finance ?? false,
        can_access_sped: can_access_sped ?? false,
        can_access_diagnostic: can_access_diagnostic ?? false,
        diagnostic_plan: diagnostic_plan || 'free',
        bingo_plan: bingo_plan || 'free',
        sped_plan: sped_plan || 'free',
        finance_transaction_limit: finance_transaction_limit ?? 10,
        finance_transactions_used: finance_transactions_used ?? 0,
        finance_full_access: finance_full_access ?? false,
        finance_release_requested: finance_release_requested ?? false,
        finance_plan_price: body.finance_plan_price ?? 49.90,
        is_active: true,
      });
      return Response.json({ user: stripPassword(created) });
    }

    // ─── ADMIN: update user ───
    if (operation === 'updateUser') {
      const { admin_email, user_id, data } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const updated = await base44.asServiceRole.entities.PortalUser.update(user_id, data);
      return Response.json({ user: stripPassword(updated) });
    }

    // ─── ADMIN: delete user ───
    if (operation === 'deleteUser') {
      const { admin_email, user_id } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const target = await base44.asServiceRole.entities.PortalUser.get(user_id);
      if (target && target.is_admin) {
        return Response.json({ error: 'Não é possível excluir um administrador' }, { status: 403 });
      }
      await base44.asServiceRole.entities.PortalUser.delete(user_id);
      return Response.json({ success: true });
    }

    // ─── ADMIN: approve release ───
    if (operation === 'approveRelease') {
      const { admin_email, user_id } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      await base44.asServiceRole.entities.PortalUser.update(user_id, {
        finance_full_access: true,
        finance_release_requested: false,
      });
      return Response.json({ success: true });
    }

    // ─── ADMIN: reset transactions ───
    if (operation === 'resetTransactions') {
      const { admin_email, user_id } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      await base44.asServiceRole.entities.PortalUser.update(user_id, {
        finance_transactions_used: 0,
      });
      return Response.json({ success: true });
    }

    // ─── FINANCE: get transactions ───
    if (operation === 'getTransactions') {
      const { email } = body;
      const transactions = await base44.asServiceRole.entities.PortalFinanceTransaction.filter(
        { user_email: email },
        '-created_date'
      );
      return Response.json({ transactions });
    }

    // ─── FINANCE: add transaction ───
    if (operation === 'addTransaction') {
      const { email, description, amount, type, category, launch_date, due_date, contact_id, contact_name, cost_center_id, cost_center_name } = body;
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const user = users[0];
      if (!user.finance_full_access && user.finance_transactions_used >= user.finance_transaction_limit) {
        return Response.json({ error: 'limit_reached' }, { status: 403 });
      }
      await base44.asServiceRole.entities.PortalFinanceTransaction.create({
        user_email: email,
        description,
        amount,
        type,
        category: category || undefined,
        date: new Date().toISOString(),
        launch_date: launch_date || undefined,
        due_date: due_date || undefined,
        contact_id: contact_id || undefined,
        contact_name: contact_name || undefined,
        cost_center_id: cost_center_id || undefined,
        cost_center_name: cost_center_name || undefined,
        status: 'pending',
      });
      if (!user.finance_full_access) {
        await base44.asServiceRole.entities.PortalUser.update(user.id, {
          finance_transactions_used: user.finance_transactions_used + 1,
        });
      }
      return Response.json({ success: true });
    }

    // ─── FINANCE: update transaction (editar todos os campos) ───
    if (operation === 'updateTransaction') {
      const { email, transaction_id, description, amount, type, category, launch_date, due_date, contact_id, contact_name, cost_center_id, cost_center_name, bank_account_id, bank_name, status } = body;
      const updateData = {};
      if (description !== undefined) updateData.description = description;
      if (amount !== undefined) updateData.amount = amount;
      if (type !== undefined) updateData.type = type;
      if (category !== undefined) updateData.category = category || undefined;
      if (launch_date !== undefined) updateData.launch_date = launch_date || undefined;
      if (due_date !== undefined) updateData.due_date = due_date || undefined;
      if (contact_id !== undefined) updateData.contact_id = contact_id || undefined;
      if (contact_name !== undefined) updateData.contact_name = contact_name || undefined;
      if (cost_center_id !== undefined) updateData.cost_center_id = cost_center_id || undefined;
      if (cost_center_name !== undefined) updateData.cost_center_name = cost_center_name || undefined;
      if (bank_account_id !== undefined) updateData.bank_account_id = bank_account_id || undefined;
      if (bank_name !== undefined) updateData.bank_name = bank_name || undefined;
      if (status !== undefined) updateData.status = status;
      await base44.asServiceRole.entities.PortalFinanceTransaction.update(transaction_id, updateData);
      return Response.json({ success: true });
    }

    // ─── FINANCE: classify transaction (atribuir centro de custo / conta bancária) ───
    if (operation === 'classifyTransaction') {
      const { email, transaction_id, cost_center_id, cost_center_name, bank_account_id, bank_name } = body;
      const updateData = {};
      if (cost_center_id !== undefined) updateData.cost_center_id = cost_center_id || undefined;
      if (cost_center_name !== undefined) updateData.cost_center_name = cost_center_name || undefined;
      if (bank_account_id !== undefined) updateData.bank_account_id = bank_account_id || undefined;
      if (bank_name !== undefined) updateData.bank_name = bank_name || undefined;
      await base44.asServiceRole.entities.PortalFinanceTransaction.update(transaction_id, updateData);
      return Response.json({ success: true });
    }

    // ─── FINANCE: bulk classify transactions ───
    if (operation === 'bulkClassifyTransactions') {
      const { email, transaction_ids, cost_center_id, cost_center_name, bank_account_id, bank_name } = body;
      const updateData = {};
      if (cost_center_id !== undefined) { updateData.cost_center_id = cost_center_id || undefined; updateData.cost_center_name = cost_center_name || undefined; }
      if (bank_account_id !== undefined) { updateData.bank_account_id = bank_account_id || undefined; updateData.bank_name = bank_name || undefined; }
      const updates = transaction_ids.map(id => ({ id, ...updateData }));
      await base44.asServiceRole.entities.PortalFinanceTransaction.bulkUpdate(updates);
      return Response.json({ success: true, updated: transaction_ids.length });
    }

    // ─── FINANCE: settle transaction (baixa de título) ───
    if (operation === 'settleTransaction') {
      const { email, transaction_id, bank_account_id, bank_name, is_partial, settled_amount, remaining_amount, interest_amount, discount_amount } = body;
      const updateData = {
        bank_account_id: bank_account_id || undefined,
        bank_name: bank_name || undefined,
        settled_date: new Date().toISOString(),
        interest_amount: interest_amount || 0,
        discount_amount: discount_amount || 0,
        is_partial: is_partial || false,
        settled_amount: settled_amount || 0,
        remaining_amount: remaining_amount || 0,
      };
      if (is_partial) {
        updateData.status = 'partial';
      } else {
        updateData.status = 'settled';
      }
      await base44.asServiceRole.entities.PortalFinanceTransaction.update(transaction_id, updateData);

      // Registrar histórico
      try {
        const tx = await base44.asServiceRole.entities.PortalFinanceTransaction.get(transaction_id);
        const portalUsers = await base44.asServiceRole.entities.PortalUser.filter({ email });
        const actedByName = portalUsers.length > 0 ? portalUsers[0].name : email;
        await base44.asServiceRole.entities.FinanceSettlementHistory.create({
          user_email: email,
          acted_by_email: email,
          acted_by_name: actedByName,
          transaction_id,
          transaction_description: tx?.description || '',
          transaction_type: tx?.type || 'expense',
          action_type: is_partial ? 'partial_settle' : 'settle',
          action_date: new Date().toISOString(),
          amount: tx?.amount || 0,
          settled_amount: settled_amount || 0,
          interest_amount: interest_amount || 0,
          discount_amount: discount_amount || 0,
          bank_name: bank_name || '',
          contact_name: tx?.contact_name || '',
        });
      } catch (_) {}

      return Response.json({ success: true });
    }

    // ─── FINANCE: reopen transaction (estornar baixa) ───
    if (operation === 'reopenTransaction') {
      const { email, transaction_id } = body;

      // Registrar histórico antes de limpar
      try {
        const tx = await base44.asServiceRole.entities.PortalFinanceTransaction.get(transaction_id);
        const portalUsers = await base44.asServiceRole.entities.PortalUser.filter({ email });
        const actedByName = portalUsers.length > 0 ? portalUsers[0].name : email;
        await base44.asServiceRole.entities.FinanceSettlementHistory.create({
          user_email: email,
          acted_by_email: email,
          acted_by_name: actedByName,
          transaction_id,
          transaction_description: tx?.description || '',
          transaction_type: tx?.type || 'expense',
          action_type: 'reopen',
          action_date: new Date().toISOString(),
          amount: tx?.amount || 0,
          settled_amount: tx?.settled_amount || 0,
          interest_amount: tx?.interest_amount || 0,
          discount_amount: tx?.discount_amount || 0,
          bank_name: tx?.bank_name || '',
          contact_name: tx?.contact_name || '',
        });
      } catch (_) {}

      await base44.asServiceRole.entities.PortalFinanceTransaction.update(transaction_id, {
        status: 'pending',
        bank_account_id: undefined,
        bank_name: undefined,
        settled_date: undefined,
        settled_amount: 0,
        remaining_amount: 0,
        interest_amount: 0,
        discount_amount: 0,
        is_partial: false,
      });
      return Response.json({ success: true });
    }

    // ─── FINANCE: get settlement history ───
    if (operation === 'getSettlementHistory') {
      const { email } = body;
      const history = await base44.asServiceRole.entities.FinanceSettlementHistory.filter(
        { user_email: email },
        '-action_date',
        200
      );
      return Response.json({ history });
    }

    // ─── FINANCE: delete transaction ───
    if (operation === 'deleteTransaction') {
      const { email, transaction_id } = body;
      await base44.asServiceRole.entities.PortalFinanceTransaction.delete(transaction_id);
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length > 0 && !users[0].finance_full_access && users[0].finance_transactions_used > 0) {
        await base44.asServiceRole.entities.PortalUser.update(users[0].id, {
          finance_transactions_used: users[0].finance_transactions_used - 1,
        });
      }
      return Response.json({ success: true });
    }

    // ─── FINANCE: request release ───
    if (operation === 'requestRelease') {
      const { email } = body;
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const user = users[0];
      await base44.asServiceRole.entities.PortalUser.update(user.id, {
        finance_release_requested: true,
      });

      // Notify admin by email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: "ailtonsaib@gmail.com",
        from_name: "SoftPremier Portal",
        subject: `🔓 Solicitação de Liberação — ${user.name || email}`,
        body: `O usuário ${user.name || '—'} (${email}) solicitou liberação de acesso completo ao Controle de Finanças.\n\nData: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
      });

      // Notify admin by WhatsApp (non-blocking)
      try {
        await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
          message: `🔓 *Solicitação de Liberação — Finance*\n\nUsuário: ${user.name || '—'}\nE-mail: ${email}\n\nAcesse o painel administrativo para liberar o acesso.`
        });
      } catch (_) {}

      return Response.json({ success: true });
    }

    // ─── ADMIN: reset password ───
    if (operation === 'resetPassword') {
      const { admin_email, user_email, new_password } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email: user_email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(new_password, salt);
      await base44.asServiceRole.entities.PortalUser.update(users[0].id, {
        password_hash: hash,
      });
      return Response.json({ success: true });
    }

    // ─── CHANGE PASSWORD (self) ───
    if (operation === 'changePassword') {
      const { email, current_password, new_password } = body;
      if (!email || !current_password || !new_password) {
        return Response.json({ error: 'Email, senha atual e nova senha são obrigatórios' }, { status: 400 });
      }
      if (email === 'teste@softpremier.com.br') {
        return Response.json({ error: 'A senha do usuário de teste não pode ser alterada' }, { status: 403 });
      }
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const user = users[0];
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) {
        return Response.json({ error: 'Senha atual incorreta' }, { status: 401 });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(new_password, salt);
      await base44.asServiceRole.entities.PortalUser.update(user.id, {
        password_hash: hash,
        must_change_password: false,
      });
      return Response.json({ success: true });
    }

    // ─── ADMIN: reset password (back to default) ───
    if (operation === 'resetToDefault') {
      const { admin_email, user_email } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const users = await base44.asServiceRole.entities.PortalUser.filter({ email: user_email });
      if (users.length === 0) {
        return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('Premier@123', salt);
      await base44.asServiceRole.entities.PortalUser.update(users[0].id, {
        password_hash: hash,
        must_change_password: true,
      });
      return Response.json({ success: true });
    }

    // ─── CONTACTS: list ───
    if (operation === 'getContacts') {
      const { email } = body;
      const items = await base44.asServiceRole.entities.FinanceContact.filter(
        { user_email: email },
        '-created_date'
      );
      return Response.json({ contacts: items });
    }

    // ─── CONTACTS: save (create or update) ───
    if (operation === 'saveContact') {
      const { email, razao_social, nome_fantasia, cnpj, endereco, tipo, is_active, id } = body;
      if (!email || !razao_social || !tipo) {
        return Response.json({ error: 'Email, razão social e tipo são obrigatórios' }, { status: 400 });
      }
      if (id) {
        const updated = await base44.asServiceRole.entities.FinanceContact.update(id, {
          razao_social, nome_fantasia: nome_fantasia || undefined, cnpj: cnpj || undefined,
          endereco: endereco || undefined, tipo, is_active: is_active !== false,
        });
        return Response.json({ contact: updated });
      }
      const created = await base44.asServiceRole.entities.FinanceContact.create({
        user_email: email, razao_social, nome_fantasia: nome_fantasia || undefined,
        cnpj: cnpj || undefined, endereco: endereco || undefined, tipo, is_active: is_active !== false,
      });
      return Response.json({ contact: created });
    }

    // ─── CONTACTS: delete ───
    if (operation === 'deleteContact') {
      const { id } = body;
      await base44.asServiceRole.entities.FinanceContact.delete(id);
      return Response.json({ success: true });
    }

    // ─── COST CENTERS: list ───
    if (operation === 'getCostCenters') {
      const { email } = body;
      const items = await base44.asServiceRole.entities.FinanceCostCenter.filter(
        { user_email: email },
        '-created_date'
      );
      return Response.json({ costCenters: items });
    }

    // ─── COST CENTERS: save (create or update) ───
    if (operation === 'saveCostCenter') {
      const { email, name, level, parent_id, code, is_active, id } = body;
      if (!email || !name || !level) {
        return Response.json({ error: 'Email, nome e nível são obrigatórios' }, { status: 400 });
      }
      // Validação de amarração hierárquica
      if (level === 'setor' && !parent_id) {
        return Response.json({ error: 'Um Setor deve obrigatoriamente estar vinculado a um Departamento.' }, { status: 400 });
      }
      if (level === 'centro_custo' && !parent_id) {
        return Response.json({ error: 'Um Centro de Custo deve obrigatoriamente estar vinculado a um Setor.' }, { status: 400 });
      }
      // Valida que o pai existe e é do nível correto
      if (parent_id) {
        const parent = await base44.asServiceRole.entities.FinanceCostCenter.get(parent_id);
        if (!parent) {
          return Response.json({ error: 'Item pai não encontrado.' }, { status: 400 });
        }
        if (level === 'setor' && parent.level !== 'departamento') {
          return Response.json({ error: 'O pai de um Setor deve ser um Departamento.' }, { status: 400 });
        }
        if (level === 'centro_custo' && parent.level !== 'setor') {
          return Response.json({ error: 'O pai de um Centro de Custo deve ser um Setor.' }, { status: 400 });
        }
      }
      if (id) {
        const updated = await base44.asServiceRole.entities.FinanceCostCenter.update(id, {
          name, level, parent_id: parent_id || undefined, code: code || undefined,
          is_active: is_active !== false,
        });
        return Response.json({ costCenter: updated });
      }
      const created = await base44.asServiceRole.entities.FinanceCostCenter.create({
        user_email: email, name, level,
        parent_id: parent_id || undefined, code: code || undefined,
        is_active: is_active !== false,
      });
      return Response.json({ costCenter: created });
    }

    // ─── COST CENTERS: delete ───
    if (operation === 'deleteCostCenter') {
      const { id } = body;
      await base44.asServiceRole.entities.FinanceCostCenter.delete(id);
      return Response.json({ success: true });
    }

    // ─── BANK ACCOUNTS: list ───
    if (operation === 'getBankAccounts') {
      const { email } = body;
      const items = await base44.asServiceRole.entities.FinanceBankAccount.filter(
        { user_email: email },
        '-created_date'
      );
      return Response.json({ bankAccounts: items });
    }

    // ─── BANK ACCOUNTS: save (create or update) ───
    if (operation === 'saveBankAccount') {
      const { email, bank_code, bank_name, agency, account_number, account_type, holder_name, is_active, id } = body;
      if (!email || !bank_code || !bank_name || !agency || !account_number) {
        return Response.json({ error: 'Campos obrigatórios não preenchidos' }, { status: 400 });
      }
      if (id) {
        const updated = await base44.asServiceRole.entities.FinanceBankAccount.update(id, {
          bank_code, bank_name, agency, account_number,
          account_type: account_type || 'corrente',
          holder_name: holder_name || undefined,
          is_active: is_active !== false,
        });
        return Response.json({ bankAccount: updated });
      }
      const created = await base44.asServiceRole.entities.FinanceBankAccount.create({
        user_email: email, bank_code, bank_name, agency, account_number,
        account_type: account_type || 'corrente',
        holder_name: holder_name || undefined,
        is_active: is_active !== false,
      });
      return Response.json({ bankAccount: created });
    }

    // ─── BANK ACCOUNTS: delete ───
    if (operation === 'deleteBankAccount') {
      const { id } = body;
      await base44.asServiceRole.entities.FinanceBankAccount.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: `Operação não suportada: ${operation}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});