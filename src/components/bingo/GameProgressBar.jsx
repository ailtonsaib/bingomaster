import { motion } from "framer-motion";

export default function GameProgressBar({ drawn, total }) {
  const pct = total > 0 ? Math.round((drawn / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-violet-300">
        <span>Progresso da partida</span>
        <span className="font-semibold">{pct}% — {drawn} de {total} números</span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-400 to-amber-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}