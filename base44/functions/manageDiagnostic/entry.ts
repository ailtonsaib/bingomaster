import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DEFAULT_LIMITS = {
  free: { max_diagnostics: 5, max_clients: 5, max_vehicles: 5, max_service_orders: -1, can_delete: false, price: 0, acquisition_price: 0, plan_name: 'Free' },
  teste: { max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: 10, can_delete: false, price: 0, acquisition_price: 0, plan_name: 'Teste' },
  bronze: { max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, price: 19.9, acquisition_price: 99.9, plan_name: 'Bronze' },
  master: { max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, price: 29.9, acquisition_price: 0, plan_name: 'Master' },
};

const GRACE_PERIOD_DAYS = 15;

async function getUserPlan(base44, email, isWorkshopUser = false) {
  const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
  if (users.length === 0) return null;
  const portalUser = users[0];

  // Admins have unlimited access (workshop users nunca são admin)
  if (portalUser.is_admin && !isWorkshopUser) {
    return { plan: 'master', ...DEFAULT_LIMITS.master, is_admin: true, subscription_status: 'active', portal_user_id: portalUser.id };
  }

  const planId = portalUser.diagnostic_plan || 'free';

  // Check for custom plan config
  const configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.filter({ plan_id: planId, is_active: true });
  let limits;
  if (configs.length > 0) {
    const c = configs[0];
    limits = {
      max_diagnostics: c.max_diagnostics ?? -1,
      max_clients: c.max_clients ?? -1,
      max_vehicles: c.max_vehicles ?? -1,
      max_service_orders: c.max_service_orders ?? -1,
      can_delete: c.can_delete ?? false,
      price: c.price ?? 0,
      acquisition_price: c.acquisition_price ?? 0,
      plan_name: c.plan_name,
    };
  } else {
    limits = DEFAULT_LIMITS[planId] || DEFAULT_LIMITS.free;
  }

  return {
    plan: planId,
    ...limits,
    is_admin: false,
    portal_user_id: portalUser.id,
    // Subscription fields
    diagnostic_acquisition_price: portalUser.diagnostic_acquisition_price ?? 0,
    diagnostic_monthly_price: portalUser.diagnostic_monthly_price ?? limits.price,
    diagnostic_registration_date: portalUser.diagnostic_registration_date || null,
    diagnostic_due_date: portalUser.diagnostic_due_date || null,
    diagnostic_grace_end_date: portalUser.diagnostic_grace_end_date || null,
    diagnostic_blocked_date: portalUser.diagnostic_blocked_date || null,
    diagnostic_last_payment_date: portalUser.diagnostic_last_payment_date || null,
    diagnostic_payment_status: portalUser.diagnostic_payment_status || 'active',
  };
}

