import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trash2, Link2, QrCode, ExternalLink } from "lucide-react";
import QRCode from "qrcode.react";
import AddSellerSection from "./AddSellerSection";

// ─── QR Modal ───────────────────────────────────────────────────────────────
function QrModal({ link, name, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-bold text-base text-center">{name}</p>
        <QRCode value={link} size={200} />
        <p className="text-xs text-gray-500 break-all text-center">{link}</p>
        <Button className="w-full" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

// ─── Seller Card ─────────────────────────────────────────────────────────────
function SellerCard({ seller, game, existingCards, onDelete }) {
  const [showQr, setShowQr] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fromN = seller.from || null;
  const toN = seller.to || null;
  const valid = fromN && toN && fromN <= toN;
  const count = valid ? toN - fromN + 1 : 0;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  params.set("seller_name", seller.name);
  params.set("seller_phone", seller.phone || "");
  params.set("seller_id", seller.id);
  params.set("game_id", game.id);
  if (valid) { params.set("range_from", fromN); params.set("range_to", toN); }
  const link = `${appUrl}/sell?${params.toString()}`;

  const handleDelete = async () => {
    if (!window.confirm(`Excluir distribuição de ${seller.name}?`)) return;
    setDeleting(true);
    const cardsInRange = existingCards.filter((c) => {
      const n = c.card_number || 0;
      return fromN && toN && n >= fromN && n <= toN;
    });
    await Promise.all(cardsInRange.map((c) =>
      base44.entities.BingoCard.update(c.id, { seller_id: null, seller_name: null })
    ));
    setDeleting(false);
    onDelete();
  };

  return (
    <>
      {showQr && <QrModal link={link} name={seller.name} onClose={() => setShowQr(false)} />}
      <div className="border rounded-xl p-4 bg-white space-y-3">
        {/* Top row: name + range + trash */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="font-bold text-sm uppercase">{seller.name}</p>
            {valid && (
              <>
                <p className="text-xs text-primary">Cartelas: {fromN} até {toN}</p>
                <p className="text-xs text-green-600">Total: {count} cartelas</p>
              </>
            )}
          </div>
          <button
            className="text-red-400 hover:text-red-600 p-1"
            onClick={handleDelete}
            disabled={deleting}
            title="Excluir distribuição"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white gap-1 text-xs"
            onClick={() => window.open(link, "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Testar
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            <Link2 className="w-3.5 h-3.5" /> Link
          </Button>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1 text-xs"
            onClick={() => setShowQr(true)}
          >
            <QrCode className="w-3.5 h-3.5" /> QR
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────
export default function DistributeCardsModal({ onClose }) {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState(null);
  // assigned = [{seller, from, to}] — only those added via the button
  const [assigned, setAssigned] = useState([]);

  const { data: games = [] } = useQuery({
    queryKey: ["dist-games"],
    queryFn: () => base44.entities.BingoGame.list("-created_date"),
  });

  const { data: dbSellers = [] } = useQuery({
    queryKey: ["dist-sellers"],
    queryFn: () => base44.entities.Seller.filter({ is_active: true }, "name"),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["dist-cards", selectedGame?.id],
    queryFn: () => base44.functions.invoke("getGameCards", { game_id: String(selectedGame.id) }).then(r => r.data.cards),
    enabled: !!selectedGame,
  });

  // All db sellers available for the dropdown
  const allSellers = dbSellers;

  const distributedCount = assigned.reduce((acc, a) => acc + (a.to - a.from + 1), 0);

  const activeGames = games.filter((g) => g.status !== "finished");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>🎟</span>
            <span className="font-semibold">Selecione o Evento</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Game selector */}
          <div className="px-5 pt-4 pb-3 border-b">
            <select
              className="w-full h-11 rounded-lg border-2 border-purple-400 bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={selectedGame?.id || ""}
              onChange={(e) => {
                const g = games.find((x) => x.id === e.target.value);
                setSelectedGame(g || null);
              }}
            >
              <option value="">Escolha um evento...</option>
              {activeGames.map((g) => (
                <option key={g.id} value={g.id}>{g.name}{g.event_date ? ` - ${g.event_date.slice(0,10)}` : ""}</option>
              ))}
            </select>
          </div>

          {selectedGame && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 border-b">
                {[
                  { label: "Cartelas Geradas:", value: cards.length, color: "text-purple-600" },
                  { label: "Distribuídas:", value: distributedCount, color: "text-purple-600" },
                  { label: "Vendedores:", value: assigned.length, color: "text-green-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col px-5 py-3 border-r last:border-r-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-xl font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Add seller */}
              <AddSellerSection
                sellers={allSellers}
                cards={cards}
                assigned={assigned}
                onAdd={async (seller, from, to) => {
                  // Persist seller_id on cards in the assigned range
                  const cardsInRange = cards.filter((c) => {
                    const n = c.card_number || 0;
                    return n >= from && n <= to;
                  });
                  await Promise.all(cardsInRange.map((c) =>
                    base44.entities.BingoCard.update(c.id, { seller_id: seller.id, seller_name: seller.name })
                  ));
                  queryClient.invalidateQueries({ queryKey: ["dist-cards", selectedGame?.id] });
                  
                  setAssigned((prev) => {
                    const filtered = prev.filter((a) => a.seller.id !== seller.id);
                    return [...filtered, { seller, from, to }];
                  });
                }}
              />

              {/* Assigned sellers list — only those added via button */}
              {assigned.length > 0 && (
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">Vendedores com Distribuição:</p>
                  {assigned.map(({ seller, from, to }) => (
                    <SellerCard
                      key={seller.id}
                      seller={{ ...seller, from, to }}
                      game={selectedGame}
                      existingCards={cards}
                      onDelete={() => setAssigned((prev) => prev.filter((a) => a.seller.id !== seller.id))}
                    />
                  ))}
                </div>
              )}

              {assigned.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Selecione um vendedor, informe o intervalo de cartelas e clique em Adicionar.
                </p>
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