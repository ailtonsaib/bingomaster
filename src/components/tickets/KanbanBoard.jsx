import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TicketCard from "./TicketCard";

const COLUMNS = [
  { id: "aberto", title: "Aberto", color: "bg-blue-500" },
  { id: "em_analise", title: "Em Análise", color: "bg-amber-500" },
  { id: "iniciado", title: "Iniciado", color: "bg-purple-500" },
  { id: "em_teste", title: "Em Teste", color: "bg-cyan-500" },
  { id: "concluido", title: "Concluído", color: "bg-emerald-500" },
];

export default function KanbanBoard({ tickets, onMove, onTicketClick, readOnly }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const ticketId = result.draggableId;
    const newStatus = result.destination.droppableId;
    const sourceStatus = result.source.droppableId;
    if (sourceStatus === newStatus) return;
    const direction = COLUMNS.findIndex((c) => c.id === newStatus) > COLUMNS.findIndex((c) => c.id === sourceStatus) ? "forward" : "backward";
    onMove(ticketId, newStatus, direction);
  };

  if (readOnly) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.map((col) => {
          const colTickets = tickets.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-72">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <h3 className="text-sm font-semibold">{col.title}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{colTickets.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px] p-2 rounded-lg bg-muted/30">
                {colTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} index={0} onClick={() => onTicketClick(ticket)} />
                ))}
                {colTickets.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8">Nenhum chamado</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.map((col) => {
          const colTickets = tickets.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-72">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <h3 className="text-sm font-semibold">{col.title}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{colTickets.length}</span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[200px] p-2 rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : "bg-muted/30"}`}
                  >
                    {colTickets.map((ticket, idx) => (
                      <TicketCard key={ticket.id} ticket={ticket} index={idx} onClick={() => onTicketClick(ticket)} />
                    ))}
                    {provided.placeholder}
                    {colTickets.length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-8">Solte aqui</div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}