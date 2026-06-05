import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X, Copy, Check, MessageCircle, ChevronDown, Hash,
  Link2, Users, Layers, AlertCircle
} from "lucide-react";

function SellerRow({ seller, game, maxCard, minCard, allAssignments, onChange }) {
  const assignment = allAssignments[seller.id] || { from: "", to: "" };
  const [copied, setCopied] = useState(false);

  const from = parseInt(assignment.from) || null;
  const to = parseInt(assignment.to) || null;
  const valid = from && to && from <= to;
  const count = valid ? to - from + 1 : 0;

  // Build the pre-filled link
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  params.set("seller_name", seller.name);
  params.set("seller_phone", seller.phone || "");
  params.set("seller_id", seller.id);
  if (valid) {
    params.set("range_from", from);
    params.set("range_to", to);
  }
  const link = `${appUrl}/sell?${params.toString()}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const phone = seller.phone?.replace(/\D/g, "");
    const rangeText = valid
      ? `de *${String(from).padStart(4, "0")}* a *${String(to).padStart(4, "0")}* (${count} cartelas)`
      : "(todas as cartelas)";
    const msg = `Olá ${seller.name}! 👋\n\nSeu link para registrar vendas do *${game.name}*:\n\n${link}\n\nSuas cartelas: ${rangeText}\n\nBoas vendas! 🎉`;
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm font-heading">{seller.name}</p>
          {seller.phone && <p className="text-xs text-muted-foreground">{seller.phone}</p>}
        </div>
        {valid && (
          <Badge className="bg-primary/10 text-primary border-0 text-xs">
            {count} cartelas
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Cartela inicial</p>
          <Input
            type="number"
            inputMode="numeric"
            className="h-10 text-center font-bold text-base"
            placeholder={String(minCard).padStart(4, "0")}
            value={assignment.from}
            onChange={(e) => onChange(seller.id, "from", e.target.value)}
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Cartela final</p>
          <Input
            type="number"
            inputMode="numeric"
            className="h-10 text-center font-bold text-base"
            placeholder={String(maxCard).padStart(4, "0")}
            value={assignment.to}
            onChange={(e) => onChange(seller.id, "to", e.target.value)}
          />
        </div>
      </div>

      {from && to && from > to && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Cartela inicial deve ser menor que a final
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}

export default function DistributeCardsModal({ onClose }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [autoFrom, setAutoFrom] = useState("");
  const [autoQty, setAutoQty] = useState("");

  const { data: games = [] } = useQuery({
    queryKey: ["dist-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["dist-sellers"],
    queryFn: () => base44.entities.Seller.filter({ is_active: true }, "name"),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["dist-cards", selectedGame?.id],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(selectedGame.id) }),
    enabled: !!selectedGame,
  });

  const maxCard = cards.length > 0 ? Math.max(...cards.map((c) => c.card_number || 0)) : 999;
  const minCard = cards.length > 0 ? Math.min(...cards.map((c) => c.card_number || 0)) : 1;

  const handleChange = (sellerId, field, value) => {
    setAssignments((prev) => ({
      ...prev,
      [sellerId]: { ...(prev[sellerId] || {}), [field]: value },
    }));
  };

  // Auto-distribute: starting from autoFrom, give autoQty to each seller in order
  const handleAutoDistribute = () => {
    const start = parseInt(autoFrom) || minCard;
    const qty = parseInt(autoQty);
    if (!qty || sellers.length === 0) return;
    const newAssignments = {};
    sellers.forEach((s, i) => {
      const from = start + i * qty;
      const to = from + qty - 1;
      newAssignments[s.id] = { from: String(from), to: String(to) };
    });
    setAssignments(newAssignments);
  };

  const activeGames = games.filter((g) => g.status !== "finished");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="font-bold font-heading flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Distribuir Cartelas por Vendedor
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Gere links personalizados para cada vendedor</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Game selector */}
          <div>
            <p className="text-sm font-medium mb-1.5">Selecionar jogo</p>
            <div className="relative">
              <button
                className="w-full flex items-center justify-between h-11 px-3 rounded-lg border border-input bg-background text-sm hover:bg-accent transition-colors"
                onClick={() => setShowGamePicker((v) => !v)}
              >
                <span className={selectedGame ? "text-foreground" : "text-muted-foreground"}>
                  {selectedGame?.name || "Escolha um jogo..."}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showGamePicker && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg max-h-48 overflow-auto">
                  {activeGames.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">Nenhum jogo ativo</div>
                  ) : (
                    activeGames.map((g) => (
                      <button
                        key={g.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm"
                        onClick={() => { setSelectedGame(g); setShowGamePicker(false); setAssignments({}); }}
                      >
                        {g.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedGame && (
            <>
              {/* Info */}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" />
                  {cards.length} cartelas ({String(minCard).padStart(4,"0")}–{String(maxCard).padStart(4,"0")})
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {sellers.length} vendedores ativos
                </span>
              </div>

              {/* Auto-distribute */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Distribuição automática</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Começar na cartela</p>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-10 text-center"
                      placeholder={String(minCard).padStart(4, "0")}
                      value={autoFrom}
                      onChange={(e) => setAutoFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Qtde por vendedor</p>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-10 text-center"
                      placeholder="100"
                      value={autoQty}
                      onChange={(e) => setAutoQty(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleAutoDistribute}
                  disabled={!autoQty || sellers.length === 0}
                >
                  <Link2 className="w-3.5 h-3.5" /> Distribuir automaticamente
                </Button>
              </div>

              {/* Seller rows */}
              {sellers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum vendedor cadastrado. Cadastre vendedores primeiro.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendedores</p>
                  {sellers.map((seller) => (
                    <SellerRow
                      key={seller.id}
                      seller={seller}
                      game={selectedGame}
                      maxCard={maxCard}
                      minCard={minCard}
                      allAssignments={assignments}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}