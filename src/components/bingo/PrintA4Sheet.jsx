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
  const hasSecondChance = card.chances === 2;

  // 3 grids per chance — use new fields if available, fallback to legacy
  const grids1 = [
    card.grid_1a || card.grid_1 || [],
    card.grid_1b || card.grid_1 || [],
    card.grid_1c || card.grid_1 || [],
  ];
  const grids2 = [
    card.grid_2a || card.grid_2 || [],
    card.grid_2b || card.grid_2 || [],
    card.grid_2c || card.grid_2 || [],
  ];

  // Prizes: first 3 for primeira chance; next 3 for segunda chance (fallback to first 3 if not set)
  const prizes1 = prizes.slice(0, 3);
  const prizes2 = prizes.slice(3, 6).length > 0 ? prizes.slice(3, 6) : prizes.slice(0, 3);

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
      <div style={{ border: "2px solid #000", padding: "5px 8px 3px 8px", marginBottom: 0 }}>
        {/* Game name centered */}
        <div style={{ textAlign: "center", fontWeight: "900", fontSize: 18, fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: 1, marginBottom: 4 }}>
          {game?.name || "BINGO"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 10, lineHeight: 1.5 }}>
            {game?.event_location && (
              <div>Local: {game.event_location}</div>
            )}
            {game?.event_address && (
              <div>Endereço: {game.event_address}</div>
            )}
          </div>
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
        display: "flex",
        justifyContent: "center",
      }}>
        <Barcode value={cardNum} width={1.5} height={34} displayValue={false} margin={0} />
      </div>

      {/* ── PRIMEIRA CHANCE ── */}
      <ChanceSection title="PRIMEIRA CHANCE" grids={grids1} prizes={prizes1} />

      {/* ── SEGUNDA CHANCE ── */}
      {hasSecondChance && (
        <ChanceSection title="SEGUNDA CHANCE" grids={grids2} prizes={prizes2} />
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1.5px dashed #666", marginTop: 10, paddingTop: 6 }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: "bold", marginBottom: 3 }}>
            N° CARTELA: {cardNum}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Barcode value={cardNum} width={1} height={24} displayValue={false} margin={0} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, fontSize: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>COLABORADOR:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;{card.player_name || ""}</div>
        </div>

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

// 3 distinct grids side by side, each with its own prize below
function ChanceSection({ title, grids, prizes }) {
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

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {grids.map((grid, i) => {
          const prize = prizes[i];
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <PrintBingoGrid numbers={grid} />
              {/* Prize for this specific grid */}
              {prize && (
                <div style={{ fontSize: 8, color: "#333", marginTop: 5, textAlign: "left", width: "100%", maxWidth: 170 }}>
                  <div style={{ whiteSpace: "normal" }}>
                    {i + 1}) {prize.name || ""}
                    {prize.description ? ` (${prize.description})` : ""}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}