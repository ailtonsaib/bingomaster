import { useState, useMemo, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, TrendingUp, Wallet, DollarSign, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  approved: { label: "Aprovado", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  awaiting_payment: { label: "Aguard. Pagamento", class: "bg-amber-100 text-amber-700 border-amber-200" },
  pending: { label: "Pendente", class: "bg-blue-100 text-blue-700 border-blue-200" },
  rejected: { label: "Rejeitado", class: "bg-red-100 text-red-700 border-red-200" },
  expired: { label: "Expirado", class: "bg-muted text-muted-foreground border-border" },
};

const BRL = (v) => (v || 0).toLocaleData?.("pt-BR", { style: "currency", currency: "BRL" }) ||
  (Number(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminFinancialPanel() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setCurrentUser(u); setUserLoading(false); }).catch(() => setUserLoading(false));
  }, []);

  const { data: planRequests = [], isLoading: loadingPR } = useQuery({
    queryKey: ["admin-financial-plan-requests"],
    queryFn: () => base44.entities.PlanRequest.list("-created_date", 500),
  });

  const { data: portalUsers = [] } = useQuery({
    queryKey: ["admin-financial-users"],
    queryFn: () => base44.asServiceRole?.entities?.PortalUser?.list?.() ||
      base44.functions.invoke("portalAuth", { operation: "listUsers" }).then(r => r.data.users || r.data || []),
  });

  // Only approved plan requests count as revenue
  const approvedRequests = planRequests.filter(pr => pr.status === "approved");

  const totalRevenue = useMemo(() =>
    approvedRequests.reduce((sum, pr) => sum + (pr.requested_plan_price || 0), 0),
    [approvedRequests]
  );

  const totalPending = useMemo(() =>
    planRequests
      .filter(pr => pr.status === "awaiting_payment" || pr.status === "pending")
      .reduce((sum, pr) => sum + (pr.requested_plan_price || 0), 0),
    [planRequests]
  );

  const filteredRequests = useMemo(() => {
    return planRequests.filter(pr => {
      const matchesSearch = !search ||
        pr.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        pr.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        pr.requested_plan_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || pr.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [planRequests, search, statusFilter]);

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/app">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold font-heading flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Painel Financeiro
              </h1>
              <p className="text-xs text-muted-foreground">Faturamento de planos do Bingo</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Faturamento (Planos)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-xl font-bold text-emerald-700">{BRL(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{approvedRequests.length} planos aprovados</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">A Receber</span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <p className="text-xl font-bold text-amber-700">{BRL(totalPending)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{planRequests.filter(pr => pr.status === "awaiting_payment" || pr.status === "pending").length} solicitações</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por email, nome ou plano..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>Todos</Button>
            <Button size="sm" variant={statusFilter === "approved" ? "default" : "outline"} onClick={() => setStatusFilter("approved")}>Aprovados</Button>
            <Button size="sm" variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pendentes</Button>
            <Button size="sm" variant={statusFilter === "awaiting_payment" ? "default" : "outline"} onClick={() => setStatusFilter("awaiting_payment")}>Aguard. Pagto</Button>
            <Button size="sm" variant={statusFilter === "rejected" ? "default" : "outline"} onClick={() => setStatusFilter("rejected")}>Rejeitados</Button>
          </div>
        </div>

        {/* Plan requests table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2 text-base">
              <Receipt className="w-4 h-4 text-primary" /> Solicitações de Planos ({filteredRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPR ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma solicitação encontrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-y">
                    <tr className="text-left text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-2.5 font-medium">Data</th>
                      <th className="px-4 py-2.5 font-medium">Usuário</th>
                      <th className="px-4 py-2.5 font-medium">Plano</th>
                      <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((pr) => (
                      <tr key={pr.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {pr.created_date ? format(new Date(pr.created_date), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium truncate max-w-[180px]">{pr.user_name || "—"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">{pr.user_email}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{pr.requested_plan_name || pr.requested_plan_key}</div>
                          {pr.requested_plan_key && pr.requested_plan_name !== pr.requested_plan_key && (
                            <div className="text-xs text-muted-foreground">{pr.requested_plan_key}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                          {BRL(pr.requested_plan_price)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={STATUS_CONFIG[pr.status]?.class || ""}>
                            {STATUS_CONFIG[pr.status]?.label || pr.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}