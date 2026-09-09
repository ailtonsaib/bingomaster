import { base44 } from "@/api/base44Client";
import { genOrderNumber } from "@/lib/erpUtils";

const round3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Calcula a quantidade total de cada insumo a partir do BOM (qtd por unidade × quantidade a produzir)
export function computeNeeded(bomItems, outputQty) {
  return (bomItems || [])
    .filter(b => b.product_id && (Number(b.quantity_per_unit) || 0) > 0)
    .map(b => ({
      product_id: b.product_id,
      product_name: b.product_name || "",
      product_code: b.product_code || "",
      unit: b.unit || "UN",
      quantity: round3((Number(b.quantity_per_unit) || 0) * (Number(outputQty) || 0)),
    }));
}

// Verifica o estoque de cada insumo — retorna as faltas ({ product_name, quantity, stock, unit, missing })
export function checkStock(products, needed) {
  return (needed || [])
    .map(n => {
      const p = (products || []).find(p => p.id === n.product_id);
      const stock = Number(p?.stock) || 0;
      return { ...n, product_name: n.product_name || p?.name || "Produto", stock, missing: Math.max(0, n.quantity - stock) };
    })
    .filter(n => n.stock < n.quantity);
}

export function shortagesMessage(shortages) {
  return shortages.map(s => `• "${s.product_name}" — necessário: ${s.quantity} ${s.unit} | disponível: ${s.stock} ${s.unit}`).join("\n");
}

// Gera a solicitação ao almoxarifado vinculada à ordem de produção
export async function createWarehouseRequisition(user, { production_order_id, production_order_number, items }) {
  return base44.entities.ErpWarehouseRequisition.create({
    user_email: user.email,
    number: genOrderNumber("REQ"),
    production_order_id,
    production_order_number,
    items: items.map(i => ({ ...i, stock_at_request: i.stock || 0 })),
    status: "pendente",
    request_date: new Date().toISOString(),
  });
}