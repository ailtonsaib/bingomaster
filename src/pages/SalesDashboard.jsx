import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ChevronDown, DollarSign, Ticket, Users,
  TrendingUp, Calendar, Clock, Target, BarChart3, CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
  LineChart, Line, ReferenceLine
} from "recharts";
import { motion } from "framer-motion";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

const REFRESH_MS = 10000;

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const parsed = parseFloat(String(priceStr).replace(/[^\d,.-]/g, "").replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
}

export default function SalesDashboard() {
  const [selectedGameId, setSelectedGameId] = useState("all");
  const [showPicker, setShowPicker] = useState(false);

  const { data: games = [] } = useQuery({
    queryKey: ["dash-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
    refetchInterval: REFRESH_MS,
  });

  const { data: allCards = [], isLoading } = useQuery({
    queryKey: ["dash-all-cards"],
    queryFn: () => base44.functions.invoke("getAllCards", {}).then((r) => r.data.cards),
    refetchInterval: REFRESH_MS,
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["dash-sellers"],
    queryFn: () => base44.entities.Seller.list(),
  });

  const sellerMap = useMemo(() => {
    const m = {};
    sellers.forEach((s) => { m[s.id] = s; });
    return m;
  }, [sellers]);

  // Filter by selected game
  const visibleGames = useMemo(
    () => selectedGameId === "all" ? games : games.filter((g) => g.id === selectedGameId),
    [games, selectedGameId]
  );
  const visibleCards = useMemo(
    () => selectedGameId === "all" ? allCards : allCards.filter((c) => c.game_id === selectedGameId),
    [allCards, selectedGameId]
  );

  const stats = useMemo(() => {
    const generated = visibleCards.length;
    const sold = visibleCards.filter((c) => c.player_phone || c.player_city).length;
    const paid = visibleCards.filter((c) => (c.player_phone || c.player_city) && c.payment_status === "paid").length;
    const pending = sold - paid;

    // Ticket price: use first game with a price, or 0
    const gameWithPrice = visibleGames.find((g) => parsePrice(g.event_price) > 0);
    const ticketPrice = gameWithPrice ? parsePrice(gameWithPrice.event_price) : 0;

    const revenuePaid = paid * ticketPrice;
    const revenuePending = pending * ticketPrice;
    const revenueTotal = revenuePaid + revenuePending;
    const maxRevenue = generated * ticketPrice;

    // Forecast: sales velocity based on days elapsed
    const now = new Date();
    const gameDates = visibleGames.map((g) => g.created_date ? parseISO(g.created_date) : null).filter(Boolean);
    const earliestCreated = gameDates.length > 0 ? new Date(Math.min(...gameDates.map((d) => d.getTime()))) : null;
    const daysElapsed = earliestCreated ? Math.max(1, differenceInCalendarDays(now, earliestCreated)) : 1;
    const velocityPerDay = sold / daysElapsed; // cards sold per day

    // Event date (earliest upcoming event)
    const eventDates = visibleGames
      .map((g) => g.event_date ? parseISO(g.event_date) : null)
      .filter((d) => d && d > now);
    const eventDate = eventDates.length > 0 ? new Date(Math.min(...eventDates.map((d) => d.getTime()))) : null;
    const daysToEvent = eventDate ? Math.max(0, differenceInCalendarDays(eventDate, now)) : null;

    // Projected sales by event date
    const projectedSold = eventDate
      ? Math.min(generated, Math.round(sold + velocityPerDay * daysToEvent))
      : sold;
    const projectedRevenue = projectedSold * ticketPrice;
    const projectedPending = Math.max(0, projectedSold - sold);
    const projectedPendingRevenue = projectedPending * ticketPrice;

    return {
      generated, sold, paid, pending,
      ticketPrice, revenuePaid, revenuePending, revenueTotal, maxRevenue,
      velocityPerDay, daysElapsed, eventDate, daysToEvent,
      projectedSold, projectedRevenue, projectedPending, projectedPendingRevenue,
      sellPct: generated > 0 ? ((sold / generated) * 100).toFixed(1) : 0,
      paidPct: sold > 0 ? ((paid / sold) * 100).toFixed(0) : 0,
      forecastPct: generated > 0 ? ((projectedSold / generated) * 100).toFixed(0) : 0,
      activeSellers: new Set(visibleCards.filter((c) => c.seller_id).map((c) => c.seller_id)).size,
    };
  }, [visibleCards, visibleGames]);

  // Seller ranking
  const sellerRanking = useMemo(() => {
    const map = {};
    for (const card of visibleCards) {
      const hasBuyer = card.player_phone || card.player_city;
      if (!hasBuyer) continue;
      const key = card.seller_id || "__sem_vendedor__";
      const name = card.seller_name || sellerMap[card.seller_id]?.name || "Sem vendedor";
      if (!map[key]) map[key] = { id: key, name, sold: 0, paid: 0, pending: 0, total: 0 };
      map[key].sold++;
      map[key].total++;
      if (card.payment_status === "paid") map[key].paid++;
      else map[key].pending++;
    }
    return Object.values(map).sort((a, b) => b.sold - a.sold);
  }, [visibleCards, sellerMap]);

  // Chart data: generated vs sold per seller
  const chartData = useMemo(
    () => sellerRanking.slice(0, 10).map((s) => ({
      name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
      vendidas: s.sold,
      pagas: s.paid,
    })),
    [sellerRanking]
  );

  // Forecast chart: daily cumulative projection
  const forecastChart = useMemo(() => {
    if (!stats.eventDate || stats.velocityPerDay === 0) return [];
    const points = [];
    const totalDays = stats.daysElapsed + stats.daysToEvent;
    for (let d = 0; d <= totalDays; d += Math.max(1, Math.ceil(totalDays / 15))) {
      const projected = Math.min(stats.generated, Math.round(stats.velocityPerDay * d));
      points.push({
        day: d === 0 ? "Início" : d === stats.daysElapsed ? "Hoje" : `D${d}`,
        projetado: projected,
      });
    }
    // Ensure "Hoje" point exists
    const hasHoje = points.some((p) => p.day === "Hoje");
    if (!hasHoje) {
      points.splice(
        points.findIndex((p) => p.day === undefined || typeof p.day === "string"),
        0,
        { day: "Hoje", projetado: stats.sold }
      );
    }
    return points;
  }, [stats]);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-6">
        <Link to="/" className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-yellow-300" /> Dashboard de Vendas
        </h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Vendedores, cartelas vendidas e previsão financeira até a data do evento
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Game picker */}
        <div className="relative">
          <button
            className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-input bg-card text-sm hover:bg-accent transition-colors shadow-sm"
            onClick={() => setShowPicker((v) => !v)}
          >
            <span className="font-medium">
              {selectedGameId === "all" ? "Todos os jogos" : selectedGame?.name || "Selecionar jogo..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showPicker && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-60 overflow-auto">
              <button
                className="w-full text-left px-4 py-3 hover:bg-muted text-sm font-medium"
                onClick={() => { setSelectedGameId("all"); setShowPicker(false); }}
              >
                📊 Todos os jogos
              </button>
              {games.map((g) => (
                <button
                  key={g.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-sm"
                  onClick={() => { setSelectedGameId(g.id); setShowPicker(false); }}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {g.status === "finished" ? "✅ Finalizado" : g.status === "in_progress" ? "🎯 Em andamento" : "⏳ Aguardando"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
          </div>
        )}

        {!isLoading && (
          <>
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Geradas vs Vendidas</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                    <Ticket className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="text-2xl font-bold font-heading">
                  {stats.sold}<span className="text-muted-foreground text-base">/{stats.generated}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stats.sellPct}% vendidas</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="p-4 rounded-xl border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Receita Atual</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50 dark:bg-green-900/20">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold font-heading">
                  {stats.ticketPrice > 0 ? currency(stats.revenueTotal) : "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.paid} pagas • {stats.pending} pendentes
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-xl border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Vendedores Ativos</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold font-heading">{stats.activeSellers}</div>
                <p className="text-xs text-muted-foreground mt-1">com cartelas vendidas</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-4 rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Previsão até Evento</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-200 dark:bg-amber-900/40">
                    <TrendingUp className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold font-heading text-amber-800 dark:text-amber-300">
                  {stats.ticketPrice > 0 ? currency(stats.projectedRevenue) : `${stats.projectedSold} cartelas`}
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {stats.eventDate
                    ? `${format(stats.eventDate, "dd/MM")} • ${stats.forecastPct}% do total`
                    : "Sem data de evento definida"}
                </p>
              </motion.div>
            </div>

            {/* Generated vs Sold progress bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Progresso de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">{stats.sold} vendidas</span>
                  <span className="text-muted-foreground">{stats.generated - stats.sold} restantes</span>
                </div>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.sellPct}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" /> {stats.paid} pagas ({stats.paidPct}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-500" /> {stats.pending} pendentes
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Financial forecast section */}
            {stats.ticketPrice > 0 && (
              <Card className="border-amber-200 dark:border-amber-900/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600" /> Previsão Financeira
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.eventDate ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        Evento em {format(stats.eventDate, "dd/MM/yyyy")} — {stats.daysToEvent} dias restantes
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-card border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Receita atual</p>
                          <p className="text-lg font-bold font-heading">{currency(stats.revenueTotal)}</p>
                          <p className="text-xs text-muted-foreground">{stats.sold} cartelas vendidas</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">Projeção até evento</p>
                          <p className="text-lg font-bold font-heading text-amber-800 dark:text-amber-300">
                            {currency(stats.projectedRevenue)}
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            +{currency(stats.projectedPendingRevenue)} ({stats.projectedSold} cartelas)
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ritmo de vendas</span>
                          <span className="font-medium">{stats.velocityPerDay.toFixed(1)} cartelas/dia</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dias decorridos</span>
                          <span className="font-medium">{stats.daysElapsed} dias</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Potencial máximo</span>
                          <span className="font-medium text-green-600">{currency(stats.maxRevenue)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-3">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Defina a data do evento no cadastro do jogo para ver a previsão financeira baseada no ritmo de vendas.
                        Receita potencial máxima: <strong className="text-foreground">{currency(stats.maxRevenue)}</strong>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Seller ranking */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Ranking de Vendedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sellerRanking.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-muted-foreground">
                    <Users className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma cartela vendida ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sellerRanking.map((seller, idx) => {
                      const pct = stats.sold > 0 ? (seller.sold / stats.sold) * 100 : 0;
                      const revenue = seller.sold * stats.ticketPrice;
                      return (
                        <div key={seller.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-100 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm truncate">{seller.name}</p>
                              <span className="text-xs font-semibold shrink-0">{seller.sold} vendidas</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="text-green-600">{seller.paid} pagas</span>
                              <span className="text-orange-500">{seller.pending} pendentes</span>
                              {stats.ticketPrice > 0 && (
                                <span className="font-medium text-foreground">{currency(revenue)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart: sold vs paid per seller */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Vendas por Vendedor (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        cursor={{ fill: 'hsl(var(--muted))' }}
                      />
                      <Bar dataKey="vendidas" name="Vendidas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pagas" name="Pagas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Forecast chart */}
            {forecastChart.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600" /> Projeção de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={forecastChart} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Line
                        type="monotone" dataKey="projetado" name="Cartelas projetadas"
                        stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={{ r: 3 }}
                      />
                      <ReferenceLine y={stats.generated} stroke="hsl(var(--destructive))" strokeDasharray="5 5"
                        label={{ value: `Máx: ${stats.generated}`, position: 'right', fontSize: 10, fill: 'hsl(var(--destructive))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}