import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Zap } from "lucide-react";

export default function BulkGenerateModal({ open, onClose, onGenerate, generating }) {
  const [quantity, setQuantity] = useState("10");
  const [chances, setChances] = useState("1");
  const [prefix, setPrefix] = useState("Cartela");

  const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 200);

  const handleSubmit = () => {
    onGenerate({ quantity: qty, chances: parseInt(chances), prefix: prefix.trim() || "Cartela" });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-heading">Geração em Lote</h2>
                <p className="text-sm text-muted-foreground">Crie várias cartelas de uma vez</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Quantity */}
              <div className="space-y-1.5">
                <Label>Quantidade de cartelas <span className="text-muted-foreground">(máx. 200)</span></Label>
                <Input
                  type="number"
                  min="1"
                  max="200"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="text-lg font-semibold"
                />
                <p className="text-xs text-muted-foreground">Serão geradas <strong>{qty}</strong> cartelas numeradas automaticamente.</p>
              </div>

              {/* Prefix */}
              <div className="space-y-1.5">
                <Label>Prefixo do nome</Label>
                <Input
                  placeholder="Ex: Cartela, Jogador, Mesa..."
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">As cartelas serão nomeadas como "{prefix || "Cartela"} 1", "{prefix || "Cartela"} 2"…</p>
              </div>

              {/* Chances / Difficulty */}
              <div className="space-y-2">
                <Label>Nível de dificuldade</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setChances("1")}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      chances === "1"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="font-bold text-sm mb-1">1 Chance</div>
                    <div className="text-xs text-muted-foreground">1 cartela por jogador. Mais difícil de vencer.</div>
                  </button>
                  <button
                    onClick={() => setChances("2")}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      chances === "2"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="font-bold text-sm mb-1">2 Chances</div>
                    <div className="text-xs text-muted-foreground">2 cartelas por jogador. Mais fácil de vencer.</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={generating}>
                Cancelar
              </Button>
              <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={generating}>
                <Zap className="w-4 h-4" />
                {generating ? "Gerando..." : `Gerar ${qty} cartelas`}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}