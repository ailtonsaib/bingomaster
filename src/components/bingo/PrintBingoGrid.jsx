const HEADERS = ["S", "O", "R", "T", "E"];

// Print grid matching the PDF model:
// - Circular bordered cells
// - Bold headers S O R T E
// - 4 rows × 5 cols (no free space)
// - 2-digit zero-padded numbers
export default function PrintBingoGrid({ numbers }) {
  // numbers is a flat array of 20 (4 rows) or 25 (5 rows with free center)
  // We always render what we get, row by row in groups of 5
  const totalRows = Math.ceil(numbers.length / 5);
  const rows = [];
  for (let r = 0; r < totalRows; r++) {
    rows.push(numbers.slice(r * 5, r * 5 + 5));
  }

  const size = 32;

  const circleStyle = {
    width: size,
    height: size,
    border: "2px solid #000",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Arial, sans-serif",
    background: "#fff",
    margin: 1,
    boxSizing: "border-box",
    flexShrink: 0,
  };

  const headerCircleStyle = {
    ...circleStyle,
    fontSize: 14,
    fontWeight: "900",
  };

  return (
    <div style={{ display: "inline-block" }}>
      {/* Header row S O R T E */}
      <div style={{ display: "flex", marginBottom: 0 }}>
        {HEADERS.map((h) => (
          <div key={h} style={headerCircleStyle}>{h}</div>
        ))}
      </div>
      {/* Number rows */}
      {rows.map((row, rIdx) => (
        <div key={rIdx} style={{ display: "flex" }}>
          {row.map((num, cIdx) => (
            <div key={cIdx} style={circleStyle}>
              {String(num).padStart(2, "0")}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}