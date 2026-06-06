import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Printer, MessageCircle } from "lucide-react";

export default function SellerReceiptModal({ seller, onClose }) {
  const printRef = useRef(null);

  const { data: allCards = [], isLoading } = useQuery({
    queryKey: ["all-cards-receipt"],
    queryFn: () => base44.entities.BingoCard.list(),
  });

  const { data: games = [] } = useQuery({
    queryKey: ["games"],
    queryFn: () => base44.entities.BingoGame.list(),
  });

  // Cards assigned to this seller (by phone or city match)
  const sellerCards = allCards.filter(
    (c) => c.player_phone === seller.phone || (seller.phone && c.player_phone === seller.phone) || c.player_city === seller.city
  ).filter((c) => seller.phone ? c.player_phone === seller.phone : c.player_city === seller.city && c.player_name?.toLowerCase().includes(""));

  // Better: match by phone (primary) or city+state combo
  const matchedCards = allCards.filter((c) => {
    if (seller.phone && c.player_phone === seller.phone) return true;
    return false;
  });

  // Group by game
  const byGame = {};
  matchedCards.forEach((c) => {
    if (!byGame[c.game_id]) byGame[c.game_id] = [];
    byGame[c.game_id].push(c);
  });

  const gameMap = {};
  games.forEach((g) => { gameMap[g.id] = g; });

  const totalCards = matchedCards.length;

  const getGamePrice = (gameId) => {
    const game = gameMap[gameId];
    if (!game?.event_price) return null;
    const price = parseFloat(game.event_price.replace(/[^0-9.,]/g, "").replace(",", "."));
    return isNaN(price) ? null : price;
  };

  const totalValue = Object.entries(byGame).reduce((sum, [gameId, cards]) => {
    const price = getGamePrice(gameId);
    return sum + (price ? price * cards.length : 0);
  }, 0);

  const formatCurrency = (val) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const today = new Date().toLocaleDateString("pt-BR");

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Recibo - ${seller.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .sub { color: #555; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #f3f3f3; text-align: left; padding: 6px 10px; font-size: 13px; border-bottom: 2px solid #ddd; }
        td { padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #eee; }
        .total-row td { font-weight: bold; background: #f9f9f9; border-top: 2px solid #ccc; }
        .signature { margin-top: 48px; display: flex; justify-content: space-between; }
        .sig-line { border-top: 1px solid #333; width: 220px; text-align: center; padding-top: 6px; font-size: 12px; }
        .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; }
      </style></head><body>
      ${content}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleWhatsApp = () => {
    let msg = `*RECIBO DE CARTELAS DE BINGO*\n`;
    msg += `Vendedor: ${seller.name}\n`;
    msg += `Data: ${today}\n\n`;

    Object.entries(byGame).forEach(([gameId, cards]) => {
      const game = gameMap[gameId];
      const price = getGamePrice(gameId);
      msg += `🎱 *${game?.name || "Jogo"}*\n`;
      msg += `  Cartelas: ${cards.length}\n`;
      if (price) msg += `  Valor unitário: ${formatCurrency(price)}\n`;
      if (price) msg += `  Subtotal: ${formatCurrency(price * cards.length)}\n`;
      msg += `\n`;
    });

    if (totalValue > 0) {
      msg += `💰 *TOTAL GERAL: ${formatCurrency(totalValue)}*\n`;
    } else {
      msg += `📦 *Total de cartelas: ${totalCards}*\n`;
    }

    msg += `\nAo receber este recibo, o vendedor confirma a responsabilidade pelas cartelas listadas.`;

    const phone = seller.phone?.replace(/\D/g, "");
    const url = `https://wa.me/${phone ? "55" + phone : ""}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-base font-heading">Recibo do Vendedor</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <div ref={printRef}>
              <h1 className="text-xl font-bold font-heading">Recibo de Cartelas de Bingo</h1>
              <div className="text-sm text-muted-foreground mb-4">Emitido em: {today}</div>

              <div className="bg-muted/40 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><span className="font-medium">Vendedor:</span> {seller.name}</div>
                {seller.phone && <div><span className="font-medium">Telefone:</span> {seller.phone}</div>}
                {seller.city && <div><span className="font-medium">Cidade:</span> {[seller.city, seller.state].filter(Boolean).join(" - ")}</div>}
              </div>

              {matchedCards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma cartela encontrada para este vendedor.<br />
                  <span className="text-xs">(Cartelas são associadas pelo telefone do vendedor)</span>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm border-collapse mb-4">
                    <thead>
                      <tr className="border-b-2 border-border">
                        <th className="text-left py-2 font-semibold">Jogo</th>
                        <th className="text-center py-2 font-semibold">Cartelas</th>
                        <th className="text-right py-2 font-semibold">Valor Unit.</th>
                        <th className="text-right py-2 font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byGame).map(([gameId, cards]) => {
                        const game = gameMap[gameId];
                        const price = getGamePrice(gameId);
                        return (
                          <tr key={gameId} className="border-b border-border/50">
                            <td className="py-2">{game?.name || "—"}</td>
                            <td className="py-2 text-center font-mono">{cards.length}</td>
                            <td className="py-2 text-right">{price ? formatCurrency(price) : "—"}</td>
                            <td className="py-2 text-right font-medium">
                              {price ? formatCurrency(price * cards.length) : `${cards.length} cart.`}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-muted/40 font-bold">
                        <td className="py-2 pl-1">TOTAL</td>
                        <td className="py-2 text-center font-mono">{totalCards}</td>
                        <td></td>
                        <td className="py-2 text-right text-primary">
                          {totalValue > 0 ? formatCurrency(totalValue) : `${totalCards} cartelas`}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-8 flex justify-between text-xs text-muted-foreground">
                    <div className="border-t border-foreground/40 w-40 pt-2 text-center">Assinatura do Vendedor</div>
                    <div className="border-t border-foreground/40 w-40 pt-2 text-center">Assinatura do Responsável</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint} disabled={isLoading || matchedCards.length === 0}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleWhatsApp}
            disabled={isLoading || matchedCards.length === 0}
          >
            <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}