import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer } from "lucide-react";
import PrintA4Sheet from "@/components/bingo/PrintA4Sheet";

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function PrintCards() {
  const { gameId } = useParams();
  const printRef = useRef();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [cards, setCards] = useState(null); // null = ainda nao carregou
  const [isLoading, setIsLoading] = useState(false);
  const [rangeLabel, setRangeLabel] = useState("");
  const [showButtons, setShowButtons] = useState(false);

  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
  });

  const { data: totalCards } = useQuery({
    queryKey: ["game-total-cards", gameId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getGameCards", { game_id: String(gameId) });
      return (res.data.cards || []).length;
    },
  });

  const handleLoadRange = async () => {
    const from = parseInt(rangeFrom);
    const to = parseInt(rangeTo);
    if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
      alert("Insira um intervalo válido (ex: 1 até 200)");
      return;
    }
    setIsLoading(true);
    setCards(null);
    const res = await base44.functions.invoke("getGameCards", {
      game_id: String(gameId),
      range_from: from,
      range_to: to,
    });
    setCards(res.data.cards || []);
    setRangeLabel(`${from} até ${to}`);
    setShowButtons(true);
    setIsLoading(false);
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 200);
  };

  const CARDS_PER_PAGE = 1;
  const prizes = game?.prizes || [];
  const sortedCards = cards ? [...cards].sort((a, b) => (a.card_number || 0) - (b.card_number || 0)) : [];
  const pages = chunkArray(sortedCards, CARDS_PER_PAGE);

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="no-print bg-background border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            to={`/cards/${gameId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar às Cartelas
          </Link>
          <span className="text-sm font-semibold">
            Impressão A4 {totalCards ? `— ${totalCards} cartelas no total` : ""}
          </span>
        </div>
        {showButtons && cards && cards.length > 0 && (
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir Agora
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Range input — always visible until cards are loaded */}
        <div className="bg-card rounded-2xl shadow-lg border p-8 text-center space-y-6">
          <div>
            <h2 className="text-xl font-bold font-heading">Impressão de Cartelas A4</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Informe o intervalo de cartelas que deseja imprimir
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">De (número)</label>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="w-28 text-center text-lg h-12"
                onKeyDown={(e) => e.key === "Enter" && handleLoadRange()}
              />
            </div>
            <span className="text-xl font-bold text-muted-foreground mt-5">até</span>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Até (número)</label>
              <Input
                type="number"
                min="1"
                placeholder="500"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="w-28 text-center text-lg h-12"
                onKeyDown={(e) => e.key === "Enter" && handleLoadRange()}
              />
            </div>
          </div>

          <Button
            size="lg"
            className="gap-2 px-8"
            onClick={handleLoadRange}
            disabled={!rangeFrom || !rangeTo || isLoading}
          >
            {isLoading ? "Carregando..." : "Carregar Cartelas"}
          </Button>

          {/* Quick range suggestions */}
          {totalCards > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Sugestões:</span>
              {(() => {
                const step = 500;
                const total = totalCards || 0;
                const chunks = [];
                for (let i = 1; i <= total; i += step) {
                  chunks.push({ from: i, to: Math.min(i + step - 1, total) });
                }
                return chunks.slice(0, 10).map((chunk) => (
                  <button
                    key={chunk.from}
                    className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
                    onClick={() => {
                      setRangeFrom(String(chunk.from));
                      setRangeTo(String(chunk.to));
                    }}
                  >
                    {chunk.from}–{chunk.to}
                  </button>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin mr-3" />
            Carregando cartelas...
          </div>
        )}

        {/* Print area */}
        {cards && cards.length > 0 && (
          <>
            <div className="no-print text-center py-3 mt-6 text-sm text-muted-foreground bg-yellow-50 border rounded-lg">
              Exibindo cartelas {rangeLabel} — {cards.length} cartela(s) — {pages.length} folha(s) A4
            </div>

            <div ref={printRef} id="print-area">
              {pages.map((pageCards, pageIdx) => (
                <div
                  key={pageIdx}
                  className="print-page"
                  style={{
                    pageBreakAfter: pageIdx < pages.length - 1 ? "always" : "auto",
                    breakAfter: pageIdx < pages.length - 1 ? "page" : "auto",
                  }}
                >
                  <PrintA4Sheet card={pageCards[0]} game={game} prizes={prizes} />
                </div>
              ))}
            </div>
          </>
        )}

        {cards && cards.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-semibold">Nenhuma cartela encontrada</p>
            <p className="text-sm mt-1">Verifique o intervalo informado.</p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff; }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            page-break-after: always;
            break-after: page;
          }
        }
        @page {
          size: A4;
          margin: 0;
        }
      `}</style>
    </>
  );
}