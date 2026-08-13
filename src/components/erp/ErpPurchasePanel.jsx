import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, ShoppingCart, ArrowDownToLine, Send } from "lucide-react";
import ErpPurchaseFormModal from "./ErpPurchaseFormModal";
import { fmtMoney, fmtDate, PURCHASE_STATUS } from "@/lib/erpUtils";

export default function ErpPurchasePanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [o, p, s] = await Promise.all([
        base44.entities.ErpPurchaseOrder.filter({ user_email: user.email }, "-emission_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpSupplier.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setOrders(o); setProducts(p); setSuppliers(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = orders.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const t = (o.order_number + " " + (o.supplier_name || "")).toLowerCase();
    return okS && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => {
    if (!confirm(`Excluir o pedido "${o.order_number}"?`)) return;
    await base44.entities.ErpPurchaseOrder.delete(o.id);
    load();
  };

  // Enviar pedido ao fornecedor (muda status para enviada)
  const handleSend = async (o) => {
    await base44.entities.ErpPurchaseOrder.update(o.id, { status: "enviada" });
    load();
  };

  // Receber mercadoria — dá entrada no estoque
  const handleReceive = async (o) => {
    if (!confirm(`Confirmar recebimento do pedido "${o.order_number}"? O estoque será atualizado.`)) return;
    setBusy(o.id);
    try {
      for (const it of (o.items || [])) {
        if (!it.product_id) continue;
        const prod = await base44.entities.ErpProduct.get(it.product_id);
        const newStock = (Number(prod.stock) || 0) + (Number(it.quantity) || 0);
        await base44.entities.ErpProduct.update(it.product_id, {
          stock: newStock,
          cost_price: Number(it.unit_cost) || prod.cost_price || 0,
        });
      }
      await base44.entities.ErpPurchaseOrder.update(o.id, { status: "recebida" });
      load();
    } catch (e) { alert("Erro ao dar entrada: " + e.message); }
    setBusy(null);
  };

  return (
    <div className="space-y-3">
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
                <th className="p-2 text-left">Emissão</th>
                <th className="p-2 text-left">Entrega</th>
                <th className="p-2 text-right">Itens</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum pedido de compra.
                </td></tr>
              ) : filtered.map(o => {
                const st = PURCHASE_STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{o.order_number}</td>
                    <td className="p-2">{o.supplier_name || "—"}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.emission_date)}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.expected_date)}</td>
                    <td className="p-2 text-right">{o.items?.length || 0}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.total_value)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {o.status === "rascunho" && (
                        <button onClick={() => handleSend(o)} title="Enviar ao fornecedor" className="p-1 hover:bg-blue-50 rounded"><Send className="w-4 h-4 text-blue-600" /></button>
                      )}
                      {(o.status === "enviada" || o.status === "recebida_parcial") && (
                        <button onClick={() => handleReceive(o)} disabled={busy === o.id} title="Reber e dar entrada no estoque" className="p-1 hover:bg-emerald-50 rounded">
                          <ArrowDownToLine className={`w-4 h-4 text-emerald-600 ${busy === o.id ? "animate-spin" : ""}`} />
                        </button>
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