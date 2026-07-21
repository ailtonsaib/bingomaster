import { jsPDF } from "jspdf";

const BRL = (v) =>
  (Number(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORY_LABELS = {
  venda_cartelas: "Venda de Cartelas",
  venda_ingressos: "Venda de Ingressos",
  doacao: "Doação",
  outra_receita: "Outra Receita",
  papel: "Papel",
  impressao: "Impressão de Cartelas",
  propaganda: "Propaganda",
  bebidas: "Bebidas",
  salgados: "Salgados",
  alimentacao: "Alimentação",
  material_escritorio: "Material de Escritório",
  premios: "Prêmios",
  aluguel: "Aluguel",
  decoracao: "Decoração",
  som_iluminacao: "Som e Iluminação",
  transporte: "Transporte",
  outra_despesa: "Outra Despesa",
};

const PAYMENT_LABELS = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR");
}

/**
 * Gera um PDF com o relatório de movimentação financeira do bingo.
 * @param {object} params
 * @param {Array}  params.transactions - Lista de BingoTransaction (já filtrada)
 * @param {object} params.totals - { income, expense, balance }
 * @param {Array}  params.expensesByCategory - [[label, value], ...]
 * @param {string} params.gameFilterLabel - Nome do evento filtrado (ou "Todos os eventos")
 * @param {string} params.typeFilterLabel - Label do filtro de tipo
 */
export function generateFinanceReportPdf({
  transactions,
  totals,
  expensesByCategory,
  gameFilterLabel,
  typeFilterLabel,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // --- Header bar ---
  doc.setFillColor(124, 58, 242); // primary
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Relatório de Movimentação Financeira", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}  •  BingoPremier`,
    margin,
    16
  );

  y = 30;
  doc.setTextColor(31, 31, 31);

  // --- Filtros ---
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Evento: ${gameFilterLabel}`, margin, y);
  y += 5;
  doc.text(`Filtro: ${typeFilterLabel}  •  ${transactions.length} movimentação(ões)`, margin, y);
  y += 7;

  // --- Resumo (caixas) ---
  const boxW = contentW / 3 - 3;
  const boxH = 16;

  const drawSummaryBox = (x, label, value, color) => {
    doc.setFillColor(245, 245, 248);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(label, x + 3, y + 5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(12);
    doc.text(value, x + 3, y + 12);
  };

  drawSummaryBox(margin, "TOTAL RECEITAS", BRL(totals.income), [5, 150, 105]);
  drawSummaryBox(margin + boxW + 3, "TOTAL DESPESAS", BRL(totals.expense), [220, 38, 38]);
  drawSummaryBox(margin + (boxW + 3) * 2, "SALDO LIQUIDO", BRL(totals.balance), totals.balance >= 0 ? [37, 99, 235] : [234, 88, 12]);
  y += boxH + 6;

  // --- Despesas por categoria ---
  if (expensesByCategory.length > 0) {
    doc.setTextColor(31, 31, 31);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Despesas por Categoria", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const [cat, val] of expensesByCategory) {
      const pct = totals.expense > 0 ? (val / totals.expense) * 100 : 0;
      const line = `  ${cat}: ${BRL(val)} (${pct.toFixed(1)}%)`;
      doc.text(line, margin, y);
      y += 4;
    }
    y += 3;
  }

  // --- Tabela de movimentações ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Movimentações", margin, y);
  y += 4;

  // Cabeçalho da tabela
  const colX = {
    data: margin,
    desc: margin + 22,
    cat: margin + 90,
    pag: margin + 130,
    valor: pageW - margin,
  };

  doc.setFillColor(124, 58, 242);
  doc.rect(margin, y - 3, contentW, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DATA", colX.data, y + 1);
  doc.text("DESCRIÇÃO", colX.desc, y + 1);
  doc.text("CATEGORIA", colX.cat, y + 1);
  doc.text("PAGTO", colX.pag, y + 1);
  doc.text("VALOR", colX.valor - 2, y + 1, { align: "right" });
  y += 7;

  // Linhas
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  let altColor = false;
  for (const t of transactions) {
    if (y > pageH - 20) {
      doc.addPage();
      y = margin;
    }

    if (altColor) {
      doc.setFillColor(248, 248, 250);
      doc.rect(margin, y - 3.5, contentW, 5.5, "F");
    }
    altColor = !altColor;

    doc.setFontSize(7);
    const dateStr = formatDate(t.date);
    const desc = (t.description || "").substring(0, 42);
    const cat = (CATEGORY_LABELS[t.category] || t.category || "—").substring(0, 22);
    const pay = PAYMENT_LABELS[t.payment_method] || t.payment_method || "—";
    const valStr = `${t.type === "income" ? "+" : "-"} ${BRL(t.amount)}`;

    doc.setTextColor(110, 110, 110);
    doc.text(dateStr, colX.data, y);
    doc.setTextColor(40, 40, 40);
    doc.text(desc, colX.desc, y);
    doc.setTextColor(80, 80, 80);
    doc.text(cat, colX.cat, y);
    doc.setTextColor(110, 110, 110);
    doc.text(pay, colX.pag, y);
    if (t.type === "income") doc.setTextColor(5, 150, 105);
    else doc.setTextColor(220, 38, 38);
    doc.text(valStr, colX.valor - 2, y, { align: "right" });

    y += 5.5;
  }

  // --- Rodapé com totais ---
  if (y > pageH - 15) {
    doc.addPage();
    y = margin;
  }
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(`Receitas: ${BRL(totals.income)}`, margin, y);
  doc.setTextColor(220, 38, 38);
  doc.text(`Despesas: ${BRL(totals.expense)}`, margin + 55, y);
  doc.setTextColor(totals.balance >= 0 ? 37 : 234, totals.balance >= 0 ? 99 : 88, totals.balance >= 0 ? 235 : 12);
  doc.text(`Saldo: ${BRL(totals.balance)}`, margin + 110, y);

  // Rodapé página
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageW - margin,
      pageH - 5,
      { align: "right" }
    );
  }

  const fileName = `relatorio_financeiro_${new Date()
    .toISOString()
    .split("T")[0]}.pdf`;
  doc.save(fileName);
}