import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { maskPhone } from "@/lib/utils";
import {
  CheckCircle2, ShoppingCart, User, Phone, MapPin,
  ChevronRight, ArrowLeft, Search, TicketCheck, X,
  ChevronDown, UserCheck, Hash, Camera, Trash2, Loader2, LogOut, MessageCircle,
  Clock, Paperclip, BadgeCheck, Undo2
} from "lucide-react";

// --- Step 1: Seller identification ---
function SellerStep({ onEnter, locked }) {
  const [phone, setPhone] = useState(() => localStorage.getItem("seller_phone") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneDigits) { setError("Informe seu telefone para continuar."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await base44.functions.invoke("sellAppPublic", { action: "validateSeller", phone: phoneDigits });
      const match = res.data.seller;

      setLoading(false);

      if (!match) {
        setError("Telefone não encontrado. Verifique com o organizador.");
        return;
      }

      localStorage.setItem("seller_name", match.name);
      localStorage.setItem("seller_phone", match.phone || phone);
      localStorage.setItem("seller_id", match.id);
      onEnter({ name: match.name, phone: match.phone || phone, id: match.id });
    } catch (e) {
      setLoading(false);
      setError("Erro ao validar telefone. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <TicketCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Venda de Cartelas</h1>
          <p className="text-muted-foreground text-sm mt-1">Informe seu telefone cadastrado para entrar</p>
        </div>

        <div className="space-y-4 bg-card rounded-2xl p-5 shadow-md border">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Seu telefone / WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-12 text-base"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => { setPhone(maskPhone(e.target.value)); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                autoFocus
                inputMode="numeric"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <Button
            className="w-full h-12 text-base gap-2 mt-2"
            onClick={handleContinue}
            disabled={!phone.replace(/\D/g, "") || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ChevronRight className="w-4 h-4" /> Entrar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Step 2: Pick game ---
function GamePickStep({ seller, onPick, onBack, locked }) {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["sell-games"],
    queryFn: () => base44.functions.invoke("sellAppPublic", { action: "listGames" }).then(r => r.data.games || []),
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-5">
        {locked ? (
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold font-heading">Olá, {seller.name}!</h1>
            <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm">
              <ArrowLeft className="w-4 h-4" /> Sair
            </button>
          </div>
        ) : (
          <>
            <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-3">
              <ArrowLeft className="w-4 h-4" /> Sair
            </button>
            <h1 className="text-xl font-bold font-heading">Olá, {seller.name}!</h1>
          </>
        )}
        <p className="text-primary-foreground/80 text-sm mt-0.5">Escolha o evento para vender</p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhum jogo disponível no momento.
          </div>
        ) : (
          games.map((game) => (
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

// --- Step 2.5: Configure seller card range ---
function CardRangeStep({ seller, game, onConfirm, onBack }) {
  const [rangeFrom, setRangeFrom] = useState(() => localStorage.getItem(`range_from_${game.id}_${seller.id || seller.name}`) || "");
  const [rangeTo, setRangeTo] = useState(() => localStorage.getItem(`range_to_${game.id}_${seller.id || seller.name}`) || "");

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["sell-cards-range", game.id],
    queryFn: () => base44.functions.invoke("sellAppPublic", { action: "getCards", game_id: String(game.id) }).then(r => r.data.cards || []),
  });

  const totalCards = cards.length;
  const maxCard = cards.length > 0 ? Math.max(...cards.map((c) => c.card_number || 0)) : 0;
  const minCard = cards.length > 0 ? Math.min(...cards.map((c) => c.card_number || 0)) : 1;

  const handleConfirm = () => {
    const from = parseInt(rangeFrom) || null;
    const to = parseInt(rangeTo) || null;
    const key = seller.id || seller.name;
    if (from) localStorage.setItem(`range_from_${game.id}_${key}`, from);
    if (to) localStorage.setItem(`range_to_${game.id}_${key}`, to);
    onConfirm({ from, to });
  };

  const handleSkip = () => {
    onConfirm({ from: null, to: null });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold font-heading">{game.name}</h1>
        <p className="text-primary-foreground/80 text-sm mt-0.5">Defina seu intervalo de cartelas</p>
      </div>

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full space-y-5">

        {isLoading ? (
          <div className="h-16 rounded-xl bg-muted animate-pulse" />
        ) : (
          <div className="bg-card border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span>Total de cartelas no jogo: <strong className="text-foreground">{totalCards}</strong></span>
            </div>
            <div className="text-xs">
              Numeração: <strong className="text-foreground">{String(minCard).padStart(4, "0")}</strong> até <strong className="text-foreground">{String(maxCard).padStart(4, "0")}</strong>
            </div>
          </div>
        )}

        <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm">
          <div>
            <p className="font-semibold font-heading text-base">Suas cartelas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ex: de 0001 a 0300 — deixe em branco para ver todas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cartela inicial</Label>
              <Input
                className="h-12 text-base text-center font-bold"
                type="number"
                inputMode="numeric"
                placeholder="0001"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cartela final</Label>
              <Input
                className="h-12 text-base text-center font-bold"
                type="number"
                inputMode="numeric"
                placeholder={String(maxCard || 300).padStart(4, "0")}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
          </div>

          {rangeFrom && rangeTo && parseInt(rangeFrom) <= parseInt(rangeTo) && (
            <div className="bg-primary/10 rounded-lg p-3 text-center text-sm">
              <span className="font-semibold text-primary">
                {parseInt(rangeTo) - parseInt(rangeFrom) + 1} cartelas
              </span>{" "}
              <span className="text-muted-foreground">
                ({String(parseInt(rangeFrom)).padStart(4, "0")} a {String(parseInt(rangeTo)).padStart(4, "0")})
              </span>
            </div>
          )}

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleConfirm}
            disabled={rangeFrom && rangeTo && parseInt(rangeFrom) > parseInt(rangeTo)}
          >
            <ChevronRight className="w-4 h-4" />
            {rangeFrom || rangeTo ? "Confirmar intervalo" : "Ver todas as cartelas"}
          </Button>
        </div>

        <button
          className="w-full text-center text-sm text-muted-foreground underline underline-offset-2"
          onClick={handleSkip}
        >
          Pular — ver todas as cartelas
        </button>
      </div>
    </div>
  );
}

// --- Step 3: Card selection & sale ---
function SellStep({ seller, game, cardRange, onBack, locked, onLogout, hasBuyerApp }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCard, setSavedCard] = useState(null);
  const [lastSoldBuyerPhone, setLastSoldBuyerPhone] = useState(null);
  const [newCardsCount, setNewCardsCount] = useState(0);
  const [showNewBanner, setShowNewBanner] = useState(false);
  const [goalAlert, setGoalAlert] = useState(null); // { percent: 50 | 100, soldCount, totalRange }
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptFileName, setReceiptFileName] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [transferPhone, setTransferPhone] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferNotFound, setTransferNotFound] = useState(false);
  const [managing, setManaging] = useState(false);
  const [manageMsg, setManageMsg] = useState(null);
  // Após devolver/transferir, esconde as cartelas não vendidas da tela
  const [devolved, setDevolved] = useState(false);

  const storageKey = `last_card_count_${game.id}_${seller.id || seller.name}`;

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["sell-cards", game.id],
    queryFn: () => base44.functions.invoke("sellAppPublic", { action: "getCards", game_id: String(game.id) }).then(r => r.data.cards || []),
  });

  // Load seller distributions to determine assigned range
  const { data: distributions = [] } = useQuery({
    queryKey: ["sell-distributions", game.id, seller.id],
    queryFn: () => base44.functions.invoke("sellAppPublic", { action: "getDistributions", game_id: String(game.id), seller_id: String(seller.id) }).then(r => r.data.distributions || []),
    enabled: !!seller.id,
  });

  // Detect new cards since last visit
  useEffect(() => {
    if (isLoading || cards.length === 0) return;
    const totalAvailable = cards.filter((c) => !c.player_phone && !c.player_city).length;
    const lastCount = parseInt(localStorage.getItem(storageKey) || "0");
    if (totalAvailable > lastCount) {
      setNewCardsCount(totalAvailable - lastCount);
      setShowNewBanner(true);
    }
  }, [isLoading, cards.length]);

  const dismissNewBanner = () => {
    const totalAvailable = cards.filter((c) => !c.player_phone && !c.player_city).length;
    localStorage.setItem(storageKey, String(totalAvailable));
    setShowNewBanner(false);
    setNewCardsCount(0);
  };

  // Distribuições efetivas: SellerDistribution ou intervalo do link (URL).
  // Após devolver/transferir (devolved=true) → sem distribuições, para que
  // as cartelas devolvidas saiam da tela (restam apenas as já vendidas por mim).
  const effectiveDistributions = devolved
    ? []
    : (distributions.length > 0
      ? distributions
      : (cardRange?.from || cardRange?.to)
        ? [{ range_from: cardRange.from, range_to: cardRange.to }]
        : []);

  const inDistribution = (n) =>
    effectiveDistributions.some((d) => n >= (d.range_from || 0) && n <= (d.range_to || Infinity));

  // "Não vendida" = sem comprador. Mostra apenas cartelas vendidas por mim
  // OU cartelas não vendidas dentro da minha distribuição. Cartelas vendidas
  // por outro vendedor nunca aparecem (mesmo que dentro do meu intervalo).
  const isUnsold = (c) => !c.player_phone && !c.player_city;

  const rangeCards = cards
    .filter((c) => {
      if (c.seller_id && c.seller_id === seller.id) return true;   // vendida por mim
      if (c.seller_id && c.seller_id !== seller.id) return false;  // vendida por outro
      return inDistribution(c.card_number || 0);                   // não vendida na minha distribuição
    })
    .sort((a, b) => {
      const aSold = isUnsold(a) ? 0 : 1;
      const bSold = isUnsold(b) ? 0 : 1;
      if (aSold !== bSold) return aSold - bSold; // não vendidas primeiro
      return (a.card_number || 0) - (b.card_number || 0); // ordem numérica dentro do grupo
    });

  const available = rangeCards.filter(isUnsold);
  const pending = rangeCards.filter((c) => !isUnsold(c) && c.payment_status === "pending");
  const sold = rangeCards.filter((c) => !isUnsold(c) && c.payment_status !== "pending");

  const filtered = rangeCards.filter((c) => {
    const q = search.toLowerCase();
    return (
      String(c.card_number).includes(q) ||
      c.player_name?.toLowerCase().includes(q) ||
      c.player_phone?.includes(q)
    );
  });

  const openCard = (card) => {
    setSelectedCard(card);
    const hasBuyer = !!(card.player_phone || card.player_city);
    setBuyerName(hasBuyer ? (card.player_name || "") : "");
    setBuyerPhone(card.player_phone || "");
    setReceiptFile(null);
    setReceiptFileName(null);
    setReceiptPreview(card.payment_receipt_url || null);
  };

  const handlePickReceipt = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptFileName(file.name);
    // Only set image preview for image files
    if (file.type.startsWith("image/")) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview(null);
    }
    e.target.value = "";
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptFileName(null);
  };

  const handleSell = async (asPending = false) => {
    if (!buyerName.trim() || !buyerPhone.trim()) return;
    setSaving(true);

    let receiptBase64 = null;
    let receiptMime = null;
    let clearReceipt = false;

    if (receiptFile) {
      setUploading(true);
      try {
        const reader = new FileReader();
        receiptBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(receiptFile);
        });
        receiptMime = receiptFile.type || 'image/jpeg';
        if (receiptPreview && receiptPreview.startsWith("blob:")) {
          URL.revokeObjectURL(receiptPreview);
        }
      } catch {
        receiptBase64 = null;
      }
      setUploading(false);
    } else if (!receiptFile && receiptPreview === null) {
      clearReceipt = true;
    }

    try {
      await base44.functions.invoke("sellAppPublic", {
        action: "sellCard",
        card_id: String(selectedCard.id),
        player_name: buyerName.trim(),
        player_phone: buyerPhone.trim(),
        seller_id: seller.id || null,
        seller_name: seller.name || null,
        payment_status: asPending ? "pending" : "paid",
        receipt_base64: receiptBase64,
        receipt_mime: receiptMime,
        clear_receipt: clearReceipt,
      });
    } catch (e) {
      setSaving(false);
      return;
    }

    setSaving(false);

    const wasPendingNowPaid = !asPending && selectedCard.payment_status === "pending";
    if (!asPending) {
      setSavedCard(selectedCard);
      setLastSoldBuyerPhone(buyerPhone.trim());
    }
    setSelectedCard(null);
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptFileName(null);
    queryClient.invalidateQueries({ queryKey: ["sell-cards", game.id] });

    // Check milestone alerts only when marking as paid (not pending)
    if (!asPending) {
      const updatedSold = sold.length + (wasPendingNowPaid ? 0 : 1);
      const total = rangeCards.length;
      if (total > 0) {
        const pct = (updatedSold / total) * 100;
        const alreadyAlerted50 = localStorage.getItem(`goal_50_${game.id}_${seller.id || seller.name}`);
        const alreadyAlerted100 = localStorage.getItem(`goal_100_${game.id}_${seller.id || seller.name}`);
        if (pct >= 100 && !alreadyAlerted100) {
          localStorage.setItem(`goal_100_${game.id}_${seller.id || seller.name}`, "1");
          setGoalAlert({ percent: 100, soldCount: updatedSold, totalRange: total });
        } else if (pct >= 50 && !alreadyAlerted50) {
          localStorage.setItem(`goal_50_${game.id}_${seller.id || seller.name}`, "1");
          setGoalAlert({ percent: 50, soldCount: updatedSold, totalRange: total });
        }
      }
      setTimeout(() => { setSavedCard(null); setLastSoldBuyerPhone(null); }, 8000);
    }
  };

  // --- Gerenciar não vendidas: devolver ao sistema ou transferir para outro vendedor ---
  const handleDevolve = async () => {
    setManaging(true);
    setTransferError("");
    try {
      await base44.functions.invoke("sellAppPublic", {
        action: "devolveUnsold",
        game_id: String(game.id),
        seller_id: String(seller.id),
        range_from: cardRange?.from ?? null,
        range_to: cardRange?.to ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["sell-distributions", game.id, seller.id] });
      queryClient.invalidateQueries({ queryKey: ["sell-cards", game.id] });
      setDevolved(true);
      // Limpa o intervalo da URL para a cartela não reaparecer ao recarregar
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("range_from");
        url.searchParams.delete("range_to");
        window.history.replaceState({}, "", url.toString());
      } catch (e) {}
      setShowManage(false);
      setTransferNotFound(false);
      setTransferPhone("");
      setManageMsg("Cartelas não vendidas devolvidas ao sistema.");
      setTimeout(() => setManageMsg(null), 6000);
    } catch (e) {
      setTransferError("Erro ao devolver. Tente novamente.");
    }
    setManaging(false);
  };

  const handleTransfer = async () => {
    const phoneDigits = transferPhone.replace(/\D/g, "");
    if (!phoneDigits) { setTransferError("Informe o telefone do vendedor."); return; }
    setManaging(true);
    setTransferError("");
    try {
      const res = await base44.functions.invoke("sellAppPublic", { action: "validateSeller", phone: phoneDigits });
      const target = res.data.seller;
      if (!target) {
        setTransferNotFound(true);
        setManaging(false);
        return;
      }
      await base44.functions.invoke("sellAppPublic", {
        action: "transferCards",
        game_id: String(game.id),
        seller_id: String(seller.id),
        to_seller_id: String(target.id),
        to_seller_name: target.name,
        range_from: cardRange?.from ?? null,
        range_to: cardRange?.to ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["sell-distributions", game.id, seller.id] });
      queryClient.invalidateQueries({ queryKey: ["sell-cards", game.id] });
      setDevolved(true);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("range_from");
        url.searchParams.delete("range_to");
        window.history.replaceState({}, "", url.toString());
      } catch (e) {}
      setShowManage(false);
      setTransferNotFound(false);
      setTransferPhone("");
      setManageMsg(`Cartelas não vendidas transferidas para ${target.name}.`);
      setTimeout(() => setManageMsg(null), 6000);
    } catch (e) {
      setTransferError("Erro ao transferir. Tente novamente.");
    }
    setManaging(false);
  };

  const rangeLabel = cardRange?.from || cardRange?.to
    ? `${String(cardRange.from || "").padStart(4, "0")}–${String(cardRange.to || "").padStart(4, "0")}`
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-1">
            <ArrowLeft className="w-4 h-4" /> {locked ? 'Voltar' : 'Trocar evento'}
          </button>
          {locked && (
            <button onClick={onLogout} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-2 ml-auto">
              Sair <LogOut className="w-4 h-4" />
            </button>
          )}
        <h1 className="text-lg font-bold font-heading leading-tight">{game.name}</h1>
        <div className="flex flex-wrap gap-2 mt-2 text-sm text-primary-foreground/80 items-center">
          {rangeLabel && (
            <Badge className="bg-white/20 text-white border-0 text-xs gap-1">
              <Hash className="w-3 h-3" /> {rangeLabel}
            </Badge>
          )}
          <span>{rangeCards.length} cartelas</span>
          <span>•</span>
          <span className="text-green-300 font-medium">{sold.length} pagas</span>
          {pending.length > 0 && <><span>•</span><span className="text-amber-300 font-medium">{pending.length} pendentes</span></>}
          <span>•</span>
          <span>{available.length} disponíveis</span>
        </div>
        {available.length > 0 && (
          <button
            onClick={() => { setShowManage(true); setTransferNotFound(false); setTransferError(""); setTransferPhone(""); }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" /> Devolver / Transferir não vendidas
          </button>
        )}
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

      {/* New cards banner */}
      {showNewBanner && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 shrink-0">
            <span className="text-lg">🎉</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Novas cartelas disponíveis!</p>
            <p className="text-xs text-amber-700">
              +{newCardsCount} cartela{newCardsCount !== 1 ? "s" : ""} liberada{newCardsCount !== 1 ? "s" : ""} desde sua última visita
            </p>
          </div>
          <button
            onClick={dismissNewBanner}
            className="text-amber-500 hover:text-amber-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success toast */}
      {savedCard && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Cartela #{String(savedCard.card_number).padStart(4, "0")} vendida com sucesso!
          </div>
          {lastSoldBuyerPhone && (
            <a
              href={`https://wa.me/55${lastSoldBuyerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Olá! Sua cartela #${String(savedCard.card_number).padStart(4, "0")} foi registrada no ${game.name}. Acompanhe o sorteio ao vivo pelo link: ${window.location.origin}/buyer?game_id=${game.id}&phone=${lastSoldBuyerPhone.replace(/\D/g, "")} 🍀`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full justify-center bg-[#25D366] hover:bg-[#1ebe5a] text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar link do sorteio via WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Goal milestone alert */}
      {goalAlert && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
            <span className="text-xl">{goalAlert.percent === 100 ? "🏆" : "🎯"}</span>
            {goalAlert.percent === 100
              ? `Parabéns! Você vendeu 100% das suas cartelas!`
              : `Meta de 50% atingida! ${goalAlert.soldCount} de ${goalAlert.totalRange} cartelas vendidas.`}
          </div>
          {seller.phone && (
            <a
              href={`https://wa.me/55${seller.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                goalAlert.percent === 100
                  ? `🏆 Parabéns ${seller.name}! Você vendeu *100%* das suas cartelas do evento *${game.name}*! Todas as ${goalAlert.totalRange} cartelas foram vendidas. Excelente trabalho!`
                  : `🎯 ${seller.name}, você atingiu *50%* das suas cartelas vendidas no evento *${game.name}*! ${goalAlert.soldCount} de ${goalAlert.totalRange} cartelas vendidas. Continue assim!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full justify-center bg-[#25D366] hover:bg-[#1ebe5a] text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar parabéns via WhatsApp
            </a>
          )}
          <button
            onClick={() => setGoalAlert(null)}
            className="text-xs text-amber-600 underline w-full text-center"
          >
            Fechar
          </button>
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
        ) : rangeCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="text-4xl">📦</div>
            <p className="font-semibold text-foreground">Nenhuma cartela distribuída para você</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Procure o organizador para receber sua distribuição de cartelas.
            </p>
            <Button variant="outline" className="mt-2" onClick={onBack}>
              Voltar
            </Button>
          </div>
        ) : (
          <>
            {!search && available.length > 0 && (
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                Toque para vender
              </p>
            )}
            {!search && rangeCards.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-10">Nenhuma cartela encontrada.</p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {(search ? filtered : rangeCards).map((card) => {
                const hasBuyer = !!(card.player_phone || card.player_city);
                const isPending = hasBuyer && card.payment_status === "pending";
                const isPaid = hasBuyer && !isPending;
                return (
                  <button
                    key={card.id}
                    onClick={() => openCard(card)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 text-center border transition-all active:scale-95
                      ${isPaid
                        ? "bg-green-50 border-green-300 text-green-800"
                        : isPending
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : "bg-card border-border hover:border-primary/60 hover:bg-primary/5"
                      }`}
                  >
                    <span className="text-sm font-bold leading-none">
                      {String(card.card_number || "").padStart(4, "0")}
                    </span>
                    {isPending && <Clock className="w-2.5 h-2.5 mt-0.5 opacity-70" />}
                    {hasBuyer && card.player_name && (
                      <span className="text-[9px] mt-0.5 opacity-70 truncate w-full">
                        {card.player_name.split(" ")[0]}
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
                  Cartela #{String(selectedCard.card_number || "").padStart(4, "0")}
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
                <Label className="text-sm">Telefone / WhatsApp *</Label>
                <Input
                  className="h-12 text-base"
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Comprovante / Anexo</Label>
                {receiptPreview ? (
                  <div className="relative rounded-xl overflow-hidden border bg-muted">
                    <img src={receiptPreview} alt="Comprovante" className="w-full h-36 object-cover" />
                    <button type="button" onClick={handleRemoveReceipt} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : receiptFileName ? (
                  <div className="flex items-center gap-2 h-12 rounded-xl border bg-muted/50 px-3">
                    <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{receiptFileName}</span>
                    <button type="button" onClick={handleRemoveReceipt} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*,application/pdf,.pdf,.doc,.docx"
                      onChange={handlePickReceipt}
                      className="hidden"
                      id="receipt-capture"
                    />
                    <label
                      htmlFor="receipt-capture"
                      className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer text-sm text-muted-foreground"
                    >
                      <Paperclip className="w-5 h-5" />
                      Anexar comprovante
                    </label>
                  </>
                )}
                {/* Also show existing receipt from db if no new file selected */}
                {!receiptFile && !receiptFileName && selectedCard?.payment_receipt_url && (
                  <a href={selectedCard.payment_receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                    Ver comprovante atual
                  </a>
                )}
              </div>
            </div>

            {/* Payment status indicator for existing pending */}
            {selectedCard?.payment_status === "pending" && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                <Clock className="w-4 h-4 shrink-0" />
                Esta cartela está pendente de pagamento.
              </div>
            )}

            <div className="space-y-2">
              {/* Primary action: paid or confirm payment */}
              <Button
                className="w-full h-12 text-base gap-2"
                onClick={() => handleSell(false)}
                disabled={!buyerName.trim() || !buyerPhone.trim() || saving || uploading}
              >
                {uploading || saving ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />{uploading ? "Enviando..." : "Registrando..."}</>
                ) : selectedCard?.payment_status === "pending" ? (
                  <><BadgeCheck className="w-5 h-5" /> Confirmar Pagamento</>
                ) : (
                  <><ShoppingCart className="w-5 h-5" /> Confirmar Venda (Pago)</>
                )}
              </Button>

              {/* Secondary: save as pending (only if not already pending) */}
              {selectedCard?.payment_status !== "pending" && (
                <Button
                  variant="outline"
                  className="w-full h-11 text-sm gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleSell(true)}
                  disabled={!buyerName.trim() || !buyerPhone.trim() || saving || uploading}
                >
                  <Clock className="w-4 h-4" /> Salvar como Pendente
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              🟡 Pendente = aguardando pagamento &nbsp;|&nbsp; 🟢 Pago = confirmado no sistema
            </p>
          </div>
        </div>
      )}

      {/* Toast de gestão */}
      {manageMsg && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {manageMsg}
        </div>
      )}

      {/* Modal: Devolver / Transferir não vendidas */}
      {showManage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => { if (!managing) { setShowManage(false); setTransferNotFound(false); } }}>
          <div className="bg-background rounded-t-2xl w-full max-w-md p-5 pb-10 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg font-heading">Gerenciar Não Vendidas</h2>
              <button onClick={() => { if (!managing) { setShowManage(false); setTransferNotFound(false); } }} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Você tem <strong className="text-foreground">{available.length} cartela(s) não vendida(s)</strong> na sua distribuição.
            </p>

            {!transferNotFound ? (
              <>
                <Button
                  variant="outline"
                  className="w-full h-12 gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={handleDevolve}
                  disabled={managing || available.length === 0}
                >
                  {managing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Devolver não vendidas ao sistema
                </Button>

                <div className="space-y-2">
                  <Label className="text-sm">Transferir para outro vendedor (telefone)</Label>
                  <Input
                    className="h-12 text-base"
                    placeholder="(00) 00000-0000"
                    value={transferPhone}
                    onChange={(e) => { setTransferPhone(maskPhone(e.target.value)); setTransferError(""); }}
                    inputMode="numeric"
                  />
                  <Button
                    className="w-full h-12 gap-2"
                    onClick={handleTransfer}
                    disabled={managing || available.length === 0 || !transferPhone.replace(/\D/g, "")}
                  >
                    {managing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Transferir não vendidas
                  </Button>
                </div>
                {transferError && <p className="text-sm text-destructive">{transferError}</p>}
              </>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                  Telefone não cadastrado no sistema. Deseja <strong>devolver</strong> as cartelas não vendidas ao sistema?
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => { setTransferNotFound(false); setTransferPhone(""); setTransferError(""); }}
                    disabled={managing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-12 gap-2"
                    onClick={handleDevolve}
                    disabled={managing}
                  >
                    {managing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Sim, devolver
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// --- Main orchestrator ---
export default function SellApp() {
  // Read URL params (pre-filled link from DistributeCardsModal)
  const urlParams = new URLSearchParams(window.location.search);
  const urlSellerName = urlParams.get("seller_name");
  const urlSellerPhone = urlParams.get("seller_phone");
  const urlSellerId = urlParams.get("seller_id");
  const urlGameId = urlParams.get("game_id");
  const urlRangeFrom = urlParams.get("range_from");
  const urlRangeTo = urlParams.get("range_to");

  const lockedSeller = !!urlSellerName; // via link — seller is locked, cannot switch

  const [seller, setSeller] = useState(() => {
    if (urlSellerName) {
      localStorage.setItem("seller_name", urlSellerName);
      localStorage.setItem("seller_phone", urlSellerPhone || "");
      localStorage.setItem("seller_id", urlSellerId || "");
      return { name: urlSellerName, phone: urlSellerPhone || "", id: urlSellerId || "" };
    }
    const name = localStorage.getItem("seller_name");
    const phone = localStorage.getItem("seller_phone");
    const id = localStorage.getItem("seller_id");
    return name ? { name, phone: phone || "", id: id || "" } : null;
  });

  const [loggedOut, setLoggedOut] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("seller_name");
    localStorage.removeItem("seller_phone");
    localStorage.removeItem("seller_id");
    setSeller(null);
    setGame(null);
    setCardRange(urlRange);
    if (lockedSeller) setLoggedOut(true);
  };

  // If URL has range, skip the range step
  const urlRange = urlRangeFrom || urlRangeTo
    ? { from: parseInt(urlRangeFrom) || null, to: parseInt(urlRangeTo) || null }
    : null;

  const [cardRange, setCardRange] = useState(urlRange);

  // If URL has game_id, load that game directly
  const { data: preloadedGame } = useQuery({
    queryKey: ["sell-preloaded-game", urlGameId],
    queryFn: () => base44.functions.invoke("sellAppPublic", { action: "getGame", game_id: String(urlGameId) }).then(r => r.data.game || null),
    enabled: !!urlGameId,
  });

  const [game, setGame] = useState(null);
  const resolvedGame = game || (urlGameId ? preloadedGame : null);

  const hasBuyerApp = false;

  if (loggedOut) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-primary/10 to-background items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold font-heading mb-2">Sessão Encerrada</h1>
          <p className="text-muted-foreground text-sm mb-6">Suas vendas foram registradas com sucesso.</p>
          <Button
            className="w-full h-12 text-base"
            onClick={() => { setLoggedOut(false); setSeller(null); }}
          >
            Entrar novamente
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-base mt-3 gap-2"
            onClick={() => window.close()}
          >
            <LogOut className="w-4 h-4" />
            Sair do aplicativo
          </Button>
        </div>
      </div>
    );
  }

  if (!seller) {
    return <SellerStep onEnter={setSeller} locked={lockedSeller} />;
  }

  if (!resolvedGame) {
    return (
      <GamePickStep
        seller={seller}
        onPick={(g) => { setGame(g); if (!urlRange) setCardRange(null); }}
        onBack={handleLogout}
        locked={lockedSeller}
      />
    );
  }

  return (
    <SellStep
      seller={seller}
      game={resolvedGame}
      cardRange={cardRange}
      onBack={() => { if (lockedSeller) { setCardRange(null); } else { setGame(null); setCardRange(urlRange); } }}
      locked={lockedSeller}
      onLogout={handleLogout}
      hasBuyerApp={hasBuyerApp}
    />
  );
}