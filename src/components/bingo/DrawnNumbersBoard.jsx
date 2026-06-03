import { motion } from "framer-motion";
import BingoNumberBall from "./BingoNumberBall";

const COLUMNS = [
  { letter: "B", min: 1, max: 15, color: "text-violet-300 border-violet-500/40 bg-violet-900/30" },
  { letter: "I", min: 16, max: 30, color: "text-blue-300 border-blue-500/40 bg-blue-900/30" },
  { letter: "N", min: 31, max: 45, color: "text-emerald-300 border-emerald-500/40 bg-emerald-900/30" },
  { letter: "G", min: 46, max: 60, color: "text-amber-300 border-amber-500/40 bg-amber-900/30" },
  { letter: "O", min: 61, max: 75, color: "text-rose-300 border-rose-500/40 bg-rose-900/30" },
];

export default function DrawnNumbersBoard({ drawnNumbers = [], maxNumber = 75 }) {
  const drawnSet = new Set(drawnNumbers);

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

      {/* Column-based board */}
      <div className="grid grid-cols-5 gap-2">
        {COLUMNS.map((col) => (
          <div key={col.letter} className={`rounded-xl border p-2 ${col.color}`}>
            <div className="text-center font-bold text-lg mb-2 font-heading">{col.letter}</div>
            <div className="grid grid-cols-1 gap-1">
              {Array.from({ length: col.max - col.min + 1 }, (_, i) => col.min + i).map((num) => {
                const drawn = drawnSet.has(num);
                return (
                  <motion.div
                    key={num}
                    animate={drawn ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 0.3 }}
                    className={`
                      text-center text-xs font-semibold rounded-md py-1 transition-all duration-300
                      ${drawn
                        ? "bg-white text-violet-900 shadow-lg font-bold"
                        : "bg-white/5 text-white/40"
                      }
                    `}
                  >
                    {num}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Last drawn list */}
      {drawnNumbers.length > 0 && (
        <div>
          <div className="text-xs text-violet-300 mb-2 font-medium">Ordem de sorteio:</div>
          <div className="flex flex-wrap gap-1.5">
            {[...drawnNumbers].reverse().map((num, idx) => (
              <motion.div
                key={`${num}-${idx}`}
                initial={idx === 0 ? { scale: 0 } : {}}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <BingoNumberBall number={num} size="sm" isDrawn minimal />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}