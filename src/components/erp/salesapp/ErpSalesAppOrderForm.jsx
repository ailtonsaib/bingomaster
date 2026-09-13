import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { genOrderNumber, fmtMoney } from "@/lib/erpUtils";
import { OPERATIONS, availableStock, r2 } from "@/lib/erpSalesApp";
import { Loader2, Trash2, AlertTriangle, Search } from "lucide-react";

const DISCOUNT_TYPES = [
  { value: "none", label: "Sem desconto" },
  { value: "percent", label: "%" },
  { value: "value", label: "R$" },
];

// Cálculo da linha: bruto, desconto e líquido
export function lineCalc(it) {
  const gross = r2((Number(it.quantity) || 0) * (Number(it.unit_price) || 0));
  let d = 0;
  if (it.discount_type === "percent") d = gross * (Number(it.discount_pct) || 0) / 100;
  else if (it.discount_type === "value") d = Number(it.discount_value) || 0;
  d = Math.min(r2(d), gross);
  return { gross, discount: d, total: r2(gross - d) };
}

export default function ErpSalesAppOrderForm({ user, order, empenhoMap, onClose, onSaved }) {
  const [team, setTeam] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceTables, setPriceTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    seller_id: order?.seller_id || "",
    customer_id: order?.customer_id || "",
    operation: order?.operation || "venda",
    emission_date: order?.emission_date ? String(order.emission_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: order?.notes || "",
  });
  const [items, setItems] = useState((order?.items || []).map(it => ({
    ...it,
    discount_type: it.discount_type || "none",
    discount_pct: it.discount_pct || "",
    discount_value: it.discount_value || "",
  })));

  useEffect(() => {
    (async () => {
      try {
        const [t, c, p, pt] = await Promise.all([
          base44.entities.ErpSalesTeam.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpCustomer.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpPriceTable.filter({ user_email: user.email }, "-created_date", 500),
        ]);
        setTeam(t.filter(x => x.is_active !== false && x.team_role === "vendedor"));
        setCustomers(c.filter(x => x.is_active !== false));
        setProducts(p.filter(x => x.is_active !== false));
        setPriceTables(pt);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const sellerCustomers = customers.filter(c => c.vendedor_id === form.seller_id);
  const customer = customers.find(c => c.id === form.customer_id);

  // preço da tabela do cliente (vigente) ou preço de venda do produto
  const tablePriceFor = (p) => {
    if (customer?.price_table_id) {
      const table = priceTables.find(t => t.id === customer.price_table_id);
      const item = (table?.items || []).find(i => i.product_id === p.id);
      if (item && Number(item.price) > 0) return r2(item.price);
    }
    return r2(p.sale_price);
  };

  // quantidade já lançada deste produto no próprio pedido
  const qtyInOrder = (pid) => items.filter(i => i.product_id === pid).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  // saldo disponível descontando o que já está no pedido
  const availableFor = (p) => r2(availableStock(p, empenhoMap) - qtyInOrder(p.id));

  const searchResults = search.trim()
    ? products.filter(p => (`${p.name || ""} ${p.code || ""} ${p.barcode || ""}`).toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const addProduct = (p) => {
    const exists = items.findIndex(i => i.product_id === p.id);
    const tp = tablePriceFor(p);
    if (exists >= 0) {
      setItems(prev => prev.map((it, i) => i === exists ? { ...it, quantity: (Number(it.quantity) || 0) + 1 } : it));
    } else {
      setItems(prev => [...prev, {
        product_id: p.id, product_code: p.code || "", barcode: p.barcode || "",
        product_name: p.name, unit: p.unit || "UN",
        quantity: 1, table_price: tp, unit_price: tp,
        discount_type: "none", discount_pct: "", discount_value: "",
      }]);
    }
    setSearch("");
  };

  const setItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const totals = items.reduce((acc, it) => {
    const c = lineCalc(it);
    return { products: r2(acc.products + c.gross), discount: r2(acc.discount + c.discount), total: r2(acc.total + c.total) };
  }, { products: 0, discount: 0, total: 0 });
  const hasDiscount = totals.discount > 0;

  // ao trocar o cliente: atualiza o preço de tabela dos itens (e o preço praticado quando não há desconto)
  const onCustomerChange = (cid) => {
    const prevCustomer = customers.find(c => c.id === form.customer_id);
    const nextCustomer = customers.find(c => c.id === cid);
    setForm(prev => ({ ...prev, customer_id: cid }));
    setItems(prev => prev.map(it => {
      const p = products.find(x => x.id === it.product_id);
      if (!p) return it;
      // recalcula com o novo cliente para pegar a nova tabela
      const tp = (() => {
        if (nextCustomer?.price_table_id) {
          const table = priceTables.find(t => t.id === nextCustomer.price_table_id);
          const titem = (table?.items || []).find(i => i.product_id === p.id);
          if (titem && Number(titem.price) > 0) return r2(titem.price);
        }
        return r2(p.sale_price);
      })();
      const wasTablePrice = Number(it.unit_price) === Number(it.table_price);
      return { ...it, table_price: tp, unit_price: wasTablePrice && prevCustomer?.id !== cid ? tp : it.unit_price };
    }));
  };

  const handleSave = async () => {
    if (!form.seller_id) { alert("Selecione o vendedor."); return; }
    if (!form.customer_id) { alert("Selecione o cliente."); return; }
    if (items.length === 0) { alert("Adicione pelo menos um produto ao pedido."); return; }
    for (const it of items) {
      if (!(Number(it.quantity) > 0)) { alert(`Informe a quantidade de ${it.product_name}.`); return; }
      if (Number(it.unit_price) < 0) { alert(`Preço inválido em ${it.product_name}.`); return; }
      const p = products.find(x => x.id === it.product_id);
      if (p && p.controla_estoque !== false && Number(it.quantity) > availableStock(p, empenhoMap)) {
        alert(`Saldo insuficiente de ${it.product_name}: disponível ${availableStock(p, empenhoMap)} ${it.unit || ""}.`);
        return;
      }
    }
    setSaving(true);
    try {
      const seller = team.find(t => t.id === form.seller_id);
      const payload = {
        user_email: user.email,
        number: order?.number || genOrderNumber("PED"),
        operation: form.operation,
        emission_date: form.emission_date ? new Date(`${form.emission_date}T12:00:00`).toISOString() : new Date().toISOString(),
        seller_id: form.seller_id,
        seller_name: seller?.name || "",
        customer_id: form.customer_id,
        customer_name: customer?.name || "",
        items: items.map(it => {
          const c = lineCalc(it);
          return {
            product_id: it.product_id, product_code: it.product_code || "", barcode: it.barcode || "",
            product_name: it.product_name, unit: it.unit || "",
            quantity: Number(it.quantity) || 0,
            table_price: r2(it.table_price), unit_price: r2(it.unit_price),
            discount_type: it.discount_type || "none",
            discount_pct: Number(it.discount_pct) || 0,
            discount_value: Number(it.discount_value) || 0,
            discount_total: c.discount, total: c.total,
          };
        }),
        total_products: totals.products,
        discount_total: totals.discount,
        total: totals.total,
        has_discount: hasDiscount,
        status: hasDiscount ? "pendente_aprovacao" : "liberado",
        notes: form.notes,
      };
      if (order?.id) await base44.entities.ErpSalesAppOrder.update(order.id, payload);
      else await base44.entities.ErpSalesAppOrder.create(payload);
      // Cliente fez pedido — marca em verde no acompanhamento de visitas do App do Vendedor
      if (customer) await base44.entities.ErpCustomer.update(customer.id, {
        visit_status: "vendido",
        no_sale_reason: "",
        last_visit_date: new Date().toISOString(),
      });
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl min-h-full sm:min-h-0 sm:max-h-[92vh] sm:overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold">{order ? "Editar Pedido" : "Novo Pedido"} {hasDiscount && <span className="text-xs font-normal text-amber-700">— irá para aprovação comercial</span>}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Carregando cadastros...</div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Vendedor *</label>
                <select value={form.seller_id} onChange={e => setForm(p => ({ ...p, seller_id: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                  <option value="">Selecione...</option>
                  {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Operação *</label>
                <select value={form.operation} onChange={e => setForm(p => ({ ...p, operation: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                  {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">Cliente *</label>
                <select value={form.customer_id} onChange={e => onCustomerChange(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1">
                  <option value="">Selecione...</option>
                  {sellerCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {form.seller_id && sellerCustomers.length === 0 && <p className="text-xs text-amber-700 mt-1">Nenhum cliente vinculado a este vendedor — vincule o cliente no cadastro de Clientes (campo Vendedor).</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Data de Emissão</label>
                <input type="date" value={form.emission_date} onChange={e => setForm(p => ({ ...p, emission_date: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1" />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <label className="text-xs font-semibold text-gray-700">Produtos</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto por nome, código ou código de barras..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {searchResults.map(p => {
                    const disp = availableStock(p, empenhoMap);
                    const noStock = p.controla_estoque !== false && disp <= 0;
                    return (
                      <button key={p.id} type="button" disabled={noStock} onClick={() => addProduct(p)}
                        className={`w-full text-left p-2 flex items-center justify-between gap-2 ${noStock ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-50"}`}>
                        <div className="text-sm">
                          <p className="font-medium">{p.code ? `${p.code} — ` : ""}{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {p.controla_estoque === false ? "Sem controle de estoque" : `Disponível: ${disp} ${p.unit || ""}`} · Tabela: {fmtMoney(tablePriceFor(p))}
                          </p>
                        </div>
                        <span className="text-xs text-indigo-600 font-medium">{noStock ? "Sem saldo" : "Adicionar"}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {items.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Nenhum produto no pedido.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((it, idx) => {
                    const c = lineCalc(it);
                    const p = products.find(x => x.id === it.product_id);
                    const exceeded = p && p.controla_estoque !== false && (Number(it.quantity) || 0) > availableFor(p);
                    return (
                      <div key={idx} className="border rounded-lg p-2 space-y-2 bg-gray-50/50">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{it.product_name}</p>
                          <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500">Quantidade</label>
                            <input type="number" min="0" step="0.01" value={it.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} className="w-full h-8 rounded-md border border-input bg-white px-2 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500">Preço unit. {it.table_price > 0 && <span className="text-gray-400">(tabela {fmtMoney(it.table_price)})</span>}</label>
                            <input type="number" min="0" step="0.01" value={it.unit_price} onChange={e => setItem(idx, { unit_price: e.target.value })} className="w-full h-8 rounded-md border border-input bg-white px-2 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500">Desconto</label>
                            <div className="flex gap-1">
                              <select value={it.discount_type} onChange={e => setItem(idx, { discount_type: e.target.value, discount_pct: "", discount_value: "" })} className="h-8 rounded-md border border-input bg-white px-1 text-sm">
                                {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                              </select>
                              {it.discount_type !== "none" && (
                                <input type="number" min="0" step="0.01"
                                  value={it.discount_type === "percent" ? it.discount_pct : it.discount_value}
                                  onChange={e => setItem(idx, it.discount_type === "percent" ? { discount_pct: e.target.value } : { discount_value: e.target.value })}
                                  className="w-full h-8 rounded-md border border-input bg-white px-2 text-sm" placeholder={it.discount_type === "percent" ? "%" : "R$"} />
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col justify-end">
                            <p className="text-xs text-gray-500 line-through">{c.discount > 0 ? fmtMoney(c.gross) : ""}</p>
                            <p className="text-sm font-semibold">{fmtMoney(c.total)}</p>
                          </div>
                        </div>
                        {exceeded && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Excede o saldo disponível ({availableFor(p)} {it.unit || ""}).</p>}
                        {it.unit_price > 0 && it.table_price > 0 && Number(it.unit_price) > Number(it.table_price) && (
                          <p className="text-xs text-indigo-600">Preço acima da tabela de preço (permitido).</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Produtos</span><span>{fmtMoney(totals.products)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Descontos</span><span className="text-amber-700">−{fmtMoney(totals.discount)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{fmtMoney(totals.total)}</span></div>
              {hasDiscount && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Pedido com desconto será enviado para <b>aprovação comercial</b> e só poderá ser faturado após a liberação.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-md border border-input bg-transparent p-2 text-sm mt-1" />
            </div>
          </div>
        )}

        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar Pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
}