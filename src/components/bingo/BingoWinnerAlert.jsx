import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

export default function BingoWinnerAlert({ winners, onClose, onConfirm }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (winners && winners.length > 0) {
      // Tocar som de vitória
      const playWinSound = () => {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          
          // Acorde triunfante principal (C major)
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
          const duration = 0.2;
          
          notes.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = "sine";
            
            const startTime = audioContext.currentTime + (index * 0.08);
            gainNode.gain.setValueAtTime(0.4, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
          });

          // Som de "ding" agudo após o acorde
          setTimeout(() => {
            const dingOscillator = audioContext.createOscillator();
            const dingGain = audioContext.createGain();
            
            dingOscillator.connect(dingGain);
            dingGain.connect(audioContext.destination);
            
            dingOscillator.frequency.value = 1318.51; // E6
            dingOscillator.type = "triangle";
            
            dingGain.gain.setValueAtTime(0.3, audioContext.currentTime);
            dingGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            dingOscillator.start();
            dingOscillator.stop(audioContext.currentTime + 0.4);
          }, 400);

          // Efeito de celebração final
          setTimeout(() => {
            const celebrationOscillator = audioContext.createOscillator();
            const celebrationGain = audioContext.createGain();
            
            celebrationOscillator.connect(celebrationGain);
            celebrationGain.connect(audioContext.destination);
            
            celebrationOscillator.frequency.value = 880; // A5
            celebrationOscillator.type = "sine";
            
            celebrationGain.gain.setValueAtTime(0.25, audioContext.currentTime);
            celebrationGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
            
            celebrationOscillator.start();
            celebrationOscillator.stop(audioContext.currentTime + 0.6);
          }, 600);
        } catch (error) {
          console.log("Audio not supported");
        }
      };
      
      playWinSound();

      // Efeitos de confete mais elaborados
      const colors = ["#a855f7", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"];
      
      // Confete inicial
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: colors,
        shapes: ["circle", "star"],
        gravity: 0.8,
        drift: 0.5,
      });

      // Explosões laterais
      setTimeout(() => {
        confetti({
          particleCount: 100,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: colors,
        });
        confetti({
          particleCount: 100,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: colors,
        });
      }, 300);

      // Confete contínuo por 3 segundos
      let end = Date.now() + 3000;
      const frame = () => {
        confetti({
          particleCount: 30,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 30,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
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

          {/* Animação de estrelas brilhantes */}
          <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-amber-400"
                initial={{ 
                  x: Math.random() * 400 - 200, 
                  y: Math.random() * 300 - 150,
                  scale: 0,
                  opacity: 0 
                }}
                animate={{ 
                  x: [Math.random() * 400 - 200, Math.random() * 400 - 200],
                  y: [Math.random() * 300 - 150, Math.random() * 300 - 150],
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2
                }}
                style={{
                  left: `${50 + (Math.random() * 40 - 20)}%`,
                  top: `${50 + (Math.random() * 40 - 20)}%`,
                }}
              >
                <Star className="w-4 h-4 fill-current" />
              </motion.div>
            ))}
          </div>

          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-7xl mb-4 relative z-10"
          >
            🎉
          </motion.div>

          <motion.h2 
            className="text-4xl md:text-5xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 mb-2 relative z-10"
            animate={{ 
              scale: [1, 1.05, 1],
              textShadow: [
                "0 0 20px rgba(251, 191, 36, 0.5)",
                "0 0 40px rgba(251, 191, 36, 0.8)",
                "0 0 20px rgba(251, 191, 36, 0.5)"
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ✨ BINGO! ✨
          </motion.h2>
          
          <motion.p 
            className="text-violet-200 text-base mb-6 relative z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {winners.length === 1
              ? `${winners[0].card.player_name || `Cartela ${winners[0].card.card_identifier}`} ganhou!`
              : `${winners.length} cartelas completaram o bingo!`
            }
          </motion.p>

          <motion.div 
            className="bg-gradient-to-r from-amber-400/30 via-yellow-300/30 to-amber-400/30 border-2 border-amber-400/60 rounded-2xl p-5 mb-6 relative overflow-hidden"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            {/* Brilho animado */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
            
            <div className="flex items-center justify-center gap-2 mb-2 relative z-10">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Trophy className="w-6 h-6 text-amber-400" />
              </motion.div>
              <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Prêmio Conquistado</span>
            </div>
            <motion.p 
              className="text-2xl font-black text-white text-center relative z-10"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {prize.prizeName}
            </motion.p>
          </motion.div>

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

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              className="w-full bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-amber-950 font-black text-lg h-14 shadow-lg shadow-amber-400/50 relative overflow-hidden group"
              onClick={onConfirm}
            >
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Trophy className="w-6 h-6" />
                Confirmar e Marcar Prêmio
              </span>
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}