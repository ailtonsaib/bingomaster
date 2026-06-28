import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Check, X, Clock, CheckCircle, XCircle, RefreshCw, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pending:          { label: "Pendente",          color: "bg-amber-100 text-amber-700",   icon: Clock },
  awaiting_payment: { label: "Aguard. Pagamento", color: "bg-blue-100 text-blue-700",     icon: Clock },
  approved:         { label: "Aprovado",           color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  rejected:         { label: "Rejeitado",          color: "bg-red-100 text-red-700",      icon: XCircle },
  expired:          { label: "Expirado",           color: "bg-slate-100 text-slate-500",  icon: XCircle },
};

export default function AdminSolicitacoes() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [notes, setNotes] = useState({});
  const [filter, setFilter] = useState("pending");
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setCurrentUser(u); setUserLoading(false); }).catch(() => setUserLoading(false));
    loadRequests();
  }, []);

  // Auto-expire: mark as expired if past expires_at and still pending
  const markExpired = async (reqs) => {
    const now = new Date();
    const toExpire = reqs.filter(r =>
      (r.status === "pending" || r.status === "awaiting_payment") &&
      r.expires_at && new Date(r.expires_at) < now
    );
    for (const r of toExpire) {
      await base44.entities.PlanRequest.update(r.id, { status: "expired" });
    }
    if (toExpire.length > 0) await loadRequests();
  };

  const loadRequests = async () => {
    setLoading(true);
    const data = await base44.entities.PlanRequest.list("-created_date", 100);
    setRequests(data);
    setLoading(false);
    markExpired(data);
  };

  const handleAction = async (req, action) => {
    setActionLoading(req.id + action);
    try {
      const result = await base44.functions.invoke("approvePlanRequest", {
        request_id: req.id,
        action,
        admin_notes: notes[req.id] || "",
      });
      if (result.data?.success) {
        toast({ title: action === "approve" ? "✅ Aprovado!" : "❌ Rejeitado", description: `Solicitação de ${req.user_name} processada.` });
        await loadRequests();
      } else {
        toast({ title: "Erro", description: result.data?.error || "Erro ao processar.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
  const formatPrice = (v) => v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Gratuito";

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  const counts = {};
  requests.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  if (loading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin-planos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <Button size="sm" variant="outline" onClick={loadRequests} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </div>

        <h1 className="text-2xl font-bold font-heading mb-1">Solicitações de Plano</h1>
        <p className="text-sm text-muted-foreground mb-6">Gerencie upgrades e aprovações de pagamento</p>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {[
            { key: "all",     label: "Todas" },
            { key: "pending", label: "Pendentes" },
            { key: "approved",label: "Aprovadas" },
            { key: "rejected",label: "Rejeitadas" },
            { key: "expired", label: "Expiradas" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && f.key !== "all" && (
                <span className="ml-1.5 text-xs opacity-75">({counts[f.key]})</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Nenhuma solicitação encontrada.</div>
        ) : (
          <div className="space-y-4">
            {filtered.map(req => {
              const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const StatusIcon = st.icon;
              const isPending = req.status === "pending" || req.status === "awaiting_payment";

              return (
                <Card key={req.id} className={isPending ? "border-amber-200 bg-amber-50/30" : ""}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 justify-between mb-3">
                      <div>
                        <p className="font-semibold">{req.user_name || req.user_email}</p>
                        <p className="text-xs text-muted-foreground">{req.user_email}</p>
                        {req.device_ip && <p className="text-xs text-muted-foreground">IP: {req.device_ip}</p>}
                      </div>
                      <Badge className={`${st.color} border-0 gap-1.5 h-fit`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {st.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground text-xs">Plano atual: </span>
                        <span className="font-medium uppercase">{req.current_plan_key || "free"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Solicitado: </span>
                        <span className="font-bold text-primary">{req.requested_plan_name}</span>
                        <span className="text-muted-foreground text-xs ml-1">({formatPrice(req.requested_plan_price)})</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Expira em: </span>
                        <span className={`font-medium ${req.status === "expired" ? "text-red-500" : ""}`}>{formatDate(req.expires_at)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Solicitado em: </span>
                        <span>{formatDate(req.created_date)}</span>
                      </div>
                    </div>

                    {req.message && (
                      <p className="text-xs bg-muted rounded-lg p-2 mb-3 italic">"{req.message}"</p>
                    )}

                    {req.admin_notes && (
                      <p className="text-xs text-muted-foreground mb-3">Nota: {req.admin_notes}</p>
                    )}

                    {isPending && (
                      <div className="flex flex-wrap gap-2 items-center mt-3 pt-3 border-t">
                        <Input
                          placeholder="Observação (opcional)..."
                          className="h-8 text-xs flex-1 min-w-[200px]"
                          value={notes[req.id] || ""}
                          onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8"
                          onClick={() => handleAction(req, "approve")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === req.id + "approve"
                            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <Check className="w-3.5 h-3.5" />}
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5 h-8"
                          onClick={() => handleAction(req, "reject")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === req.id + "reject"
                            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <X className="w-3.5 h-3.5" />}
                          Rejeitar
                        </Button>
                        <a
                          href={`https://wa.me/55${req.user_email?.replace(/\D/g, "") || ""}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}