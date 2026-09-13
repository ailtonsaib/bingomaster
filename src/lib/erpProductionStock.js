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
export async function createWarehouseRequisition(user, { production_order_id, production_order_number, finished_order_number, finished_product_name, items, notes }) {
  return base44.entities.ErpWarehouseRequisition.create({
    user_email: user.email,
    number: genOrderNumber("REQ"),
    production_order_id,
    production_order_number,
    finished_order_number: finished_order_number || undefined,
    finished_product_name: finished_product_name || undefined,
    items: items.map(i => ({ ...i, stock_at_request: i.stock || 0 })),
    status: "pendente",
    request_date: new Date().toISOString(),
    notes: notes || undefined,
  });
}

// Árvore de produção multi-nível: ficha técnica → subprodutos com ficha própria (recursivo)
export function buildProductionTree(technicalSheets, productId, qty, visited = new Set()) {
  const sheets = technicalSheets || [];
  const sheet = sheets.find(t => t.product_id === productId && t.is_active !== false);
  const node = { product_id: productId, qty: round3(Number(qty) || 0), bom: [], children: [] };
  if (!sheet || visited.has(productId)) return node; // sem ficha técnica ou ciclo
  visited.add(productId);
  const yieldQ = Number(sheet.yield_quantity) || 1;
  (sheet.items || []).forEach(it => {
    const isSub = it.item_type === "subproduto" && it.product_id !== productId &&
      sheets.some(t => t.product_id === it.product_id && t.is_active !== false);
    const perUnit = round3((Number(it.quantity) || 0) / yieldQ);
    if (isSub) {
      node.children.push(buildProductionTree(sheets, it.product_id, round3(perUnit * node.qty), visited));
    } else {
      node.bom.push({
        product_id: it.product_id,
        product_name: it.product_name || "",
        product_code: it.product_code || "",
        unit: it.product_unit || "UN",
        quantity_per_unit: perUnit,
      });
    }
  });
  return node;
}

// Eficiência de produção pela velocidade nominal da linha: compara a quantidade
// real produzida com a capacidade esperada (velocidade nominal × tempo
// disponível, descontada a parada de refeição). Retorna null quando a OP não tem
// linha com velocidade nominal ou apontamento — a eficiência é sempre calculada
// a partir dos dados atuais, nunca fica desatualizada.
const _lunchMinutes = (s, e) => {
  if (!s || !e) return 0;
  const [sh, sm] = String(s).split(":").map(Number);
  const [eh, em] = String(e).split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
};

export function computeLineEfficiency(order) {
  const uph = Number(order?.units_per_hour) || 0;
  const gross = order?.start_datetime && order?.end_datetime
    ? Math.max(0, Math.round((new Date(order.end_datetime) - new Date(order.start_datetime)) / 60000))
    : 0;
  if (!uph || !gross) return null;
  const availableMin = Math.max(0, gross - _lunchMinutes(order.lunch_start, order.lunch_end));
  const expected = round3(uph * (availableMin / 60));
  if (expected <= 0) return null;
  const produced = Number(order.produced_quantity) || 0;
  return {
    availableMin,
    expected,
    produced,
    efficiency: Math.round((produced / expected) * 100),
  };
}

// Soma insumos repetidos (verificação de estoque global / requisição agrupada)
export function sumMaterials(items) {
  const acc = new Map();
  (items || []).forEach(m => {
    if (!m.product_id) return;
    const cur = acc.get(m.product_id) || {
      product_id: m.product_id,
      product_name: m.product_name || "",
      product_code: m.product_code || "",
      unit: m.unit || "UN",
      quantity: 0,
    };
    cur.quantity = round3(cur.quantity + (Number(m.quantity) || 0));
    acc.set(m.product_id, cur);
  });
  return [...acc.values()];
}