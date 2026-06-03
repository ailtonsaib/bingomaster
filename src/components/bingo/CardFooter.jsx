import SimpleBarcode from "./SimpleBarcode";

export default function CardFooter({ card }) {
  const cardNum = String(card.card_number || 1).padStart(6, "0");

  return (
    <div className="border-2 border-gray-700 border-t-0 text-[10px] font-sans px-2 py-1.5 space-y-1">
      {/* Row 1: COLABORADOR + N° CARTELA with barcode */}
      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-end gap-1">
          <span className="font-bold text-gray-900 whitespace-nowrap">COLABORADOR:</span>
          <span className="flex-1 border-b border-gray-700 text-gray-800 pb-px">
            {card.player_name || ""}
          </span>
        </div>
        <div className="flex items-end gap-1 shrink-0">
          <span className="font-bold text-gray-900 whitespace-nowrap">N° CARTELA:</span>
          <span className="text-blue-700 font-bold border-b border-gray-700 pb-px min-w-[40px]">
            {cardNum}
          </span>
          <SimpleBarcode value={cardNum} height={24} />
        </div>
      </div>

      {/* Row 2: ENDEREÇO + CIDADE + FONE */}
      <div className="flex items-end gap-2">
        <div className="flex items-end gap-1 flex-[2]">
          <span className="font-bold text-gray-900 whitespace-nowrap">ENDEREÇO:</span>
          <span className="flex-1 border-b border-gray-700 text-gray-800 pb-px">
            {card.player_city && card.player_state
              ? `${card.player_city} - ${card.player_state}`
              : card.player_city || ""}
          </span>
        </div>
        <div className="flex items-end gap-1 flex-1">
          <span className="font-bold text-gray-900 whitespace-nowrap">CIDADE:</span>
          <span className="flex-1 border-b border-gray-700 text-gray-800 pb-px">
            {card.player_city || ""}
          </span>
        </div>
        <div className="flex items-end gap-1 flex-1">
          <span className="font-bold text-gray-900 whitespace-nowrap">FONE: ( )</span>
          <span className="flex-1 border-b border-gray-700 text-gray-800 pb-px">
            {card.player_phone || ""}
          </span>
        </div>
      </div>
    </div>
  );
}