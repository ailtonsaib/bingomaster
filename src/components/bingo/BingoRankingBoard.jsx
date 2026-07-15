import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BingoRankingBoard() {
  const [ranking, setRanking] = useState([]);
  const [totalWinners, setTotalWinners] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await base44.functions.invoke("getBingoRanking", {});
        if (mounted && res.data) {
          setRanking(res.data.ranking || []);
          setTotalWinners(res.data.total_winners || 0);
        }
      } catch (e) {
        // silent fail — board is decorative
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getMedalColor = (idx) => {
    if (idx === 0) return "from-yellow-400 to-amber-500";
    if (idx === 1) return "from-gray-300 to-gray-400";
    if (idx === 2) return "from-orange-400 to-amber-600";
    return "from-purple-100 to-purple-200";
  };

  const getRankBadge = (idx) => {
    if (idx === 0) return { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-50" };
    if (idx === 1) return { icon: Medal, color: "text-gray-400", bg: "bg-gray-50" };
    if (idx === 2) return { icon: Medal, color: "text-orange-500", bg: "bg-orange-50" };
    return null;
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#6200EA] to-[#7C3AED] p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Placar Global de Vencedores</h3>
            <p className="text-white/80 text-sm">
              {loading ? "Carregando..." : `${totalWinners} ${totalWinners === 1 ? "vencedor" : "vencedores"} cadastrados`}
            </p>
          </div>
        </div>
      </div>

      {/* Ranking list */}
      <div className="p-4 max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-100" />
                <div className="flex-1">
                  <div className="h-4 w-32 rounded bg-gray-100 mb-2" />
                  <div className="h-3 w-20 rounded bg-gray-50" />
                </div>
                <div className="h-6 w-12 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#71717A]">Nenhum vencedor cadastrado ainda.</p>
            <p className="text-xs text-[#A1A1AA] mt-1">Os vencedores aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ranking.map((player, idx) => {
              const badge = getRankBadge(idx);
              return (
                <motion.div
                  key={player.name + idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    idx < 3 ? "bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-10 flex justify-center">
                    {badge ? (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${badge.bg}`}>
                        <badge.icon className={`w-5 h-5 ${badge.color}`} />
                      </div>
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-sm font-bold text-[#71717A]">
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1B1C21] truncate">{player.name}</p>
                    {(player.city || player.state) && (
                      <p className="text-xs text-[#A1A1AA] flex items-center gap-1 truncate">
                        {player.city && <MapPin className="w-3 h-3 flex-shrink-0" />}
                        {[player.city, player.state].filter(Boolean).join(" - ")}
                      </p>
                    )}
                  </div>

                  {/* Wins */}
                  <div className="flex-shrink-0 text-right">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${getMedalColor(idx)} ${
                      idx < 3 ? "text-white" : "text-purple-700"
                    }`}>
                      {player.wins} {player.wins === 1 ? "vitória" : "vitórias"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}