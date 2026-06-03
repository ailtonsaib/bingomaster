import Barcode from "react-barcode";

export default function CardHeader({ game, card }) {
  if (!game) return null;

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatPrice = (val) => {
    if (!val) return "—";
    const num = parseFloat(String(val).replace(",", "."));
    if (isNaN(num)) return val;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const cardNum = String(card.card_number || 1).padStart(6, "0");

  return (
    <div className="border-2 border-gray-700 mb-2 text-[11px] font-sans">
      {/* Title centered */}
      <div className="text-center px-2 pt-2 pb-1">
        <p className="font-black text-[18px] leading-tight text-gray-900 uppercase tracking-wide">
          {game.name}
        </p>
      </div>

      {/* Top section */}
      <div className="flex items-start px-2 pb-1">
        {/* Left: location + address */}
        <div className="flex-1 pr-4">
          {game.event_location && (
            <p className="text-gray-800">Local: {game.event_location}</p>
          )}
          {game.event_address && (
            <p className="text-gray-800">Endereço: {game.event_address}</p>
          )}
        </div>

        {/* Right: date, time, barcode */}
        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          <p className="text-gray-800">DATA: {formatDate(game.event_date)}</p>
          <p className="text-gray-800">HORAS: {formatTime(game.event_date)}</p>
          <Barcode value={cardNum} width={1.2} height={30} displayValue={false} margin={0} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="grid grid-cols-3 text-center text-[11px]">
        <div className="bg-gray-500 py-1" />
        <div className="py-1 bg-white text-gray-900 font-bold border-x border-gray-600">
          Cartela: <span className="text-blue-700">{cardNum}</span>
        </div>
        <div className="py-1 text-white font-bold bg-gray-500">
          VALOR: {formatPrice(game.event_price)}
        </div>
      </div>
    </div>
  );
}