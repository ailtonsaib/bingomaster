import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_PLANS = [
  {
    plan_key: 'free',
    plan_name: 'FREE',
    price: 0,
    downloads_limit: 5,
    sped_types: ['FISCAL'],
    description: 'Para testes e pequenas opera\u00e7\u00f5es',
    is_active: true,
    order: 1
  },
  {
    plan_key: 'basic',
    plan_name: 'B\u00c1SICO',
    price: 49.90,
    downloads_limit: null,
    sped_types: ['FISCAL'],
    description: 'SPED Fiscal ilimitado',
    is_active: true,
    order: 2
  },
  {
    plan_key: 'pro',
    plan_name: 'PRO',
    price: 99.90,
    downloads_limit: null,
    sped_types: ['FISCAL', 'CONTRIBUICOES'],
    description: 'SPED Fiscal + Contribui\u00e7\u00f5es',
    is_active: true,
    order: 3
  },
  {
    plan_key: 'max',
    plan_name: 'MAX',
    price: 199.90,
    downloads_limit: null,
    sped_types: ['FISCAL', 'CONTRIBUICOES', 'ECD', 'ECF'],
    description: 'Todos os m\u00f3dulos SPED',
    is_active: true,
    order: 4
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try {
      body = await req.json();
    } catch (_) {}

    const action = body.action || 'list';

    // Seed defaults if table is empty
    const existing = await base44.asServiceRole.entities.SpedPlanConfig.list('order', 50);
    if (existing.length === 0) {
      await base44.asServiceRole.entities.SpedPlanConfig.bulkCreate(DEFAULT_PLANS);
    }

    if (action === 'list') {
      const plans = await base44.asServiceRole.entities.SpedPlanConfig.list('order', 50);
      return Response.json({ success: true, plans });
    }

    if (action === 'save') {
      // Admin only
      if (user.role !== 'admin') {
        return Response.json({ error: 'Apenas administradores podem alterar planos.' }, { status: 403 });
      }

      const { plan_key, plan_name, price, downloads_limit, sped_types, description, is_active } = body;

      if (!plan_key || !plan_name) {
        return Response.json({ error: 'plan_key e plan_name s\u00e3o obrigat\u00f3rios.' }, { status: 400 });
      }

      const found = await base44.asServiceRole.entities.SpedPlanConfig.filter({ plan_key });
      if (found.length > 0) {
        const updated = await base44.asServiceRole.entities.SpedPlanConfig.update(found[0].id, {
          plan_name,
          price: Number(price) || 0,
          downloads_limit: downloads_limit === null || downloads_limit === '' ? null : Number(downloads_limit),
          sped_types: sped_types || [],
          description: description || '',
          is_active: is_active !== undefined ? is_active : true
        });
        return Response.json({ success: true, plan: updated });
      } else {
        const created = await base44.asServiceRole.entities.SpedPlanConfig.create({
          plan_key,
          plan_name,
          price: Number(price) || 0,
          downloads_limit: downloads_limit === null || downloads_limit === '' ? null : Number(downloads_limit),
          sped_types: sped_types || [],
          description: description || '',
          is_active: is_active !== undefined ? is_active : true,
          order: DEFAULT_PLANS.length
        });
        return Response.json({ success: true, plan: created });
      }
    }

    return Response.json({ error: 'A\u00e7\u00e3o n\u00e3o suportada.' }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});