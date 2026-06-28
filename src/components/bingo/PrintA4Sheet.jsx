import PrintBingoGrid from "./PrintBingoGrid";
import Barcode from "react-barcode";

export default function PrintA4Sheet({ card, game, prizes = [], brandName = "BINGO" }) {
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

  // Número de grades = número de prêmios (mínimo 1, máximo 6)
  const validPrizes = (prizes || []).filter(p => p && p.name && p.name.trim());
  const numGrids = Math.max(1, Math.min(6, validPrizes.length));

  // Calcula layout ideal para preencher a página A4 (horizontal e vertical)
  const MM_TO_PX = 3.7795;
  const availWidth = 210 * MM_TO_PX - 7 * MM_TO_PX * 2 - 4; // página - padding lateral - bordas
  const availHeight = 297 * MM_TO_PX - (5 + 4) * MM_TO_PX;  // página - padding vertical
  const fixedH = 230; // header + barra + barcode + rodapé + gaps
  const chanceAreaH = availHeight - fixedH;
  const numChances = hasSecondChance ? 2 : 1;
  const chanceGap = hasSecondChance ? 50 : 0;
  const gridAreaH = (chanceAreaH - chanceGap) / numChances - 55; // 55 = título + prêmio + padding
  const layout = calculateGridLayout(numGrids, availWidth, gridAreaH);
  const { cols, size: circleSize } = layout;
  const gridGap = 8;

  // Gera N grades — usa os campos existentes (grid_1a/b/c) e repete o primeiro para extras
  const baseGrid1 = card.grid_1a || card.grid_1 || [];
  const baseGrid2 = card.grid_2a || card.grid_2 || [];
  const gridFields1 = [card.grid_1a, card.grid_1b, card.grid_1c];
  const gridFields2 = [card.grid_2a, card.grid_2b, card.grid_2c];
  const grids1 = Array.from({ length: numGrids }, (_, i) => gridFields1[i] || baseGrid1);
  const grids2 = Array.from({ length: numGrids }, (_, i) => gridFields2[i] || baseGrid2);

  // Mesmos prêmios para primeira e segunda chance
  const prizes1 = validPrizes;
  const prizes2 = validPrizes;

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

      {/* ── WRAPPER LATERAL BORDERS ── */}
      <div style={{
        borderLeft: "2px solid #000",
        borderRight: "2px solid #000",
        borderBottom: "2px solid #000",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        position: "relative",
      }}>
        {/* Background image */}
        {game?.card_bg_image_url && (
          <img
            src={game.card_bg_image_url}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.15,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>

      {/* ── CARTELA BAR ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        background: "#888",
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
          <span style={{ fontWeight: "900", fontSize: 14, letterSpacing: 2 }}>{cardNum}</span>
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
        padding: "4px 8px 0 8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <Barcode value={cardNum} width={1.5} height={34} displayValue={false} margin={0} />
        {game?.card_image_url && (
          <img
            src={game.card_image_url}
            alt="Imagem do evento"
            style={{ maxHeight: 40, maxWidth: 120, objectFit: "contain" }}
          />
        )}
      </div>

      {/* ── PRIMEIRA CHANCE ── */}
      <ChanceSection title="PRIMEIRA CHANCE" grids={grids1} prizes={prizes1} brandName={brandName} circleSize={circleSize} gridGap={gridGap} cols={cols} />

      {/* ── SEGUNDA CHANCE ── */}
      {hasSecondChance && (
        <div style={{ marginTop: chanceGap }}>
          <ChanceSection title="SEGUNDA CHANCE" grids={grids2} prizes={prizes2} brandName={brandName} circleSize={circleSize} gridGap={gridGap} cols={cols} />
        </div>
      )}

      {/* Spacer inside border */}
      <div style={{ flex: 1, minHeight: 8 }} />

        </div>{/* end inner zIndex wrapper */}
      </div>{/* end lateral borders wrapper */}

      {/* Gap between border and footer dashed line */}
      <div style={{ height: 8 }} />

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1.5px dashed #666", paddingTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: "bold" }}>
              N° {cardNum}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Barcode value={cardNum} width={1} height={24} displayValue={false} margin={0} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, fontSize: 10, marginBottom: 14 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>COLABORADOR:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;</div>
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

// N grids in a CSS grid (rows × cols), each with its prize description below
function ChanceSection({ title, grids, prizes, brandName, circleSize = 32, gridGap = 8, cols = 1 }) {
  return (
    <div style={{
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

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: gridGap, justifyItems: "center" }}>
        {grids.map((grid, i) => {
          const prize = prizes[i];
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <PrintBingoGrid numbers={grid} brandName={brandName} size={circleSize} />
              {prize && (
                <div style={{
                  fontSize: Math.max(9, Math.round(circleSize * 0.32)),
                  color: "#000",
                  fontWeight: "bold",
                  marginTop: 4,
                  textAlign: "left",
                  width: "100%",
                }}>
                  {i + 1}) {prize.name || ""}
                  {prize.description ? ` (${prize.description})` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Calcula o melhor layout (cols × rows) e o tamanho do círculo para preencher a área
function calculateGridLayout(numGrids, availWidth, availHeight) {
  if (numGrids <= 0) return { cols: 1, rows: 1, size: 32 };
  const gap = 8;
  let best = { cols: numGrids, rows: 1, size: 0 };

  for (let cols = 1; cols <= numGrids; cols++) {
    const rows = Math.ceil(numGrids / cols);
    const emptySlots = cols * rows - numGrids;
    if (emptySlots > 1) continue; // tolera no máximo 1 slot vazio

    const sizeByWidth = Math.floor((availWidth - (cols - 1) * gap) / (cols * 5) - 2);
    const sizeByHeight = Math.floor((availHeight - (rows - 1) * gap) / (rows * 5) - 2);
    const size = Math.max(10, Math.min(sizeByWidth, sizeByHeight));

    if (size > best.size) {
      best = { cols, rows, size };
    }
  }
  return best;
}