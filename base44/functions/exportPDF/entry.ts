import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { gameId, batchStart = 0, batchSize = 300 } = await req.json();
  if (!gameId) return Response.json({ error: 'gameId required' }, { status: 400 });

  const games = await base44.entities.BingoGame.filter({ id: gameId });
  const game = games[0];
  if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

  const allCards = await base44.entities.BingoCard.filter({ game_id: String(gameId) });
  const cards = allCards.slice(batchStart, batchStart + batchSize);
  if (cards.length === 0) return Response.json({ error: 'No cards' }, { status: 404 });

  const prizes = game.prizes || [];
  const HEADERS = ['S', 'O', 'R', 'T', 'E'];
  const CELL = 7.5;
  const GAP = 0.5;
  const MARGIN = 8;
  const PAGE_W = 210;
  const PAGE_H = 297;

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const fmtPrice = (v) => {
    if (!v) return '';
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? v : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const drawCell = (doc, x, y, text, bold) => {
    doc.setLineWidth(0.35);
    doc.circle(x + CELL / 2, y + CELL / 2, CELL / 2 - 0.3, 'S');
    doc.setFontSize(bold ? 7 : 6.5);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const tw = doc.getTextWidth(text);
    doc.text(text, x + CELL / 2 - tw / 2, y + CELL / 2 + 2.2);
  };

  const drawGrid = (doc, gx, gy, numbers) => {
    HEADERS.forEach((h, ci) => drawCell(doc, gx + ci * (CELL + GAP), gy, h, true));
    const rows = Math.ceil(numbers.length / 5);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        const num = numbers[r * 5 + c];
        if (num === undefined) continue;
        drawCell(doc, gx + c * (CELL + GAP), gy + (r + 1) * (CELL + GAP), String(num).padStart(2, '0'), false);
      }
    }
    return (rows + 1) * (CELL + GAP);
  };

  const drawSection = (doc, cards3, getGrid, title, startY) => {
    let y = startY;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    const tw = doc.getTextWidth(title);
    doc.text(title, PAGE_W / 2 - tw / 2, y + 4);
    y += 8;

    const gridW = 5 * (CELL + GAP);
    const totalW = gridW * 3 + 10 * 2;
    const startX = (PAGE_W - totalW) / 2;
    let maxH = 0;

    cards3.forEach((card, ci) => {
      const grid = getGrid(card);
      if (!grid) return;
      const gx = startX + ci * (gridW + 10);
      const h = drawGrid(doc, gx, y, grid);
      if (h > maxH) maxH = h;
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      const label = prizes[ci]?.name || '';
      doc.text(`${ci + 1}) ${label}`, gx, y + h + 3.5);
    });
    return y + maxH + 7;
  };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const chunks = [];
  for (let i = 0; i < cards.length; i += 3) chunks.push(cards.slice(i, i + 3));

  chunks.forEach((cards3, pi) => {
    if (pi > 0) doc.addPage();
    const card0 = cards3[0];
    const cardNum = String(card0.card_number || 1).padStart(6, '0');
    let y = MARGIN;

    // Header box
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 22);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    const nw = doc.getTextWidth(game.name || 'BINGO');
    doc.text(game.name || 'BINGO', PAGE_W / 2 - nw / 2, y + 6);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    if (game.event_location) {
      doc.text(`Local: ${game.event_location}`, MARGIN + 2, y + 12);
      doc.text(`Endereco: ${game.event_location}`, MARGIN + 2, y + 17);
    }
    if (game.event_date) {
      doc.setFont('helvetica', 'bold');
      doc.text(`DATA: ${fmtDate(game.event_date)}`, PAGE_W - MARGIN - 2, y + 12, { align: 'right' });
      doc.text(`HORAS: ${fmtTime(game.event_date)}`, PAGE_W - MARGIN - 2, y + 17, { align: 'right' });
    }
    y += 22;

    // Cartela bar
    doc.setFillColor(150, 150, 150); doc.rect(MARGIN, y, 55, 7, 'F');
    doc.setFillColor(255, 255, 255); doc.rect(MARGIN + 55, y, 42, 7, 'FD');
    doc.setFillColor(150, 150, 150); doc.rect(MARGIN + 97, y, PAGE_W - MARGIN * 2 - 97, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(`Cartela:  ${cardNum}`, PAGE_W / 2 - doc.getTextWidth(`Cartela:  ${cardNum}`) / 2, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.text(`VALOR: ${fmtPrice(game.event_price)}`, PAGE_W - MARGIN - 2, y + 5, { align: 'right' });
    doc.setTextColor(0);
    y += 7;

    // Card number label
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    const cnW = doc.getTextWidth(cardNum);
    doc.text(cardNum, PAGE_W / 2 - cnW / 2, y + 7);
    y += 10;

    y = drawSection(doc, cards3, (c) => c.grid_1, 'PRIMEIRA CHANCE', y);
    const hasSecond = cards3.some((c) => c.chances === 2 && c.grid_2);
    if (hasSecond) y = drawSection(doc, cards3, (c) => c.grid_2 || c.grid_1, 'SEGUNDA CHANCE', y);

    // Footer
    const fy = PAGE_H - 20;
    doc.setLineWidth(0.2); doc.setLineDash([1, 1]);
    doc.line(MARGIN, fy, PAGE_W - MARGIN, fy);
    doc.setLineDash([]);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(`N CARTELA: ${cardNum}`, PAGE_W - MARGIN, fy + 5, { align: 'right' });
    doc.text('COLABORADOR:', MARGIN, fy + 5);
    doc.setFont('helvetica', 'normal');
    doc.line(MARGIN + 28, fy + 5.5, PAGE_W - MARGIN - 36, fy + 5.5);
    if (card0.player_name) doc.text(card0.player_name, MARGIN + 29, fy + 5);
    doc.setFont('helvetica', 'bold');
    doc.text('ENDERECO:', MARGIN, fy + 11);
    doc.line(MARGIN + 18, fy + 11.5, MARGIN + 65, fy + 11.5);
    doc.text('CIDADE:', MARGIN + 68, fy + 11);
    doc.line(MARGIN + 83, fy + 11.5, MARGIN + 110, fy + 11.5);
    doc.text('FONE: ( )', MARGIN + 113, fy + 11);
    doc.line(MARGIN + 130, fy + 11.5, PAGE_W - MARGIN, fy + 11.5);
  });

  const pdfBytes = doc.output('arraybuffer');
  const totalCards = allCards.length;
  const hasMore = batchStart + batchSize < totalCards;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'X-Total-Cards': String(totalCards),
      'X-Has-More': String(hasMore),
      'X-Next-Batch': String(batchStart + batchSize),
      'Content-Disposition': `attachment; filename=cartelas_${String(batchStart + 1).padStart(6,'0')}-${String(Math.min(batchStart + batchSize, totalCards)).padStart(6,'0')}.pdf`,
    },
  });
});