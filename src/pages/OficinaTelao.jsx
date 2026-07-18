import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getPortalUser, clearPortalUser } from "@/lib/portalSession";
import { Wrench, Clock, User, Car, LogOut, RefreshCw, ClipboardList, AlertCircle } from "lucide-react";

const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "bg-blue-500", text: "text-blue-100", ring: "ring-blue-400/40" },
  em_andamento: { label: "Em Andamento", color: "bg-amber-500", text: "text-amber-100", ring: "ring-amber-400/40" },
  aguardando_pecas: { label: "Aguardando Peças", color: "bg-purple-500", text: "text-purple-100", ring: "ring-purple-400/40" },
  concluida: { label: "Concluída", color: "bg-emerald-500", text: "text-emerald-100", ring: "ring-emerald-400/40" },
  entregue: { label: "Entregue", color: "bg-slate-500", text: "text-slate-100", ring: "ring-slate-400/40" },
  cancelada: { label: "Cancelada", color: "bg-red-500", text: "text-red-100", ring: "ring-red-400/40" },
};

const OPEN_STATUSES = ["aberta", "em_andamento", "aguardando_pecas"];

function formatPlate(plate) {
  if (!plate) return "—";
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (p.length === 7) return `${p.slice(0, 3)}-${p.slice(3, 7)}`;
  return plate.toUpperCase();
}

function elapsedLabel(startStr) {
  if (!startStr) return "—";
  const start = new Date(startStr).getTime();
  if (isNaN(start)) return "—";
  const diff = Date.now() - start;
  if (diff < 0) return "agora";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMin}min`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export default function OficinaTelao() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalUser = getPortalUser();
  const effectiveEmail = searchParams.get("email") || portalUser?.owner_email || portalUser?.email;

  const [orders, setOrders] = useState([]);
  const [companyName, setCompanyName] = useState("Oficina");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [now, setNow] = useState(new Date());

  const loadOrders = useCallback(async () => {
    if (!effectiveEmail) { setLoading(false); return; }
    try {
      const all = await base44.entities.ServiceOrder.filter({ user_email: effectiveEmail }, "-created_date", 500);
      const open = all.filter(o => OPEN_STATUSES.includes(o.status));
      setOrders(open);
      // Buscar nome da empresa
      const companies = await base44.entities.DiagnosticCompanyConfig.filter({ user_email: effectiveEmail });
      if (companies.length > 0) setCompanyName(companies[0].nome_fantasia || companies[0].razao_social || "Oficina");
    } catch (e) {
      console.error("Erro ao carregar OS:", e);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [effectiveEmail]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000); // auto-refresh 30s
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clockInterval); };
  }, [loadOrders]);

  const handleLogout = () => {
    clearPortalUser();
    navigate("/diagnostico");
  };

  if (!effectiveEmail) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-400" />
          <p className="text-lg font-semibold mb-2">Acesso não autorizado</p>
          <p className="text-slate-400 text-sm mb-4">Faça login para acessar o painel.</p>
          <button onClick={() => navigate("/diagnostico")} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  // Agrupar por status
  const byStatus = OPEN_STATUSES.map(status => ({
    status,
    config: STATUS_CONFIG[status],
    orders: orders.filter(o => o.status === status),
  }));

  const totalOpen = orders.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{companyName}</h1>
              <p className="text-xs text-slate-400">Painel de Ordens de Serviço</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold">
                {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight">
                {now.toLocaleTimeString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin-slow" style={{ animation: "spin 2s linear infinite" }} />
              <span className="text-xs text-slate-300">
                {lastUpdate ? `Atualizado ${lastUpdate.toLocaleTimeString("pt-BR")}` : "Carregando..."}
              </span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="px-6 pb-3 flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold">{totalOpen}</span>
            <span className="text-xs text-slate-400">OS Abertas</span>
          </div>
          {byStatus.map(group => (
            <div key={group.status} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60">
              <span className={`w-2.5 h-2.5 rounded-full ${group.config.color}`} />
              <span className="text-sm font-semibold">{group.orders.length}</span>
              <span className="text-xs text-slate-400">{group.config.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ClipboardList className="w-16 h-16 mb-4 text-slate-600" />
            <p className="text-xl font-semibold">Nenhuma OS aberta</p>
            <p className="text-sm">Todas as ordens de serviço estão concluídas ou entregues.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {orders.map(order => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.aberta;
              return (
                <div
                  key={order.id}
                  className={`relative rounded-2xl bg-slate-900 ring-1 ${config.ring} overflow-hidden flex flex-col`}
                >
                  {/* Status bar */}
                  <div className={`${config.color} px-4 py-2 flex items-center justify-between`}>
                    <span className="text-sm font-bold text-white">OS #{order.order_number || "—"}</span>
                    <span className="text-xs font-bold text-white uppercase tracking-wide">{config.label}</span>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3 flex-1">
                    {/* Cliente */}
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold">Cliente</p>
                        <p className="text-sm font-semibold text-white truncate">{order.client_name || "—"}</p>
                      </div>
                    </div>

                    {/* Veículo */}
                    <div className="flex items-start gap-2">
                      <Car className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold">Veículo</p>
                        <p className="text-sm font-semibold text-white truncate">
                          {order.vehicle_brand} {order.vehicle_model}
                        </p>
                        <div className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                          <span className="text-xs font-mono font-bold tracking-wider text-yellow-300">
                            {formatPlate(order.vehicle_plate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mecânico */}
                    <div className="flex items-start gap-2">
                      <Wrench className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold">Mecânico</p>
                        <p className="text-sm font-semibold text-white truncate">{order.mechanic_name || "Não atribuído"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs text-slate-400">{elapsedLabel(order.start_date || order.created_date)}</span>
                    </div>
                    {order.total > 0 && (
                      <span className="text-xs font-semibold text-emerald-400">
                        R$ {order.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}