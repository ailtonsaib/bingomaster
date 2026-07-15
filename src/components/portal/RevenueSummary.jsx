import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Gamepad2, Grid3x3, FileText, Wallet } from "lucide-react";

const GAME_LABELS = {
  "campo-minado": "Campo Minado",
  "galaxy-blaster": "Galaxy Blaster",
};

const BRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RevenueSummary({ adminEmail, users = [] }) {
  const [loading, setLoading] = useState(true);
  const [gameConfigs, setGameConfigs] = useState([]);
  const [gameUnlocks, setGameUnlocks] = useState([]);
  const [planRequests, setPlanRequests] = useState([]);
  const [spedSubs, setSpedSubs] = useState([]);
  const [spedConfigs, setSpedConfigs] = useState([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [gameRes, requests, subs, spedCfg] = await Promise.all([
        base44.functions.invoke("manageGamePlans", {
          operation: "getAllConfigs",
          admin_email: adminEmail,
        }),
        base44.entities.PlanRequest.filter({ status: "approved" }),
        base44.entities.SpedSubscription.filter({ status: "active" }),
        base44.entities.SpedPlanConfig.list(),
      ]);

      const gameUnlockRes = await base44.functions.invoke("manageGamePlans", {
        operation: "getAllUnlocks",
        admin_email: adminEmail,
      });

      setGameConfigs(gameRes.data.configs || []);
      setGameUnlocks(gameUnlockRes.data.unlocks || []);
      setPlanRequests(requests || []);
      setSpedSubs(subs || []);
      setSpedConfigs(spedCfg || []);
    } catch (e) {
      console.error("Erro ao carregar receita:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // --- Jogos ---
  const getGamePrice = (gameId) => {
    const cfg = gameConfigs.find((c) => c.game_id === gameId);
    return cfg ? Number(cfg.price) || 0 : 0;
  };
  const approvedGameUnlocks = gameUnlocks.filter((u) => u.status === "approved");
  const gameRevenue = approvedGameUnlocks.reduce(
    (sum, u) => sum + getGamePrice(u.game_id),
    0
  );

  // --- BingoPremier (PlanRequest aprovados) ---
  const bingoRevenue = planRequests.reduce(
    (sum, r) => sum + (Number(r.requested_plan_price) || 0),
    0
  );

  // --- SPED (assinaturas ativas × preço do plano) ---
  const getSpedPrice = (planKey) => {
    const cfg = spedConfigs.find((c) => c.plan_key === planKey);
    return cfg ? Number(cfg.price) || 0 : 0;
  };
  const spedRevenue = spedSubs.reduce(
    (sum, s) => sum + getSpedPrice(s.plan_key),
    0
  );

  // --- Finance (usuários com finance_full_access × finance_plan_price) ---
  const financeUsers = users.filter((u) => u.finance_full_access);
  const financeRevenue = financeUsers.reduce(
    (sum, u) => sum + (Number(u.finance_plan_price) || 0),
    0
  );

  const totalRevenue = gameRevenue + bingoRevenue + spedRevenue + financeRevenue;

  const sections = [
    {
      icon: Gamepad2,
      label: "Jogos",
      count: approvedGameUnlocks.length,
      revenue: gameRevenue,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      icon: Grid3x3,
      label: "BingoPremier",
      count: planRequests.length,
      revenue: bingoRevenue,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: FileText,
      label: "SPED",
      count: spedSubs.length,
      revenue: spedRevenue,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      icon: Wallet,
      label: "Finance",
      count: financeUsers.length,
      revenue: financeRevenue,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Receita Consolidada — Liberações</h2>
      </div>

      {/* Total geral */}
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Geral Recebido</p>
            <p className="text-3xl font-bold text-emerald-600">{BRL(totalRevenue)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cards por aplicativo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-lg ${s.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{s.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.count} liberação(ões)
                    </p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${s.color}`}>{BRL(s.revenue)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalhamento Jogos */}
      {approvedGameUnlocks.length > 0 && (
        <DetailTable
          title="Jogos — Liberações Aprovadas"
          headers={["Jogo", "Contato", "Data", "Valor"]}
          rows={approvedGameUnlocks.map((u) => [
            GAME_LABELS[u.game_id] || u.game_id,
            u.contact_info || "—",
            u.approved_at
              ? new Date(u.approved_at).toLocaleDateString("pt-BR")
              : "—",
            BRL(getGamePrice(u.game_id)),
          ])}
          total={gameRevenue}
        />
      )}

      {/* Detalhamento Bingo */}
      {planRequests.length > 0 && (
        <DetailTable
          title="BingoPremier — Planos Aprovados"
          headers={["Usuário", "Plano", "Data", "Valor"]}
          rows={planRequests.map((r) => [
            r.user_name || r.user_email || "—",
            r.requested_plan_name || r.requested_plan_key,
            r.approved_at
              ? new Date(r.approved_at).toLocaleDateString("pt-BR")
              : "—",
            BRL(r.requested_plan_price),
          ])}
          total={bingoRevenue}
        />
      )}

      {/* Detalhamento SPED */}
      {spedSubs.length > 0 && (
        <DetailTable
          title="SPED — Assinaturas Ativas"
          headers={["Usuário", "Plano", "Aprovado em", "Valor"]}
          rows={spedSubs.map((s) => [
            s.user_name || s.user_email || "—",
            s.plan_name || s.plan_key,
            s.approved_at
              ? new Date(s.approved_at).toLocaleDateString("pt-BR")
              : "—",
            BRL(getSpedPrice(s.plan_key)),
          ])}
          total={spedRevenue}
        />
      )}

      {/* Detalhamento Finance */}
      {financeUsers.length > 0 && (
        <DetailTable
          title="Finance — Acessos Completos"
          headers={["Usuário", "Email", "Valor"]}
          rows={financeUsers.map((u) => [
            u.name || "—",
            u.email || "—",
            BRL(u.finance_plan_price),
          ])}
          total={financeRevenue}
        />
      )}
    </div>
  );
}

function DetailTable({ title, headers, rows, total }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className={`p-3 font-medium ${i === headers.length - 1 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-t">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`p-3 ${ci === row.length - 1 ? "text-right font-semibold text-emerald-600" : ""} ${ci > 0 && ci < row.length - 1 ? "text-muted-foreground" : ""}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t bg-emerald-50">
                  <td colSpan={headers.length - 1} className="p-3 font-bold text-right">
                    Total
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-600">
                    {BRL(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}