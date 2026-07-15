import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Gamepad2, Lock, Check, X, Clock, DollarSign, TrendingUp } from "lucide-react";
import { getPortalUser } from "@/lib/portalSession";

const GAME_LABELS = {
  "campo-minado": "Campo Minado",
  "galaxy-blaster": "Galaxy Blaster",
};

export default function GameAdminPanel() {
  const admin = getPortalUser();
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [unlocks, setUnlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState("configs");
  const [editPrices, setEditPrices] = useState({});

  const loadData = async () => {
    try {
      const [cfgRes, unlockRes] = await Promise.all([
        base44.functions.invoke("manageGamePlans", { operation: "getAllConfigs", admin_email: admin.email }),
        base44.functions.invoke("manageGamePlans", { operation: "getAllUnlocks", admin_email: admin.email }),
      ]);
      setConfigs(cfgRes.data.configs || []);
      setUnlocks(unlockRes.data.unlocks || []);
      const prices = {};
      (cfgRes.data.configs || []).forEach((c) => {
        prices[c.game_id] = { price: c.price, free_levels: c.free_levels, game_name: c.game_name, is_active: c.is_active };
      });
      setEditPrices(prices);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveConfig = async (gameId) => {
    const cfg = editPrices[gameId];
    if (!cfg) return;
    try {
      await base44.functions.invoke("manageGamePlans", {
        operation: "updateConfig",
        admin_email: admin.email,
        game_id: gameId,
        game_name: cfg.game_name || GAME_LABELS[gameId] || gameId,
        price: Number(cfg.price),
        free_levels: Number(cfg.free_levels),
        is_active: cfg.is_active !== false,
      });
      toast({ title: "Preço atualizado!", description: `${GAME_LABELS[gameId] || gameId}: R$ ${Number(cfg.price).toFixed(2)}` });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const approveUnlock = async (unlockId) => {
    try {
      await base44.functions.invoke("manageGamePlans", {
        operation: "approveUnlock",
        admin_email: admin.email,
        unlock_id: unlockId,
      });
      toast({ title: "Liberação aprovada!", description: "O jogador já pode acessar os níveis premium." });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const rejectUnlock = async (unlockId) => {
    try {
      await base44.functions.invoke("manageGamePlans", {
        operation: "rejectUnlock",
        admin_email: admin.email,
        unlock_id: unlockId,
      });
      toast({ title: "Liberação rejeitada" });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  const pendingCount = unlocks.filter((u) => u.status === "pending").length;

  // Receita: soma das liberações aprovadas × preço do jogo
  const getPriceFor = (gameId) => {
    const cfg = configs.find((c) => c.game_id === gameId);
    return cfg ? Number(cfg.price) || 0 : 0;
  };
  const approvedUnlocks = unlocks.filter((u) => u.status === "approved");
  const totalRevenue = approvedUnlocks.reduce((sum, u) => sum + getPriceFor(u.game_id), 0);

  // Receita por jogo
  const revenueByGame = {};
  approvedUnlocks.forEach((u) => {
    if (!revenueByGame[u.game_id]) {
      revenueByGame[u.game_id] = { count: 0, total: 0 };
    }
    revenueByGame[u.game_id].count++;
    revenueByGame[u.game_id].total += getPriceFor(u.game_id);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Gamepad2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Planos dos Jogos</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveSub("configs")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSub === "configs" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          <DollarSign className="w-4 h-4 inline mr-1" /> Preços
        </button>
        <button onClick={() => setActiveSub("unlocks")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSub === "unlocks" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          <Clock className="w-4 h-4 inline mr-1" /> Liberações
          {pendingCount > 0 && <Badge className="ml-1.5 bg-red-500 text-white text-xs px-1.5">{pendingCount}</Badge>}
        </button>
        <button onClick={() => setActiveSub("revenue")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSub === "revenue" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          <TrendingUp className="w-4 h-4 inline mr-1" /> Receita
        </button>
      </div>

      {/* Configs */}
      {activeSub === "configs" && (
        <div className="space-y-4">
          {Object.entries(GAME_LABELS).map(([gameId, gameName]) => {
            const cfg = editPrices[gameId] || { price: 19.9, free_levels: 10, game_name: gameName, is_active: true };
            return (
              <Card key={gameId}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold">{gameName}</h3>
                      <p className="text-xs text-muted-foreground">ID: {gameId}</p>
                    </div>
                    <Badge variant={cfg.is_active !== false ? "default" : "secondary"}>
                      {cfg.is_active !== false ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Preço Premium (R$)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={cfg.price ?? 0}
                        onChange={(e) => setEditPrices({ ...editPrices, [gameId]: { ...cfg, price: e.target.value } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Níveis Gratuitos</label>
                      <Input
                        type="number"
                        value={cfg.free_levels ?? 10}
                        onChange={(e) => setEditPrices({ ...editPrices, [gameId]: { ...cfg, free_levels: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cfg.is_active !== false}
                        onChange={(e) => setEditPrices({ ...editPrices, [gameId]: { ...cfg, is_active: e.target.checked } })}
                        className="w-4 h-4"
                      />
                      Jogo ativo
                    </label>
                    <Button size="sm" onClick={() => saveConfig(gameId)}>
                      <DollarSign className="w-4 h-4 mr-1" /> Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unlocks */}
      {activeSub === "unlocks" && (
        <div className="space-y-3">
          {unlocks.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhuma solicitação de liberação ainda.
            </CardContent></Card>
          ) : (
            unlocks.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{GAME_LABELS[u.game_id] || u.game_id}</span>
                      <Badge variant={u.status === "approved" ? "default" : u.status === "rejected" ? "destructive" : "secondary"}>
                        {u.status === "approved" ? "Aprovado" : u.status === "rejected" ? "Rejeitado" : "Pendente"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Código: <code className="bg-muted px-1.5 py-0.5 rounded">{u.device_code}</code></p>
                    {u.contact_info && <p className="text-xs text-muted-foreground mt-0.5">Contato: {u.contact_info}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">Solicitado em: {new Date(u.created_date).toLocaleString("pt-BR")}</p>
                  </div>
                  {u.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveUnlock(u.id)}>
                        <Check className="w-4 h-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectUnlock(u.id)}>
                        <X className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Receita */}
      {activeSub === "revenue" && (
        <div className="space-y-4">
          {/* Card de total */}
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Recebido com Desbloqueios</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {approvedUnlocks.length} liberação(ões) aprovada(s)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Receita por jogo */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Receita por Jogo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.keys(revenueByGame).length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Nenhuma liberação aprovada ainda.
                </CardContent></Card>
              ) : (
                Object.entries(revenueByGame).map(([gameId, data]) => (
                  <Card key={gameId}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{GAME_LABELS[gameId] || gameId}</p>
                        <p className="text-xs text-muted-foreground">
                          {data.count} liberação(ões) × {getPriceFor(gameId).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-emerald-600">
                        {data.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Detalhamento */}
          {approvedUnlocks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Detalhamento</h3>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Jogo</th>
                          <th className="text-left p-3 font-medium">Contato</th>
                          <th className="text-left p-3 font-medium">Data</th>
                          <th className="text-left p-3 font-medium">Aprovado por</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedUnlocks.map((u) => (
                          <tr key={u.id} className="border-t">
                            <td className="p-3 font-medium">{GAME_LABELS[u.game_id] || u.game_id}</td>
                            <td className="p-3 text-muted-foreground">{u.contact_info || "—"}</td>
                            <td className="p-3 text-muted-foreground">
                              {u.approved_at ? new Date(u.approved_at).toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="p-3 text-muted-foreground">{u.approved_by || "—"}</td>
                            <td className="p-3 text-right font-semibold text-emerald-600">
                              {getPriceFor(u.game_id).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-emerald-50">
                          <td colSpan={4} className="p-3 font-bold text-right">Total Geral</td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}