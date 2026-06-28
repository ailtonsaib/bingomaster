import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, Trophy, Ticket, Search, Check, X } from "lucide-react";
import moment from "moment";
import RifaFormModal from "@/components/rifa/RifaFormModal";

export default function RifaDetail() {
  const { rifaId } = useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingTicket, setEditingTicket] = useState(null); // { number, buyer_name, buyer_phone, is_paid }
  const [showEditRifa, setShowEditRifa] = useState(false);
  const [drawResult, setDrawResult] = useState(null);

  const { data: rifa, isLoading: loadingRifa } = useQuery({
    queryKey: ["rifa", rifaId],
    queryFn: () => base44.entities.Rifa.get(rifaId),
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["rifa-tickets", rifaId],
    queryFn: () => base44.entities.RifaTicket.filter({ rifa_id: rifaId }, "number"),
  });

  // Build full list merging existing tickets with all numbers
  const allNumbers = useMemo(() => {
    if (!rifa) return [];
    const ticketMap = {};
    tickets.forEach(t => { ticketMap[t.number] = t; });
    return Array.from({ length: rifa.total_tickets }, (_, i) => {
      const n = i + 1;
      return ticketMap[n] || { number: n, rifa_id: rifaId, buyer_name: "", buyer_phone: "", is_paid: false, is_winner: false };
    });
  }, [rifa, tickets, rifaId]);

  const filtered = useMemo(() => {
    if (!search) return allNumbers;
    const q = search.toLowerCase();
    return allNumbers.filter(t =>
      String(t.number).includes(q) ||
      (t.buyer_name || "").toLowerCase().includes(q) ||
      (t.buyer_phone || "").includes(q)
    );
  }, [allNumbers, search]);

  const sold = allNumbers.filter(t => t.buyer_name).length;
  const paid = allNumbers.filter(t => t.is_paid).length;
  const total = rifa?.total_tickets || 0;

  const saveMutation = useMutation({
    mutationFn: async ({ ticket, updates }) => {
      if (ticket.id) {
        return base44.entities.RifaTicket.update(ticket.id, updates);
      } else {
        return base44.entities.RifaTicket.create({ rifa_id: rifaId, number: ticket.number, ...updates });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rifa-tickets", rifaId] });
      setEditingTicket(null);
    },
  });

  const drawWinner = async () => {
    const soldTickets = allNumbers.filter(t => t.buyer_name);
    if (soldTickets.length === 0) return alert("Nenhum número vendido para sortear.");
    const winner = soldTickets[Math.floor(Math.random() * soldTickets.length)];
    setDrawResult(winner);
    // mark winner on rifa and ticket
    await base44.entities.Rifa.update(rifaId, { status: "finished", winner_number: winner.number });
    if (winner.id) await base44.entities.RifaTicket.update(winner.id, { is_winner: true });
    qc.invalidateQueries({ queryKey: ["rifa", rifaId] });
    qc.invalidateQueries({ queryKey: ["rifa-tickets", rifaId] });
  };

  const pad = (n) => rifa ? String(n).padStart(String(rifa.total_tickets).length, "0") : String(n);

  if (loadingRifa) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  if (!rifa) return <div className="p-8 text-center text-muted-foreground">Rifa não encontrada.</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link to="/rifas"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold">{rifa.name}</h1>
            {rifa.prize && <p className="text-sm text-muted-foreground">🏆 {rifa.prize}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditRifa(true)}>Editar</Button>
            <Link to={`/rifas/print/${rifaId}`}>
              <Button size="sm" className="gap-1.5"><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{sold}</p><p className="text-xs text-muted-foreground">Vendidos</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-amber-600">{paid}</p><p className="text-xs text-muted-foreground">Pagos</p></CardContent></Card>
        </div>

        {/* Winner result */}
        {(rifa.status === "finished" && rifa.winner_number != null) && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-600 shrink-0" />
            <div>
              <p className="font-bold text-yellow-800">🎉 Vencedor sorteado!</p>
              <p className="text-sm text-yellow-700">Número <strong>{pad(rifa.winner_number)}</strong>
                {(() => { const w = allNumbers.find(t => t.number === rifa.winner_number); return w?.buyer_name ? ` — ${w.buyer_name}` : ""; })()}
              </p>
            </div>
          </div>
        )}

        {/* Draw button */}
        {rifa.status !== "finished" && (
          <div className="mb-4">
            <Button onClick={drawWinner} className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-white">
              <Trophy className="w-4 h-4" /> Sortear Vencedor
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, nome ou telefone..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Numbers grid */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {filtered.map(ticket => {
            const isEditing = editingTicket?.number === ticket.number;
            const hasOwner = !!ticket.buyer_name;
            const isWinner = ticket.is_winner || (rifa.winner_number === ticket.number && rifa.status === "finished");

            return (
              <div
                key={ticket.number}
                className={`rounded-lg border p-2 text-xs transition-all cursor-pointer
                  ${isWinner ? "border-yellow-400 bg-yellow-50" :
                    ticket.is_paid ? "border-emerald-300 bg-emerald-50" :
                    hasOwner ? "border-blue-200 bg-blue-50" :
                    "border-border bg-card hover:border-primary/40"}`}
                onClick={() => !isEditing && setEditingTicket({ ...ticket })}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono font-bold text-sm ${isWinner ? "text-yellow-700" : hasOwner ? "text-primary" : "text-foreground"}`}>
                    {pad(ticket.number)}
                  </span>
                  {isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}
                  {!isWinner && ticket.is_paid && <Check className="w-3 h-3 text-emerald-500" />}
                </div>
                {!isEditing ? (
                  <div>
                    {hasOwner ? <p className="truncate font-medium text-foreground">{ticket.buyer_name}</p> : <p className="text-muted-foreground italic">Disponível</p>}
                    {ticket.buyer_phone && <p className="truncate text-muted-foreground">{ticket.buyer_phone}</p>}
                  </div>
                ) : (
                  <div className="space-y-1" onClick={e => e.stopPropagation()}>
                    <Input
                      autoFocus
                      className="h-6 text-xs px-1.5"
                      placeholder="Nome"
                      value={editingTicket.buyer_name || ""}
                      onChange={e => setEditingTicket(t => ({ ...t, buyer_name: e.target.value }))}
                    />
                    <Input
                      className="h-6 text-xs px-1.5"
                      placeholder="Telefone"
                      value={editingTicket.buyer_phone || ""}
                      onChange={e => setEditingTicket(t => ({ ...t, buyer_phone: e.target.value }))}
                    />
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={!!editingTicket.is_paid}
                        onChange={e => setEditingTicket(t => ({ ...t, is_paid: e.target.checked }))}
                        className="w-3 h-3 accent-emerald-500" />
                      <span className="text-muted-foreground">Pago</span>
                    </label>
                    <div className="flex gap-1 pt-0.5">
                      <Button size="sm" className="h-5 text-xs px-2 flex-1"
                        onClick={() => saveMutation.mutate({ ticket, updates: { buyer_name: editingTicket.buyer_name, buyer_phone: editingTicket.buyer_phone, is_paid: !!editingTicket.is_paid } })}>
                        <Check className="w-2.5 h-2.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-5 text-xs px-2 flex-1" onClick={() => setEditingTicket(null)}>
                        <X className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showEditRifa && (
        <RifaFormModal
          rifa={rifa}
          onClose={() => setShowEditRifa(false)}
          onSaved={() => { setShowEditRifa(false); qc.invalidateQueries({ queryKey: ["rifa", rifaId] }); }}
        />
      )}
    </div>
  );
}