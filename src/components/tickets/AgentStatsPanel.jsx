import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Filter, Users, ChevronDown, ChevronUp, Ticket } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const STATUS_LABELS = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  iniciado: "Iniciado",
  em_teste: "Em Teste",
  concluido: "Concluído"
};

const STATUS_COLORS = {
  aberto: "#3b82f6",
  em_analise: "#f59e0b",
  iniciado: "#8b5cf6",
  em_teste: "#06b6d4",
  concluido: "#22c55e"
};

export default function AgentStatsPanel({ user, tickets: propTickets, users: propUsers }) {
  const [agents, setAgents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedAgent, setExpandedAgent] = useState(null);

  const load = useCallback(async () => {
    // Se dados já foram passados via props (ex: Kanban já carregou), usa direto
    if (propTickets && propUsers) {
      const agentUsers = propUsers.filter((u) =>
        ["agent", "master_agent", "company_admin", "admin", "system_admin"].includes(u.role)
      );
      setAgents(agentUsers);
      setTickets(propTickets);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersRes, ticketsRes] = await Promise.all([
        base44.functions.invoke("ticketSystem", {
          operation: "getUsers",
          actor_id: user.id
        }),
        base44.functions.invoke("ticketSystem", {
          operation: "getTickets",
          actor_id: user.id
        })
      ]);
      const allUsers = usersRes.data.users || [];
      const allTickets = ticketsRes.data.tickets || [];

      const agentUsers = allUsers.filter((u) =>
        ["agent", "master_agent", "company_admin", "admin", "system_admin"].includes(u.role)
      );

      setAgents(agentUsers);
      setTickets(allTickets);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user.company_id, user.role, propTickets, propUsers]);

  useEffect(() => { load(); }, [load]);

  // Agrupar chamados por agente
  const statsByAgent = useMemo(() => {
    return agents.map((agent) => {
      const agentTickets = tickets.filter((t) => t.assigned_to_id === agent.id);
      const byStatus = {};
      for (const s of Object.keys(STATUS_LABELS)) {
        byStatus[s] = agentTickets.filter((t) => t.status === s).length;
      }
      const concluidos = byStatus["concluido"] || 0;
      const total = agentTickets.length;
      const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

      return { agent, name: agent.name, total, concluidos, byStatus, taxaConclusao };
    });
  }, [agents, tickets]);

  const sortedStats = [...statsByAgent].sort((a, b) => b.total - a.total);

  // Quando um agente está selecionado, filtra os chamados dele (e por status, se houver)
  const selectedAgentTickets = useMemo(() => {
    if (!selectedAgentId) return [];
    let result = tickets.filter((t) => t.assigned_to_id === selectedAgentId);
    if (filterStatus) result = result.filter((t) => t.status === filterStatus);
    return result.sort((a, b) => new Date(b.aberto_at || b.created_date) - new Date(a.aberto_at || a.created_date));
  }, [tickets, selectedAgentId, filterStatus]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // Dados para o gráfico (filtra por agente selecionado se houver)
  const chartData = (selectedAgentId
    ? sortedStats.filter((s) => s.agent.id === selectedAgentId)
    : sortedStats
  ).map((s) => ({
    name: s.name.split(" ")[0],
    fullName: s.name,
    ...s.byStatus
  }));

  // KPIs refletem o filtro de agente selecionado
  const kpiTickets = selectedAgentId ? tickets.filter((t) => t.assigned_to_id === selectedAgentId) : tickets;
  const totalGeral = kpiTickets.length;
  const totalConcluidos = kpiTickets.filter((t) => t.status === "concluido").length;
  const totalAbertos = kpiTickets.filter((t) => t.status === "aberto").length;

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="space-y-4">
      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de Chamados{selectedAgent ? ` · ${selectedAgent.name}` : ""}</p>
            <p className="text-2xl font-bold font-heading">{totalGeral}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-bold font-heading text-green-600">{totalConcluidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Abertos</p>
            <p className="text-2xl font-bold font-heading text-blue-600">{totalAbertos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Agentes Ativos</p>
            <p className="text-2xl font-bold font-heading">{agents.filter((a) => a.is_active).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros rápidos por agente */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="w-4 h-4" /> Filtrar por Atendente
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedAgentId(""); setFilterStatus(""); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!selectedAgentId ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-border hover:bg-accent"}`}
            >
              Todos
            </button>
            {sortedStats.map((s) => (
              <button
                key={s.agent.id}
                onClick={() => { setSelectedAgentId(s.agent.id); setFilterStatus(""); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${selectedAgentId === s.agent.id ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-border hover:bg-accent"}`}
              >
                {s.name}
                <Badge variant={selectedAgentId === s.agent.id ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">{s.total}</Badge>
              </button>
            ))}
          </div>
          {/* Filtro de status (visível quando um agente está selecionado) */}
          {selectedAgentId && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">Status:</span>
              <button
                onClick={() => setFilterStatus("")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${!filterStatus ? "bg-foreground text-background border-foreground" : "bg-transparent border-border hover:bg-accent"}`}
              >
                Todos
              </button>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 ${filterStatus === key ? "bg-foreground text-background border-foreground" : "bg-transparent border-border hover:bg-accent"}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" /> Chamados por Agente
              {selectedAgent && <Badge variant="secondary" className="text-[10px]">{selectedAgent.name}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <Bar key={key} dataKey={key} name={label} stackId="a" fill={STATUS_COLORS[key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lista detalhada dos chamados do agente selecionado */}
      {selectedAgentId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="w-4 h-4" /> Chamados de {selectedAgent?.name}
              <Badge variant="secondary" className="text-[10px]">{selectedAgentTickets.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAgentTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado encontrado com os filtros selecionados.</p>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {selectedAgentTickets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.company_name || "—"} · {t.priority_name || "Sem prioridade"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                      style={{ borderColor: STATUS_COLORS[t.status], color: STATUS_COLORS[t.status] }}
                    >
                      {STATUS_LABELS[t.status] || t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista detalhada por agente */}
      <div className="space-y-2">
        {sortedStats.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Nenhum agente cadastrado.
            </CardContent>
          </Card>
        )}
        {sortedStats.map((s) => {
          const isExpanded = expandedAgent === s.agent.id;
          return (
            <Card key={s.agent.id} className={selectedAgentId === s.agent.id ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{s.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {s.agent.role === "master_agent" ? "Master" : s.agent.role === "agent" ? "Agente" : "Admin"}
                      </Badge>
                      {!s.agent.is_active && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-xs text-muted-foreground">Aberto: <strong className="text-foreground">{s.byStatus.aberto || 0}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">Análise: <strong className="text-foreground">{s.byStatus.em_analise || 0}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                        <span className="text-xs text-muted-foreground">Iniciado: <strong className="text-foreground">{s.byStatus.iniciado || 0}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                        <span className="text-xs text-muted-foreground">Teste: <strong className="text-foreground">{s.byStatus.em_teste || 0}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">Concluído: <strong className="text-foreground">{s.concluidos}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold font-heading">{s.total}</p>
                      <p className="text-[10px] text-muted-foreground">chamados</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-heading text-green-600">{s.taxaConclusao}%</p>
                      <p className="text-[10px] text-muted-foreground">conclusão</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 shrink-0"
                      onClick={() => setExpandedAgent(isExpanded ? null : s.agent.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className="text-xs">{isExpanded ? "Ocultar" : "Ver chamados"}</span>
                    </Button>
                  </div>
                </div>
                {/* Lista de chamados expandida inline */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-1.5 max-h-[300px] overflow-y-auto">
                    {tickets.filter((t) => t.assigned_to_id === s.agent.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhum chamado atribuído.</p>
                    ) : (
                      tickets
                        .filter((t) => t.assigned_to_id === s.agent.id)
                        .sort((a, b) => new Date(b.aberto_at || b.created_date) - new Date(a.aberto_at || a.created_date))
                        .map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{t.title}</p>
                              <p className="text-[11px] text-muted-foreground">{t.priority_name || "Sem prioridade"}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: STATUS_COLORS[t.status], color: STATUS_COLORS[t.status] }}>
                              {STATUS_LABELS[t.status] || t.status}
                            </Badge>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}