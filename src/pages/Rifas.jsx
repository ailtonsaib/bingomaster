import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useUserScope } from "@/hooks/useUserScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Plus, Printer, Ticket, Trophy, Trash2, ArrowLeft, CalendarDays, MapPin, Phone } from "lucide-react";
import moment from "moment";
import RifaFormModal from "@/components/rifa/RifaFormModal";

export default function Rifas() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRifa, setEditingRifa] = useState(null);
  const { userId, scope, enabled } = useUserScope();

  const { data: rifas = [], isLoading } = useQuery({
    queryKey: ["rifas", userId],
    queryFn: () => base44.entities.Rifa.filter(scope(), "-created_date", 50),
    enabled,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // delete tickets first
      const tickets = await base44.entities.RifaTicket.filter({ rifa_id: id });
      await Promise.all(tickets.map(t => base44.entities.RifaTicket.delete(t.id)));
      return base44.entities.Rifa.delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rifas"] }),
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
                <Ticket className="w-6 h-6 text-primary" /> Rifas
              </h1>
              <p className="text-sm text-muted-foreground">Gerencie e imprima suas rifas</p>
            </div>
          </div>
          <Button onClick={() => { setEditingRifa(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Rifa
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : rifas.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhuma rifa criada</p>
            <p className="text-sm mt-1">Clique em "Nova Rifa" para começar</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rifas.map(rifa => (
              <Card key={rifa.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base font-bold">{rifa.name}</CardTitle>
                      {rifa.prize && <p className="text-sm text-muted-foreground mt-0.5">🏆 {rifa.prize}</p>}
                    </div>
                    <Badge variant={rifa.status === "finished" ? "secondary" : "default"} className="shrink-0">
                      {rifa.status === "finished" ? "Finalizada" : "Ativa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> {rifa.total_tickets} números</span>
                    <span className="flex items-center gap-1">💵 R$ {Number(rifa.ticket_price || 0).toFixed(2)}/número</span>
                    {rifa.event_date && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {moment(rifa.event_date).format("DD/MM/YYYY")}</span>}
                    {rifa.event_location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {rifa.event_location}</span>}
                    {rifa.organizer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {rifa.organizer_phone}</span>}
                  </div>
                  {rifa.status === "finished" && rifa.winner_number != null && (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 mb-3 text-sm font-semibold text-yellow-800 flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Vencedor: Nº {String(rifa.winner_number).padStart(String(rifa.total_tickets).length, "0")}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Link to={`/rifas/${rifa.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Ticket className="w-3.5 h-3.5" /> Gerenciar
                      </Button>
                    </Link>
                    <Link to={`/rifas/print/${rifa.id}`} className="flex-1">
                      <Button size="sm" className="w-full gap-1.5">
                        <Printer className="w-3.5 h-3.5" /> Imprimir
                      </Button>
                    </Link>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => { if (confirm("Excluir esta rifa e todos os bilhetes?")) deleteMutation.mutate(rifa.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <RifaFormModal
          rifa={editingRifa}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["rifas"] }); }}
        />
      )}
    </div>
  );
}