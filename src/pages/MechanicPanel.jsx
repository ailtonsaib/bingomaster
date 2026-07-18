import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, LogOut, Loader2, Search, ClipboardList, Car, Lock, AlertCircle } from "lucide-react";
import { getMechanicSession, clearMechanicSession } from "@/lib/mechanicSession";
import MechanicOSDetail from "@/components/workshop/MechanicOSDetail";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtMoney = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIG = {
  aberta: { label: "Aberta", color: "bg-gray-100 text-gray-700" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700" },
  aguardando_pecas: { label: "Aguardando Peças", color: "bg-amber-100 text-amber-700" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700" },
  entregue: { label: "Entregue", color: "bg-purple-100 text-purple-700" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

export default function MechanicPanel() {
  const navigate = useNavigate();
  const mechanic = getMechanicSession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOS, setSelectedOS] = useState(null);
  const [passwordPrompt, setPasswordPrompt] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const loadOrders = async () => {
    if (!mechanic) return;
    try {
      const all = await base44.entities.ServiceOrder.filter({ user_email: mechanic.user_email });
      // Só OS direcionadas a este mecânico, não canceladas e não entregues
      const mine = all.filter(o => o.mechanic_id === mechanic.id && o.status !== "cancelada" && o.status !== "entregue");
      setOrders(mine);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!mechanic) {
      navigate("/mecanico");
      return;
    }
    loadOrders();
  }, []);

  const handleLogout = () => {
    clearMechanicSession();
    navigate("/mecanico");
  };

  const handleOSClick = (os) => {
    setPasswordPrompt(os);
    setPasswordInput("");
    setPasswordError("");
  };

  const handlePasswordVerify = async () => {
    if (!passwordPrompt) return;
    setVerifying(true);
    setPasswordError("");
    try {
      // Busca o mecânico para validar a senha
      const mechs = await base44.entities.DiagnosticMechanic.filter({ id: mechanic.id });
      const mech = mechs[0];
      if (!mech || mech.password !== passwordInput) {
        setPasswordError("Senha incorreta. Acesso negado.");
        setVerifying(false);
        return;
      }
      // Verifica se a OS pertence a este mecânico
      if (passwordPrompt.mechanic_id !== mechanic.id) {
        setPasswordError("Esta OS não pertence a você. Acesso negado.");
        setVerifying(false);
        return;
      }
      // Tudo certo — abre a OS
      setSelectedOS(passwordPrompt);
      setPasswordPrompt(null);
      setPasswordInput("");
    } catch {
      setPasswordError("Erro ao validar acesso.");
    }
    setVerifying(false);
  };

  const handleOSUpdated = (updatedOS) => {
    setOrders(prev => prev.map(o => o.id === updatedOS.id ? { ...o, ...updatedOS } : o));
    setSelectedOS(null);
    loadOrders();
  };

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.order_number || "").toLowerCase().includes(q) ||
             (o.client_name || "").toLowerCase().includes(q) ||
             (o.vehicle_plate || "").toLowerCase().includes(q) ||
             (o.vehicle_brand || "").toLowerCase().includes(q) ||
             (o.vehicle_model || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (!mechanic) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Se uma OS está selecionada, mostra o detalhe
  if (selectedOS) {
    return (
      <MechanicOSDetail
        os={selectedOS}
        mechanic={mechanic}
        onUpdate={handleOSUpdated}
        onBack={() => setSelectedOS(null)}
      />
    );
  }

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm block">{mechanic.name}</span>
              <span className="text-xs text-gray-400">Painel do Mecânico</span>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Resumo de status */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {["aberta", "em_andamento", "aguardando_pecas", "concluida"].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(statusFilter === st ? "all" : st)}
              className={`p-3 rounded-xl border text-center transition-all ${statusFilter === st ? "border-blue-400 bg-blue-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}
            >
              <p className="text-2xl font-bold text-gray-800">{statusCounts[st] || 0}</p>
              <p className="text-[10px] text-gray-500 font-medium">{STATUS_CONFIG[st]?.label}</p>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por OS, cliente, placa, veículo..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm"
            />
          </div>
          {statusFilter !== "all" && (
            <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Lista de OS */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Nenhuma OS atribuída a você no momento.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(o => (
              <button
                key={o.id}
                onClick={() => handleOSClick(o)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">OS #{o.order_number}</span>
                        <Badge className={`text-[10px] border-0 ${STATUS_CONFIG[o.status]?.color}`}>{STATUS_CONFIG[o.status]?.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{o.client_name}</p>
                      <p className="text-xs text-gray-400">{o.vehicle_brand} {o.vehicle_model} {o.vehicle_plate && `• ${o.vehicle_plate}`}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{fmtDate(o.completion_date || o.start_date)}</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">{fmtMoney(o.total)}</p>
                    <div className="flex items-center gap-1 text-[10px] text-blue-500 mt-1">
                      <Lock className="w-3 h-3" /> Clique para abrir
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de senha */}
      {passwordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPasswordPrompt(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900">Confirme sua senha</h3>
              <p className="text-sm text-gray-500 mt-1">OS #{passwordPrompt.order_number}</p>
            </div>

            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePasswordVerify()}
              placeholder="Digite sua senha"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm mb-3"
              autoFocus
            />

            {passwordError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {passwordError}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPasswordPrompt(null)}>Cancelar</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: "#2563EB" }} onClick={handlePasswordVerify} disabled={verifying}>
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}