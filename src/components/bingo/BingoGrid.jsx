import { cn } from "@/lib/utils";
import { useBrandName } from "@/hooks/useBrandName";
import { getBrandLetters, COLUMN_BG } from "@/lib/brandConfig";

export default function BingoGrid({ numbers, drawnNumbers = [], label, compact = false }) {
  const { brandName } = useBrandName();
  const headers = getBrandLetters(brandName);
  const drawn = new Set(drawnNumbers);
  const cellSize = compact ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  const headerSize = compact ? "w-9 h-8 text-xs" : "w-11 h-9 text-sm";

  return (
    <div className="inline-block">
      {label && (
        <div className="text-center text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
          {label}
        </div>
      )}
      <div className="bg-card rounded-xl border-2 border-primary/20 overflow-hidden shadow-md">
        {/* Header */}
        <div className="grid grid-cols-5 gap-px bg-primary/10">
          {headers.map((h, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center font-bold text-white font-heading",
                headerSize,
                COLUMN_BG[i]
              )}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Grid — 4 rows x 5 cols = 20 cells */}
        <div className="grid grid-cols-5 gap-px bg-border/50 p-px">
          {numbers.map((num, idx) => {
            const isMarked = drawn.has(num);
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-center font-semibold font-heading transition-all duration-300",
                  cellSize,
                  isMarked
                    ? "bg-primary text-primary-foreground scale-105"
                    : "bg-card text-card-foreground hover:bg-muted"
                )}
              >
                {num}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}