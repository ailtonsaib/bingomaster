import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, RotateCcw, Trophy, Check, X, Gift, Dices } from "lucide-react";
import { motion } from "framer-motion";

const SPIN_DURATION = 10; // segundos
const TICK_MS = 70;

export default function LuckySpinModal({ cards, gameName, onClose, onConfirm }) {
  const [phase, setPhase] = useState("idle"); // idle | spinning | result | confirm
  const [currentCard, setCurrentCard] = useState(null);
  const [winner, setWinner] = useState(null);
  const [prizeDesc, setPrizeDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(SPIN_DURATION);
  const spinRef = useRef(null);
  const countRef = useRef(null);

  const hasGiroDaSorte = (card) =>
    (card.won_prizes || []).some((p) => p.prize_name === "Giro da Sorte");

  const eligibleCards = cards.filter((c) => c.is_validated && !hasGiroDaSorte(c));

  const startSpin = () => {
    if (eligibleCards.length === 0) return;
    setPhase("spinning");
    setWinner(null);
    setPrizeDesc("");
    setCountdown(SPIN_DURATION);

    // Cicla rapidamente entre cartelas aleatórias
    spinRef.current = setInterval(() => {
      const random = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
      setCurrentCard(random);
    }, TICK_MS);

    // Countdown de 10 segundos
    let secs = SPIN_DURATION;
    countRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(spinRef.current);
        clearInterval(countRef.current);
        spinRef.current = null;
        countRef.current = null;
        // Seleção final aleatória
        const finalWinner = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
        setWinner(finalWinner);
        setCurrentCard(finalWinner);
        setPhase("result");
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (spinRef.current) clearInterval(spinRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  const handleSpinAgain = () => {
    setPhase("idle");
    setWinner(null);
    setCurrentCard(null);
    setTimeout(startSpin, 200);
  };

  const handleConfirm = async () => {
    if (!prizeDesc.trim() || !winner) return;
    setSaving(true);
    await onConfirm(winner, prizeDesc.trim());
    setSaving(false);
    onClose();
  };

  const displayNumber = currentCard?.card_number;
  const displayName =
    currentCard?.player_name && !currentCard.player_name.startsWith("Cartela ")
      ? currentCard.player_name
      : "";

  return (
    <div className="fixed inset-0 z-[70] bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Botão fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white z-10"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Título */}
      <div className="text-center mb-6 md:mb-10">
        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-6xl font-bold font-heading text-white flex items-center gap-3 justify-center"
        >
          <Dices className="w-8 h-8 md:w-14 md:h-14 text-amber-400" />
          GIRO DA SORTE
        </motion.h1>
        <p className="text-violet-300 text-sm md:text-lg mt-2">{gameName}</p>
      </div>

      {/* Estado inicial */}
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-6">
          {eligibleCards.length === 0 ? (
            <div className="text-center">
              <p className="text-white/80 text-lg">Nenhuma cartela elegível.</p>
              <p className="text-violet-400 text-sm mt-2">
                Todas as cartelas validadas já ganharam o Giro da Sorte.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-violet-300 text-lg mb-1">
                  {eligibleCards.length} cartela{eligibleCards.length !== 1 ? "s" : ""} validada{eligibleCards.length !== 1 ? "s" : ""}
                </p>
                <p className="text-violet-400 text-sm">participando do sorteio</p>
              </div>
              <Button
                size="lg"
                className="gap-3 px-12 py-8 text-2xl font-bold bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-full shadow-2xl shadow-amber-500/30"
                onClick={startSpin}
              >
                <Sparkles className="w-8 h-8" />
                GIRAR
              </Button>
            </>
          )}
        </div>
      )}

      {/* Girando */}
      {phase === "spinning" && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-amber-400 text-3xl font-bold font-heading">
            {countdown}s
          </div>
          <motion.div
            key={displayNumber}
            initial={{ scale: 0.85, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.06 }}
            className="bg-white rounded-3xl shadow-2xl px-8 md:px-16 py-6 md:py-10 min-w-[260px] md:min-w-[340px] text-center"
          >
            <div className="text-6xl md:text-9xl font-bold font-heading text-purple-900 tabular-nums">
              {String(displayNumber || "").padStart(4, "0")}
            </div>
            {displayName && (
              <div className="text-base md:text-xl text-gray-500 mt-2 truncate max-w-[280px] mx-auto">
                {displayName}
              </div>
            )}
          </motion.div>
          <p className="text-violet-300 text-sm animate-pulse">Sorteando...</p>
        </div>
      )}

      {/* Resultado */}
      {phase === "result" && winner && (
        <div className="flex flex-col items-center gap-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="flex items-center gap-2 text-amber-400"
          >
            <Trophy className="w-7 h-7 md:w-9 md:h-9" />
            <span className="text-xl md:text-3xl font-bold">CARTELA SORTEADA!</span>
          </motion.div>

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8, delay: 0.1 }}
            className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-3xl shadow-2xl px-8 md:px-16 py-6 md:py-10 min-w-[260px] md:min-w-[340px] text-center border-4 border-amber-300"
          >
            <div className="text-6xl md:text-9xl font-bold font-heading text-purple-950 tabular-nums">
              {String(winner.card_number || "").padStart(4, "0")}
            </div>
            {winner.player_name && !winner.player_name.startsWith("Cartela ") && (
              <div className="text-base md:text-xl text-purple-900 mt-2 font-semibold truncate max-w-[280px] mx-auto">
                {winner.player_name}
              </div>
            )}
          </motion.div>

          <p className="text-white text-base md:text-lg">O comprador está presente?</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="gap-2 px-8 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-lg"
              onClick={() => setPhase("confirm")}
            >
              <Check className="w-5 h-5" /> Sim, está presente
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 px-8 border-white/30 text-white hover:bg-white/10 text-lg"
              onClick={handleSpinAgain}
            >
              <RotateCcw className="w-5 h-5" /> Não, girar novamente
            </Button>
          </div>
        </div>
      )}

      {/* Confirmar prêmio */}
      {phase === "confirm" && winner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-5 w-full max-w-md"
        >
          <div className="flex items-center gap-2 text-emerald-400">
            <Gift className="w-7 h-7 md:w-9 md:h-9" />
            <span className="text-xl md:text-3xl font-bold">PARABÉNS!</span>
          </div>

          <div className="bg-white/10 rounded-2xl px-8 py-4 text-center border border-white/10 w-full">
            <div className="text-3xl md:text-4xl font-bold font-heading text-amber-400 tabular-nums">
              {String(winner.card_number || "").padStart(4, "0")}
            </div>
            {winner.player_name && !winner.player_name.startsWith("Cartela ") && (
              <div className="text-base md:text-lg text-white mt-1 truncate">
                {winner.player_name}
              </div>
            )}
          </div>

          <div className="w-full">
            <label className="text-sm text-violet-300 font-medium">Prêmio ganho</label>
            <Input
              className="mt-1 h-12 text-lg bg-white/10 border-white/20 text-white placeholder:text-violet-400"
              placeholder="Ex: Geladeira, TV 50, R$ 500..."
              value={prizeDesc}
              onChange={(e) => setPrizeDesc(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && prizeDesc.trim() && handleConfirm()}
            />
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="gap-2 border-white/30 text-white hover:bg-white/10 text-base flex-1"
              onClick={() => setPhase("result")}
              disabled={saving}
            >
              Voltar
            </Button>
            <Button
              size="lg"
              className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-base flex-1"
              disabled={!prizeDesc.trim() || saving}
              onClick={handleConfirm}
            >
              {saving ? (
                "Salvando..."
              ) : (
                <>
                  <Trophy className="w-5 h-5" /> Confirmar Ganhador
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}