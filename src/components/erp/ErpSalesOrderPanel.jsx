import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, ShoppingCart, CheckCircle2, X, FileText } from "lucide-react";
import { genOrderNumber, fmtMoney, fmtDate } from "@/lib/erpUtils";
import ErpSalesInvoiceModal from "@/components/erp/ErpSalesInvoiceModal";

const STATUS = {
  aberto: { label: "Aberto", color: "text-amber-700 bg-amber-100" },
  faturado: { label: "Faturado", color: "text-emerald-700 bg-emerald-100" },
  cancelado: { label: "Cancelado", color: "text-red-700 bg-red-100" },
};

export default function ErpSalesOrderPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);
  const [invoicing, setInvoicing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [o, p, c] = await Promise.all([
        base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-emission_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpCustomer.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setOrders(o); setProducts(p); setCustomers(c);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = orders.filter(o => {
    const okS = statusFilter === "all" || o.status === statusFilter;
    const t = (o.number + " " + (o.customer_name || "")).toLowerCase();
    return okS && t.includes(search.toLowerCase());
  });

  const handleDelete = async (o) => { if (!confirm(`Excluir pedido "${o.number}"?`)) return; await base44.entities.ErpSalesOrder.delete(o.id); load(); };

  // Faturar pedido: abre o modal de faturamento — operação de saída (CFOP),
  // impostos pela regra fiscal, parcelas no contas a receber e baixa de estoque
  const handleInvoice = (o) => setInvoicing(o);

  // Emitir NF-e do pedido faturado (ERP): gera e assina o XML da nota
  const handleEmitNfe = async (o) => {
    if (!confirm(`Emitir NF-e do pedido "${o.number}"?`)) return;
    setBusy(o.id);
    try {
      const res = await base44.functions.invoke("gerarNfeSaida", { order_id: o.id, source: "erp", modelo: "55" });
      if (!res?.data?.success) alert(res?.data?.error || "Erro ao emitir NF-e.");
      else alert(`NF-e ${res.data.nfe_number} (série ${res.data.nfe_series}) gerada.\nChave de acesso: ${res.data.nfe_key}`);
      load();
    } catch (e) { alert("Erro ao emitir NF-e: " + e.message); }
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
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Novo Pedido</Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Pedido</th><th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Emissão</th><th className="p-2 text-right">Itens</th>
                <th className="p-2 text-right">Total</th><th className="p-2 text-left">NF-e</th><th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-400"><ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhum pedido de venda.</td></tr>
              : filtered.map(o => {
                const st = STATUS[o.status] || { label: o.status, color: "text-gray-700 bg-gray-100" };
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{o.number}</td>
                    <td className="p-2">{o.customer_name || "—"}</td>
                    <td className="p-2 text-gray-600">{fmtDate(o.emission_date)}</td>
                    <td className="p-2 text-right">{o.items?.length || 0}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(o.total)}</td>
                    <td className="p-2 text-xs">
                      {o.nfe_key
                        ? <span className="text-emerald-700 font-medium" title={`Chave: ${o.nfe_key}`}>NF-e {o.nfe_number}</span>
                        : (o.status === "faturado" ? <span className="text-amber-600">Pendente</span> : "—")}
                    </td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {o.status === "aberto" && (
                        <button onClick={() => handleInvoice(o)} disabled={busy === o.id} title="Faturar — operação, impostos, parcelas e estoque" className="p-1 hover:bg-emerald-50 rounded">
                          <CheckCircle2 className={`w-4 h-4 text-emerald-600 ${busy === o.id ? "animate-spin" : ""}`} />
                        </button>
                      )}
                      {o.status === "faturado" && !o.nfe_key && (
                        <button onClick={() => handleEmitNfe(o)} disabled={busy === o.id} title="Emitir NF-e" className="p-1 hover:bg-blue-50 rounded">
                          <FileText className={`w-4 h-4 text-blue-600 ${busy === o.id ? "animate-pulse" : ""}`} />
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

      {showForm && <ErpSalesForm user={user} order={editing} products={products} customers={customers} onClose={() => setShowForm(false)} onSaved={load} />}
      {invoicing && <ErpSalesInvoiceModal user={user} order={invoicing} products={products} customers={customers} onClose={() => setInvoicing(null)} onSaved={load} />}
    </div>
  );
}

function ErpSalesForm({ user, order, products, customers, onClose, onSaved }) {
  const [form, setForm] = useState({
    number: order?.number || genOrderNumber("PV"),
    customer_id: order?.customer_id || "",
    emission_date: order?.emission_date || new Date().toISOString().slice(0, 10),
    discount: order?.discount || 0,
    payment_method: order?.payment_method || "",
    notes: order?.notes || "",
    items: order?.items || [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { product_id: "", product_name: "", unit: "UN", quantity: 1, unit_price: 0, total: 0 }] }));
  const removeItem = (i) => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(prev => {
    const items = [...prev.items]; items[i] = { ...items[i], [field]: value };
    if (field === "product_id") { const p = products.find(p => p.id === value); if (p) { items[i].product_name = p.name; items[i].unit = p.unit; items[i].unit_price = p.sale_price || 0; } }
    if (["quantity", "unit_price"].includes(field)) items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    return { ...prev, items };
  });

  const subtotal = form.items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const total = subtotal - (Number(form.discount) || 0);

  const handleSave = async () => {
    if (!form.items.length) { alert("Adicione ao menos um item."); return; }
    if (!form.customer_id) { alert("Selecione um cliente."); return; }
    setSaving(true);
    const customer = customers.find(c => c.id === form.customer_id);
    const payload = {
      user_email: user.email, number: form.number, customer_id: form.customer_id, customer_name: customer?.name || "",
      emission_date: new Date(form.emission_date).toISOString(), items: form.items, subtotal,
      discount: Number(form.discount) || 0, total, status: order?.status || "aberto",
      payment_method: form.payment_method || undefined, notes: form.notes || undefined,
    };
    try {
      if (order?.id) await base44.entities.ErpSalesOrder.update(order.id, payload);
      else await base44.entities.ErpSalesOrder.create(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{order ? "Editar Pedido de Venda" : "Novo Pedido de Venda"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Número</Label><Input value={form.number} onChange={e => set("number", e.target.value)} /></div>
            <div><Label>Cliente *</Label>
              <select value={form.customer_id} onChange={e => set("customer_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Emissão</Label><Input type="date" value={form.emission_date} onChange={e => set("emission_date", e.target.value)} /></div>
            <div><Label>Forma de Pagamento</Label><Input value={form.payment_method} onChange={e => set("payment_method", e.target.value)} /></div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b"><span className="text-sm font-semibold">Itens</span>
              <Button size="sm" variant="outline" onClick={addItem} className="h-7 gap-1"><Plus className="w-3.5 h-3.5" /> Item</Button></div>
            {form.items.length === 0 ? <p className="p-4 text-center text-sm text-gray-400">Nenhum item.</p> : form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 p-2 border-b items-end text-xs">
                <div className="col-span-4"><Label className="text-[10px]">Produto</Label>
                  <select value={it.product_id} onChange={e => updateItem(i, "product_id", e.target.value)} className="w-full h-8 rounded border border-input px-2 text-xs">
                    <option value="">Selecione...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label className="text-[10px]">Qtd</Label><Input type="number" value={it.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-2"><Label className="text-[10px]">Preço unit.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="h-8 text-xs" /></div>
                <div className="col-span-3"><Label className="text-[10px]">Total</Label><p className="h-8 flex items-center font-medium">{fmtMoney(it.total)}</p></div>
                <div className="col-span-1"><button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Desconto (R$)</Label><Input type="number" step="0.01" value={form.discount} onChange={e => set("discount", e.target.value)} /></div>
            <div className="flex items-end justify-between"><span className="text-sm text-gray-500">Total</span><span className="text-lg font-bold">{fmtMoney(total)}</span></div>
          </div>
          <div><Label>Observações</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Pedido"}</Button>
        </div>
      </div>
    </div>
  );
}