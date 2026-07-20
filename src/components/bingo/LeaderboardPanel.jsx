import { useMemo } from "react";
import { Flame, TrendingUp, Hash, Crown } from "lucide-react";
import { getCardMaxPoints } from "@/lib/bingoUtils";

export default function LeaderboardPanel({ cards, drawnNumbers, maxItems = 8 }) {
  const ranking = useMemo(() => {
    const dn = drawnNumbers || [];
    if (!Array.isArray(dn) || dn.length === 0) return [];

    const drawnSet = new Set(dn);
    // Painel de líderes mostra apenas cartelas validadas (habilitadas para concorrer)
    const filtered = (cards || []).filter((c) => c.is_validated);

    return filtered
      .map((c) => ({
        id: c.id,
        card_number: c.card_number,
        player_name: c.player_name,
        player_phone: c.player_phone,
        points: getCardMaxPoints(c, drawnSet),
        is_winner: c.is_winner,
      }))
      .filter((c) => c.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, maxItems);
  }, [cards, drawnNumbers, maxItems]);

  if (ranking.length === 0) {
    return null;
  }

  const maxPts = ranking[0]?.points || 0;

  const formatPhone = (phone) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    if (clean.length >= 4) return "****" + clean.slice(-4);
    return phone;
  };

  const getRankStyle = (pts) => {
    if (pts >= 20) return { bg: "bg-green-500/25", border: "border-green-400/50", bar: "bg-green-400", text: "text-green-300", glow: "shadow-green-500/20" };
    if (pts === 19) return { bg: "bg-red-500/25", border: "border-red-400/50", bar: "bg-red-400", text: "text-red-300", glow: "shadow-red-500/20" };
    if (pts === 18) return { bg: "bg-amber-500/20", border: "border-amber-400/40", bar: "bg-amber-400", text: "text-amber-300", glow: "shadow-amber-500/20" };
    if (pts === 17) return { bg: "bg-orange-500/15", border: "border-orange-400/30", bar: "bg-orange-400", text: "text-orange-300", glow: "shadow-orange-500/10" };
    return { bg: "bg-white/5", border: "border-white/10", bar: "bg-violet-400", text: "text-violet-300", glow: "" };
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/10 p-4 space-y-3">
      <h3 className="font-semibold text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2">
        <TrendingUp className="w-4 h-4" /> Líderes em Tempo Real
      </h3>

      <div className="space-y-2">
        {ranking.map((card, idx) => {
          const style = getRankStyle(card.points);
          const pct = maxPts > 0 ? (card.points / 20) * 100 : 0;
          const isTop = idx === 0;
          const isHot = card.points >= 17 && card.points < 20;

          return (
            <div
              key={card.id}
              className={`relative rounded-xl border p-2.5 ${style.bg} ${style.border} ${
                isHot ? `shadow-lg ${style.glow}` : ""
              }`}
            >
              {/* Progress bar background */}
              <div className="absolute inset-0 rounded-xl overflow-hidden opacity-20">
                <div
                  className={`h-full ${style.bar}`}
                  style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
                />
              </div>

              <div className="relative flex items-center gap-2">
                {/* Rank number */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  isTop ? "bg-amber-400 text-amber-900" : "bg-white/10 text-violet-300"
                }`}>
                  {isTop ? <Crown className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-violet-300 flex-shrink-0" />
                    <span className="font-bold text-white text-sm truncate">
                      {String(card.card_number || "").padStart(4, "0")}
                    </span>
                    {card.player_name && (
                      <span className="text-violet-200 text-xs truncate">
                        · {card.player_name}
                      </span>
                    )}
                  </div>
                  {formatPhone(card.player_phone) && (
                    <p className="text-violet-400 text-[10px] mt-0.5">📞 {formatPhone(card.player_phone)}</p>
                  )}
                </div>

                {/* Points badge */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {isHot && (
                    <Flame className={`w-4 h-4 ${style.text}`} />
                  )}
                  <span className={`font-bold font-heading text-lg ${style.text}`}>
                    {card.points}
                    <span className="text-xs text-violet-400">/20</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {ranking[0]?.points < 17 && (
        <p className="text-center text-xs text-violet-400 pt-1">
          Aguardando cartelas se aproximarem do bingo...
        </p>
      )}
    </div>
  );
}