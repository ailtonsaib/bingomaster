import { base44 } from "@/api/base44Client";

// Resolve o ErpUser logado a partir do usuário do portal.
// O dono/admin sem ErpUser correspondente é tratado como diretor (enxerga tudo).
export async function resolveCurrentErpUser(portalUser) {
  if (!portalUser?.email) return { erpUser: null, isDiretor: true };
  try {
    const list = await base44.entities.ErpUser.filter({ owner_email: portalUser.email }, "-created_date", 500);
    const match = list.find(u => u.email === portalUser.email);
    if (match) {
      return { erpUser: match, isDiretor: match.user_type === "diretor" || match.role === "admin" };
    }
    return { erpUser: null, isDiretor: true };
  } catch {
    return { erpUser: null, isDiretor: true };
  }
}

// Verifica se o usuário atual pode aprovar o pedido de compra.
// approverConfig: registro ErpApprover do setor do pedido (ou null)
export function canApprovePo({ isDiretor, erpUser, po, approverConfig }) {
  if (isDiretor) return { can: true, reason: "Diretor — aprova qualquer valor" };
  if (!erpUser) return { can: false, reason: "Sem perfil de aprovador vinculado" };
  if (!approverConfig) return { can: false, reason: "Nenhum aprovador configurado para o setor" };
  const isApprover = approverConfig.approver_user_id === erpUser.id;
  const isSubstitute = approverConfig.substitute_user_id === erpUser.id;
  if (!isApprover && !isSubstitute) {
    return { can: false, reason: "Você não é o aprovador nem o substituto deste setor" };
  }
  const limite = Number(approverConfig.max_value) || 0;
  if (Number(po?.total_value || 0) > limite) {
    return { can: false, reason: `Valor acima do limite (R$ ${limite.toFixed(2)}) — exige diretor` };
  }
  return { can: true, reason: isApprover ? "Aprovador do setor" : "Substituto do aprovador" };
}

// Filtra as ordens visíveis ao usuário atual.
// Diretor vê todas; demais vêem somente as do seu setor.
export function filterVisibleOrders(orders, { isDiretor, erpUser }) {
  if (isDiretor) return orders;
  if (!erpUser?.department_id) return [];
  return orders.filter(o => o.department_id === erpUser.department_id);
}