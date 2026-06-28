import { getBrandLetters } from "@/lib/brandConfig";

export default function PrintBingoGrid({ numbers, brandName = "BINGO", size = 32 }) {
  if (!numbers || numbers.length === 0) return null;

  const HEADERS = getBrandLetters(brandName);

  const totalRows = Math.ceil(numbers.length / 5);
  const rows = [];
  for (let r = 0; r < totalRows; r++) {
    rows.push(numbers.slice(r * 5, r * 5 + 5));
  }

  const fontSize = size <= 22 ? 9 : size <= 26 ? 10 : 12;
  const headerFontSize = size <= 22 ? 10 : size <= 26 ? 12 : 14;

  const circleStyle = {
    width: size,
    height: size,
    border: "2px solid #000",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: fontSize,
    fontWeight: "bold",
    fontFamily: "Arial, sans-serif",
    background: "#fff",
    margin: 1,
    boxSizing: "border-box",
    flexShrink: 0,
  };

  const headerCircleStyle = {
    ...circleStyle,
    fontSize: headerFontSize,
    fontWeight: "900",
  };

  const freeStyle = {
    ...circleStyle,
    background: "#f8a0a0",
    borderColor: "#c00",
    color: "#c00",
  };

  let flatIndex = 0;

  return (
    <div style={{ display: "inline-block" }}>
      {/* Header row */}
      <div style={{ display: "flex", marginBottom: 0 }}>
        {HEADERS.map((h, i) => (
          <div key={i} style={headerCircleStyle}>{h}</div>
        ))}
      </div>
      {/* Number rows */}
      {rows.map((row, rIdx) => (
        <div key={rIdx} style={{ display: "flex" }}>
          {row.map((num, cIdx) => {
            const isFree = num === 0;
            flatIndex++;
            return (
              <div key={cIdx} style={isFree ? freeStyle : circleStyle}>
                {isFree ? "00" : String(num).padStart(2, "0")}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}