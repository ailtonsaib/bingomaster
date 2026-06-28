export default function RegulationSheet({ regulation, game, brandName = "BINGO" }) {
  if (!regulation) return null;

  return (
    <div style={{
      width: "210mm",
      minHeight: "297mm",
      padding: "20mm 18mm",
      background: "#fff",
      fontFamily: "Arial, sans-serif",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        textAlign: "center",
        fontWeight: "900",
        fontSize: 24,
        fontFamily: "'Arial Black', Arial, sans-serif",
        letterSpacing: 2,
        marginBottom: 8,
      }}>
        REGULAMENTO
      </div>
      <div style={{
        textAlign: "center",
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: "2px solid #000",
      }}>
        {game?.name || brandName}
      </div>
      <div style={{
        whiteSpace: "pre-wrap",
        fontSize: 12,
        lineHeight: 1.9,
        flex: 1,
        textAlign: "justify",
      }}>
        {regulation}
      </div>

      {/* ── FOOTER (mesma posição do rodapé da cartela) ── */}
      <div style={{ borderTop: "1.5px dashed #666", paddingTop: 6, marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, fontSize: 10, marginBottom: 14 }}>
          <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>VENDEDOR:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #000" }}>&nbsp;</div>
        </div>
      </div>
    </div>
  );
}