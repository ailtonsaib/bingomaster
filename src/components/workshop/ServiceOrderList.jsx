import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Search, ClipboardList, Car } from "lucide-react";
import ServiceOrderForm from "./ServiceOrderForm";
import ServiceOrderDetail from "./ServiceOrderDetail";
import PlanUpgradePanel from "./PlanUpgradePanel";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "aberta", label: "Abertas" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "aguardando_pecas", label: "Aguardando Peças" },
  { value: "concluida", label: "Concluídas" },
  { value: "entregue", label: "Entregues" },
  { value: "cancelada", label: "Canceladas" },
];

const STATUS_CONFIG = {
  aberta: "bg-blue-50 text-blue-600",
  em_andamento: "bg-amber-50 text-amber-600",
  aguardando_pecas: "bg-orange-50 text-orange-600",
  concluida: "bg-green-50 text-green-600",
  entregue: "bg-teal-50 text-teal-600",
  cancelada: "bg-red-50 text-red-600",
};

const STATUS_LABELS = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  aguardando_pecas: "Aguard. Peças",
  concluida: "Concluída",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export default function ServiceOrderList({ userEmail }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [planUsage, setPlanUsage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, usageRes] = await Promise.all([
        base44.entities.ServiceOrder.filter({ user_email: userEmail }, "-created_date"),
        base44.functions.invoke("manageDiagnostic", { operation: "getUsage" }).catch(() => null),
      ]);
      setOrders(data);
      if (usageRes?.data) setPlanUsage(usageRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [userEmail]);

  const osLimitReached = planUsage &&
    planUsage.max_service_orders >= 0 &&
    planUsage.used_service_orders >= planUsage.max_service_orders;

  const filtered = orders.filter(o => {
    const statusMatch = statusFilter === "all" || o.status === statusFilter;
    const searchMatch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.vehicle_plate?.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const handleViewDetail = (order) => {
    setSelectedOrder(order);
    setView("detail");
  };

  const handleBack = () => {
    setView("list");
    load();
  };

  if (view === "form") {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4">Nova Ordem de Serviço</h3>
        <ServiceOrderForm
          userEmail={userEmail}
          onSaved={() => { setView("list"); load(); }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "edit" && selectedOrder) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4">Editar Ordem de Serviço — {selectedOrder.order_number}</h3>
        <ServiceOrderForm
          userEmail={userEmail}
          editOrder={selectedOrder}
          onSaved={() => { setView("detail"); load(); }}
          onCancel={() => setView("detail")}
        />
      </div>
    );
  }

  if (view === "detail" && selectedOrder) {
    return (
      <ServiceOrderDetail
        order={selectedOrder}
        onBack={handleBack}
        onEdit={() => setView("edit")}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" /> Ordens de Serviço ({orders.length})
        </h3>
        <Button
          type="button"
          onClick={() => setView("form")}
          disabled={osLimitReached}
          className="gap-1 text-white"
          style={{ backgroundColor: "#2563EB" }}
        >
          <Plus className="w-4 h-4" /> Nova OS
        </Button>
      </div>

      {/* Usage indicator */}
      {planUsage && planUsage.max_service_orders >= 0 && !osLimitReached && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
          <ClipboardList className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 whitespace-nowrap">
            {planUsage.used_service_orders} de {planUsage.max_service_orders} OS criadas
          </p>
          <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden ml-2">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (planUsage.used_service_orders / planUsage.max_service_orders) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Limit reached — show upgrade panel */}
      {osLimitReached && (
        <div className="mb-6">
          <PlanUpgradePanel
            used={planUsage.used_service_orders}
            max={planUsage.max_service_orders}
            currentPlanName={planUsage.plan_name}
            bronzePrice={19.9}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por OS, cliente ou placa..." className="pl-9" />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1 opacity-70">({orders.filter(o => o.status === f.value).length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>{search || statusFilter !== "all" ? "Nenhuma OS encontrada." : "Nenhuma ordem de serviço cadastrada."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-medium">OS</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium">Veículo</th>
                <th className="p-3 font-medium">Mecânico</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Total</th>
                <th className="p-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} onClick={() => handleViewDetail(o)} className="border-t border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors">
                  <td className="p-3 font-mono text-xs font-medium text-blue-600">{o.order_number}</td>
                  <td className="p-3 font-medium">{o.client_name}</td>
                  <td className="p-3 text-gray-500">
                    <span className="flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-gray-400" />
                      {o.vehicle_brand} {o.vehicle_model}
                      {o.vehicle_plate && ` | ${o.vehicle_plate}`}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{o.mechanic_name || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[o.status] || ""}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium text-green-600">{formatCurrency(o.total)}</td>
                  <td className="p-3 text-gray-400 text-xs">{formatDate(o.created_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}