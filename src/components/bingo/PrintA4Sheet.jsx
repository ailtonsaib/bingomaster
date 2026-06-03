import PrintBingoGrid from "./PrintBingoGrid";
import Barcode from "react-barcode";

export default function PrintA4Sheet({ cards, game, prizes = [] }) {
  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatPrice = (val) => {
    if (!val) return "";
    const num = parseFloat(String(val).replace(",", "."));
    if (isNaN(num)) return val;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const hasSecondChance = cards.some((c) => c.chances === 2 && c.grid_2);

  // Use first card number for the sheet identifier (all cards share same number in the PDF model)
  const sheetCard = cards[0];
  const cardNum = String(sheetCard?.card_number || 1).padStart(6, "0");

  return (
    <div style={{
      width: "210mm",
      minHeight: "297mm",
      padding: "6mm 8mm 4mm 8mm",
      background: "#fff",
      fontFamily: "Arial, sans-serif",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── TOP HEADER ── */}
      <div style={{ border: "2px solid #000", padding: "4px 8px", marginBottom: 0 }}>
        {/* Title */}
        <div style={{ textAlign: "center", fontSize: 18, fontWeight: "900", fontFamily: "'Arial Black', Arial, sans-serif", marginBottom: 4 }}>
          {game?.name || "BINGO"}
        </div>

        {/* Local + Data row */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
          <div>
            {game?.event_location && (
              <>
                <div>Local: {game.event_location}</div>
                <div>Endereço: {game.event_location}</div>
              </>
            )}
          </div>
          <div style={{ textAlign: "right", fontWeight: "bold" }}>
            {game?.event_date && (
              <>
                <div>DATA: {formatDate(game.event_date)}</div>
                <div>HORAS: {formatTime(game.event_date)}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CARTELA BAR ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", background: "#ccc", borderLeft: "2px solid #000", borderRight: "2px solid #000" }}>
        <div style={{ background: "#888" }} />
        <div style={{ background: "#fff", textAlign: "center", padding: "3px 16px", fontWeight: "bold", fontSize: 11, borderLeft: "1px solid #888", borderRight: "1px solid #888" }}>
          Cartela: &nbsp;<span style={{ fontWeight: "900", fontSize: 13 }}>{cardNum}</span>
        </div>
        <div style={{ background: "#888", textAlign: "right", padding: "3px 8px", color: "#fff", fontWeight: "bold", fontSize: 11 }}>
          VALOR: {game?.event_price ? formatPrice(game.event_price) : ""}
        </div>
      </div>

      {/* ── BARCODE (centered) ── */}
      <div style={{ textAlign: "center", borderLeft: "2px solid #000", borderRight: "2px solid #000", padding: "4px 0 0 0" }}>
        <Barcode value={cardNum} width={1.4} height={32} displayValue={false} margin={0} />
      </div>

      {/* ── PRIMEIRA CHANCE ── */}
      <ChanceSection title="PRIMEIRA CHANCE" cards={cards} getGrid={(c) => c.grid_1} prizes={prizes} />

      {/* ── SEGUNDA CHANCE ── */}
      {hasSecondChance && (
        <ChanceSection title="SEGUNDA CHANCE" cards={cards} getGrid={(c) => c.grid_2 || c.grid_1} prizes={prizes} />
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1.5px dashed #555", marginTop: 8, paddingTop: 6 }}>
        {/* N° CARTELA + barcode on the right */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: "bold" }}>
            N° CARTELA:
            <Barcode value={cardNum} width={1} height={22} displayValue={true} margin={0} fontSize={9} />
          </div>
        </div>

        {/* COLABORADOR */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, fontSize: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>COLABORADOR:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{cards[0]?.player_name || ""}</div>
        </div>

        {/* ENDEREÇO + CIDADE + FONE */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, fontSize: 10 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>ENDEREÇO:</span>
          <div style={{ flex: 2, borderBottom: "1px solid #000" }}>&nbsp;{cards[0]?.player_city && cards[0]?.player_state ? `${cards[0].player_city} - ${cards[0].player_state}` : cards[0]?.player_city || ""}</div>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>CIDADE:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{cards[0]?.player_city || ""}</div>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>FONE: ( )</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{cards[0]?.player_phone || ""}</div>
        </div>
      </div>
    </div>
  );
}

function ChanceSection({ title, cards, getGrid, prizes }) {
  return (
    <div style={{ borderLeft: "2px solid #000", borderRight: "2px solid #000", padding: "4px 6px 6px 6px" }}>
      {/* Section title */}
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: "bold", letterSpacing: 2, marginBottom: 6 }}>
        {title}
      </div>

      {/* 3 grids side by side, each with its own prize list */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {cards.map((card) => {
          const grid = getGrid(card);
          if (!grid) return null;

          return (
            <div key={card.id + "_" + title} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <PrintBingoGrid numbers={grid} />
              {/* All prizes listed below each card's grid */}
              <div style={{ fontSize: 8, color: "#333", marginTop: 4, textAlign: "left", width: "100%" }}>
                {prizes.map((prize, pIdx) => (
                  <div key={pIdx} style={{ whiteSpace: "nowrap" }}>
                    {pIdx + 1}) {prize.name || ""}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}