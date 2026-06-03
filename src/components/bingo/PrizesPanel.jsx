import { motion } from "framer-motion";
import { Trophy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrizesPanel({ prizes, isPlaying, onAwardPrize }) {
  if (!prizes || prizes.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4">
        <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Prêmios
        </h3>
        <p className="text-sm text-violet-300/60 italic">Nenhum prêmio definido.</p>
      </div>
    );
  }

  const awarded = prizes.filter(p => p.awarded).length;

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Prêmios
        </h3>
        <span className="text-xs bg-white/10 text-violet-200 px-2 py-0.5 rounded-full">
          {awarded}/{prizes.length} entregues
        </span>
      </div>

      <div className="space-y-2">
        {prizes.map((prize, idx) => (
          <motion.div
            key={idx}
            layout
            className={`rounded-xl p-3 border transition-all ${
              prize.awarded
                ? "bg-emerald-500/20 border-emerald-400/30"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                prize.awarded
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-400/20 text-amber-300"
              }`}>
                {prize.awarded ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${prize.awarded ? "line-through text-white/40" : "text-white"}`}>
                  {prize.name}
                </p>
                {prize.description && (
                  <p className="text-xs text-violet-300/70 mt-0.5 truncate">{prize.description}</p>
                )}
                {prize.awarded && (
                  <span className="text-xs text-emerald-400 font-medium">✓ Premiado</span>
                )}
              </div>
            </div>

            {isPlaying && !prize.awarded && (
              <Button
                size="sm"
                className="w-full mt-2 h-7 text-xs bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold"
                onClick={() => onAwardPrize(idx)}
              >
                🏆 Marcar como Premiado
              </Button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}