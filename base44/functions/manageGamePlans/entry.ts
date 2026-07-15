import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operation } = body;

    // ===== PUBLIC OPERATIONS =====

    if (operation === 'getGameConfig') {
      const { game_id } = body;
      const configs = await base44.asServiceRole.entities.GamePlanConfig.filter({ game_id, is_active: true });
      if (configs.length === 0) {
        return Response.json({ price: 19.90, free_levels: 10 });
      }
      const c = configs[0];
      return Response.json({ price: c.price, free_levels: c.free_levels });
    }

    if (operation === 'checkUnlock') {
      const { device_code, game_id } = body;
      const unlocks = await base44.asServiceRole.entities.GameUnlock.filter({ device_code, game_id, status: 'approved' });
      return Response.json({ unlocked: unlocks.length > 0 });
    }

    if (operation === 'requestUnlock') {
      const { device_code, game_id, contact_info } = body;
      const existing = await base44.asServiceRole.entities.GameUnlock.filter({ device_code, game_id });
      if (existing.length > 0) {
        return Response.json({ status: existing[0].status, id: existing[0].id, message: 'Ja existe uma solicitacao' });
      }
      const unlock = await base44.asServiceRole.entities.GameUnlock.create({
        device_code,
        game_id,
        status: 'pending',
        contact_info: contact_info || ''
      });
      return Response.json({ status: 'pending', id: unlock.id });
    }

    // ===== ADMIN OPERATIONS =====

    const adminOps = ['getAllConfigs', 'updateConfig', 'getPendingUnlocks', 'getAllUnlocks', 'approveUnlock', 'rejectUnlock'];
    if (!adminOps.includes(operation)) {
      return Response.json({ error: 'Unknown operation' }, { status: 400 });
    }

    const { admin_email } = body;
    if (!admin_email) return Response.json({ error: 'Admin email required' }, { status: 401 });

    const adminUsers = await base44.asServiceRole.entities.PortalUser.filter({ email: admin_email, is_admin: true, is_active: true });
    if (adminUsers.length === 0) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (operation === 'getAllConfigs') {
      const configs = await base44.asServiceRole.entities.GamePlanConfig.list();
      return Response.json({ configs });
    }

    if (operation === 'updateConfig') {
      const { game_id, game_name, price, free_levels, is_active } = body;
      const existing = await base44.asServiceRole.entities.GamePlanConfig.filter({ game_id });
      if (existing.length > 0) {
        const updated = await base44.asServiceRole.entities.GamePlanConfig.update(existing[0].id, {
          price, free_levels, is_active, game_name
        });
        return Response.json({ config: updated });
      } else {
        const created = await base44.asServiceRole.entities.GamePlanConfig.create({
          game_id, game_name, price, free_levels, is_active
        });
        return Response.json({ config: created });
      }
    }

    if (operation === 'getPendingUnlocks') {
      const unlocks = await base44.asServiceRole.entities.GameUnlock.filter({ status: 'pending' });
      return Response.json({ unlocks });
    }

    if (operation === 'getAllUnlocks') {
      const unlocks = await base44.asServiceRole.entities.GameUnlock.list('-created_date', 100);
      return Response.json({ unlocks });
    }

    if (operation === 'approveUnlock') {
      const { unlock_id } = body;
      const updated = await base44.asServiceRole.entities.GameUnlock.update(unlock_id, {
        status: 'approved',
        approved_by: admin_email,
        approved_at: new Date().toISOString()
      });
      return Response.json({ unlock: updated });
    }

    if (operation === 'rejectUnlock') {
      const { unlock_id } = body;
      const updated = await base44.asServiceRole.entities.GameUnlock.update(unlock_id, {
        status: 'rejected',
        approved_by: admin_email,
        approved_at: new Date().toISOString()
      });
      return Response.json({ unlock: updated });
    }

    return Response.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});