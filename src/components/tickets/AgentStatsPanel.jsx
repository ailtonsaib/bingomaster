import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3 } from "lucide-react";
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

export default function AgentStatsPanel({ user }) {
  const [agents, setAgents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, ticketsRes] = await Promise.all([
        base44.functions.invoke("ticketSystem", {
          operation: "getUsers",
          company_id: user.company_id,
          user_role: user.role
        }),
        base44.functions.invoke("ticketSystem", {
          operation: "getTickets",
          company_id: user.company_id,
          user_role: user.role
        })
      ]);
      const allUsers = usersRes.data.users || [];
      const allTickets = ticketsRes.data.tickets || [];

      // Filtrar apenas agentes (agent, master_agent, company_admin, admin, system_admin)
      const agentUsers = allUsers.filter((u) =>
        ["agent", "master_agent", "company_admin", "admin", "system_admin"].includes(u.role)
      );

      setAgents(agentUsers);
      setTickets(allTickets);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user.company_id, user.role]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // Agrupar chamados por agente
  const statsByAgent = agents.map((agent) => {
    const agentTickets = tickets.filter((t) => t.assigned_to_id === agent.id);
    const byStatus = {};
    let concluidos = 0;
    let abertos = 0;
    for (const s of Object.keys(STATUS_LABELS)) {
      byStatus[s] = agentTickets.filter((t) => t.status === s).length;
    }
    concluidos = byStatus["concluido"] || 0;
    abertos = byStatus["aberto"] || 0;
    const total = agentTickets.length;
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    return {
      agent,
      name: agent.name,
      total,
      concluidos,
      abertos,
      byStatus,
      taxaConclusao
    };
  });

  // Agentes sem chamados também aparecem (desde que ativos)
  const sortedStats = statsByAgent.sort((a, b) => b.total - a.total);

  // Dados para o gráfico
  const chartData = sortedStats.map((s) => ({
    name: s.name.split(" ")[0],
    fullName: s.name,
    ...s.byStatus
  }));

  const totalGeral = tickets.length;
  const totalConcluidos = tickets.filter((t) => t.status === "concluido").length;
  const totalAbertos = tickets.filter((t) => t.status === "aberto").length;

  return (
    <div className="space-y-4">
      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de Chamados</p>
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

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" /> Chamados por Agente
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

      {/* Lista detalhada por agente */}
      <div className="space-y-2">
        {sortedStats.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Nenhum agente cadastrado.
            </CardContent>
          </Card>
        )}
        {sortedStats.map((s) => (
          <Card key={s.agent.id}>
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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}