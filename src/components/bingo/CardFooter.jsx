export default function CardFooter({ card }) {
  return (
    <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground space-y-0.5">
      <div className="flex items-center gap-1">
        <span className="font-semibold text-foreground">Nome:</span>
        <span>{card.player_name || "—"}</span>
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-foreground">Tel:</span>
          <span>{card.player_phone || "—"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-foreground">Cidade:</span>
          <span>{card.player_city || "—"}</span>
          {card.player_state && (
            <span>/ {card.player_state}</span>
          )}
        </div>
      </div>
    </div>
  );
}