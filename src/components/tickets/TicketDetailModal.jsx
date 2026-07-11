import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, ArrowLeft, UserCheck, Trash2, Clock } from "lucide-react";

const STATUS_LABELS = {
  aberto: "Aberto", em_analise: "Em Análise", iniciado: "Iniciado", em_teste: "Em Teste", concluido: "Concluído",
};
const STATUS_FLOW = ["aberto", "em_analise", "iniciado", "em_teste", "concluido"];

export default function TicketDetailModal({ ticket, users, currentUser, onMove, onTransfer, onDelete, onClose }) {
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState(true);

  const currentIdx = STATUS_FLOW.indexOf(ticket.status);
  const canForward = currentIdx < STATUS_FLOW.length - 1;
  const canBackward = currentIdx > 0;

  const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";
  const stageTimestamps = [
    { label: "Aberto", date: ticket.aberto_at },
    { label: "Em Análise", date: ticket.em_analise_at },
    { label: "Iniciado", date: ticket.iniciado_at },
    { label: "Em Teste", date: ticket.em_teste_at },
    { label: "Concluído", date: ticket.concluido_at },
  ];

  const handleForward = () => onMove(ticket.id, STATUS_FLOW[currentIdx + 1], "forward");
  const handleBackward = () => onMove(ticket.id, STATUS_FLOW[currentIdx - 1], "backward");
  const handleTransfer = () => {
    if (!transferTo) return;
    const user = users.find((u) => u.id === transferTo);
    onTransfer(ticket.id, transferTo, user?.name || "");
    setShowTransfer(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">{ticket.title}</h2>
              <p className="text-xs text-muted-foreground">#{ticket.id?.slice(-6)} · Criado por {ticket.created_by_name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>

          {ticket.description && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{STATUS_LABELS[ticket.status]}</Badge>
            {ticket.type_name && <Badge variant="outline">{ticket.type_name}</Badge>}
            {ticket.priority_name && <Badge variant="outline" className="border-primary/30">{ticket.priority_name}</Badge>}
            {ticket.assigned_to_name && <Badge variant="outline" className="gap-1"><UserCheck className="w-3 h-3" />{ticket.assigned_to_name}</Badge>}
          </div>

          {/* Stage timestamps */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Linha do Tempo</h3>
            <div className="space-y-1">
              {stageTimestamps.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${s.date ? "" : "opacity-40"}`}>
                  <div className={`w-2 h-2 rounded-full ${s.date ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className="w-24 font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{s.date ? fmtDate(s.date) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button size="sm" variant="default" onClick={handleForward} disabled={!canForward} className="gap-1">
              <ArrowRight className="w-4 h-4" /> Avançar
            </Button>
            <Button size="sm" variant="outline" onClick={handleBackward} disabled={!canBackward} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowTransfer(!showTransfer)} className="gap-1">
              <UserCheck className="w-4 h-4" /> Transferir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir chamado?")) onDelete(ticket.id); }} className="gap-1 text-destructive ml-auto">
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          </div>

          {showTransfer && (
            <div className="flex gap-2 items-center bg-muted/30 p-3 rounded-lg">
              <select className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">Selecione um usuário...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              <Button size="sm" onClick={handleTransfer} disabled={!transferTo}>Transferir</Button>
            </div>
          )}

          {/* History */}
          {ticket.history && ticket.history.length > 0 && (
            <div>
              <button onClick={() => setHistoryExpanded(!historyExpanded)} className="text-sm font-semibold mb-2">
                Histórico de Movimentações ({ticket.history.length})
              </button>
              {historyExpanded && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {ticket.history.map((h, i) => (
                    <div key={i} className="text-xs border-l-2 pl-2 py-1" style={{ borderColor: h.direction === 'forward' ? '#10b981' : h.direction === 'backward' ? '#f59e0b' : '#3b82f6' }}>
                      <span className="font-medium">{h.moved_by_name}</span> ·{" "}
                      {h.direction === 'transfer' ? (h.note || 'Transferiu') : (
                        `${STATUS_LABELS[h.from_status] || 'Início'} → ${STATUS_LABELS[h.to_status]}`
                      )}
                      <span className="text-muted-foreground"> · {fmtDate(h.moved_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}