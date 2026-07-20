import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function BingoGlobe({ spinning, result, availableCount, maxNumber }) {
  const [displayNumber, setDisplayNumber] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (spinning) {
      // Cicla números rapidamente durante o giro (3 segundos)
      setDisplayNumber(null);
      intervalRef.current = setInterval(() => {
        setDisplayNumber(Math.floor(Math.random() * maxNumber) + 1);
      }, 80);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayNumber(result);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spinning, result, maxNumber]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48 md:w-56 md:h-56">
        {/* Globo */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-amber-400/30 bg-gradient-to-br from-violet-800/60 to-indigo-900/60 overflow-hidden"
          animate={spinning ? { rotate: 720 } : { rotate: 0 }}
          transition={{ duration: spinning ? 3 : 0.5, ease: spinning ? "easeOut" : "easeInOut" }}
        >
          {/* Pedras dentro do globo */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 55;
            const x = 50 + Math.cos(angle) * radius;
            const y = 50 + Math.sin(angle) * radius;
            return (
              <div
                key={i}
                className="absolute w-5 h-5 rounded-full bg-amber-400/40 flex items-center justify-center text-[8px] font-bold text-amber-200"
                style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
              >
                {((i * 7) % maxNumber) + 1}
              </div>
            );
          })}
        </motion.div>

        {/* Número central exibido */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {displayNumber !== null ? (
              <motion.div
                key={spinning ? `spin-${displayNumber}` : `result-${displayNumber}`}
                initial={spinning ? { opacity: 0.6, scale: 0.8 } : { scale: 0, rotate: -180, opacity: 0 }}
                animate={spinning ? { opacity: 1, scale: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={spinning ? { duration: 0.08 } : { type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-2xl shadow-amber-500/50 flex items-center justify-center"
              >
                <span className="text-3xl md:text-4xl font-black font-heading text-amber-950">
                  {displayNumber}
                </span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-violet-300 text-center"
              >
                <div className="text-5xl mb-1">🎱</div>
                <div className="text-xs font-semibold">{availableCount} pedras</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Anel pulsante durante o giro */}
        {spinning && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-400/50"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      {/* Status */}
      <div className="text-center">
        {spinning ? (
          <p className="text-sm font-bold text-amber-400 animate-pulse">🎲 Girando o globo...</p>
        ) : result !== null && result !== undefined ? (
          <p className="text-sm font-bold text-emerald-400">✓ Pedra sorteada: {result}</p>
        ) : (
          <p className="text-sm text-violet-400">Pronto para girar</p>
        )}
      </div>
    </div>
  );
}