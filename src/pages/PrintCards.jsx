import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import PrintA4Sheet from "@/components/bingo/PrintA4Sheet";

// Groups cards into sets of 3 for each A4 page
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

  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards", gameId],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(gameId) }),
  });

  const handlePrint = () => {
    window.print();
  };

  // Each A4 sheet holds 3 cards (one row per sheet)
  const CARDS_PER_PAGE = 3;
  const pages = chunkArray(cards, CARDS_PER_PAGE);
  const prizes = game?.prizes || [];

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
            Impressão A4 — {cards.length} cartelas / {pages.length} folhas
          </span>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Print area */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Carregando cartelas...
        </div>
      ) : (
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
              <PrintA4Sheet cards={pageCards} game={game} prizes={prizes} />
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff; }
          #print-area { margin: 0; padding: 0; }
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