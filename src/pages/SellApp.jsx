import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ShoppingCart, User, Phone, MapPin,
  ChevronRight, ArrowLeft, Search, TicketCheck, X
} from "lucide-react";

// --- Step 1: Seller identification ---
function SellerStep({ onEnter }) {
  const [name, setName] = useState(() => localStorage.getItem("seller_name") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("seller_phone") || "");

  const handleContinue = () => {
    if (!name.trim()) return;
    localStorage.setItem("seller_name", name.trim());
    localStorage.setItem("seller_phone", phone.trim());
    onEnter({ name: name.trim(), phone: phone.trim() });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <TicketCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Venda de Cartelas</h1>
          <p className="text-muted-foreground text-sm mt-1">Identifique-se para começar</p>
        </div>

        <div className="space-y-4 bg-card rounded-2xl p-5 shadow-md border">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Seu nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-12 text-base"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Seu telefone (opcional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-12 text-base"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              />
            </div>
          </div>
          <Button
            className="w-full h-12 text-base gap-2 mt-2"
            onClick={handleContinue}
            disabled={!name.trim()}
          >
            Continuar <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Step 2: Pick game ---
function GamePickStep({ seller, onPick, onBack }) {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["sell-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const active = games.filter((g) => g.status !== "finished");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Sair
        </button>
        <h1 className="text-xl font-bold font-heading">Olá, {seller.name}!</h1>
        <p className="text-primary-foreground/80 text-sm mt-0.5">Escolha o evento para vender</p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : active.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhum jogo disponível no momento.
          </div>
        ) : (
          active.map((game) => (
            <button
              key={game.id}
              onClick={() => onPick(game)}
              className="w-full text-left bg-card border rounded-2xl p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold font-heading">{game.name}</div>
                  {game.event_location && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {game.event_location}
                    </div>
                  )}
                  {game.event_price && (
                    <Badge variant="outline" className="text-xs mt-1 bg-green-50 text-green-700 border-green-200">
                      R$ {game.event_price}
                    </Badge>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// --- Step 3: Card selection & sale ---
function SellStep({ seller, game, onBack }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCard, setSavedCard] = useState(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["sell-cards", game.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(game.id) }),
  });

  const available = cards.filter((c) => !c.player_phone && !c.player_city);
  const sold = cards.filter((c) => c.player_phone || c.player_city);

  const filtered = cards.filter((c) => {
    const q = search.toLowerCase();
    return (
      String(c.card_number).includes(q) ||
      c.player_name?.toLowerCase().includes(q) ||
      c.player_phone?.includes(q)
    );
  });

  const openCard = (card) => {
    setSelectedCard(card);
    setBuyerName(card.player_name || "");
    setBuyerPhone(card.player_phone || "");
    setBuyerAddress(card.player_city || "");
  };

  const handleSell = async () => {
    if (!buyerName.trim()) return;
    setSaving(true);
    await base44.entities.BingoCard.update(selectedCard.id, {
      player_name: buyerName.trim(),
      player_phone: buyerPhone.trim(),
      player_city: buyerAddress.trim(),
    });
    setSaving(false);
    setSavedCard(selectedCard);
    setSelectedCard(null);
    queryClient.invalidateQueries({ queryKey: ["sell-cards", game.id] });
    setTimeout(() => setSavedCard(null), 3000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-2">
          <ArrowLeft className="w-4 h-4" /> Trocar evento
        </button>
        <h1 className="text-lg font-bold font-heading leading-tight">{game.name}</h1>
        <div className="flex gap-3 mt-2 text-sm text-primary-foreground/80">
          <span>{cards.length} cartelas</span>
          <span>•</span>
          <span className="text-green-300 font-medium">{sold.length} vendidas</span>
          <span>•</span>
          <span>{available.length} disponíveis</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b bg-card sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11"
            placeholder="Buscar cartela ou comprador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Success toast */}
      {savedCard && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Cartela #{String(savedCard.card_number).padStart(3, "0")} vendida com sucesso!
        </div>
      )}

      {/* Cards grid */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-5 gap-2">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {!search && available.length > 0 && (
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                Toque para vender
              </p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {(search ? filtered : cards).map((card) => {
                const isSold = !!(card.player_phone || card.player_city);
                return (
                  <button
                    key={card.id}
                    onClick={() => openCard(card)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 text-center border transition-all active:scale-95
                      ${isSold
                        ? "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
                        : "bg-card border-border hover:border-primary/60 hover:bg-primary/5"
                      }`}
                  >
                    <span className="text-sm font-bold leading-none">
                      {String(card.card_number || "").padStart(3, "0")}
                    </span>
                    {isSold && (
                      <span className="text-[9px] mt-0.5 opacity-70 truncate w-full">
                        {card.player_name?.split(" ")[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Sell modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="bg-background rounded-t-2xl w-full max-w-md p-5 pb-10 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-bold text-lg font-heading">
                  Cartela #{String(selectedCard.card_number || "").padStart(3, "0")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedCard.player_phone || selectedCard.player_city ? "Editar comprador" : "Registrar venda"}
                </p>
              </div>
              <button onClick={() => setSelectedCard(null)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm">Nome do Comprador *</Label>
                <Input
                  className="h-12 text-base"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Nome completo"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Telefone / WhatsApp</Label>
                <Input
                  className="h-12 text-base"
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Endereço / Cidade</Label>
                <Input
                  className="h-12 text-base"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="Cidade ou endereço"
                />
              </div>
            </div>

            <Button
              className="w-full h-12 text-base gap-2"
              onClick={handleSell}
              disabled={!buyerName.trim() || saving}
            >
              <ShoppingCart className="w-5 h-5" />
              {saving ? "Registrando..." : "Confirmar Venda"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main orchestrator ---
export default function SellApp() {
  const [seller, setSeller] = useState(() => {
    const name = localStorage.getItem("seller_name");
    const phone = localStorage.getItem("seller_phone");
    return name ? { name, phone: phone || "" } : null;
  });
  const [game, setGame] = useState(null);

  if (!seller) {
    return <SellerStep onEnter={setSeller} />;
  }

  if (!game) {
    return (
      <GamePickStep
        seller={seller}
        onPick={setGame}
        onBack={() => {
          localStorage.removeItem("seller_name");
          localStorage.removeItem("seller_phone");
          setSeller(null);
        }}
      />
    );
  }

  return <SellStep seller={seller} game={game} onBack={() => setGame(null)} />;
}