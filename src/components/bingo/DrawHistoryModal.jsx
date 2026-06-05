import { X, Clock, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DrawHistoryModal({ drawnNumbers, onClose }) {
  const totalNumbers = drawnNumbers.length;
  const lastNumber = drawnNumbers[totalNumbers - 1];
  const firstNumber = drawnNumbers[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold font-heading flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-primary" /> Histórico de Sorteios
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalNumbers} números sorteados em ordem cronológica
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {totalNumbers === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Hash className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum número sorteado ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-primary/10 rounded-xl p-3 text-center border border-primary/20">
                  <div className="text-2xl font-bold font-heading text-primary">{totalNumbers}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total</div>
                </div>
                <div className="bg-accent/10 rounded-xl p-3 text-center border border-accent/20">
                  <div className="text-2xl font-bold font-heading text-accent-foreground">{firstNumber}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">1º Sorteado</div>
                </div>
                <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                  <div className="text-2xl font-bold font-heading text-green-600">{lastNumber}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Último</div>
                </div>
              </div>

              {/* Number grid */}
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                {drawnNumbers.map((num, idx) => (
                  <div
                    key={`${num}-${idx}`}
                    className={`relative flex items-center justify-center aspect-square rounded-lg font-bold text-sm transition-all ${
                      idx === totalNumbers - 1
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/30 ring-2 ring-green-300"
                        : idx === 0
                          ? "bg-accent text-accent-foreground shadow-md"
                          : "bg-primary/10 text-primary border border-primary/20"
                    }`}
                  >
                    {num}
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center text-muted-foreground">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">1</div>
                  <span>Primeiro sorteado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</div>
                  <span>Sorteados no meio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-green-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">{totalNumbers}</div>
                  <span>Último sorteado</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}