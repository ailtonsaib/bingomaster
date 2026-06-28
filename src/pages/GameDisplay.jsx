import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BingoNumberBall from "@/components/bingo/BingoNumberBall";
import { Trophy, CheckCircle2, ArrowLeft } from "lucide-react";
import { useBrandName } from "@/hooks/useBrandName";
import { getBrandLetters, getLetterForNumber, COLUMN_BG } from "@/lib/brandConfig";

export default function GameDisplay() {
  const { gameId } = useParams();
  const [prevLength, setPrevLength] = useState(0);
  const { brandName } = useBrandName();

  const { data: game } = useQuery({
    queryKey: ["display-game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (d) => d[0],
    refetchInterval: 2000,
  });

  const drawnNumbers = game?.drawn_numbers || [];
  const drawnSet = new Set(drawnNumbers);
  const lastNumber = drawnNumbers[drawnNumbers.length - 1];
  const maxNumber = game?.max_number || 75;
  const pct = Math.round((drawnNumbers.length / maxNumber) * 100);
  const prizes = game?.prizes || [];

  const isNew = drawnNumbers.length > prevLength;
  useEffect(() => {
    if (drawnNumbers.length !== prevLength) setPrevLength(drawnNumbers.length);
  }, [drawnNumbers.length]);

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-950 to-indigo-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-400/20 border-t-violet-400 rounded-full animate-spin" />
      </div>
    );
  }

  const letters = getBrandLetters(brandName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/20">
        <Link to={`/game/${gameId}`} className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Controle
        </Link>
        <h1 className="text-lg font-bold font-heading text-white truncate max-w-xs md:max-w-md">{game.name}</h1>
        <div className="flex items-center gap-2 text-sm text-violet-300">
          <span className={`w-2 h-2 rounded-full ${game.status === "in_progress" ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
          {game.status === "in_progress" ? "Ao Vivo" : game.status === "finished" ? "Encerrado" : "Aguardando"}
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_380px] gap-0">

        {/* LEFT: Main display */}
        <div className="flex flex-col items-center justify-start gap-6 p-6">

          {/* Last number - hero */}
          <div className="flex flex-col items-center gap-3 w-full">
            <span className="text-xs font-bold text-violet-300 uppercase tracking-[0.2em]">
              Último Número Sorteado
            </span>
            <div className="relative flex items-center justify-center h-52">
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
              <AnimatePresence mode="wait">
                {lastNumber ? (
                  <motion.div
                    key={lastNumber}
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0, rotate: 90 }}
                    transition={{ type: "spring", stiffness: 160, damping: 13 }}
                    className="relative"
                  >
                    <div className="w-44 h-44 rounded-full bg-gradient-to-br from-accent to-amber-600 shadow-2xl shadow-amber-500/40 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black font-heading text-amber-950">{lastNumber}</span>
                      <span className="text-sm font-bold text-amber-900/80 -mt-1">
                        {getLetterForNumber(lastNumber, brandName)}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-44 h-44 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center text-white/20 text-6xl font-heading"
                  >
                    ?
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-lg space-y-1.5">
            <div className="flex justify-between text-xs text-violet-300">
              <span>Progresso</span>
              <span className="font-bold">{drawnNumbers.length} / {maxNumber} • {pct}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-400 via-primary to-amber-400 rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Board by column */}
          <div className="w-full max-w-2xl">
            <div className="grid grid-cols-5 gap-2">
              {letters.map((letter, colIdx) => (
                <div key={colIdx} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className={`${COLUMN_BG[colIdx]} text-white text-center font-black text-xl py-2 font-heading`}>
                    {letter}
                  </div>
                  <div className="grid grid-cols-3 gap-px p-1.5">
                    {Array.from({ length: 15 }, (_, i) => colIdx * 15 + i + 1).map((num) => {
                      const drawn = drawnSet.has(num);
                      const isLast = num === lastNumber;
                      return (
                        <motion.div
                          key={num}
                          animate={isLast && isNew ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 0.4 }}
                          className={`text-center text-xs font-bold rounded py-1.5 transition-all duration-500 ${isLast ? "bg-accent text-amber-950 shadow-lg scale-105 ring-1 ring-amber-300" : drawn ? "bg-white text-violet-900" : "bg-white/5 text-white/25"}`}
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

          {/* Recent draws row */}
          {drawnNumbers.length > 0 && (
            <div className="w-full max-w-2xl">
              <div className="text-xs text-violet-300 mb-2 font-medium uppercase tracking-wider">Últimos sorteados</div>
              <div className="flex flex-wrap gap-1.5">
                {[...drawnNumbers].reverse().slice(0, 20).map((num, idx) => (
                  <motion.div
                    key={`${num}-${idx}`}
                    initial={idx === 0 ? { scale: 0 } : {}}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <BingoNumberBall number={num} size="sm" isDrawn minimal />
                  </motion.div>
                ))}
                {drawnNumbers.length > 20 && (
                  <span className="text-xs text-violet-400 self-center">+{drawnNumbers.length - 20} mais</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Prizes sidebar */}
        <div className="border-l border-white/10 bg-black/20 p-6 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-violet-200 uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Prêmios da Rodada
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
                    <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-black text-sm font-heading ${prize.awarded ? "bg-emerald-500 text-white" : "bg-amber-400/20 text-amber-300"}`}>
                      {prize.awarded ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm leading-tight ${prize.awarded ? "line-through text-white/40" : "text-white"}`}>
                        {prize.name}
                      </p>
                      {prize.description && (
                        <p className="text-xs text-violet-300/70 mt-0.5">{prize.description}</p>
                      )}
                      {prize.awarded && (
                        <motion.span
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="inline-block mt-1 text-xs text-emerald-400 font-semibold"
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

          {/* Summary */}
          <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
            {[
              { label: "Sorteados", value: drawnNumbers.length },
              { label: "Restantes", value: maxNumber - drawnNumbers.length },
              { label: "Cartelas", value: "—" },
              { label: "Prêmios", value: `${prizes.filter(p => p.awarded).length}/${prizes.length}` },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <div className="text-xl font-black font-heading text-accent">{s.value}</div>
                <div className="text-xs text-violet-300 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}