const HEADERS = ["S", "O", "R", "T", "E"];

// Print-optimized bingo grid matching the image style:
// square cells with rounded borders, 2-digit numbers, no colors.
export default function PrintBingoGrid({ numbers }) {
  const rows = [];
  for (let r = 0; r < 5; r++) {
    rows.push(numbers.slice(r * 5, r * 5 + 5));
  }

  const cellStyle = {
    width: 28,
    height: 24,
    border: "1.5px solid #555",
    borderRadius: 3,
    textAlign: "center",
    verticalAlign: "middle",
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: "Arial, sans-serif",
    background: "#fff",
    padding: 0,
  };

  const headerCellStyle = {
    ...cellStyle,
    fontSize: 13,
    fontWeight: "900",
    height: 22,
    borderRadius: 3,
  };

  return (
    <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
      <thead>
        <tr>
          {HEADERS.map((h) => (
            <th key={h} style={headerCellStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rIdx) => (
          <tr key={rIdx}>
            {row.map((num, cIdx) => {
              const isFree = rIdx === 2 && cIdx === 2;
              return (
                <td key={cIdx} style={cellStyle}>
                  {isFree ? "★" : String(num).padStart(2, "0")}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}