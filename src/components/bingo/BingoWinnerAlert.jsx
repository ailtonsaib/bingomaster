import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { useEffect } from "react";

export default function BingoWinnerAlert({ winners, onClose, onConfirm }) {
  useEffect(() => {
    if (winners && winners.length > 0) {
      confetti({
        particleCount: 180,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#a855f7", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"],
      });
    }
  }, [winners]);

  if (!winners || winners.length === 0) return null;

  const prize = winners[0];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-violet-900 to-indigo-900 border border-amber-400/40 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative"
          initial={{ scale: 0.5, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-6xl mb-4"
          >
            🎉
          </motion.div>

          <h2 className="text-3xl font-black font-heading text-white mb-1">BINGO!</h2>
          <p className="text-violet-300 text-sm mb-4">
            {winners.length === 1
              ? `${winners[0].card.player_name || `Cartela ${winners[0].card.card_identifier}`} ganhou!`
              : `${winners.length} cartelas completaram o bingo!`
            }
          </p>

          <div className="bg-amber-400/20 border border-amber-400/40 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="text-xs text-amber-300 font-semibold uppercase tracking-wider">Prêmio Conquistado</span>
            </div>
            <p className="text-xl font-bold text-white">{prize.prizeName}</p>
          </div>

          {winners.length > 1 && (
            <div className="mb-4 space-y-1">
              {winners.map((w, i) => (
                <div key={i} className="text-sm text-violet-200 bg-white/5 rounded-lg px-3 py-1.5">
                  {w.card.player_name || `Cartela ${w.card.card_identifier || w.card.card_number}`}
                  {w.card.chances === 2 ? " (dupla chance)" : ""}
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-base h-12"
            onClick={onConfirm}
          >
            🏆 Confirmar e Marcar Prêmio
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}