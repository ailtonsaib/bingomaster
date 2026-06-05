import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Trophy, Phone, User } from "lucide-react";

export default function DrawStatistics({ cards, drawnNumbers }) {
  const [nearWinners, setNearWinners] = useState({ near19: [], near20: [] });
  const [showWinners, setShowWinners] = useState(false);
  const [winnerCards, setWinnerCards] = useState([]);

  useEffect(() => {
    if (drawnNumbers.length === 0) return;

    const drawnSet = new Set(drawnNumbers);
    
    // Calcular pontos de cada cartela
    const cardStats = cards.map((card) => {
      // Combinar todos os grids da cartela
      const allNumbers = new Set([
        ...(card.grid_1 || []),
        ...(card.grid_2 || []),
        ...(card.grid_1a || []),
        ...(card.grid_1b || []),
        ...(card.grid_1c || []),
        ...(card.grid_2a || []),
        ...(card.grid_2b || []),
        ...(card.grid_2c || []),
      ].filter(n => n !== 0));

      const points = Array.from(allNumbers).filter(n => drawnSet.has(n)).length;
      
      return {
        card,
        points,
        cardNumber: card.card_number,
        playerName: card.player_name,
        playerPhone: card.player_phone,
      };
    });

    // Cartelas com 19 pontos (próximas da vitória)
    const near19 = cardStats.filter(c => c.points === 19);
    
    // Cartelas com 20 pontos (vencedoras - cartela cheia)
    const near20 = cardStats.filter(c => c.points === 20);

    setNearWinners({ near19, near20 });

    // Alertar quando tiver cartelas com 20 pontos
    if (near20.length > 0) {
      setWinnerCards(near20);
      setShowWinners(true);
    }
  }, [drawnNumbers, cards]);

  const formatPhone = (phone) => {
    if (!phone) return "";
    const clean = phone.replace(/\D/g, "");
    if (clean.length >= 4) {
      return "****" + clean.slice(-4);
    }
    return phone;
  };

  return (
    <>
      {/* Estatísticas de cartelas próximas */}
      <Card className="bg-white/10 backdrop-blur border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-violet-200 uppercase tracking-wider flex items-center gap-2">
            🎯 Cartelas Próximas da Vitória
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 19 pontos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-violet-300">19 pontos (quase lá!)</span>
              <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/50">
                {nearWinners.near19.length} cartelas
              </Badge>
            </div>
            {nearWinners.near19.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {nearWinners.near19.slice(0, 10).map((c) => (
                  <Badge
                    key={c.card.id}
                    variant="outline"
                    className="text-xs bg-amber-500/10 text-amber-200 border-amber-500/30"
                  >
                    #{String(c.cardNumber || "").padStart(4, "0")}
                  </Badge>
                ))}
                {nearWinners.near19.length > 10 && (
                  <Badge variant="outline" className="text-xs text-violet-400">
                    +{nearWinners.near19.length - 10}
                  </Badge>
                )}
              </div>
            )}
            {nearWinners.near19.length === 0 && (
              <p className="text-xs text-violet-400">Nenhuma cartela com 19 pontos</p>
            )}
          </div>

          {/* 20 pontos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-violet-300">20 pontos (COMPLETA!)</span>
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-300 border-green-500/50">
                {nearWinners.near20.length} cartelas
              </Badge>
            </div>
            {nearWinners.near20.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {nearWinners.near20.map((c) => (
                  <Badge
                    key={c.card.id}
                    className="text-xs bg-green-500 text-white border-0"
                  >
                    🏆 #{String(c.cardNumber || "").padStart(4, "0")}
                  </Badge>
                ))}
              </div>
            )}
            {nearWinners.near20.length === 0 && (
              <p className="text-xs text-violet-400">Nenhuma cartela completa ainda</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de cartelas vencedoras */}
      {showWinners && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowWinners(false)}
        >
          <div
            className="bg-background rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold font-heading">Cartelas Vencedoras!</h2>
              </div>
              <button
                onClick={() => setShowWinners(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                {winnerCards.length} cartela(s) completaram 20 pontos!
              </p>

              <div className="space-y-3">
                {winnerCards.map((w) => (
                  <Card key={w.card.id} className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-green-500 text-white border-0">
                              🏆 VENCEDORA
                            </Badge>
                            <span className="font-bold text-lg">
                              #{String(w.cardNumber || "").padStart(4, "0")}
                            </span>
                          </div>
                          
                          {w.playerName ? (
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-foreground">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{w.playerName}</span>
                              </div>
                              {w.playerPhone && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Phone className="w-4 h-4" />
                                  <span>{formatPhone(w.playerPhone)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Sem informações do comprador
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={() => setShowWinners(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}