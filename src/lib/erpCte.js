import { base44 } from "@/api/base44Client";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const digits = (v) => String(v || "").replace(/\D/g, "");
const itemGross = (it) => Number(it.total) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);

// Cadastra a transportadora como fornecedora (ErpPartner) se ainda não existir
async function ensureTransportadora(user, cte) {
  const doc = digits(cte.supplier_cnpj);
  if (!doc) return;
  try {
    const partners = await base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500);
    if (partners.some(p => p.document === doc)) return;
    await base44.entities.ErpPartner.create({
      user_email: user.email,
      partner_type: "fornecedor",
      document_type: doc.length <= 11 ? "cpf" : "cnpj",
      document: doc,
      name: cte.supplier_name || "Transportadora",
      uf: cte.supplier_uf || undefined,
      is_active: true,
    });
  } catch (e) { console.error(e); }
}

// Aplica um CT-e importado (ErpCte): o valor líquido (deduzidos ICMS/PIS/COFINS)
// é rateado proporcionalmente ao valor dos itens das notas vinculadas (entrada
// ou venda) compondo o custo dos produtos, e é gerada uma única conta a pagar
// para a transportadora no vencimento informado.
export async function aplicarCte(user, cte) {
  await ensureTransportadora(user, cte);
  const net = r2((Number(cte.value) || 0) - (Number(cte.icms_value) || 0) - (Number(cte.pis_value) || 0) - (Number(cte.cofins_value) || 0));

  // Carrega as notas vinculadas e o peso de cada uma (valor dos itens)
  const links = cte.links || [];
  const recs = [];
  for (const ln of links) {
    try {
      const rec = ln.kind === "venda"
        ? await base44.entities.ErpSalesOrder.get(ln.id)
        : await base44.entities.ErpFiscalEntry.get(ln.id);
      if (rec) recs.push({ rec, weight: (rec.items || []).reduce((s, it) => s + itemGross(it), 0) });
    } catch (e) { console.error(e); }
  }
  const totalWeight = recs.reduce((s, r) => s + r.weight, 0);

  // Acumula o incremento de custo por produto (proporcional ao valor de cada item)
  const products = await base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500);
  const byId = new Map(products.map(p => [p.id, p]));
  const costAdd = new Map();
  for (const { rec, weight } of recs) {
    for (const it of rec.items || []) {
      const gross = itemGross(it);
      const share = totalWeight > 0 && net > 0 ? net * (gross / totalWeight) : 0;
      if (share <= 0) continue;
      const prod = (it.product_id && byId.get(it.product_id)) || products.find(p => (p.code && p.code === it.product_code) || (p.name && p.name.toLowerCase() === (it.product_name || "").toLowerCase()));
      if (!prod) continue;
      const qty = Number(it.quantity) || 0;
      const inc = qty > 0 ? share / qty : 0;
      const cur = costAdd.get(prod.id) || { prod, add: 0 };
      costAdd.set(prod.id, { prod, add: cur.add + inc });
    }
  }
  let updatedProducts = 0;
  for (const { prod, add } of costAdd.values()) {
    if (add > 0) { await base44.entities.ErpProduct.update(prod.id, { cost_price: r2((prod.cost_price || 0) + add) }); updatedProducts++; }
  }

  // Financeiro: uma única conta a pagar para a transportadora (valor cheio do CT-e)
  if (!cte.financeiro_gerado) {
    await base44.entities.ErpPayable.create({
      user_email: user.email,
      description: `CT-e ${cte.doc_number || ""} - ${cte.supplier_name || ""}`,
      beneficiary: cte.supplier_name || "",
      amount: Number(cte.value) || 0,
      category: "Frete",
      status: "aberto",
      due_date: cte.due_date || undefined,
    });
  }
  return { net, updatedProducts, notes: recs.length };
}