async function computeSubscriptionStatus(base44, planInfo) {
  // Only bronze plan has subscription enforcement
  if (planInfo.plan !== 'bronze' || planInfo.is_admin) {
    return { subscription_status: 'active', subscription_message: '', days_until_block: -1 };
  }

  const now = new Date();

  // Already blocked
  if (planInfo.diagnostic_blocked_date) {
    return {
      subscription_status: 'blocked',
      subscription_message: 'Sistema bloqueado por inadimplência. Entre em contato com o administrador para regularizar.',
      days_until_block: 0,
    };
  }

  // Check grace period
  if (planInfo.diagnostic_grace_end_date) {
    const graceEnd = new Date(planInfo.diagnostic_grace_end_date);
    if (now > graceEnd) {
      // Grace period ended → auto-block
      await base44.asServiceRole.entities.PortalUser.update(planInfo.portal_user_id, {
        diagnostic_blocked_date: now.toISOString(),
        diagnostic_payment_status: 'blocked',
      });
      return {
        subscription_status: 'blocked',
        subscription_message: 'Período de tolerância encerrado. Sistema bloqueado. Entre em contato com o administrador.',
        days_until_block: 0,
      };
    }
    const daysLeft = Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24));
    return {
      subscription_status: 'grace_period',
      subscription_message: `Mensalidade em atraso. Restam ${daysLeft} dia(s) de acesso. Entre em contato com o administrador para regularizar.`,
      days_until_block: daysLeft,
    };
  }

  // Check due date
  if (planInfo.diagnostic_due_date) {
    const dueDate = new Date(planInfo.diagnostic_due_date);
    if (now > dueDate) {
      // Overdue → start grace period
      const graceEnd = new Date(dueDate);
      graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
      await base44.asServiceRole.entities.PortalUser.update(planInfo.portal_user_id, {
        diagnostic_grace_end_date: graceEnd.toISOString(),
        diagnostic_payment_status: 'grace_period',
      });
      const daysLeft = Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24));
      return {
        subscription_status: 'grace_period',
        subscription_message: `Mensalidade em atraso. Restam ${daysLeft} dia(s) de acesso. Entre em contato com o administrador para regularizar.`,
        days_until_block: daysLeft,
      };
    }
    // Still active, compute days until due
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    return {
      subscription_status: 'active',
      subscription_message: daysUntilDue <= 7 ? `Sua mensalidade vence em ${daysUntilDue} dia(s).` : '',
      days_until_block: -1,
    };
  }

  // No due date set yet
  return { subscription_status: 'active', subscription_message: '', days_until_block: -1 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation, email: rawEmail } = body;

    // Resolve email efetivo — usuários de oficina usam owner_email
    let userEmail = rawEmail;
    let isWorkshopUser = false;
    if (rawEmail) {
      const wsUsers = await base44.asServiceRole.entities.WorkshopUser.filter({ email: rawEmail });
      if (wsUsers.length > 0) {
        isWorkshopUser = true;
        userEmail = wsUsers[0].owner_email;
      }
    }
    if (!userEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ─── GET USAGE ───
    if (operation === 'getUsage') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado no portal' }, { status: 404 });

      const [clients, vehicles, diagnostics, serviceOrders] = await Promise.all([
        base44.asServiceRole.entities.DiagnosticClient.filter({ user_email: userEmail }),
        base44.asServiceRole.entities.DiagnosticVehicle.filter({ user_email: userEmail }),
        base44.asServiceRole.entities.DiagnosticRecord.filter({ user_email: userEmail }),
        base44.asServiceRole.entities.ServiceOrder.filter({ user_email: userEmail }),
      ]);

      const subStatus = await computeSubscriptionStatus(base44, planInfo);

      return Response.json({
        ...planInfo,
        ...subStatus,
        used_clients: clients.length,
        used_vehicles: vehicles.length,
        used_diagnostics: diagnostics.length,
        used_service_orders: serviceOrders.length,
      });
    }

    // ─── CHECK SERVICE ORDER LIMIT ───
    if (operation === 'checkServiceOrderLimit') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado no portal' }, { status: 404 });

      const subStatus = await computeSubscriptionStatus(base44, planInfo);
      if (subStatus.subscription_status === 'blocked') {
        return Response.json({ allowed: false, blocked: true, message: subStatus.subscription_message });
      }

      const serviceOrders = await base44.asServiceRole.entities.ServiceOrder.filter({ user_email: userEmail });
      const used = serviceOrders.length;
      const max = planInfo.max_service_orders;

      if (max >= 0 && used >= max) {
        return Response.json({
          allowed: false,
          used_service_orders: used,
          max_service_orders: max,
          plan: planInfo.plan,
          plan_name: planInfo.plan_name,
        });
      }

      return Response.json({
        allowed: true,
        used_service_orders: used,
        max_service_orders: max,
        plan: planInfo.plan,
        plan_name: planInfo.plan_name,
      });
    }

    // ─── CREATE CLIENT AND VEHICLE ───
    if (operation === 'createClientAndVehicle') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado no portal' }, { status: 404 });

      const { client_data, vehicle_data, is_new_client, existing_client_name } = body;

      if (is_new_client) {
        const clients = await base44.asServiceRole.entities.DiagnosticClient.filter({ user_email: userEmail });
        if (planInfo.max_clients >= 0 && clients.length >= planInfo.max_clients) {
          return Response.json({ error: `Limite de ${planInfo.max_clients} clientes atingido no plano ${planInfo.plan_name}. Faça upgrade para o plano Master.` }, { status: 403 });
        }
      }

      const vehicles = await base44.asServiceRole.entities.DiagnosticVehicle.filter({ user_email: userEmail });
      if (planInfo.max_vehicles >= 0 && vehicles.length >= planInfo.max_vehicles) {
        return Response.json({ error: `Limite de ${planInfo.max_vehicles} veículos atingido no plano ${planInfo.plan_name}. Faça upgrade para o plano Master.` }, { status: 403 });
      }

      let finalCpfCnpj = client_data?.cpf_cnpj || body.cpf_cnpj;

      if (is_new_client && client_data) {
        await base44.entities.DiagnosticClient.create({
          user_email: userEmail,
          name: client_data.name,
          cpf_cnpj: client_data.cpf_cnpj,
          phone: client_data.phone || undefined,
          email: client_data.email || undefined,
          address: client_data.address || undefined,
        });
        finalCpfCnpj = client_data.cpf_cnpj;
      }

      const createdVehicle = await base44.entities.DiagnosticVehicle.create({
        user_email: userEmail,
        client_cpf_cnpj: finalCpfCnpj,
        client_name: is_new_client ? client_data.name : existing_client_name,
        plate: vehicle_data.plate || '',
        brand: vehicle_data.brand,
        model: vehicle_data.model,
        year: vehicle_data.year || '',
        engine: vehicle_data.engine || '',
        fuel: vehicle_data.fuel || 'flex',
        mileage: vehicle_data.mileage ? Number(vehicle_data.mileage) : 0,
        color: vehicle_data.color || '',
        vin: vehicle_data.vin || '',
        observations: vehicle_data.observations || '',
      });

      return Response.json({ success: true, vehicle: createdVehicle });
    }

    // ─── DELETE CLIENT (bronze/master only) ───
    if (operation === 'deleteClient') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (!planInfo.can_delete) {
        return Response.json({ error: 'Exclusão não permitida no seu plano. Faça upgrade para o plano Bronze ou Master.' }, { status: 403 });
      }
      await base44.asServiceRole.entities.DiagnosticClient.delete(body.client_id);
      return Response.json({ success: true });
    }

    // ─── DELETE VEHICLE (bronze/master only) ───
    if (operation === 'deleteVehicle') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (!planInfo.can_delete) {
        return Response.json({ error: 'Exclusão não permitida no seu plano. Faça upgrade para o plano Bronze ou Master.' }, { status: 403 });
      }
      await base44.asServiceRole.entities.DiagnosticVehicle.delete(body.vehicle_id);
      return Response.json({ success: true });
    }

    // ─── ADMIN: GET PLAN CONFIGS ───
    if (operation === 'getPlanConfigs') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      let configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.list();
      if (configs.length === 0) {
        await base44.asServiceRole.entities.DiagnosticPlanConfig.bulkCreate([
          { plan_id: 'free', plan_name: 'Free', price: 0, acquisition_price: 0, max_diagnostics: 5, max_clients: 5, max_vehicles: 5, max_service_orders: -1, can_delete: false, is_active: true },
          { plan_id: 'teste', plan_name: 'Teste', price: 0, acquisition_price: 0, max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: 10, can_delete: false, is_active: true },
          { plan_id: 'bronze', plan_name: 'Bronze', price: 19.9, acquisition_price: 99.9, max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, is_active: true },
          { plan_id: 'master', plan_name: 'Master', price: 29.9, acquisition_price: 0, max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, is_active: true },
        ]);
        configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.list();
      }
      return Response.json({ configs });
    }

    // ─── ADMIN: SAVE PLAN CONFIG ───
    if (operation === 'savePlanConfig') {
      const planInfo = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!planInfo?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      const { plan_id, plan_name, price, acquisition_price, max_diagnostics, max_clients, max_vehicles, max_service_orders, can_delete, is_active, id } = body;
      const existing = await base44.asServiceRole.entities.DiagnosticPlanConfig.filter({ plan_id });

      const updateData = {
        plan_name,
        price: Number(price),
        acquisition_price: Number(acquisition_price) || 0,
        max_diagnostics: Number(max_diagnostics),
        max_clients: Number(max_clients),
        max_vehicles: Number(max_vehicles),
        max_service_orders: Number(max_service_orders),
        can_delete,
        is_active: is_active !== false,
      };

      if (existing.length > 0 || id) {
        const configId = id || existing[0].id;
        const updated = await base44.asServiceRole.entities.DiagnosticPlanConfig.update(configId, updateData);
        return Response.json({ config: updated });
      }

      const created = await base44.asServiceRole.entities.DiagnosticPlanConfig.create({
        plan_id, ...updateData,
      });
      return Response.json({ config: created });
    }

    // ─── ADMIN: REGISTER COMPANY (set subscription start) ───
    if (operation === 'adminRegisterCompany') {
      const adminPlan = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!adminPlan?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      const { user_email, acquisition_price, monthly_price, registration_date } = body;
      const regDate = registration_date ? new Date(registration_date) : new Date();
      const dueDate = new Date(regDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const targetUsers = await base44.asServiceRole.entities.PortalUser.filter({ email: user_email });
      if (targetUsers.length === 0) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });

      await base44.asServiceRole.entities.PortalUser.update(targetUsers[0].id, {
        diagnostic_plan: 'bronze',
        diagnostic_acquisition_price: Number(acquisition_price) || 0,
        diagnostic_monthly_price: Number(monthly_price) || 0,
        diagnostic_registration_date: regDate.toISOString(),
        diagnostic_due_date: dueDate.toISOString(),
        diagnostic_grace_end_date: null,
        diagnostic_blocked_date: null,
        diagnostic_last_payment_date: null,
        diagnostic_payment_status: 'active',
        can_access_diagnostic: true,
      });

      return Response.json({ success: true, message: 'Empresa registrada com sucesso.' });
    }

    // ─── ADMIN: MARK PAYMENT (extend due date by 1 month) ───
    if (operation === 'adminMarkPayment') {
      const adminPlan = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!adminPlan?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      const { user_email } = body;
      const targetUsers = await base44.asServiceRole.entities.PortalUser.filter({ email: user_email });
      if (targetUsers.length === 0) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });

      const portalUser = targetUsers[0];
      const now = new Date();
      const newDueDate = new Date(now);
      newDueDate.setDate(newDueDate.getDate() + 30);

      await base44.asServiceRole.entities.PortalUser.update(portalUser.id, {
        diagnostic_due_date: newDueDate.toISOString(),
        diagnostic_last_payment_date: now.toISOString(),
        diagnostic_grace_end_date: null,
        diagnostic_blocked_date: null,
        diagnostic_payment_status: 'active',
      });

      return Response.json({ success: true, message: 'Pagamento registrado. Mensalidade estendida por 30 dias.' });
    }

    // ─── ADMIN: UNBLOCK ───
    if (operation === 'adminUnblock') {
      const adminPlan = await getUserPlan(base44, userEmail, isWorkshopUser);
      if (!adminPlan?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      const { user_email, extend_days } = body;
      const targetUsers = await base44.asServiceRole.entities.PortalUser.filter({ email: user_email });
      if (targetUsers.length === 0) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });

      const now = new Date();
      const days = Number(extend_days) || 30;
      const newDueDate = new Date(now);
      newDueDate.setDate(newDueDate.getDate() + days);

      await base44.asServiceRole.entities.PortalUser.update(targetUsers[0].id, {
        diagnostic_blocked_date: null,
        diagnostic_grace_end_date: null,
        diagnostic_due_date: newDueDate.toISOString(),
        diagnostic_payment_status: 'active',
      });

      return Response.json({ success: true, message: 'Sistema desbloqueado com sucesso.' });
    }

    return Response.json({ error: `Operação não suportada: ${operation}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});