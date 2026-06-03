// Simple Code 128-style barcode using SVG bars derived from the string
export default function SimpleBarcode({ value, height = 30 }) {
  // Generate a deterministic bar pattern from the value string
  const bars = [];
  let x = 0;
  const barWidth = 1.5;
  const gap = 0.8;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Generate 5 bars per character with varying widths based on char code
    for (let b = 0; b < 5; b++) {
      const wide = ((code >> b) & 1) === 1;
      const w = wide ? barWidth * 2 : barWidth;
      bars.push({ x, w, filled: b % 2 === 0 });
      x += w + gap;
    }
    x += gap; // extra space between chars
  }

  const totalWidth = x + 4;

  return (
    <svg width={totalWidth} height={height} xmlns="http://www.w3.org/2000/svg">
      {bars.map((bar, i) =>
        bar.filled ? (
          <rect key={i} x={bar.x} y={0} width={bar.w} height={height} fill="#000" />
        ) : null
      )}
    </svg>
  );
}