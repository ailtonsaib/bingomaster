import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ShoppingCart, User, Phone, MapPin,
  ChevronRight, ArrowLeft, Search, TicketCheck, X,
  ChevronDown, UserCheck, Hash, Download, Camera, Trash2, Loader2
} from "lucide-react";

// --- Step 1: Seller identification ---
function SellerStep({ onEnter, locked }) {
  const [name, setName] = useState(() => localStorage.getItem("seller_name") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("seller_phone") || "");
  const [sellerId, setSellerId] = useState(() => localStorage.getItem("seller_id") || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState("");

  const { data: sellers = [] } = useQuery({
    queryKey: ["sell-sellers"],
    queryFn: () => base44.entities.Seller.filter({ is_active: true }, "name"),
  });

  const filtered = sellers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const selectSeller = (s) => {
    setName(s.name);
    setPhone(s.phone || "");
    setSellerId(s.id);
    setShowDropdown(false);
    setSearch("");
  };

  const handleContinue = () => {
    if (!name.trim()) return;
    localStorage.setItem("seller_name", name.trim());
    localStorage.setItem("seller_phone", phone.trim());
    localStorage.setItem("seller_id", sellerId);
    onEnter({ name: name.trim(), phone: phone.trim(), id: sellerId });
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
          {/* Seller picker — hidden when locked via link */}
          {!locked && sellers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Selecionar vendedor cadastrado</Label>
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between h-12 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
                  onClick={() => setShowDropdown((v) => !v)}
                >
                  <span className={name ? "text-foreground" : "text-muted-foreground"}>
                    {name || "Escolha um vendedor..."}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {showDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-56 overflow-auto">
                    <div className="p-2 border-b sticky top-0 bg-background">
                      <Input
                        placeholder="Buscar vendedor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 text-sm"
                        autoFocus
                      />
                    </div>
                    {filtered.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">Nenhum vendedor encontrado</div>
                    ) : (
                      filtered.map((s) => (
                        <button
                          key={s.id}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm flex flex-col"
                          onClick={() => selectSeller(s)}
                        >
                          <span className="font-medium">{s.name}</span>
                          {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                        </button>
                      ))
                    )}
                    <button
                      className="w-full text-left px-3 py-2.5 text-xs text-primary border-t hover:bg-muted"
                      onClick={() => { setName(""); setPhone(""); setSellerId(""); setShowDropdown(false); }}
                    >
                      + Digitar manualmente
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Seu nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-12 text-base"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => { setName(e.target.value); setSellerId(""); }}
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
function GamePickStep({ seller, onPick, onBack, locked }) {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["sell-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const active = games.filter((g) => g.status !== "finished");

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

// --- Step 2.5: Configure seller card range ---
function CardRangeStep({ seller, game, onConfirm, onBack }) {
  const [rangeFrom, setRangeFrom] = useState(() => localStorage.getItem(`range_from_${game.id}_${seller.id || seller.name}`) || "");
  const [rangeTo, setRangeTo] = useState(() => localStorage.getItem(`range_to_${game.id}_${seller.id || seller.name}`) || "");

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["sell-cards-range", game.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(game.id) }),
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

// --- Export Sold Cards Modal ---
function ExportSoldModal({ game, seller, soldCards, onClose, onExported }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const data = soldCards.map((c) => ({
      card_number: c.card_number,
      player_name: c.player_name,
      player_phone: c.player_phone || "",
      player_city: c.player_city || "",
      player_state: c.player_state || "",
      chances: c.chances,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `cartelas-vendidas-${game.name.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Mark cards as exported
    const now = new Date().toISOString();
    await Promise.all(soldCards.map((c) =>
      base44.entities.BingoCard.update(c.id, { exported_date: now })
    ));
    setExporting(false);
    onExported();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading">Exportar Cartelas Vendidas</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {soldCards.length} cartela(s) vendida(s)
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={soldCards.length === 0 || exporting} className="flex-1 gap-2">
            <Download className="w-4 h-4" />
            {exporting ? "Exportando..." : `Exportar ${soldCards.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Step 3: Card selection & sale ---
function SellStep({ seller, game, cardRange, onBack, locked, onLogout }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCard, setSavedCard] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [newCardsCount, setNewCardsCount] = useState(0);
  const [showNewBanner, setShowNewBanner] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const storageKey = `last_card_count_${game.id}_${seller.id || seller.name}`;

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["sell-cards", game.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(game.id) }),
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

  // Apply range filter and sort by card_number
  const rangeCards = cards
    .filter((c) => {
      if (!cardRange?.from && !cardRange?.to) return true;
      const n = c.card_number || 0;
      if (cardRange.from && n < cardRange.from) return false;
      if (cardRange.to && n > cardRange.to) return false;
      return true;
    })
    .sort((a, b) => (a.card_number || 0) - (b.card_number || 0));

  const available = rangeCards.filter((c) => !c.player_phone && !c.player_city);
  const sold = rangeCards.filter((c) => c.player_phone || c.player_city);
  // Only unexported sold cards for the export button
  const soldNotExported = sold.filter((c) => !c.exported_date);

  const filtered = rangeCards
    .filter((c) => {
      const q = search.toLowerCase();
      return (
        String(c.card_number).includes(q) ||
        c.player_name?.toLowerCase().includes(q) ||
        c.player_phone?.includes(q)
      );
    })
    .sort((a, b) => (a.card_number || 0) - (b.card_number || 0));

  const openCard = (card) => {
    setSelectedCard(card);
    const hasBuyer = !!(card.player_phone || card.player_city);
    setBuyerName(hasBuyer ? (card.player_name || "") : "");
    setBuyerPhone(card.player_phone || "");
    setBuyerAddress(card.player_city || "");
    setReceiptFile(null);
    setReceiptPreview(card.payment_receipt_url || null);
  };

  const handlePickReceipt = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleSell = async () => {
    if (!buyerName.trim()) return;
    setSaving(true);

    let receiptUrl = selectedCard.payment_receipt_url || null;
    if (receiptFile) {
      setUploading(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: receiptFile });
        receiptUrl = file_url;
        if (receiptPreview && receiptPreview.startsWith("blob:")) {
          URL.revokeObjectURL(receiptPreview);
        }
      } catch {
        // continua sem o comprovante se falhar
      }
      setUploading(false);
    } else if (!receiptFile && receiptPreview === null) {
      receiptUrl = null;
    }

    const updateData = {
      player_name: buyerName.trim(),
      player_phone: buyerPhone.trim(),
      player_city: buyerAddress.trim(),
    };
    if (receiptUrl !== selectedCard.payment_receipt_url) {
      updateData.payment_receipt_url = receiptUrl;
    }

    await base44.entities.BingoCard.update(selectedCard.id, updateData);
    setSaving(false);
    setSavedCard(selectedCard);
    setSelectedCard(null);
    setReceiptFile(null);
    setReceiptPreview(null);
    queryClient.invalidateQueries({ queryKey: ["sell-cards", game.id] });
    setTimeout(() => setSavedCard(null), 3000);
  };

  const rangeLabel = cardRange?.from || cardRange?.to
    ? `${String(cardRange.from || "").padStart(4, "0")}–${String(cardRange.to || "").padStart(4, "0")}`
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-10 pb-4">
        {locked ? (
          <div className="flex items-center justify-between mb-2">
            <span className="text-primary-foreground/80 text-sm">🔒 {seller.name}</span>
            <button onClick={onLogout} className="flex items-center gap-1 text-primary-foreground/80 text-sm">
              <ArrowLeft className="w-4 h-4" /> Sair
            </button>
          </div>
        ) : (
          <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/80 text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Trocar evento
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
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Cartela #{String(savedCard.card_number).padStart(4, "0")} vendida com sucesso!
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
        ) : rangeCards.length === 0 && (cardRange?.from || cardRange?.to) ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="text-4xl">🔍</div>
            <p className="font-semibold text-foreground">Nenhuma cartela neste intervalo</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              O intervalo {String(cardRange.from || "").padStart(4,"0")}–{String(cardRange.to || "").padStart(4,"0")} não tem cartelas cadastradas.
            </p>
            <Button variant="outline" className="mt-2" onClick={onBack}>
              Alterar intervalo
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
                      {String(card.card_number || "").padStart(4, "0")}
                    </span>
                    {isSold && card.player_name && (
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

              <div className="space-y-1.5">
                <Label className="text-sm">Comprovante de pagamento</Label>
                {receiptPreview ? (
                  <div className="relative rounded-xl overflow-hidden border bg-muted">
                    <img
                      src={receiptPreview}
                      alt="Comprovante"
                      className="w-full h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePickReceipt}
                      className="hidden"
                      id="receipt-capture"
                    />
                    <label
                      htmlFor="receipt-capture"
                      className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer text-sm text-muted-foreground"
                    >
                      <Camera className="w-5 h-5" />
                      Abrir câmera
                    </label>
                  </>
                )}
              </div>
            </div>

            <Button
              className="w-full h-12 text-base gap-2"
              onClick={handleSell}
              disabled={!buyerName.trim() || saving || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando foto...
                </>
              ) : saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Confirmar Venda
                </>
              )}
            </Button>

            {soldNotExported.length > 0 && (
              <Button
                variant="outline"
                className="w-full h-12 text-base gap-2 mt-2"
                onClick={() => setShowExport(true)}
              >
                <Download className="w-4 h-4" />
                Exportar {soldNotExported.length} Nova(s) Cartela(s)
              </Button>
            )}
            {soldNotExported.length === 0 && sold.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Todas as {sold.length} cartelas vendidas já foram exportadas.
              </p>
            )}
          </div>
        </div>
      )}

      {showExport && (
        <ExportSoldModal
          game={game}
          seller={seller}
          soldCards={soldNotExported}
          onClose={() => setShowExport(false)}
          onExported={() => queryClient.invalidateQueries({ queryKey: ["sell-cards", game.id] })}
        />
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
    queryFn: () => base44.entities.BingoGame.filter({ id: urlGameId }).then((r) => r[0] || null),
    enabled: !!urlGameId,
  });

  const [game, setGame] = useState(null);
  const resolvedGame = game || (urlGameId ? preloadedGame : null);

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

  if (cardRange === null) {
    return (
      <CardRangeStep
        seller={seller}
        game={resolvedGame}
        onConfirm={(range) => setCardRange(range)}
        onBack={() => setGame(null)}
      />
    );
  }

  return (
    <SellStep
      seller={seller}
      game={resolvedGame}
      cardRange={cardRange}
      onBack={() => { setGame(null); setCardRange(urlRange); }}
      locked={lockedSeller}
      onLogout={handleLogout}
    />
  );
}