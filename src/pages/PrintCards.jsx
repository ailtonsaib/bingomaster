import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import PrintA4Sheet from "@/components/bingo/PrintA4Sheet";

const BATCH_SIZE = 300; // cards per PDF export batch (100 A4 pages)

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
  const [exportBatch, setExportBatch] = useState(null); // null = show all, number = batch index
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [useCustomRange, setUseCustomRange] = useState(false);

  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => base44.entities.BingoGame.filter({ id: gameId }),
    select: (data) => data[0],
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards", gameId],
    queryFn: () => base44.entities.BingoCard.filter({ game_id: String(gameId) }),
  });

  const handlePrint = () => window.print();

  const handleExportBatch = (batchIdx) => {
    setExportBatch(batchIdx);
    setUseCustomRange(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => setExportBatch(null), 1000);
    }, 300);
  };

  const handlePrintRange = () => {
    const from = parseInt(customRange.from);
    const to = parseInt(customRange.to);
    if (isNaN(from) || isNaN(to) || from > to) {
      alert("Por favor, insira um intervalo válido (de 1 a 100, por exemplo)");
      return;
    }
    setExportBatch(null);
    setUseCustomRange(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setUseCustomRange(false), 1000);
    }, 300);
  };

  // 1 card per A4 sheet (3 identical grids side by side per chance)
  const CARDS_PER_PAGE = 1;
  const prizes = game?.prizes || [];

  // Which cards to show: all, selected batch, or custom range
  const batches = chunkArray(cards, BATCH_SIZE);
  let displayCards = cards;
  let rangeLabel = "";
  
  if (exportBatch !== null) {
    displayCards = batches[exportBatch] || [];
    rangeLabel = `Lote ${exportBatch + 1} (${exportBatch * BATCH_SIZE + 1}–${Math.min((exportBatch + 1) * BATCH_SIZE, cards.length)})`;
  } else if (useCustomRange && customRange.from && customRange.to) {
    const from = parseInt(customRange.from);
    const to = parseInt(customRange.to);
    displayCards = cards.filter((c) => c.card_number >= from && c.card_number <= to);
    rangeLabel = `${from}–${to}`;
  }
  
  const pages = chunkArray(displayCards, CARDS_PER_PAGE);

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
            Impressão A4 — {cards.length} cartelas / {chunkArray(cards, CARDS_PER_PAGE).length} folhas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/40">
            <span className="text-xs font-medium">Imprimir faixa:</span>
            <input
              type="number"
              min="1"
              placeholder="De"
              value={customRange.from}
              onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })}
              className="w-16 h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="number"
              min="1"
              placeholder="Até"
              value={customRange.to}
              onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })}
              className="w-16 h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handlePrintRange}
              disabled={!customRange.from || !customRange.to}
            >
              <Printer className="w-3 h-3" /> Imprimir
            </Button>
          </div>
          {batches.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Lotes:</span>
              {batches.map((_, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => handleExportBatch(idx)}
                >
                  <Download className="w-3 h-3" />
                  {idx * BATCH_SIZE + 1}–{Math.min((idx + 1) * BATCH_SIZE, cards.length)}
                </Button>
              ))}
            </div>
          )}
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir Tudo
          </Button>
        </div>
      </div>

      {/* Print area */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Carregando cartelas...
        </div>
      ) : (
        <div ref={printRef} id="print-area">
          {(exportBatch !== null || useCustomRange) && (
            <div className="no-print text-center py-2 text-sm text-muted-foreground bg-yellow-50 border-b">
              Modo exportação: {rangeLabel} — {displayCards.length} cartela(s)
            </div>
          )}
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