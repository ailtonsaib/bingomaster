import { QRCodeSVG } from "qrcode.react";

export default function CardHeader({ game, card }) {
  if (!game) return null;

  const qrData = JSON.stringify({
    cartela: card.card_number,
    evento_id: game.id,
    data: game.event_date || "",
  });

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (val) => {
    if (!val) return "—";
    const num = parseFloat(val.replace(",", "."));
    if (isNaN(num)) return val;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="flex items-start justify-between gap-3 border-b-2 border-primary/20 pb-3 mb-3">
      {/* Event info */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold font-heading text-foreground leading-tight truncate">
          {game.name}
        </p>
        {game.event_location && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            📍 {game.event_location}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          🗓 {formatDate(game.event_date)}
        </p>
        <p className="text-xs font-semibold text-primary mt-0.5">
          💰 {formatPrice(game.event_price)}
        </p>
        <p className="text-xs font-bold text-foreground mt-1">
          Cartela #{card.card_number}
        </p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <QRCodeSVG value={qrData} size={72} level="M" />
        <span className="text-[9px] text-muted-foreground text-center">#{card.card_number}</span>
      </div>
    </div>
  );
}