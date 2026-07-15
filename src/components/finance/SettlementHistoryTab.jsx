import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, CheckCircle2, Undo2, History, Landmark, Filter } from "lucide-react";

export default function SettlementHistoryTab({ userEmail }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadHistory();
  }, [userEmail]);

  const loadHistory = async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "getSettlementHistory",
        email: userEmail,
      });
      setHistory(res.data.history || []);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    }
    setLoading(false);
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;

  const inDateRange = (dateStr) => {
    if (!startDate && !endDate) return true;
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return false;
    const s = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
    const e = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
    return d >= s && d <= e;
  };

  const filtered = history.filter((h) => {
    if (filterType !== "all" && h.action_type !== filterType) return false;
    return inDateRange(h.action_date);
  });

  const actionConfig = {
    settle: { label: "Baixa", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", badge: "bg-emerald-100 text-emerald-700 border-0" },
    partial_settle: { label: "Baixa Parcial", icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-100", badge: "bg-amber-100 text-amber-700 border-0" },
    reopen: { label: "Estorno", icon: Undo2, color: "text-red-600", bg: "bg-red-100", badge: "bg-red-100 text-red-700 border-0" },
  };

  const clearFilters = () => {
    setFilterType("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Histórico de Baixas e Estornos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Ação</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">Todas as ações</option>
                <option value="settle">Baixa total</option>
                <option value="partial_settle">Baixa parcial</option>
                <option value="reopen">Estorno</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Data final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            {(filterType !== "all" || startDate || endDate) && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
                <Filter className="w-4 h-4" /> Limpar
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} registro(s)
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum registro de baixa ou estorno encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Ação</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Valor</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Responsável</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Banco</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => {
                    const cfg = actionConfig[h.action_type] || actionConfig.settle;
                    const Icon = cfg.icon;
                    const isIncome = h.transaction_type === "income";
                    return (
                      <tr key={h.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg}`}>
                              <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                            </div>
                            <Badge className={`text-[10px] py-0 ${cfg.badge}`}>{cfg.label}</Badge>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <p className="font-medium">{h.transaction_description || "—"}</p>
                          {h.contact_name && (
                            <p className="text-xs text-muted-foreground">{h.contact_name}</p>
                          )}
                          {h.action_type === "partial_settle" && (
                            <p className="text-xs text-amber-600">
                              Baixado: {fmtMoney(h.settled_amount)}
                              {h.interest_amount > 0 && ` · Juros: ${fmtMoney(h.interest_amount)}`}
                              {h.discount_amount > 0 && ` · Desc: ${fmtMoney(h.discount_amount)}`}
                            </p>
                          )}
                          {h.action_type === "settle" && (h.interest_amount > 0 || h.discount_amount > 0) && (
                            <p className="text-xs text-muted-foreground">
                              {h.interest_amount > 0 && `Juros: ${fmtMoney(h.interest_amount)}`}
                              {h.interest_amount > 0 && h.discount_amount > 0 ? " · " : ""}
                              {h.discount_amount > 0 && `Desc: ${fmtMoney(h.discount_amount)}`}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`font-semibold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                            {isIncome ? "+" : "-"} {fmtMoney(h.amount)}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-xs">{h.acted_by_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{h.acted_by_email}</p>
                        </td>
                        <td className="py-3 pr-3">
                          {h.bank_name ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Landmark className="w-3 h-3 text-muted-foreground" /> {h.bank_name}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(h.action_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}