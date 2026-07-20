import { motion } from "framer-motion";
import { Trophy, CheckCircle2, Crown, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrizesPanel({ prizes, isPlaying, onAwardPrize, activePrizeIndex, winnersCount = 0 }) {
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
        {prizes.map((prize, idx) => {
          const isActive = idx === activePrizeIndex && !prize.awarded && isPlaying;
          return (
            <motion.div
              key={idx}
              layout
              className={`rounded-xl p-3 border transition-all ${
                prize.awarded
                  ? "bg-emerald-500/20 border-emerald-400/30"
                  : isActive
                    ? "bg-amber-400/10 border-amber-400/40 ring-1 ring-amber-400/30"
                    : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  prize.awarded
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-amber-400 text-amber-950 animate-pulse"
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
                    <div className="mt-1.5 space-y-0.5">
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Premiado
                      </span>
                      {prize.awarded_card_number != null && (
                        <p className="text-xs text-white/60">
                          Cartela #{String(prize.awarded_card_number).padStart(4, "0")}
                        </p>
                      )}
                      {prize.awarded_player_name && (
                        <p className="text-xs text-white/60 flex items-center gap-1">
                          <User className="w-3 h-3" /> {prize.awarded_player_name}
                        </p>
                      )}
                      {prize.pedra_maior != null && (
                        <p className="text-xs text-amber-400/80">
                          Pedra maior: {prize.pedra_maior}
                        </p>
                      )}
                    </div>
                  )}
                  {isActive && !prize.awarded && (
                    <span className="text-xs text-amber-400 font-medium">● Prêmio ativo</span>
                  )}
                </div>
              </div>

              {isPlaying && !prize.awarded && (
                <Button
                  size="sm"
                  disabled={!isActive || winnersCount === 0}
                  onClick={() => onAwardPrize(idx)}
                  className={
                    !isActive || winnersCount === 0
                      ? "w-full mt-2 h-7 text-xs bg-white/5 text-violet-400/50 font-bold cursor-not-allowed"
                      : "w-full mt-2 h-7 text-xs bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold"
                  }
                >
                  {!isActive
                    ? "Aguardando vez..."
                    : winnersCount === 0
                      ? "Aguardando bingo..."
                      : winnersCount === 1
                        ? "Marcar como Premiado"
                        : `Desempate — Pedra Maior (${winnersCount} cartelas)`}
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}