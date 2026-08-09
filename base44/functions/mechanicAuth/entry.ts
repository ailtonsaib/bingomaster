import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { generateTempPassword, sendRecoveryEmail } from '../../shared/passwordRecovery.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation } = body;

    // ─── GET COMPANIES ───
    // Retorna as empresas vinculadas ao email do mecânico
    if (operation === 'getCompanies') {
      const { email } = body;
      if (!email) return Response.json({ error: 'Email obrigatório' }, { status: 400 });

      const mechanics = await base44.asServiceRole.entities.DiagnosticMechanic.filter({ email: email.trim() });
      if (mechanics.length === 0) {
        return Response.json({ companies: [] });
      }

      // Busca dados das empresas (DiagnosticCompanyConfig) pelos user_email
      const ownerEmails = [...new Set(mechanics.map(m => m.user_email))];
      const companies = [];
      for (const ownerEmail of ownerEmails) {
        const configs = await base44.asServiceRole.entities.DiagnosticCompanyConfig.filter({ user_email: ownerEmail });
        if (configs.length > 0) {
          const c = configs[0];
          companies.push({
            user_email: ownerEmail,
            razao_social: c.razao_social,
            nome_fantasia: c.nome_fantasia,
            mechanic_id: mechanics.find(m => m.user_email === ownerEmail).id,
            has_password: !!mechanics.find(m => m.user_email === ownerEmail).password,
          });
        } else {
          // Empresa sem config — usa o email como identificador
          companies.push({
            user_email: ownerEmail,
            razao_social: ownerEmail,
            nome_fantasia: '',
            mechanic_id: mechanics.find(m => m.user_email === ownerEmail).id,
            has_password: !!mechanics.find(m => m.user_email === ownerEmail).password,
          });
        }
      }

      return Response.json({ companies });
    }

    // ─── LOGIN ───
    // Valida senha do mecânico para uma empresa específica
    if (operation === 'login') {
      const { email, password, user_email } = body;
      if (!email || !password) {
        return Response.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
      }

      const filter = { email: email.trim() };
      if (user_email) filter.user_email = user_email;

      const mechanics = await base44.asServiceRole.entities.DiagnosticMechanic.filter(filter);
      if (mechanics.length === 0) {
        return Response.json({ error: 'Mecânico não encontrado' }, { status: 404 });
      }

      const mech = mechanics.find(m => m.password === password.trim() && m.is_active !== false);
      if (!mech) {
        return Response.json({ error: 'Senha incorreta ou mecânico inativo' }, { status: 401 });
      }

      return Response.json({
        id: mech.id,
        name: mech.name,
        email: mech.email,
        user_email: mech.user_email,
        specialty: mech.specialty,
      });
    }

    // ─── REQUEST PASSWORD RESET (envia senha temporária por email) ───
    if (operation === 'requestPasswordReset') {
      const { email } = body;
      if (!email) return Response.json({ error: 'Email é obrigatório' }, { status: 400 });
      const mechanics = await base44.asServiceRole.entities.DiagnosticMechanic.filter({ email: email.trim() });
      if (mechanics.length === 0) return Response.json({ error: 'Email não encontrado' }, { status: 404 });
      const mech = mechanics.find(m => m.is_active !== false) || mechanics[0];
      if (mech.is_active === false) return Response.json({ error: 'Mecânico inativo' }, { status: 403 });
      const tempPassword = generateTempPassword();
      await base44.asServiceRole.entities.DiagnosticMechanic.update(mech.id, { password: tempPassword });
      try {
        await sendRecoveryEmail(base44, email, mech.name, tempPassword, 'Painel do Mecânico - SoftPremier');
      } catch (e) {
        return Response.json({ error: 'Falha ao enviar email de recuperação' }, { status: 500 });
      }
      return Response.json({ success: true, message: 'Senha temporária enviada para seu email' });
    }

    // ─── CHANGE PASSWORD (self) ───
    if (operation === 'changePassword') {
      const { email, current_password, new_password } = body;
      if (!email || !current_password || !new_password) {
        return Response.json({ error: 'Email, senha atual e nova senha são obrigatórios' }, { status: 400 });
      }
      if (new_password.length < 6) {
        return Response.json({ error: 'A nova senha deve ter ao menos 6 caracteres' }, { status: 400 });
      }
      const mechanics = await base44.asServiceRole.entities.DiagnosticMechanic.filter({ email: email.trim() });
      if (mechanics.length === 0) return Response.json({ error: 'Email não encontrado' }, { status: 404 });
      const mech = mechanics[0];
      if (mech.password !== current_password) {
        return Response.json({ error: 'Senha atual incorreta' }, { status: 401 });
      }
      if (current_password === new_password) {
        return Response.json({ error: 'A nova senha deve ser diferente da atual' }, { status: 400 });
      }
      await base44.asServiceRole.entities.DiagnosticMechanic.update(mech.id, { password: new_password });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Operação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});