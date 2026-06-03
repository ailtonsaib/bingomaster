import { AnimatePresence, motion } from "framer-motion";
import BingoNumberBall from "./BingoNumberBall";

export default function LastNumberDisplay({ number, drawing }) {
  const BINGO_LETTERS = ["B", "I", "N", "G", "O"];
  const getLetter = (num) => {
    if (!num) return null;
    const idx = Math.ceil(num / 15) - 1;
    return BINGO_LETTERS[Math.min(idx, 4)];
  };

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <span className="text-xs font-semibold text-violet-300 uppercase tracking-widest">
        Último Número Sorteado
      </span>

      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Glow ring */}
        {number && !drawing && (
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/30 blur-2xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {drawing ? (
          <motion.div
            className="w-32 h-32 rounded-full bg-white/20 border-4 border-accent flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
          >
            <span className="text-4xl">🎱</span>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {number ? (
              <motion.div
                key={number}
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 14 }}
              >
                <BingoNumberBall number={number} size="xl" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-32 h-32 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center text-white/30 text-4xl"
              >
                ?
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {number && !drawing && (
        <motion.div
          key={`letter-${number}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-bold text-accent tracking-widest"
        >
          B I N G O — {getLetter(number)}
        </motion.div>
      )}
    </div>
  );
}