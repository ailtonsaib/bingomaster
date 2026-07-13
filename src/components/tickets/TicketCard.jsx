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

export default function TicketCard({ ticket, index, onClick, readOnly }) {
  const priorityColor = PRIORITY_COLORS[ticket.priority_level >= 4 ? 'red' : ticket.priority_level === 3 ? 'orange' : ticket.priority_level === 2 ? 'yellow' : 'blue'] || PRIORITY_COLORS.gray;

  const inner = (provided, snapshot) => (
        <div
          ref={provided?.innerRef}
          {...(provided?.draggableProps || {})}
          {...(provided?.dragHandleProps || {})}
          onClick={onClick}
          className={`bg-card border rounded-md px-2.5 py-2 cursor-pointer transition-shadow hover:shadow-md ${snapshot?.isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs text-muted-foreground font-mono shrink-0">#{ticket.id?.slice(-4)}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityColor.includes('red') ? '#ef4444' : priorityColor.includes('orange') ? '#f97316' : priorityColor.includes('yellow') ? '#eab308' : priorityColor.includes('blue') ? '#3b82f6' : '#9ca3af' }} />
          </div>
          <p className="text-xs font-medium leading-tight truncate mt-0.5">{ticket.title}</p>
        </div>
  );

  if (readOnly) return inner();

  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => inner(provided, snapshot)}
    </Draggable>
  );
}