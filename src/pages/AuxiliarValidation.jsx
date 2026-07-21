import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, CheckCircle2, XCircle, Wifi } from "lucide-react";

export default function AuxiliarValidation() {
  const { gameId } = useParams();
  const queryClient = useQueryClient();
  const [saleCard, setSaleCard] = useState(null);
  const [saleName, setSaleName] = useState("");
  const [salePhone, setSalePhone] = useState("");
  const [saleLoading, setSaleLoading] = useState(false);
  const [validating, setValidating] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);

  const { data: game } = useQuery({
    queryKey: ["aux-game", gameId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getAllGames", {});
      return (res.data.games || []).find((g) => g.id === gameId);
    },
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["aux-cards", gameId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getGameCards", {
        game_id: String(gameId),
      });
      return (res.data.cards || [])
        .filter((c) => !c.is_validated)
        .sort((a, b) => (a.card_number || 0) - (b.card_number || 0));
    },
    refetchInterval: 3000,
  });

  // Real-time: atualiza quando cartelas são validadas externamente
  useEffect(() => {
    const unsubscribe = base44.entities.BingoCard.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["aux-cards", gameId] });
    });
    return unsubscribe;
  }, [gameId, queryClient]);

  // Status de conexão
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const hasBuyer = (card) => !!card.player_phone || !!card.player_city;

  const handleQuickValidate = async (card) => {
    setValidating(card.id);
    await base44.entities.BingoCard.update(card.id, { is_validated: true });
    await queryClient.refetchQueries({ queryKey: ["aux-cards", gameId] });
    setValidating(null);
  };

  const handleOpenSale = (card) => {
    setSaleCard(card);
    setSaleName(card.player_name && !card.player_name.startsWith("Cartela ") ? card.player_name : "");
    setSalePhone(card.player_phone || "");
  };

  const handleSaveSale = async () => {
    if (!saleName.trim()) return;
    setSaleLoading(true);
    await base44.entities.BingoCard.update(saleCard.id, {
      player_name: saleName.trim(),
      player_phone: salePhone.trim(),
      payment_status: "paid",
      is_validated: true,
    });
    await queryClient.refetchQueries({ queryKey: ["aux-cards", gameId] });
    setSaleLoading(false);
    setSaleCard(null);
    setSaleName("");
    setSalePhone("");
  };

  const buyerCards = cards.filter(hasBuyer);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-8 pb-5 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold font-heading">Validação Auxiliar</h1>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${online ? "bg-green-500/20" : "bg-red-500/20"}`}>
            <Wifi className="w-3 h-3" /> {online ? "Online" : "Offline"}
          </span>
        </div>
        {game && <p className="text-primary-foreground/80 text-sm">{game.name}</p>}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold font-heading text-amber-700 dark:text-amber-400">{cards.length}</div>
            <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Aguardando validação</div>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <div className="text-2xl font-bold font-heading text-foreground">{buyerCards.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Com comprador</div>
          </div>
        </div>

        {/* Help text */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <p>Toque em uma cartela <strong>com comprador</strong> para validar. Cartelas sem comprador permitem cadastrar nome e telefone.</p>
        </div>

        {isLoading ? (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}>
            {[...Array(40)].map((_, i) => (
              <div key={i} className="h-11 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-muted-foreground font-medium">Tudo validado!</p>
            <p className="text-xs text-muted-foreground">Todas as cartelas já estão concorrendo.</p>
          </div>
        ) : (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}>
            {cards.map((card) => {
              const buyer = hasBuyer(card);
              const cellStyle = buyer
                ? "bg-amber-300 text-amber-900 hover:bg-amber-400 hover:scale-110"
                : "bg-muted text-muted-foreground hover:bg-primary/20 hover:scale-110";
              return (
                <button
                  key={card.id}
                  onClick={() => (buyer ? handleQuickValidate(card) : handleOpenSale(card))}
                  disabled={validating === card.id}
                  title={buyer ? `${card.player_name || "Comprador"} — tocar para validar` : `Cartela ${String(card.card_number || "").padStart(4, "0")} — tocar para vender`}
                  className={`flex items-center justify-center h-11 rounded-md text-xs font-bold font-heading transition-all relative ${cellStyle}`}
                >
                  {validating === card.id ? "..." : String(card.card_number || "").padStart(4, "0")}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sale modal */}
      {saleCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saleLoading && setSaleCard(null)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold font-heading text-lg">
                Cartela {String(saleCard.card_number || "").padStart(4, "0")}
              </h3>
              {!saleLoading && (
                <button onClick={() => setSaleCard(null)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome do comprador</label>
                <Input
                  className="mt-1 h-10"
                  placeholder="Digite o nome..."
                  value={saleName}
                  onChange={(e) => setSaleName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <Input
                  className="mt-1 h-10"
                  placeholder="(00) 00000-0000"
                  value={salePhone}
                  onChange={(e) => setSalePhone(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              A cartela será validada e concorrerá aos prêmios.
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={saleLoading || !saleName.trim()}
              onClick={handleSaveSale}
            >
              <CheckCircle2 className="w-4 h-4" />
              {saleLoading ? "Salvando..." : "Vender e Validar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}