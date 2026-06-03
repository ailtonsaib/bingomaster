import PrintBingoGrid from "./PrintBingoGrid";
import Barcode from "react-barcode";

// One A4 page sheet rendering up to 3 cards.
// Layout: header info → "PRIMEIRA CHANCE" (3 grids) → "SEGUNDA CHANCE" (3 grids, if applicable)
// Matches the style in the reference image.

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

  return (
    <div style={{
      width: "210mm",
      minHeight: "297mm",
      padding: "10mm 8mm",
      background: "#fff",
      fontFamily: "Arial, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Page header */}
      {game && (
        <div style={{ marginBottom: 8, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: "bold", textAlign: "center", color: "#111" }}>
            {game.name}
          </div>
          <div style={{ fontSize: 9, textAlign: "center", color: "#555", marginTop: 2 }}>
            {[
              game.event_location && `Local: ${game.event_location}`,
              game.event_date && `Data: ${formatDate(game.event_date)} às ${formatTime(game.event_date)}`,
              game.event_price && `Valor: ${formatPrice(game.event_price)}`,
            ].filter(Boolean).join("   |   ")}
          </div>
        </div>
      )}

      {/* PRIMEIRA CHANCE */}
      <ChanceSection
        title="PRIMEIRA CHANCE"
        cards={cards}
        getGrid={(c) => c.grid_1}
        prizes={prizes}
      />

      {/* SEGUNDA CHANCE */}
      {hasSecondChance && (
        <ChanceSection
          title="SEGUNDA CHANCE"
          cards={cards}
          getGrid={(c) => c.grid_2 || c.grid_1}
          prizes={prizes}
          topMargin={14}
        />
      )}

      {/* Footer */}
      <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #ccc", fontSize: 8, color: "#888", textAlign: "center" }}>
        {cards.map((c) => `Cartela ${String(c.card_number || "").padStart(6, "0")} — ${c.player_name}`).join("   |   ")}
      </div>
    </div>
  );
}

function ChanceSection({ title, cards, getGrid, prizes, topMargin = 0 }) {
  return (
    <div style={{ marginTop: topMargin }}>
      {/* Section title */}
      <div style={{
        textAlign: "center",
        fontSize: 13,
        fontWeight: "bold",
        letterSpacing: 1,
        marginBottom: 6,
        color: "#111",
      }}>
        {title}
      </div>

      {/* 3 cards side by side */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {cards.map((card, cIdx) => {
          const grid = getGrid(card);
          if (!grid) return null;
          const cardNum = String(card.card_number || 1).padStart(6, "0");
          const prizeLabel = prizes[cIdx]?.name || card.player_name || "";

          return (
            <div key={card.id + "_" + title} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* Barcode header */}
              <div style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <Barcode
                  value={cardNum}
                  width={0.9}
                  height={18}
                  displayValue={false}
                  margin={0}
                />
              </div>

              {/* Bingo grid */}
              <PrintBingoGrid numbers={grid} />

              {/* Prize / player label */}
              <div style={{ fontSize: 9, color: "#444", marginTop: 3, textAlign: "center", maxWidth: 150 }}>
                {cIdx + 1}) {prizeLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}