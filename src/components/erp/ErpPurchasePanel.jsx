import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, ShoppingCart, Send, CheckCircle2, XCircle, Clock, Building2 } from "lucide-react";
import ErpPurchaseFormModal from "./ErpPurchaseFormModal";
import { fmtMoney, fmtDate, PURCHASE_STATUS, APPROVAL_STATUS } from "@/lib/erpUtils";
import { resolveCurrentErpUser, canApprovePo, filterVisibleOrders } from "@/lib/erpApproval";

export default function ErpPurchasePanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [ctx, setCtx] = useState({ isDiretor: true, erpUser: null });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [o, p, s, a, c] = await Promise.all([
        base44.entities.ErpPurchaseOrder.filter({ user_email: user.email }, "-emission_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpPartner.filter({ user_email: user.email, partner_type: { $in: ["fornecedor", "ambos"] } }, "-created_date", 500),
        base44.entities.ErpApprover.filter({ user_email: user.email }, "department_name", 500),
        resolveCurrentErpUser(user),
      ]);
      setOrders(o); setProducts(p); setSuppliers(s); setApprovers(a); setCtx(c);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  // Filtra visibilidade por setor (diretor vê tudo)
  const visible = filterVisibleOrders(orders, ctx);

  const filtered = visible.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const t = (o.order_number + " " + (o.supplier_name || "") + " " + (o.department_name || "")).toLowerCase();
    return okS && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => {
    if (!confirm(`Excluir o pedido "${o.order_number}"?`)) return;
    await base44.entities.ErpPurchaseOrder.delete(o.id);
    load();
  };

  const handleSendToApproval = async (o) => {
    if (!o.department_id) { alert("Defina o setor do pedido antes de enviar para aprovação."); return; }
    await base44.entities.ErpPurchaseOrder.update(o.id, { approval_status: "aguardando_aprovacao" });
    load();
  };

  const handleApprove = async (o) => {
    const cfg = approvers.find(a => a.department_id === o.department_id && a.is_active !== false);
    const check = canApprovePo({ isDiretor: ctx.isDiretor, erpUser: ctx.erpUser, po: o, approverConfig: cfg });
    if (!check.can) { alert(`Não é possível aprovar: ${check.reason}`); return; }
    const obs = prompt("Observação da aprovação (opcional):", "") ?? "";
    await base44.entities.ErpPurchaseOrder.update(o.id, {
      approval_status: "aprovada",
      approved_by_id: ctx.erpUser?.id || undefined,
      approved_by_name: ctx.erpUser?.name || user.name,
      approved_date: new Date().toISOString(),
      approval_obs: obs || undefined,
    });
    load();
  };

  const handleReject = async (o) => {
    const cfg = approvers.find(a => a.department_id === o.department_id && a.is_active !== false);
    const check = canApprovePo({ isDiretor: ctx.isDiretor, erpUser: ctx.erpUser, po: o, approverConfig: cfg });
    if (!check.can) { alert(`Não é possível reprovar: ${check.reason}`); return; }
    const obs = prompt("Motivo da reprovação:");
    if (obs === null) return;
    await base44.entities.ErpPurchaseOrder.update(o.id, {
      approval_status: "reprovada",
      approved_by_id: ctx.erpUser?.id || undefined,
      approved_by_name: ctx.erpUser?.name || user.name,
      approved_date: new Date().toISOString(),
      approval_obs: obs || undefined,
    });
    load();
  };

  const handleSend = async (o) => {
    await base44.entities.ErpPurchaseOrder.update(o.id, { status: "enviada" });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-gray-500">
          {ctx.isDiretor
            ? "Você é diretor — vê todos os pedidos e aprova qualquer valor."
            : (ctx.erpUser?.department_name ? `Setor: ${ctx.erpUser.department_name} — você vê somente os pedidos do seu setor.` : "Sem setor vinculado ao seu usuário.")}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos os status</option>
          {Object.entries(PURCHASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Novo Pedido
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Pedido</th>
                <th className="p-2 text-left">Fornecedor</th>
                <th className="p-2 text-left">Setor</th>
                <th className="p-2 text-left">Emissão</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Aprovação</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum pedido de compra visível.
                </td></tr>
              ) : filtered.map(o => {
                const st = PURCHASE_STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                const ap = APPROVAL_STATUS[o.approval_status] || APPROVAL_STATUS.nao_aplica;
                const cfg = approvers.find(a => a.department_id === o.department_id && a.is_active !== false);
                const check = canApprovePo({ isDiretor: ctx.isDiretor, erpUser: ctx.erpUser, po: o, approverConfig: cfg });
                const pending = o.approval_status === "aguardando_aprovacao";
                const canSendToSupplier = o.approval_status === "aprovada" || o.approval_status === "nao_aplica";
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{o.order_number}</td>
                    <td className="p-2">{o.supplier_name || "—"}</td>
                    <td className="p-2 text-gray-600"><span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-gray-400" />{o.department_name || "—"}</span></td>
                    <td className="p-2 text-gray-600">{fmtDate(o.emission_date)}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.total_value)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ap.color}`}>{ap.label}</span>
                      {o.approved_by_name && <div className="text-[10px] text-gray-400 mt-0.5">por {o.approved_by_name}</div>}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {o.status === "rascunho" && o.approval_status === "nao_aplica" && (
                        <button onClick={() => handleSendToApproval(o)} title="Enviar para aprovação" className="p-1 hover:bg-amber-50 rounded"><Clock className="w-4 h-4 text-amber-600" /></button>
                      )}
                      {pending && check.can && (
                        <>
                          <button onClick={() => handleApprove(o)} title="Aprovar" className="p-1 hover:bg-emerald-50 rounded"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></button>
                          <button onClick={() => handleReject(o)} title="Reprovar" className="p-1 hover:bg-red-50 rounded"><XCircle className="w-4 h-4 text-red-500" /></button>
                        </>
                      )}
                      {pending && !check.can && (
                        <span className="text-[10px] text-gray-400" title={check.reason}>aguarda diretor</span>
                      )}
                      {o.status === "rascunho" && canSendToSupplier && (
                        <button onClick={() => handleSend(o)} title="Enviar ao fornecedor" className="p-1 hover:bg-blue-50 rounded"><Send className="w-4 h-4 text-blue-600" /></button>
                      )}
                      <button onClick={() => { setEditing(o); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded"><span className="text-xs">✏️</span></button>
                      <button onClick={() => handleDelete(o)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ErpPurchaseFormModal user={user} order={editing} products={products} suppliers={suppliers} onClose={() => setShowForm(false)} onSaved={load} />
      )}
    </div>
  );
}