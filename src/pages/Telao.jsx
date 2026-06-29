import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, CheckCircle2 } from "lucide-react";
import { useBrandName } from "@/hooks/useBrandName";
import { getBrandLetters, getLetterForNumber, COLUMN_BG } from "@/lib/brandConfig";
import PointsRanking from "@/components/bingo/PointsRanking";

export default function Telao() {
  const { gameId } = useParams();
  const [prevLength, setPrevLength] = useState(0);
  const { brandName } = useBrandName();

  const { data: gameData } = useQuery({
    queryKey: ["telao-game", gameId],
    queryFn: () => base44.functions.invoke("getGamePublic", { game_id: String(gameId) }).then(r => r.data),
    refetchInterval: 1500,
  });
  const game = gameData?.game;
  const allCards = gameData?.cards || [];
  // Ranking no telão usa apenas cartelas validadas (que estão concorrendo)
  const cards = allCards.filter(c => c.is_validated);

  const drawnNumbers = game?.drawn_numbers || [];
  const drawnSet = new Set(drawnNumbers);
  const lastNumber = drawnNumbers[drawnNumbers.length - 1];
  const maxNumber = game?.max_number || 75;
  const pct = Math.round((drawnNumbers.length / maxNumber) * 100);
  const prizes = game?.prizes || [];
  const awardedCount = prizes.filter((p) => p.awarded).length;

  const isNew = drawnNumbers.length > prevLength;
  useEffect(() => {
    if (drawnNumbers.length !== prevLength) setPrevLength(drawnNumbers.length);
  }, [drawnNumbers.length]);

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-950 to-indigo-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-400/20 border-t-violet-400 rounded-full animate-spin" />
      </div>
    );
  }

  const letters = getBrandLetters(brandName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950 text-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/30">
        <h1 className="text-2xl md:text-3xl font-bold font-heading text-white truncate max-w-[40vw]">
          {game.name}
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-base text-violet-200">
            <span className={`w-3 h-3 rounded-full ${game.status === "in_progress" ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
            <span className="font-semibold">
              {game.status === "in_progress" ? "AO VIVO" : game.status === "finished" ? "ENCERRADO" : "AGUARDANDO"}
            </span>
          </div>
          <div className="text-base text-violet-200 font-semibold">
            {drawnNumbers.length} / {maxNumber}
          </div>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_360px] gap-0 min-h-0">
        <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-0">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-violet-300 uppercase tracking-[0.3em]">
              Último Número Sorteado
            </span>
            <div className="relative flex items-center justify-center h-56 md:h-64">
              {lastNumber && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-accent/40"
                    animate={{ scale: [1, 1.6, 1.6], opacity: [0.6, 0, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-accent/20"
                    animate={{ scale: [1, 2, 2], opacity: [0.4, 0, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.5, delay: 0.3 }}
                  />
                </>
              )}
              <AnimatePresence mode="popLayout">
                {lastNumber ? (
                  <motion.div
                    key={lastNumber}
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0, rotate: 90 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="relative"
                  >
                    <div className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-gradient-to-br from-accent to-amber-600 shadow-2xl shadow-amber-500/40 flex flex-col items-center justify-center">
                      <span className="text-6xl md:text-7xl font-black font-heading text-amber-950">
                        {lastNumber}
                      </span>
                      <span className="text-lg font-bold text-amber-900/80 -mt-1">
                        {getLetterForNumber(lastNumber, brandName)}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-48 h-48 md:w-56 md:h-56 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center text-white/20 text-7xl font-heading"
                  >
                    ?
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="w-full max-w-xl space-y-1">
            <div className="flex justify-between text-xs text-violet-300">
              <span>Progresso do Sorteio</span>
              <span className="font-bold">{pct}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-400 via-primary to-amber-400 rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="w-full max-w-3xl">
            <div className="grid grid-cols-5 gap-2">
              {letters.map((letter, colIdx) => (
                <div key={colIdx} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className={`${COLUMN_BG[colIdx]} text-white text-center font-black text-2xl py-2 font-heading`}>
                    {letter}
                  </div>
                  <div className="grid grid-cols-3 gap-px p-1.5">
                    {Array.from({ length: 15 }, (_, i) => colIdx * 15 + i + 1).map((num) => {
                      const drawn = drawnSet.has(num);
                      const isLast = num === lastNumber;
                      const cellClass = isLast
                        ? "bg-accent text-amber-950 shadow-lg scale-105 ring-1 ring-amber-300"
                        : drawn
                          ? "bg-white text-violet-900"
                          : "bg-white/5 text-white/25";
                      return (
                        <motion.div
                          key={num}
                          animate={isLast && isNew ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 0.4 }}
                          className={`text-center text-sm font-bold rounded py-1.5 transition-all duration-500 ${cellClass}`}
                        >
                          {num}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-l border-white/10 bg-black/30 p-6 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* Ranking 17-20 pontos */}
          <div>
            <h2 className="text-sm font-bold text-violet-200 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-400" /> Ranking de Pontos
            </h2>
            <PointsRanking cards={cards} drawnNumbers={drawnNumbers} variant="telao" />
          </div>

          <div className="border-t border-white/10 pt-4">
            <h2 className="text-lg font-bold text-violet-200 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-400" /> Prêmios
            </h2>

            <div className="space-y-3 flex-1">
              {prizes.length === 0 ? (
                <p className="text-sm text-violet-400 italic">Nenhum prêmio definido.</p>
              ) : (
                prizes.map((prize, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    className={`rounded-xl p-4 border transition-all ${prize.awarded ? "bg-emerald-500/20 border-emerald-400/40" : "bg-white/5 border-white/10"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-black text-base font-heading ${prize.awarded ? "bg-emerald-500 text-white" : "bg-amber-400/20 text-amber-300"}`}>
                        {prize.awarded ? <CheckCircle2 className="w-6 h-6" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-base leading-tight ${prize.awarded ? "line-through text-white/40" : "text-white"}`}>
                          {prize.name}
                        </p>
                        {prize.description && (
                          <p className="text-sm text-violet-300/70 mt-0.5">{prize.description}</p>
                        )}
                        {prize.awarded && (
                          <motion.span
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-block mt-1 text-sm text-emerald-400 font-semibold"
                          >
                            ✓ Prêmio entregue!
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black font-heading text-accent">{drawnNumbers.length}</div>
              <div className="text-xs text-violet-300 mt-0.5">Sorteados</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black font-heading text-accent">{maxNumber - drawnNumbers.length}</div>
              <div className="text-xs text-violet-300 mt-0.5">Restantes</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black font-heading text-emerald-400">{awardedCount}</div>
              <div className="text-xs text-violet-300 mt-0.5">Prêmios Entregues</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black font-heading text-amber-400">{prizes.length - awardedCount}</div>
              <div className="text-xs text-violet-300 mt-0.5">Prêmios Restantes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}