import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DEFAULT_LIMITS = {
  free: { max_diagnostics: 5, max_clients: 5, max_vehicles: 5, max_service_orders: -1, can_delete: false, price: 0, plan_name: 'Free' },
  teste: { max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: 10, can_delete: false, price: 0, plan_name: 'Teste' },
  bronze: { max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, price: 19.9, plan_name: 'Bronze' },
  master: { max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, price: 29.9, plan_name: 'Master' },
};

async function getUserPlan(base44, email) {
  const users = await base44.asServiceRole.entities.PortalUser.filter({ email });
  if (users.length === 0) return null;
  const portalUser = users[0];

  // Admins have unlimited access
  if (portalUser.is_admin) {
    return { plan: 'master', ...DEFAULT_LIMITS.master, is_admin: true };
  }

  const planId = portalUser.diagnostic_plan || 'free';

  // Check for custom plan config
  const configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.filter({ plan_id: planId, is_active: true });
  if (configs.length > 0) {
    const c = configs[0];
    return {
      plan: planId,
      max_diagnostics: c.max_diagnostics ?? DEFAULT_LIMITS[planId]?.max_diagnostics ?? -1,
      max_clients: c.max_clients ?? DEFAULT_LIMITS[planId]?.max_clients ?? -1,
      max_vehicles: c.max_vehicles ?? DEFAULT_LIMITS[planId]?.max_vehicles ?? -1,
      max_service_orders: c.max_service_orders ?? DEFAULT_LIMITS[planId]?.max_service_orders ?? -1,
      can_delete: c.can_delete ?? false,
      price: c.price ?? 0,
      plan_name: c.plan_name,
      is_admin: false,
    };
  }

  // Fallback to defaults
  const def = DEFAULT_LIMITS[planId] || DEFAULT_LIMITS.free;
  return { plan: planId, ...def, is_admin: false };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { operation } = body;

    // ─── GET USAGE ───
    if (operation === 'getUsage') {
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado no portal' }, { status: 404 });

      const [clients, vehicles, diagnostics, serviceOrders] = await Promise.all([
        base44.asServiceRole.entities.DiagnosticClient.filter({ user_email: user.email }),
        base44.asServiceRole.entities.DiagnosticVehicle.filter({ user_email: user.email }),
        base44.asServiceRole.entities.DiagnosticRecord.filter({ user_email: user.email }),
        base44.asServiceRole.entities.ServiceOrder.filter({ user_email: user.email }),
      ]);

      return Response.json({
        ...planInfo,
        used_clients: clients.length,
        used_vehicles: vehicles.length,
        used_diagnostics: diagnostics.length,
        used_service_orders: serviceOrders.length,
      });
    }

    // ─── CHECK SERVICE ORDER LIMIT ───
    if (operation === 'checkServiceOrderLimit') {
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado no portal' }, { status: 404 });

      const serviceOrders = await base44.asServiceRole.entities.ServiceOrder.filter({ user_email: user.email });
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
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado no portal' }, { status: 404 });

      const { client_data, vehicle_data, is_new_client, existing_client_name } = body;

      // Check client limit
      if (is_new_client) {
        const clients = await base44.asServiceRole.entities.DiagnosticClient.filter({ user_email: user.email });
        if (planInfo.max_clients >= 0 && clients.length >= planInfo.max_clients) {
          return Response.json({ error: `Limite de ${planInfo.max_clients} clientes atingido no plano ${planInfo.plan_name}. Faça upgrade para o plano Master.` }, { status: 403 });
        }
      }

      // Check vehicle limit
      const vehicles = await base44.asServiceRole.entities.DiagnosticVehicle.filter({ user_email: user.email });
      if (planInfo.max_vehicles >= 0 && vehicles.length >= planInfo.max_vehicles) {
        return Response.json({ error: `Limite de ${planInfo.max_vehicles} veículos atingido no plano ${planInfo.plan_name}. Faça upgrade para o plano Master.` }, { status: 403 });
      }

      let finalCpfCnpj = client_data?.cpf_cnpj || body.cpf_cnpj;

      // Create client if new
      if (is_new_client && client_data) {
        await base44.entities.DiagnosticClient.create({
          user_email: user.email,
          name: client_data.name,
          cpf_cnpj: client_data.cpf_cnpj,
          phone: client_data.phone || undefined,
          email: client_data.email || undefined,
          address: client_data.address || undefined,
        });
        finalCpfCnpj = client_data.cpf_cnpj;
      }

      // Create vehicle
      const createdVehicle = await base44.entities.DiagnosticVehicle.create({
        user_email: user.email,
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

    // ─── DELETE CLIENT (master only) ───
    if (operation === 'deleteClient') {
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (!planInfo.can_delete) {
        return Response.json({ error: 'Exclusão não permitida no seu plano. Faça upgrade para o plano Bronze ou Master.' }, { status: 403 });
      }
      await base44.asServiceRole.entities.DiagnosticClient.delete(body.client_id);
      return Response.json({ success: true });
    }

    // ─── DELETE VEHICLE (master only) ───
    if (operation === 'deleteVehicle') {
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (!planInfo.can_delete) {
        return Response.json({ error: 'Exclusão não permitida no seu plano. Faça upgrade para o plano Bronze ou Master.' }, { status: 403 });
      }
      await base44.asServiceRole.entities.DiagnosticVehicle.delete(body.vehicle_id);
      return Response.json({ success: true });
    }

    // ─── ADMIN: GET PLAN CONFIGS ───
    if (operation === 'getPlanConfigs') {
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      let configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.list();
      // Seed defaults if empty
      if (configs.length === 0) {
        await base44.asServiceRole.entities.DiagnosticPlanConfig.bulkCreate([
          { plan_id: 'free', plan_name: 'Free', price: 0, max_diagnostics: 5, max_clients: 5, max_vehicles: 5, max_service_orders: -1, can_delete: false, is_active: true },
          { plan_id: 'teste', plan_name: 'Teste', price: 0, max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: 10, can_delete: false, is_active: true },
          { plan_id: 'bronze', plan_name: 'Bronze', price: 19.9, max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, is_active: true },
          { plan_id: 'master', plan_name: 'Master', price: 29.9, max_diagnostics: -1, max_clients: -1, max_vehicles: -1, max_service_orders: -1, can_delete: true, is_active: true },
        ]);
        configs = await base44.asServiceRole.entities.DiagnosticPlanConfig.list();
      }
      return Response.json({ configs });
    }

    // ─── ADMIN: SAVE PLAN CONFIG ───
    if (operation === 'savePlanConfig') {
      const planInfo = await getUserPlan(base44, user.email);
      if (!planInfo?.is_admin) return Response.json({ error: 'Acesso negado' }, { status: 403 });

      const { plan_id, plan_name, price, max_diagnostics, max_clients, max_vehicles, max_service_orders, can_delete, is_active, id } = body;
      const existing = await base44.asServiceRole.entities.DiagnosticPlanConfig.filter({ plan_id });

      if (existing.length > 0 || id) {
        const configId = id || existing[0].id;
        const updated = await base44.asServiceRole.entities.DiagnosticPlanConfig.update(configId, {
          plan_name, price, max_diagnostics: Number(max_diagnostics), max_clients: Number(max_clients), max_vehicles: Number(max_vehicles), max_service_orders: Number(max_service_orders), can_delete, is_active: is_active !== false,
        });
        return Response.json({ config: updated });
      }

      const created = await base44.asServiceRole.entities.DiagnosticPlanConfig.create({
        plan_id, plan_name, price, max_diagnostics: Number(max_diagnostics), max_clients: Number(max_clients), max_vehicles: Number(max_vehicles), max_service_orders: Number(max_service_orders), can_delete, is_active: is_active !== false,
      });
      return Response.json({ config: created });
    }

    return Response.json({ error: `Operação não suportada: ${operation}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});