import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trophy, Phone, User } from "lucide-react";
import BingoGrid from "./BingoGrid";

export default function WinnerCardsModal({ game, cards, drawnNumbers, onClose }) {
  const [winningCards, setWinningCards] = useState([]);

  useEffect(() => {
    if (!game?.drawn_numbers || !cards) return;

    const drawnSet = new Set(game.drawn_numbers);
    const winners = [];

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
      ].filter(n => n !== 0));

      const points = Array.from(allNumbers).filter(n => drawnSet.has(n)).length;
      
      if (points === 20) {
        winners.push(card);
      }
    });

    setWinningCards(winners);
  }, [game?.drawn_numbers, cards]);

  const formatPhone = (phone) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4) return digits;
    return `**${digits.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl border">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold font-heading">🎉 Cartelas Vencedoras - {game?.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {winningCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Nenhuma cartela vencedora ainda</p>
              <p className="text-sm mt-2">Continue sorteando números!</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-green-500 font-bold text-lg">
                  🏆 {winningCards.length} cartela(s) vencedora(s)!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Números sorteados: {drawnNumbers.length} | Total de cartelas: {cards.length}
                </p>
              </div>

              <div className="grid gap-4">
                {winningCards.map((card, idx) => (
                  <Card key={card.id} className="border-2 border-green-500/50 bg-green-500/5">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Trophy className="w-7 h-7 text-green-500" />
                          </div>
                          <div>
                            <div className="font-bold text-xl font-heading">
                              Cartela #{String(card.card_number || "").padStart(4, "0")}
                            </div>
                            {card.player_name ? (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="w-4 h-4" />
                                <span>{card.player_name}</span>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Sem proprietário</div>
                            )}
                            {card.player_phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{formatPhone(card.player_phone)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-green-500 text-white border-0 text-base px-4 py-2">
                          20/20 Pontos
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-center gap-4">
                        <BingoGrid numbers={card.grid_1 || []} drawnNumbers={drawnNumbers} compact={false} />
                        {card.chances === 2 && (
                          <div>
                            <p className="text-xs text-center text-muted-foreground mb-2">Segunda Chance</p>
                            <BingoGrid numbers={card.grid_2 || []} drawnNumbers={drawnNumbers} compact={false} />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-background border-t p-4">
          <Button className="w-full h-12 text-lg" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}