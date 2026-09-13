import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { fmtDate, fmtMoney } from "@/lib/erpUtils";
import { Search, Loader2, Check, Clock, X, ClipboardList, BadgeCheck, FileText, Package, Truck } from "lucide-react";

const STEP_DEFS = [
  { key: "pedido", label: "Pedido", icon: ClipboardList },
  { key: "aprovacao", label: "Aprovação", icon: BadgeCheck },
  { key: "faturamento", label: "Faturamento", icon: FileText },
  { key: "carga", label: "Carga Montada", icon: Package },
  { key: "entrega", label: "Saiu p/ Entrega", icon: Truck },
];
const STEP_STATE_STYLE = {
  done: "bg-emerald-600 text-white",
  current: "bg-amber-500 text-white",
  pending: "bg-gray-100 text-gray-400 border border-gray-200",
  failed: "bg-red-600 text-white",
};

// Situação do pedido do cliente: parado (aprovação/faturamento), carga montada, faturado e saída para entrega
function trackOrder(o, salesOrders, loads) {
  const so = o.sales_order_id ? salesOrders.find(s => s.id === o.sales_order_id) : null;
  const load = loads.find(l => (l.orders || []).some(x => x.order_id === o.id || x.order_id === o.sales_order_id)) || null;
  const dead = o.status === "reprovado" || o.status === "cancelado";

  const steps = [
    { key: "pedido", state: "done", info: `${o.number} — ${fmtDate(o.emission_date)}` },
    o.status === "pendente_aprovacao"
      ? { key: "aprovacao", state: "current", info: "Pedido parado — aguardando aprovação comercial do desconto" }
      : { key: "aprovacao", state: o.status === "reprovado" ? "failed" : "done", info: o.status === "reprovado" ? (o.approval_obs || "Reprovado") : (o.approved_by_name ? `Aprovado por ${o.approved_by_name}` : "Liberado") },
    dead
      ? { key: "faturamento", state: "failed", info: o.status === "cancelado" ? "Pedido cancelado" : "Não faturado" }
      : so?.status === "faturado"
        ? { key: "faturamento", state: "done", info: so.nfe_number ? `Faturado — NF-e ${so.nfe_number}` : "Faturado" }
        : o.status === "faturado"
          ? { key: "faturamento", state: "current", info: `Pedido de venda ${o.sales_order_number} gerado — aguardando faturamento` }
          : { key: "faturamento", state: "pending", info: "—" },
  ];

  if (dead) {
    steps.push({ key: "carga", state: "pending", info: "—" }, { key: "entrega", state: "pending", info: "—" });
  } else if (load) {
    steps.push(
      { key: "carga", state: "done", info: `Carga ${load.number}${load.vehicle_plate ? ` — ${load.vehicle_plate}` : ""}` },
      load.status === "carregada"
        ? { key: "entrega", state: "done", info: `Saiu para entrega${load.driver_name ? ` — motorista ${load.driver_name}` : ""}` }
        : { key: "entrega", state: "current", info: "Carga montada — aguardando carregamento do veículo" },
    );
  } else {
    steps.push(
      so?.status === "faturado"
        ? { key: "carga", state: "current", info: "Faturado — aguardando montagem da carga" }
        : { key: "carga", state: "pending", info: "—" },
      { key: "entrega", state: "pending", info: "—" },
    );
  }

  let summary;
  if (o.status === "reprovado") summary = { label: "Reprovado", color: "bg-red-100 text-red-700" };
  else if (o.status === "cancelado") summary = { label: "Cancelado", color: "bg-red-100 text-red-700" };
  else if (load?.status === "carregada") summary = { label: "Saiu para entrega", color: "bg-emerald-100 text-emerald-700" };
  else if (load?.status === "montada") summary = { label: "Carga montada", color: "bg-sky-100 text-sky-700" };
  else if (so?.status === "faturado") summary = { label: "Faturado", color: "bg-indigo-100 text-indigo-700" };
  else if (o.status === "pendente_aprovacao") summary = { label: "Parado — aguardando aprovação", color: "bg-amber-100 text-amber-700" };
  else if (o.status === "faturado" || o.status === "liberado") summary = { label: "Aguardando faturamento", color: "bg-amber-100 text-amber-700" };
  else summary = { label: "Pedido registrado", color: "bg-gray-100 text-gray-600" };

  return { steps, summary, so, load };
}

export default function ErpSalesAppTracking({ user, orders }) {
  const [salesOrders, setSalesOrders] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [sos, lds] = await Promise.all([
          base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpLoadAssembly.filter({ user_email: user.email }, "-created_date", 500),
        ]);
        setSalesOrders(sos);
        setLoads(lds.filter(l => l.status !== "cancelada"));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email, orders]);

  const list = orders.filter(o =>
    [o.number, o.customer_name, o.seller_name].map(v => String(v ?? "")).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido ou cliente..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Carregando situação dos pedidos...</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Nenhum pedido para acompanhar.</div>
      ) : (
        <div className="space-y-2">
          {list.map(o => {
            const t = trackOrder(o, salesOrders, loads);
            return (
              <div key={o.id} className="bg-white rounded-xl border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm">{o.number} — {o.customer_name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(o.emission_date)} · {fmtMoney(o.total)}{o.seller_name ? ` · ${o.seller_name}` : ""}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.summary.color}`}>{t.summary.label}</span>
                </div>
                <div className="flex items-start gap-1">
                  {STEP_DEFS.map((def, i) => {
                    const st = t.steps[i];
                    const Ic = def.icon;
                    const StateIc = st.state === "done" ? Check : st.state === "failed" ? X : st.state === "current" ? Clock : Ic;
                    return (
                      <div key={def.key} className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${STEP_STATE_STYLE[st.state]}`}>
                            <StateIc className="w-3.5 h-3.5" />
                          </span>
                          <span className="flex-1 h-0.5 rounded -mt-3 mr-1" style={{ background: st.state === "pending" ? "#e5e7eb" : st.state === "failed" ? "#dc2626" : "#059669" }}></span>
                        </div>
                        <p className={`text-[10px] font-medium mt-1 ${st.state === "pending" ? "text-gray-400" : st.state === "failed" ? "text-red-600" : st.state === "current" ? "text-amber-700" : "text-emerald-700"}`}>{def.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{st.info}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}