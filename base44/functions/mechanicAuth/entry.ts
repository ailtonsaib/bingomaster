import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    return Response.json({ error: 'Operação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});