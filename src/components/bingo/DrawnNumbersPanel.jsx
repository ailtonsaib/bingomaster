import BingoNumberBall from "./BingoNumberBall";
import { motion, AnimatePresence } from "framer-motion";

export default function DrawnNumbersPanel({ drawnNumbers = [] }) {
  const lastNumber = drawnNumbers[drawnNumbers.length - 1];

  return (
    <div className="space-y-4">
      {/* Last drawn */}
      {lastNumber && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Último Sorteado
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={lastNumber}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <BingoNumberBall number={lastNumber} size="xl" />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* All drawn numbers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Números Sorteados
          </span>
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {drawnNumbers.length} / 75
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {drawnNumbers.map((num, idx) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx === drawnNumbers.length - 1 ? 0.3 : 0 }}
            >
              <BingoNumberBall number={num} size="sm" isDrawn minimal />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Number board - all 75 numbers */}
      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Painel Completo
        </span>
        <div className="grid grid-cols-15 gap-0.5">
          {Array.from({ length: 75 }, (_, i) => i + 1).map((num) => (
            <BingoNumberBall
              key={num}
              number={num}
              size="sm"
              isDrawn={drawnNumbers.includes(num)}
              minimal
            />
          ))}
        </div>
      </div>
    </div>
  );
}