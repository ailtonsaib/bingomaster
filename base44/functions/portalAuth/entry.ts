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
          bingo_plan: 'free',
          finance_transaction_limit: 10,
          finance_transactions_used: 0,
          finance_full_access: true,
          finance_release_requested: false,
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
          bingo_plan: 'free',
          finance_transaction_limit: 10,
          finance_transactions_used: 0,
          finance_full_access: false,
          finance_release_requested: false,
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
      return Response.json({ user: stripPassword(user) });
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
      const { admin_email, email, password, name, can_access_bingo, can_access_finance, bingo_plan, finance_full_access, finance_transaction_limit, finance_transactions_used, finance_release_requested } = body;
      const admin = await verifyAdmin(base44, admin_email);
      if (!admin) {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const existing = await base44.asServiceRole.entities.PortalUser.filter({ email });
      if (existing.length > 0) {
        return Response.json({ error: 'Email já cadastrado' }, { status: 409 });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const created = await base44.asServiceRole.entities.PortalUser.create({
        email,
        password_hash: hash,
        name,
        can_access_bingo: can_access_bingo ?? true,
        can_access_finance: can_access_finance ?? false,
        bingo_plan: bingo_plan || 'free',
        finance_transaction_limit: finance_transaction_limit ?? 10,
        finance_transactions_used: finance_transactions_used ?? 0,
        finance_full_access: finance_full_access ?? false,
        finance_release_requested: finance_release_requested ?? false,
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
      const { email, description, amount, type, category } = body;
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
      });
      if (!user.finance_full_access) {
        await base44.asServiceRole.entities.PortalUser.update(user.id, {
          finance_transactions_used: user.finance_transactions_used + 1,
        });
      }
      return Response.json({ success: true });
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
      await base44.asServiceRole.entities.PortalUser.update(users[0].id, {
        finance_release_requested: true,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: `Operação não suportada: ${operation}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});