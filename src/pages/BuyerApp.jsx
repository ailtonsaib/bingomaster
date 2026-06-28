import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { maskPhone } from "@/lib/utils";
import { useBrandName } from "@/hooks/useBrandName";
import { getBrandLetters, COLUMN_BG } from "@/lib/brandConfig";
import { cn } from "@/lib/utils";
import {
  Search, Phone, User, ChevronRight, ArrowLeft,
  Trophy, Ticket, MapPin, CheckCircle2, XCircle, Star
} from "lucide-react";

// ─── Mini BingoGrid para o comprador ────────────────────────────────────────
function BuyerGrid({ numbers, drawnNumbers = [], label }) {
  const { brandName } = useBrandName();
  const headers = getBrandLetters(brandName);
  const drawn = new Set(drawnNumbers);

  return (
    <div className="inline-block w-full">
      {label && (
        <div className="text-center text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
          {label}
        </div>
      )}
      <div className="bg-card rounded-xl border-2 border-primary/20 overflow-hidden shadow-md">
        <div className="grid grid-cols-5 gap-px bg-primary/10">
          {headers.map((h, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center font-bold text-white font-heading h-8 text-xs",
                COLUMN_BG[i]
              )}
            >
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-px bg-border/50 p-px">
          {numbers.map((num, idx) => {
            const isMarked = num !== 0 && drawn.has(num);
            const isFree = num === 0;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-center font-semibold font-heading h-9 text-sm transition-all duration-500",
                  isFree
                    ? "bg-primary/20 text-primary text-xs"
                    : isMarked
                    ? "bg-primary text-primary-foreground scale-105 shadow-inner"
                    : "bg-card text-card-foreground"
                )}
              >
                {isFree ? "★" : num}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Identificação do comprador ─────────────────────────────────────
function BuyerLoginStep({ onEnter }) {
  const [phone, setPhone] = useState(() => localStorage.getItem("buyer_phone") || "");
  const [name, setName] = useState(() => localStorage.getItem("buyer_name") || "");

  const handleContinue = () => {
    if (!phone.trim() && !name.trim()) return;
    localStorage.setItem("buyer_phone", phone.trim());
    localStorage.setItem("buyer_name", name.trim());
    onEnter({ phone: phone.trim(), name: name.trim() });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Ticket className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading">App do Comprador</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe suas cartelas em tempo real</p>
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
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              />
            </div>
          </div>
          <Button
            className="w-full h-12 text-base gap-2 mt-2"
            onClick={handleContinue}
            disabled={!phone.trim() && !name.trim()}
          >
            Buscar minhas cartelas <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Escolher jogo ───────────────────────────────────────────────────
function GamePickStep({ buyer, onPick, onBack }) {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["buyer-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const active = games.filter((g) => g.status !== "finished");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold font-heading">Olá, {buyer.name || buyer.phone}!</h1>
        <p className="text-primary-foreground/80 text-sm mt-0.5">Escolha o evento</p>
      </div>
      <div className="flex-1 px-4 py-5 space-y-3">
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)
        ) : active.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhum evento disponível.</div>
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
                  <Badge variant="outline" className={`text-xs mt-1 ${game.status === "in_progress" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {game.status === "in_progress" ? "🎰 Sorteio em andamento" : "⏳ Aguardando início"}
                  </Badge>
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

// ─── Tela de GANHOU ──────────────────────────────────────────────────────────
function WinnerScreen({ prizeName, gameFinished, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-yellow-400 via-amber-300 to-yellow-500 px-6 text-center animate-in fade-in duration-500">
      <div className="text-8xl mb-4 animate-bounce">🏆</div>
      <h1 className="text-3xl font-bold font-heading text-white drop-shadow-lg mb-2">
        VOCÊ GANHOU!
      </h1>
      <p className="text-xl font-semibold text-yellow-900 mb-2">{prizeName}</p>
      <p className="text-base text-yellow-900/80 mb-8 max-w-xs">
        {gameFinished
          ? "Favor compareça ao local do evento ou procure o seu vendedor para retirada do prêmio."
          : "Parabéns! Aguarde as instruções do organizador."}
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-8 h-8 text-yellow-200 fill-yellow-200" />
        ))}
      </div>
      <Button className="mt-8 bg-yellow-900 text-yellow-100 hover:bg-yellow-800 h-12 px-10 text-base" onClick={onClose}>
        Ver minhas cartelas
      </Button>
    </div>
  );
}

// ─── Tela de NÃO GANHOU ──────────────────────────────────────────────────────
function LoserScreen({ message, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900 px-6 text-center animate-in fade-in duration-500">
      <div className="text-7xl mb-4">😔</div>
      <h2 className="text-2xl font-bold font-heading text-white mb-3">{message}</h2>
      <Button variant="outline" className="mt-6 h-12 px-10 text-base text-white border-white/40 hover:bg-white/10" onClick={onClose}>
        Continuar
      </Button>
    </div>
  );
}

// ─── Step 3: Acompanhamento em tempo real ────────────────────────────────────
function WatchStep({ buyer, game, onBack }) {
  const POLL_MS = 2000;

  const [shownWinner, setShownWinner] = useState(null); // { prizeName, isWinner }
  const [gameEndShown, setGameEndShown] = useState(false);
  const [didWinAny, setDidWinAny] = useState(false);
  const prevPrizesRef = useRef([]);
  const prevStatusRef = useRef(game.status);

  // Poll game
  const { data: liveGame } = useQuery({
    queryKey: ["buyer-live-game", game.id],
    queryFn: () => base44.entities.BingoGame.filter({ id: game.id }).then((r) => r[0] || game),
    refetchInterval: POLL_MS,
  });

  // Poll buyer cards
  const { data: allCards = [] } = useQuery({
    queryKey: ["buyer-cards", game.id],
    queryFn: () => base44.functions.invoke("getGameCards", { game_id: String(game.id) }).then((r) => r.data.cards),
    refetchInterval: POLL_MS,
  });

  const currentGame = liveGame || game;
  const drawnNumbers = currentGame.drawn_numbers || [];
  const prizes = currentGame.prizes || [];

  // Find my cards (by name or phone)
  const myCards = allCards.filter((c) => {
    const nameMatch = buyer.name && c.player_name?.toLowerCase().includes(buyer.name.toLowerCase());
    const phoneMatch = buyer.phone && c.player_phone?.replace(/\D/g, "") === buyer.phone.replace(/\D/g, "");
    return nameMatch || phoneMatch;
  });

  // Get grids for the CURRENT prize being drawn (chance 1 first, then chance 2 if needed)
  // prizeIndex: index of the current prize (0-based)
  // We show chance 1 grids for prize 0, 1, 2... and chance 2 grids after chance 1 prizes are exhausted
  // Logic: alternate by prize — odd prizes use chance 2 if available, but simpler:
  // Show chance 1 always for current prize; if card has chance 2 and current prize index >= number of chance-1-only prizes, show chance 2
  // Actually simplest: show chance 1 grids while prize uses chance 1, chance 2 grids when prize uses chance 2
  // We determine this by checking if the current prize index is within the first "chance 1" set or second "chance 2" set
  const getGridsForPrize = (card, prizeIdx) => {
    const hasChance1 = card.grid_1a?.length > 0;
    const hasChance2 = card.grid_2a?.length > 0;
    const hasLegacy = card.grid_1?.length > 0;

    // Count prizes — first half uses chance 1, second half uses chance 2 (if dual chance card)
    const totalPrizes = prizes.length;
    const halfPrizes = Math.ceil(totalPrizes / 2);
    const useChance2 = hasChance2 && prizeIdx >= halfPrizes;

    if (useChance2) {
      const grids = [];
      if (card.grid_2a?.length) grids.push({ nums: card.grid_2a, label: "2ª Chance - A" });
      if (card.grid_2b?.length) grids.push({ nums: card.grid_2b, label: "2ª Chance - B" });
      if (card.grid_2c?.length) grids.push({ nums: card.grid_2c, label: "2ª Chance - C" });
      return grids;
    }

    if (hasChance1) {
      const grids = [];
      if (card.grid_1a?.length) grids.push({ nums: card.grid_1a, label: "1ª Chance - A" });
      if (card.grid_1b?.length) grids.push({ nums: card.grid_1b, label: "1ª Chance - B" });
      if (card.grid_1c?.length) grids.push({ nums: card.grid_1c, label: "1ª Chance - C" });
      return grids;
    }

    // Legacy fallback
    const grids = [];
    if (hasLegacy) grids.push({ nums: card.grid_1, label: "Grade 1" });
    if (card.grid_2?.length) grids.push({ nums: card.grid_2, label: "Grade 2" });
    return grids;
  };

  // Detect new prize awarded
  useEffect(() => {
    if (!liveGame || shownWinner) return;
    const prevPrizes = prevPrizesRef.current;
    const currentPrizes = prizes;

    const newlyAwarded = currentPrizes.find((p, i) => {
      const prev = prevPrizes[i];
      return p.awarded && (!prev || !prev.awarded);
    });

    if (newlyAwarded) {
      const myCardIds = myCards.map((c) => c.id);
      const iWon = myCardIds.includes(newlyAwarded.awarded_card_id);
      if (iWon) setDidWinAny(true);
      setShownWinner({ prizeName: newlyAwarded.name, isWinner: iWon });
    }

    prevPrizesRef.current = currentPrizes.map((p) => ({ ...p }));
  }, [prizes, liveGame, myCards, shownWinner]);

  // Detect game finished
  useEffect(() => {
    if (!liveGame) return;
    if (prevStatusRef.current !== "finished" && liveGame.status === "finished" && !gameEndShown && !shownWinner) {
      setGameEndShown(true);
    }
    prevStatusRef.current = liveGame.status;
  }, [liveGame?.status, gameEndShown, shownWinner]);

  // Current prize being drawn (first not awarded)
  const currentPrize = prizes.find((p) => !p.awarded);
  const currentPrizeIndex = prizes.findIndex((p) => !p.awarded);
  const lastNumber = drawnNumbers[drawnNumbers.length - 1];

  // Score per card (for current prize grids only)
  const getHits = (card) => {
    const grids = getGridsForPrize(card, currentPrizeIndex >= 0 ? currentPrizeIndex : 0);
    if (!grids.length) return 0;
    const drawn = new Set(drawnNumbers);
    let maxHits = 0;
    for (const g of grids) {
      const hits = g.nums.filter((n) => n !== 0 && drawn.has(n)).length;
      if (hits > maxHits) maxHits = hits;
    }
    return maxHits;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Winner/Loser overlay */}
      {shownWinner && shownWinner.isWinner && (
        <WinnerScreen
          prizeName={shownWinner.prizeName}
          gameFinished={currentGame.status === "finished"}
          onClose={() => setShownWinner(null)}
        />
      )}
      {shownWinner && !shownWinner.isWinner && (
        <LoserScreen
          message={`Infelizmente você não ganhou este prêmio, vamos para o próximo!`}
          onClose={() => setShownWinner(null)}
        />
      )}
      {gameEndShown && (
        <LoserScreen
          message={didWinAny
            ? "Favor compareça ao local do evento ou procure o seu vendedor para retirada do prêmio."
            : "Infelizmente não foi desta vez 😢"}
          onClose={() => setGameEndShown(false)}
        />
      )}

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-2">
          <ArrowLeft className="w-4 h-4" /> Trocar evento
        </button>
        <h1 className="text-lg font-bold font-heading leading-tight">{currentGame.name}</h1>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {currentGame.status === "in_progress" && (
            <Badge className="bg-emerald-500 text-white border-0 text-xs animate-pulse">🎰 Sorteio ao vivo</Badge>
          )}
          {currentGame.status === "waiting" && (
            <Badge className="bg-amber-400 text-amber-900 border-0 text-xs">⏳ Aguardando início</Badge>
          )}
          {currentGame.status === "finished" && (
            <Badge className="bg-slate-400 text-white border-0 text-xs">✅ Finalizado</Badge>
          )}
          <span className="text-primary-foreground/70 text-xs">{drawnNumbers.length} números sorteados</span>
        </div>
      </div>

      {/* Live draw panel */}
      {currentGame.status === "in_progress" && (
        <div className="mx-4 mt-4 bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Sorteando</p>
              <p className="text-base font-bold text-foreground">{currentPrize?.name || "—"}</p>
            </div>
            {lastNumber && (
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-0.5">Último número</p>
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <span className="text-xl font-bold text-primary-foreground">{lastNumber}</span>
                </div>
              </div>
            )}
          </div>

          {/* Recent numbers */}
          {drawnNumbers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...drawnNumbers].reverse().slice(0, 15).map((n, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border",
                    i === 0
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prizes summary */}
      {prizes.length > 0 && (
        <div className="mx-4 mt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Prêmios</p>
          <div className="flex flex-wrap gap-2">
            {prizes.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium",
                  p.awarded
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-amber-50 border-amber-300 text-amber-700"
                )}
              >
                {p.awarded ? <CheckCircle2 className="w-3 h-3" /> : <Trophy className="w-3 h-3" />}
                {p.name}
                {p.awarded && p.awarded_card_number && (
                  <span className="text-emerald-600 font-bold">#{String(p.awarded_card_number).padStart(4, "0")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My cards */}
      <div className="flex-1 px-4 py-4">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Minhas cartelas ({myCards.length})
        </p>

        {myCards.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="text-4xl">🔍</div>
            <p className="font-semibold text-foreground">Nenhuma cartela encontrada</p>
            <p className="text-sm text-muted-foreground">
              Verifique com seu vendedor se suas cartelas foram registradas no sistema.
            </p>
            <Button variant="outline" className="mt-4" onClick={onBack}>Tentar com outro nome/telefone</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {myCards.map((card) => {
              const activePrizeIdx = currentPrizeIndex >= 0 ? currentPrizeIndex : prizes.length - 1;
              const grids = getGridsForPrize(card, activePrizeIdx);
              const hits = getHits(card);
              const isWinner = card.is_winner || (card.won_prizes && card.won_prizes.length > 0);
              return (
                <div
                  key={card.id}
                  className={cn(
                    "bg-card border rounded-2xl p-4 shadow-sm",
                    isWinner && "border-amber-400 bg-amber-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold text-lg font-heading">
                        #{String(card.card_number || "").padStart(4, "0")}
                      </span>
                      {card.chances === 2 && (
                        <Badge className="ml-2 text-xs bg-violet-100 text-violet-700 border-violet-300">Dupla Chance</Badge>
                      )}
                    </div>
                    {currentPrize && (
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                        🎯 {currentPrize.name}
                      </Badge>
                    )}
                    <div className="flex items-center gap-2">
                      {isWinner && (
                        <Badge className="bg-amber-400 text-amber-900 border-0 gap-1">
                          <Trophy className="w-3 h-3" /> Ganhador!
                        </Badge>
                      )}
                      {currentGame.status === "in_progress" && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {hits} acertos
                        </span>
                      )}
                    </div>
                  </div>

                  {grids.length > 0 ? (
                    <div className="grid gap-3" style={{ gridTemplateColumns: grids.length > 1 ? "1fr 1fr" : "1fr" }}>
                      {grids.map((g, gi) => (
                        <BuyerGrid
                          key={gi}
                          numbers={g.nums}
                          drawnNumbers={drawnNumbers}
                          label={grids.length > 1 ? g.label : null}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Grade não disponível</p>
                  )}

                  {card.won_prizes && card.won_prizes.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {card.won_prizes.map((wp, wi) => (
                        <div key={wi} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-lg px-2.5 py-1">
                          <Trophy className="w-3 h-3 shrink-0" />
                          Ganhou: <strong>{wp.prize_name}</strong> no número {wp.won_at_draw}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function BuyerApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlPhone = urlParams.get("phone");
  const urlName = urlParams.get("name");
  const urlGameId = urlParams.get("game_id");

  const [buyer, setBuyer] = useState(() => {
    if (urlPhone || urlName) {
      return { phone: urlPhone || "", name: urlName || "" };
    }
    const phone = localStorage.getItem("buyer_phone");
    const name = localStorage.getItem("buyer_name");
    return phone || name ? { phone: phone || "", name: name || "" } : null;
  });

  const [game, setGame] = useState(null);

  const { data: preloadedGame } = useQuery({
    queryKey: ["buyer-preloaded-game", urlGameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: urlGameId }).then((r) => r[0] || null),
    enabled: !!urlGameId,
  });

  const resolvedGame = game || (urlGameId ? preloadedGame : null);

  if (!buyer) {
    return <BuyerLoginStep onEnter={setBuyer} />;
  }

  if (!resolvedGame) {
    return (
      <GamePickStep
        buyer={buyer}
        onPick={setGame}
        onBack={() => setBuyer(null)}
      />
    );
  }

  return (
    <WatchStep
      buyer={buyer}
      game={resolvedGame}
      onBack={() => setGame(null)}
    />
  );
}