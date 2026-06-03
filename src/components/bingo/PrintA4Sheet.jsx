import PrintBingoGrid from "./PrintBingoGrid";
import Barcode from "react-barcode";

export default function PrintA4Sheet({ card, game, prizes = [] }) {
  if (!card) return null;

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

  const cardNum = String(card.card_number || 1).padStart(6, "0");
  const hasSecondChance = card.chances === 2 && card.grid_2;
  const grid1 = card.grid_1 || [];
  const grid2 = card.grid_2 || [];

  return (
    <div style={{
      width: "210mm",
      minHeight: "297mm",
      padding: "5mm 7mm 4mm 7mm",
      background: "#fff",
      fontFamily: "Arial, sans-serif",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── HEADER ── */}
      <div style={{ border: "2px solid #000", padding: "5px 8px 5px 8px", marginBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* Left: game name + location */}
          <div style={{ fontSize: 10, lineHeight: 1.5 }}>
            <div style={{ fontWeight: "900", fontSize: 14, fontFamily: "'Arial Black', Arial, sans-serif", marginBottom: 2 }}>
              {game?.name || "BINGO"}
            </div>
            {game?.event_location && (
              <>
                <div>Local: {game.event_location}</div>
                <div>Endereço: {game.event_location}</div>
              </>
            )}
          </div>
          {/* Right: date + time */}
          <div style={{ textAlign: "right", fontSize: 10, fontWeight: "bold", lineHeight: 1.8 }}>
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
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        background: "#888",
        borderLeft: "2px solid #000",
        borderRight: "2px solid #000",
      }}>
        <div style={{ background: "#888" }} />
        <div style={{
          background: "#fff",
          textAlign: "center",
          padding: "3px 24px",
          fontWeight: "bold",
          fontSize: 11,
          borderLeft: "1px solid #555",
          borderRight: "1px solid #555",
          letterSpacing: 1,
        }}>
          Cartela: &nbsp;<span style={{ fontWeight: "900", fontSize: 14, letterSpacing: 2 }}>{cardNum}</span>
        </div>
        <div style={{
          background: "#888",
          textAlign: "right",
          padding: "3px 8px",
          color: "#fff",
          fontWeight: "bold",
          fontSize: 11,
        }}>
          VALOR: {game?.event_price ? formatPrice(game.event_price) : ""}
        </div>
      </div>

      {/* ── BARCODE ── */}
      <div style={{
        textAlign: "center",
        borderLeft: "2px solid #000",
        borderRight: "2px solid #000",
        padding: "4px 0 0 0",
      }}>
        <Barcode value={cardNum} width={1.5} height={34} displayValue={false} margin={0} />
      </div>

      {/* ── PRIMEIRA CHANCE ── */}
      <ChanceSection title="PRIMEIRA CHANCE" grid={grid1} prizes={prizes} />

      {/* ── SEGUNDA CHANCE ── */}
      {hasSecondChance && (
        <ChanceSection title="SEGUNDA CHANCE" grid={grid2} prizes={prizes} />
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1.5px dashed #666", marginTop: 10, paddingTop: 6 }}>
        {/* N° CARTELA barcode on the right */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: "bold" }}>
            N° CARTELA:
            <Barcode value={cardNum} width={1} height={24} displayValue={true} margin={0} fontSize={9} />
          </div>
        </div>

        {/* COLABORADOR */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, fontSize: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>COLABORADOR:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{card.player_name || ""}</div>
        </div>

        {/* ENDEREÇO + CIDADE + FONE */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, fontSize: 10 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>ENDEREÇO:</span>
          <div style={{ flex: 2, borderBottom: "1px solid #000" }}>
            &nbsp;{card.player_city && card.player_state ? `${card.player_city} - ${card.player_state}` : card.player_city || ""}
          </div>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>CIDADE:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{card.player_city || ""}</div>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>FONE: (___)</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{card.player_phone || ""}</div>
        </div>
      </div>
    </div>
  );
}

// Renders a chance section: title + 3 identical grids side by side + prizes below
function ChanceSection({ title, grid, prizes }) {
  if (!grid || grid.length === 0) return null;

  return (
    <div style={{
      borderLeft: "2px solid #000",
      borderRight: "2px solid #000",
      padding: "6px 8px 8px 8px",
    }}>
      <div style={{
        textAlign: "center",
        fontSize: 15,
        fontWeight: "bold",
        letterSpacing: 3,
        marginBottom: 8,
      }}>
        {title}
      </div>

      {/* 3 identical grids */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PrintBingoGrid numbers={grid} />
            {/* Prizes below each grid */}
            <div style={{ fontSize: 8, color: "#333", marginTop: 5, textAlign: "left", width: "100%" }}>
              {prizes.map((prize, pIdx) => (
                <div key={pIdx} style={{ whiteSpace: "nowrap" }}>
                  {pIdx + 1}) {prize.name || ""}
                  {prize.description ? ` (${prize.description})` : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}