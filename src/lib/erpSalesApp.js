// Regras do App do Vendedor — operações, status e empenho de estoque
export const OPERATIONS = [
  { value: "venda", label: "Venda" },
  { value: "bonificacao", label: "Bonificação" },
  { value: "troca", label: "Troca" },
];

export const ORDER_STATUS = {
  pendente_aprovacao: { label: "Pendente de Aprovação", color: "text-amber-700 bg-amber-100" },
  liberado: { label: "Liberado", color: "text-emerald-700 bg-emerald-100" },
  reprovado: { label: "Reprovado", color: "text-red-700 bg-red-100" },
  faturado: { label: "Faturado", color: "text-sky-700 bg-sky-100" },
  cancelado: { label: "Cancelado", color: "text-gray-600 bg-gray-100" },
};

export const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

// Empenho: pedidos ativos (pendente de aprovação ou liberado) reservam a quantidade vendida.
// O empenho NÃO movimenta o estoque — serve apenas para calcular o saldo disponível.
export function computeEmpenhoMap(orders, excludeId) {
  const map = {};
  for (const o of orders || []) {
    if (!o || o.id === excludeId) continue;
    if (o.status !== "pendente_aprovacao" && o.status !== "liberado") continue;
    for (const it of o.items || []) {
      if (!it.product_id) continue;
      map[it.product_id] = r2((map[it.product_id] || 0) + (Number(it.quantity) || 0));
    }
  }
  return map;
}

// Saldo disponível do produto: estoque atual − empenhado em pedidos ativos
export function availableStock(product, empenhoMap) {
  const reserved = (empenhoMap || {})[product.id] || 0;
  return r2((Number(product.stock) || 0) - reserved);
}