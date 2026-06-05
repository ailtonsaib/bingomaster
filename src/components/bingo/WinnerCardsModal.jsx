import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trophy, Phone, User } from "lucide-react";

export default function WinnerCardsModal({ isOpen, onClose, winningCards }) {
  if (!isOpen || winningCards.length === 0) return null;

  const formatPhone = (phone) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4) return digits;
    return `**${digits.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto shadow-2xl border">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold font-heading">BOOYA! Cartelas Vencedoras</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {winningCards.map((card, idx) => (
            <Card key={idx} className="border-2 border-accent/50 bg-accent/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <div className="font-bold text-lg font-heading">
                        Cartela #{String(card.card_number || "").padStart(4, "0")}
                      </div>
                      {card.player_name ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="w-3.5 h-3.5" />
                          <span>{card.player_name}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Sem proprietário</div>
                      )}
                      {card.player_phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{formatPhone(card.player_phone)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-accent text-accent-foreground text-sm px-3 py-1">
                    20 Pontos
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="sticky bottom-0 bg-background border-t p-4">
          <Button className="w-full h-12" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}