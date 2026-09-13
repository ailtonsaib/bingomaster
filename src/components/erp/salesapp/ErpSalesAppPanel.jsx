import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { genOrderNumber, fmtMoney, fmtDate } from "@/lib/erpUtils";
import { OPERATIONS, ORDER_STATUS, computeEmpenhoMap, availableStock, r2 } from "@/lib/erpSalesApp";
import ErpSalesAppOrderForm from "./ErpSalesAppOrderForm";
import { Plus, Loader2, ChevronDown, ChevronRight, Search } from "lucide-react";

export default function ErpSalesAppPanel({ user }) {
  const [tab, setTab] = useState("pedidos"); // pedidos | aprovacoes | empenhos
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOrder, setFormOrder] = useState(null); // null = fechado, {} = novo, objeto = edição
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [sellerFilter, setSellerFilter] = useState("");
  const [vSearch, setVSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [os, ps, cs] = await Promise.all([
        base44.entities.ErpSalesAppOrder.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpCustomer.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setOrders(os);
      setProducts(ps.filter(p => p.is_active !== false));
      setCustomers(cs.filter(c => c.is_active !== false));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  // empenho considera todos os pedidos ativos, menos o que está em edição
  const empenhoMap = useMemo(() => computeEmpenhoMap(orders, formOrder?.id), [orders, formOrder]);

  const pendentes = orders.filter(o => o.status === "pendente_aprovacao");
  const liberados = orders.filter(o => o.status === "liberado");

  const handleApprove = async (o) => {
    if (!confirm(`Aprovar comercialmente o pedido ${o.number} de ${o.customer_name}?`)) return;
    setBusyId(o.id);
    try {
      await base44.entities.ErpSalesAppOrder.update(o.id, {
        status: "liberado",
        approved_by_name: user.full_name || user.email,
        approval_date: new Date().toISOString(),
      });
      load();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  const handleReject = async (o) => {
    const obs = prompt(`Motivo da reprovação do pedido ${o.number}:`);
    if (!obs || !obs.trim()) { alert("Informe o motivo da reprovação."); return; }
    setBusyId(o.id);
    try {
      await base44.entities.ErpSalesAppOrder.update(o.id, {
        status: "reprovado",
        approval_obs: obs.trim(),
        approved_by_name: user.full_name || user.email,
        approval_date: new Date().toISOString(),
      });
      load();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  // Faturar: só pedido liberado — gera o Pedido de Venda (faturamento normal do ERP)
  const handleFaturar = async (o) => {
    if (o.status !== "liberado") { alert("Somente pedidos liberados pela aprovação comercial podem ser faturados."); return; }
    if (!confirm(`Faturar o pedido ${o.number} de ${o.customer_name}?\nSerá gerado um Pedido de Venda no módulo de Faturamento.`)) return;
    setBusyId(o.id);
    try {
      const items = (o.items || []).map(it => ({
        product_id: it.product_id, product_code: it.product_code, barcode: it.barcode,
        product_name: it.product_name, unit: it.unit,
        quantity: Number(it.quantity) || 0,
        unit_price: (Number(it.quantity) || 0) > 0 ? r2((Number(it.total) || 0) / (Number(it.quantity) || 1)) : 0,
        total: r2(it.total),
      }));
      const created = await base44.entities.ErpSalesOrder.create({
        user_email: user.email,
        number: genOrderNumber("PV"),
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        emission_date: new Date().toISOString(),
        items,
        subtotal: r2(o.total_products),
        discount: r2(o.discount_total),
        total: r2(o.total),
        status: "aberto",
        notes: `App do Vendedor — pedido ${o.number} (${o.operation})${o.notes ? ` — ${o.notes}` : ""}`,
      });
      await base44.entities.ErpSalesAppOrder.update(o.id, {
        status: "faturado",
        sales_order_id: created.id,
        sales_order_number: created.number,
      });
      load();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  const handleCancel = async (o) => {
    if (!confirm(`Cancelar o pedido ${o.number}? O empenho dos produtos será liberado.`)) return;
    setBusyId(o.id);
    try {
      await base44.entities.ErpSalesAppOrder.update(o.id, { status: "cancelado" });
      load();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  // Acompanhamento de visitas: verde = cliente fez pedido, amarelo = visitado sem venda, cinza = sem visita
  const VISIT_STATUS = {
    vendido: { label: "Vendeu", color: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-500" },
    sem_venda: { label: "Sem venda", color: "bg-amber-100 text-amber-700", border: "border-l-amber-400" },
    pendente: { label: "Sem visita", color: "bg-gray-100 text-gray-600", border: "border-l-gray-300" },
  };
  const VISIT_FREQ = { semanal: "Semanal", bissemanal: "Bissemanal", quinzenal: "Quinzenal", mensal: "Mensal" };
  const WEEKDAYS = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado" };

  // Visita sem venda: o vendedor informa o motivo e o cliente fica amarelo — pode voltar depois e vender
  const handleNoSale = async (c) => {
    const reason = prompt(`Motivo da não venda para ${c.name}:`);
    if (!reason || !reason.trim()) { alert("Informe o motivo da não venda."); return; }
    setBusyId(c.id);
    try {
      await base44.entities.ErpCustomer.update(c.id, {
        visit_status: "sem_venda",
        no_sale_reason: reason.trim(),
        last_visit_date: new Date().toISOString(),
      });
      load();
    } catch (e) { alert(e.message); }
    setBusyId("");
  };

  const visitList = customers.filter(c =>
    (!sellerFilter || c.vendedor_id === sellerFilter) &&
    [c.name, c.city, c.district, c.vendedor_name].map(v => String(v ?? "")).join(" ").toLowerCase().includes(vSearch.toLowerCase())
  );

  const opLabel = (v) => (OPERATIONS.find(o => o.value === v) || {}).label || v;

  const renderCard = (o) => {
    const st = ORDER_STATUS[o.status] || {};
    return (
      <div key={o.id} className="bg-white rounded-xl border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold text-sm">{o.number}</p>
            <p className="text-xs text-gray-500">{fmtDate(o.emission_date)} · {opLabel(o.operation)}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
        </div>
        <div className="text-sm">
          <p><span className="text-gray-500">Cliente: </span>{o.customer_name}</p>
          <p className="text-xs text-gray-500">Vendedor: {o.seller_name || "—"}</p>
        </div>
        <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="text-xs text-indigo-600 flex items-center gap-1">
          {expanded === o.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Itens ({(o.items || []).length})
        </button>
        {expanded === o.id && (
          <div className="border rounded-lg divide-y text-xs">
            {(o.items || []).map((it, i) => (
              <div key={i} className="p-2 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{it.product_name}</p>
                  <p className="text-gray-500">{Number(it.quantity)} {it.unit || ""} × {fmtMoney(it.unit_price)}{it.table_price > 0 && it.unit_price > it.table_price ? " (acima da tabela)" : ""}</p>
                  {Number(it.discount_total) > 0 && <p className="text-amber-700">Desconto: {Number(it.discount_pct) > 0 ? `${it.discount_pct}%` : fmtMoney(it.discount_value)} (−{fmtMoney(it.discount_total)})</p>}
                </div>
                <p className="font-medium whitespace-nowrap">{fmtMoney(it.total)}</p>
              </div>
            ))}
          </div>
        )}
        {o.approval_obs && <p className="text-xs text-red-600">Obs.: {o.approval_obs}</p>}
        {o.sales_order_number && <p className="text-xs text-sky-700">Faturado em: {o.sales_order_number}</p>}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t">
          <p className="font-bold">{fmtMoney(o.total)}</p>
          {busyId === o.id ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : (
            <div className="flex gap-1.5 flex-wrap">
              {o.status === "pendente_aprovacao" && (<>
                <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(o)}>Aprovar</Button>
                <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200" onClick={() => handleReject(o)}>Reprovar</Button>
              </>)}
              {o.status === "liberado" && <Button size="sm" className="h-7 bg-sky-600 hover:bg-sky-700" onClick={() => handleFaturar(o)}>Faturar</Button>}
              {(o.status === "pendente_aprovacao" || o.status === "liberado") && (<>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setFormOrder(o)}>Editar</Button>
                <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200" onClick={() => handleCancel(o)}>Cancelar</Button>
              </>)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const empenhoFiltered = products.filter(p =>
    p.controla_estoque !== false &&
    ((p.name || "") + (p.code || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { id: "pedidos", label: `Pedidos (${orders.length})` },
            { id: "visitas", label: `Visitas (${customers.length})` },
            { id: "aprovacoes", label: `Aprovações (${pendentes.length})` },
            { id: "empenhos", label: "Saldos / Empenhos" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === t.id ? "bg-white shadow text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1"></div>
        <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700" onClick={() => setFormOrder({})}><Plus className="w-4 h-4" /> Novo Pedido</Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</div>
      ) : tab === "pedidos" ? (
        orders.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Nenhum pedido registrado.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">{orders.map(renderCard)}</div>
        )
      ) : tab === "visitas" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={vSearch} onChange={e => setVSearch(e.target.value)} placeholder="Buscar cliente, cidade, bairro..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
            </div>
            <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
              <option value="">Vendedor: todos</option>
              {[...new Set(customers.map(c => c.vendedor_id).filter(Boolean))].map(id => (
                <option key={id} value={id}>{customers.find(c => c.vendedor_id === id)?.vendedor_name || "—"}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 whitespace-nowrap">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 align-middle"></span>fez pedido
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 ml-2 mr-1 align-middle"></span>visitado sem venda
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 ml-2 mr-1 align-middle"></span>sem visita
            </p>
          </div>
          {visitList.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Nenhum cliente ativo no filtro.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {visitList.map(c => {
                const st = VISIT_STATUS[c.visit_status] || VISIT_STATUS.pendente;
                const days = [c.visit_day_1, c.visit_day_2].filter(Boolean).map(d => WEEKDAYS[d] || d).join(" e ");
                return (
                  <div key={c.id} className={`bg-white rounded-xl border border-l-4 p-3 space-y-2 ${st.border}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500">
                          {c.city || "—"}{c.district ? ` / ${c.district}` : ""} · Vendedor: {c.vendedor_name || "—"}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Visita: {VISIT_FREQ[c.visit_frequency] || "não configurada"}{days ? ` — ${days}` : ""}
                      {c.last_visit_date ? ` · Última: ${fmtDate(c.last_visit_date)}` : ""}
                    </p>
                    {c.no_sale_reason && <p className="text-xs text-amber-700">Motivo da não venda: {c.no_sale_reason}</p>}
                    <div className="flex gap-1.5 flex-wrap pt-2 border-t">
                      <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => setFormOrder({ seller_id: c.vendedor_id || "", customer_id: c.id })}>Fazer Pedido</Button>
                      <Button size="sm" variant="outline" className="h-7 text-amber-700 border-amber-300" disabled={busyId === c.id} onClick={() => handleNoSale(c)}>
                        {busyId === c.id ? "Salvando..." : "Visita sem Venda"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === "aprovacoes" ? (
        pendentes.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Nenhum pedido aguardando aprovação comercial.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">{pendentes.map(renderCard)}</div>
        )
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs">
                <tr>
                  <th className="p-2 text-left">Produto</th>
                  <th className="p-2 text-right">Estoque</th>
                  <th className="p-2 text-right">Empenhado</th>
                  <th className="p-2 text-right">Disponível</th>
                </tr>
              </thead>
              <tbody>
                {empenhoFiltered.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-400">Nenhum produto.</td></tr>
                ) : empenhoFiltered.map(p => {
                  const emp = empenhoMap[p.id] || 0;
                  const disp = availableStock(p, empenhoMap);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.code ? `${p.code} — ` : ""}{p.name}</td>
                      <td className="p-2 text-right">{Number(p.stock) || 0} {p.unit || ""}</td>
                      <td className="p-2 text-right text-amber-700">{emp > 0 ? emp : "—"}</td>
                      <td className={`p-2 text-right font-medium ${disp < 0 ? "text-red-600" : disp <= (Number(p.min_stock) || 0) ? "text-amber-700" : ""}`}>{disp} {p.unit || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOrder && (
        <ErpSalesAppOrderForm
          user={user}
          order={formOrder.id ? formOrder : null}
          empenhoMap={empenhoMap}
          onClose={() => setFormOrder(null)}
          onSaved={() => { setFormOrder(null); load(); }}
        />
      )}
    </div>
  );
}