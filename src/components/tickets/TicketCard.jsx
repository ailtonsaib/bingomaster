import { Badge } from "@/components/ui/badge";
import { Draggable } from "@hello-pangea/dnd";

const PRIORITY_COLORS = {
  red: "bg-red-100 text-red-700 border-red-300",
  orange: "bg-orange-100 text-orange-700 border-orange-300",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-300",
  blue: "bg-blue-100 text-blue-700 border-blue-300",
  green: "bg-emerald-100 text-emerald-700 border-emerald-300",
  gray: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function TicketCard({ ticket, index, onClick }) {
  const priorityColor = PRIORITY_COLORS[ticket.priority_level >= 4 ? 'red' : ticket.priority_level === 3 ? 'orange' : ticket.priority_level === 2 ? 'yellow' : 'blue'] || PRIORITY_COLORS.gray;

  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-card border rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium leading-tight">{ticket.title}</p>
            {ticket.priority_name && (
              <Badge variant="outline" className={`text-[10px] shrink-0 ${priorityColor}`}>
                {ticket.priority_name}
              </Badge>
            )}
          </div>
          {ticket.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ticket.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mb-1">
            {ticket.type_name && (
              <Badge variant="secondary" className="text-[10px]">{ticket.type_name}</Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{ticket.assigned_to_name || "Sem responsável"}</span>
            <span>#{ticket.id?.slice(-4)}</span>
          </div>
        </div>
      )}
    </Draggable>
  );
}