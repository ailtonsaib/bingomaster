export const PRODUCT_TYPES = [
  { key: "materia_prima", label: "Matéria-Prima", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { key: "mercadoria", label: "Mercadoria", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { key: "produto_acabado", label: "Produto Acabado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { key: "produto_em_processo", label: "Em Processo", color: "text-purple-700 bg-purple-50 border-purple-200" },
  { key: "insumo", label: "Insumo", color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  { key: "consumo", label: "Consumo", color: "text-orange-700 bg-orange-50 border-orange-200" },
  { key: "servico", label: "Serviço", color: "text-gray-700 bg-gray-50 border-gray-200" },
];

export const PURCHASE_STATUS = {
  rascunho: { label: "Rascunho", color: "text-gray-700 bg-gray-100" },
  enviada: { label: "Enviada", color: "text-blue-700 bg-blue-100" },
  recebida_parcial: { label: "Recebida Parcial", color: "text-amber-700 bg-amber-100" },
  recebida: { label: "Recebida", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-red-700 bg-red-100" },
};

export const APPROVAL_STATUS = {
  nao_aplica: { label: "Sem aprovação", color: "text-gray-600 bg-gray-100" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "text-amber-700 bg-amber-100" },
  aprovada: { label: "Aprovada", color: "text-emerald-700 bg-emerald-100" },
  reprovada: { label: "Reprovada", color: "text-red-700 bg-red-100" },
};

export const PRODUCTION_STATUS = {
  rascunho: { label: "Rascunho", color: "text-gray-700 bg-gray-100" },
  standby: { label: "Standby (aguardando estoque)", color: "text-amber-700 bg-amber-100" },
  em_producao: { label: "Em Produção", color: "text-blue-700 bg-blue-100" },
  concluida: { label: "Concluída", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-red-700 bg-red-100" },
};

export const UNITS = ["UN", "KG", "G", "LT", "ML", "M", "M2", "M3", "CX", "PCT", "FD", "PAR", "CJ", "L"];

export function fmtMoney(v) { return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function fmtDate(d) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; } }
export function typeLabel(k) { return (PRODUCT_TYPES.find(t => t.key === k) || {}).label || k; }
export function typeColor(k) { return (PRODUCT_TYPES.find(t => t.key === k) || {}).color || "text-gray-700 bg-gray-50 border-gray-200"; }

export function genOrderNumber(prefix) {
  const y = new Date().getFullYear();
  const n = String(Date.now()).slice(-5);
  return `${prefix} ${n}/${y}`;
}