import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    // Só audita atualizações de ServiceOrder
    if (event?.type !== "update" || !data || !old_data) {
      return Response.json({ skipped: true, reason: "not an update event" });
    }

    const num = (v) => Number(v) || 0;

    // Compara campos financeiros — detecção direta de valor (não depende de changed_fields)
    const totalChanged = num(old_data.total) !== num(data.total);
    const discountChanged = num(old_data.discount) !== num(data.discount);
    const partsChanged = num(old_data.parts_total) !== num(data.parts_total);
    const laborChanged = num(old_data.labor_total) !== num(data.labor_total);
    const itemsChanged = JSON.stringify(old_data.items || []) !== JSON.stringify(data.items || []);

    const changedFields = [];
    if (totalChanged) changedFields.push("total");
    if (discountChanged) changedFields.push("discount");
    if (partsChanged) changedFields.push("parts_total");
    if (laborChanged) changedFields.push("labor_total");
    if (itemsChanged) changedFields.push("items");

    // Se nenhum valor financeiro mudou, não registra auditoria
    if (changedFields.length === 0) {
      return Response.json({ skipped: true, reason: "no financial fields changed" });
    }

    // Alteração suspeita: valor mudou após OS já estar concluída/entregue (cliente já aprovou)
    const wasApproved = old_data.status === "concluida" || old_data.status === "entregue";
    const isSuspicious = wasApproved;

    // Monta descrição legível
    const changes = [];
    if (totalChanged) changes.push(`Total: R$ ${num(old_data.total).toFixed(2)} → R$ ${num(data.total).toFixed(2)}`);
    if (discountChanged) changes.push(`Desconto: R$ ${num(old_data.discount).toFixed(2)} → R$ ${num(data.discount).toFixed(2)}`);
    if (partsChanged) changes.push(`Total Peças: R$ ${num(old_data.parts_total).toFixed(2)} → R$ ${num(data.parts_total).toFixed(2)}`);
    if (laborChanged) changes.push(`Total Mão de Obra: R$ ${num(old_data.labor_total).toFixed(2)} → R$ ${num(data.labor_total).toFixed(2)}`);
    if (itemsChanged) changes.push("Itens da OS alterados");

    await base44.asServiceRole.entities.ServiceOrderAuditLog.create({
      order_id: data.id || event?.entity_id || "",
      order_number: data.order_number || "",
      user_email: data.user_email || "",
      changed_by_email: data.last_edited_by_email || "",
      changed_by_name: data.last_edited_by_name || "",
      changed_fields: changedFields,
      old_total: num(old_data.total),
      new_total: num(data.total),
      old_discount: num(old_data.discount),
      new_discount: num(data.discount),
      old_parts_total: num(old_data.parts_total),
      new_parts_total: num(data.parts_total),
      old_labor_total: num(old_data.labor_total),
      new_labor_total: num(data.labor_total),
      old_items: old_data.items || [],
      new_items: data.items || [],
      old_status: old_data.status || "",
      new_status: data.status || "",
      is_suspicious: isSuspicious,
      timestamp: new Date().toISOString(),
      description: changes.join(" | "),
    });

    return Response.json({ success: true, logged: true, suspicious: isSuspicious, changed: changedFields });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});