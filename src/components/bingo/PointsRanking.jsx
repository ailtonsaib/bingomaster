import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trophy, Hash } from "lucide-react";

export default function PointsRanking({ cards, drawnNumbers, variant = "default" }) {
  const { stats, winners } = useMemo(() => {
    const drawnSet = new Set(drawnNumbers);
    const s = { 17: 0, 18: 0, 19: 0, 20: 0 };
    const w = [];

    cards.forEach((card) => {
      const allNumbers = new Set([
        ...(card.grid_1 || []),
        ...(card.grid_2 || []),
        ...(card.grid_1a || []),
        ...(card.grid_1b || []),
        ...(card.grid_1c || []),
        ...(card.grid_2a || []),
        ...(card.grid_2b || []),
        ...(card.grid_2c || []),
      ].filter((n) => n !== 0));

      const points = Array.from(allNumbers).filter((n) => drawnSet.has(n)).length;

      if (points >= 17 && points <= 20) s[points]++;

      if (points === 20) {
        w.push({
          id: card.id,
          cardNumber: card.card_number,
          playerName: card.player_name,
          playerPhone: card.player_phone,
        });
      }
    });

    return { stats: s, winners: w };
  }, [cards, drawnNumbers]);

  const formatPhone = (phone) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    if (clean.length >= 4) return "****" + clean.slice(-4);
    return phone;
  };

  const hasWinners = winners.length > 0;

  // Telão variant: bigger, more dramatic
  const isTelao = variant === "telao";

  return (
    <div className="space-y-3">
      {/* Winner banner — shown when 20 pts reached */}
      <AnimatePresence>
        {hasWinners && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-2xl border-2 border-green-400/60 bg-green-500/20 backdrop-blur p-4 ${
              isTelao ? "p-6" : ""
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
              >
                <Trophy className={isTelao ? "w-10 h-10 text-green-400" : "w-7 h-7 text-green-400"} />
              </motion.div>
              <h3 className={`font-bold font-heading text-green-300 ${isTelao ? "text-3xl" : "text-xl"}`}>
                🎉 BINGO! Cartela(s) Vencedora(s)!
              </h3>
            </div>
            <div className={`grid gap-2 ${winners.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {winners.map((w) => (
                <div
                  key={w.id}
                  className="bg-green-500/30 rounded-xl p-3 border border-green-400/40"
                >
                  <div className="flex items-center gap-2">
                    <Hash className={isTelao ? "w-6 h-6 text-green-300" : "w-4 h-4 text-green-300"} />
                    <span className={`font-bold font-heading text-white ${isTelao ? "text-2xl" : "text-lg"}`}>
                      {String(w.cardNumber || "").padStart(4, "0")}
                    </span>
                  </div>
                  {w.playerName && (
                    <p className={`text-white/90 mt-1 ${isTelao ? "text-xl" : "text-sm"} font-medium`}>
                      {w.playerName}
                    </p>
                  )}
                  {formatPhone(w.playerPhone) && (
                    <p className={`text-white/60 ${isTelao ? "text-lg" : "text-xs"}`}>
                      📞 {formatPhone(w.playerPhone)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ranking 17-20 */}
      <div className={`grid grid-cols-4 gap-2 ${isTelao ? "gap-3" : ""}`}>
        {/* 17 pts */}
        <RankCard points={17} count={stats[17]} color="blue" isTelao={isTelao} />
        {/* 18 pts */}
        <RankCard points={18} count={stats[18]} color="violet" isTelao={isTelao} />
        {/* 19 pts */}
        <RankCard points={19} count={stats[19]} color="amber" isTelao={isTelao} />
        {/* 20 pts */}
        <RankCard points={20} count={stats[20]} color="green" isTelao={isTelao} />
      </div>

      {/* Messages */}
      <div className="space-y-2">
        {(stats[17] > 0 || stats[18] > 0) && !hasWinners && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center font-bold text-amber-300 ${isTelao ? "text-2xl" : "text-base"}`}
          >
            {stats[17] > 0 && `${stats[17]} cartela(s) com 17 pontos · `}
            {stats[18] > 0 && `${stats[18]} cartela(s) com 18 pontos · `}
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-amber-200"
            >
              Está chegandoooo! 🔥
            </motion.span>
          </motion.div>
        )}
        {stats[19] > 0 && !hasWinners && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center font-bold text-red-300 ${isTelao ? "text-3xl" : "text-lg"} flex items-center justify-center gap-2`}
          >
            <span>{stats[19]} cartela(s) com 19 pontos!</span>
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-flex"
            >
              <Heart className={`${isTelao ? "w-8 h-8" : "w-5 h-5"} text-red-500 fill-red-500`} />
            </motion.span>
            <span className="text-red-200">Aguenta Coração, está chegando!</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function RankCard({ points, count, color, isTelao }) {
  const colorMap = {
    blue: { bg: "bg-blue-500/20", border: "border-blue-400/40", text: "text-blue-300", glow: "shadow-blue-500/30" },
    violet: { bg: "bg-violet-500/20", border: "border-violet-400/40", text: "text-violet-300", glow: "shadow-violet-500/30" },
    amber: { bg: "bg-amber-500/20", border: "border-amber-400/40", text: "text-amber-300", glow: "shadow-amber-500/30" },
    green: { bg: "bg-green-500/20", border: "border-green-400/40", text: "text-green-300", glow: "shadow-green-500/30" },
  };
  const c = colorMap[color];
  const hasCount = count > 0;

  return (
    <motion.div
      animate={hasCount ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}
      className={`rounded-xl border p-2 text-center ${c.bg} ${c.border} ${
        hasCount ? `shadow-lg ${c.glow}` : "opacity-50"
      } ${isTelao ? "p-4" : ""}`}
    >
      <div className={`font-bold font-heading ${c.text} ${isTelao ? "text-4xl" : "text-2xl"}`}>
        {count}
      </div>
      <div className={`text-violet-300 ${isTelao ? "text-lg" : "text-xs"}`}>{points} pts</div>
    </motion.div>
  );
}