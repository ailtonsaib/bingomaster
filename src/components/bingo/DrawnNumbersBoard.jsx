import { memo, useMemo } from "react";
import { useBrandName } from "@/hooks/useBrandName";
import { getBrandLetters, COLUMN_SOFT, getLetterForNumber, getColumnIndex, COLUMN_GRADIENT } from "@/lib/brandConfig";
import { cn } from "@/lib/utils";

function DrawnNumbersBoard({ drawnNumbers = [], maxNumber = 75 }) {
  const { brandName } = useBrandName();
  const letters = getBrandLetters(brandName);
  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);

  const COLUMNS = letters.map((letter, i) => ({
    letter,
    min: i * 15 + 1,
    max: i * 15 + 15,
    color: COLUMN_SOFT[i],
  }));

  // Histórico reverso memoizado — não recria array a cada render
  const reversedDrawn = useMemo(() => [...drawnNumbers].reverse(), [drawnNumbers]);

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider">
          🎱 Painel de Números
        </h3>
        <span className="text-xs bg-white/10 text-violet-200 px-3 py-1 rounded-full font-medium">
          {drawnNumbers.length} / {maxNumber} sorteados
        </span>
      </div>

      {/* Column-based board — plain divs with CSS transitions (no framer-motion) */}
      <div className="grid grid-cols-5 gap-2">
        {COLUMNS.map((col) => (
          <div key={col.letter} className={`rounded-xl border p-2 ${col.color}`}>
            <div className="text-center font-bold text-lg mb-2 font-heading">{col.letter}</div>
            <div className="grid grid-cols-1 gap-1">
              {Array.from({ length: col.max - col.min + 1 }, (_, i) => col.min + i).map((num) => {
                const drawn = drawnSet.has(num);
                return (
                  <div
                    key={num}
                    className={cn(
                      "text-center text-xs font-semibold rounded-md py-1 transition-all duration-300",
                      drawn
                        ? "bg-white text-violet-900 shadow-lg font-bold scale-110"
                        : "bg-white/5 text-white/40 scale-100"
                    )}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Last drawn list — plain divs (no framer-motion, no BingoNumberBall) */}
      {reversedDrawn.length > 0 && (
        <div>
          <div className="text-xs text-violet-300 mb-2 font-medium">Ordem de sorteio:</div>
          <div className="flex flex-wrap gap-1.5">
            {reversedDrawn.map((num, idx) => {
              const letter = getLetterForNumber(num, brandName);
              const gradient = COLUMN_GRADIENT[getColumnIndex(num)] || "from-gray-500 to-gray-600";
              return (
                <div
                  key={num}
                  className={cn(
                    "rounded-full flex items-center justify-center font-bold font-heading w-8 h-8 text-xs transition-all duration-200",
                    idx === 0
                      ? `bg-gradient-to-br ${gradient} text-white shadow-lg scale-125 ring-2 ring-white/50`
                      : `bg-gradient-to-br ${gradient} text-white shadow`
                  )}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DrawnNumbersBoard);