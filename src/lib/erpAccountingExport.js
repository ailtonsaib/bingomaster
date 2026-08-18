import { jsPDF } from "jspdf";

// Formatação numérica padrão BRL
const BRL = (v) => (Number(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const NUM = (v) => (Number(v || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDC = (mag, isDebit) => (Number(mag) || 0) ? `${BRL(mag)} ${isDebit ? "D" : "C"}` : "—";

// ---------- Utilitário: download de arquivo ----------
function downloadBlob(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Excel (HTML table -> .xls) ----------
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtmlTable(headers, rows, title, subtitle) {
  const ths = headers.map(h => `<th style="background:#4c1d95;color:#fff;padding:6px 8px;font-size:11px;text-align:${h.align || "left"};border:0.5pt solid #ddd">${escapeHtml(h.label)}</th>`).join("");
  const trs = rows.map((r, idx) => {
    const tds = headers.map(h => {
      const raw = r[h.key];
      const val = h.money ? (raw ? BRL(raw) : "—") : (raw ?? "");
      const align = h.align || "left";
      const style = h.bold ? "font-weight:bold" : "";
      const bg = idx % 2 === 1 ? "background:#f7f5ff" : "";
      return `<td style="padding:5px 8px;font-size:11px;text-align:${align};border:0.5pt solid #ddd;${style};${bg}">${escapeHtml(val)}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table style="border-collapse:collapse;width:100%">${trs.length ? `<thead><tr>${ths}</tr></thead>` : ""}<tbody>${trs}</tbody></table>`;
}

function exportXls(filename, title, subtitle, headers, rows) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`
    + `<h2 style="font-family:Calibri">${escapeHtml(title)}</h2>`
    + (subtitle ? `<p style="font-family:Calibri;color:#666">${escapeHtml(subtitle)}</p>` : "")
    + buildHtmlTable(headers, rows, title, subtitle)
    + `</body></html>`;
  downloadBlob(filename, "application/vnd.ms-excel", html);
}

// ---------- PDF genérico (tabela) ----------
function exportPdfTable({ title, subtitle, headers, rows, totalsRow, orientation = "portrait" }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // Cabeçalho
  doc.setFillColor(76, 29, 149);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(title, margin, 9);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(subtitle || "", margin, 15);

  y = 26;
  doc.setTextColor(31, 31, 31);

  // Largura das colunas
  const labelCols = headers.filter(h => !h.money);
  const moneyCols = headers.filter(h => h.money);
  const labelW = labelCols.reduce((s, h) => s + (h.width || 0), 0);
  const moneyW = orientation === "landscape" ? 38 : 32;
  // ajusta coluna de nome/código proporcionalmente
  const xMap = [];
  let cx = margin;
  headers.forEach(h => {
    xMap.push(cx);
    if (h.money) cx += moneyW;
    else cx += h.width || 0;
  });

  const drawHeader = () => {
    doc.setFillColor(76, 29, 149);
    doc.rect(margin, y - 3.5, pageW - margin * 2, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    headers.forEach((h, i) => {
      const align = h.align || (h.money ? "right" : "left");
      const x = align === "right" ? (h.money ? xMap[i] + moneyW - 1.5 : xMap[i] + (h.width || 0) - 1) : xMap[i] + 1;
      doc.text(h.label, x, y + 0.5, { align });
    });
    y += 6;
  };
  drawHeader();

  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  let alt = false;
  const rowH = 5;
  for (const r of rows) {
    if (y > pageH - 16) { doc.addPage(); y = margin; drawHeader(); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); }
    if (alt) { doc.setFillColor(247, 245, 255); doc.rect(margin, y - 3, pageW - margin * 2, rowH, "F"); }
    alt = !alt;
    const bold = r._bold;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(bold ? 40 : 60, bold ? 40 : 60, bold ? 40 : 60);
    headers.forEach((h, i) => {
      const raw = r[h.key];
      const val = h.money ? (raw ? BRL(raw) : "—") : String(raw ?? "");
      // indentação por nível hierárquico
      let txt = val;
      if (!h.money && h.indent && r._level > 0) txt = "  ".repeat(r._level) + val;
      const align = h.align || (h.money ? "right" : "left");
      const x = align === "right" ? (h.money ? xMap[i] + moneyW - 1.5 : xMap[i] + (h.width || 0) - 1) : xMap[i] + 1;
      doc.text(txt, x, y + 0.5, { align });
    });
    y += rowH;
  }

  // Totais
  if (totalsRow) {
    if (y > pageH - 14) { doc.addPage(); y = margin; }
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y - 1, pageW - margin, y - 1);
    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    headers.forEach((h, i) => {
      const raw = totalsRow[h.key];
      if (raw === undefined || raw === null || raw === "") return;
      const val = h.money ? BRL(raw) : String(raw);
      const align = h.align || (h.money ? "right" : "left");
      const x = align === "right" ? (h.money ? xMap[i] + moneyW - 1.5 : xMap[i] + (h.width || 0) - 1) : xMap[i] + 1;
      doc.text(val, x, y, { align });
    });
  }

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 5, { align: "right" });
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 5);
  }

  doc.save(title.toLowerCase().replace(/[^a-z0-9]+/gi, "_") + ".pdf");
}

// ===================== BALANCETE =====================
export function exportBalancete({ rows, totals, year, companyName, format }) {
  const title = `Balancete de Verificação — ${year}`;
  const subtitle = `${companyName ? companyName + " • " : ""}Saldo Inicial (D/C), Débito, Crédito e Saldo Final (D/C)`;
  const headers = [
    { key: "code", label: "Código", width: 28 },
    { key: "name", label: "Conta", width: 68, indent: true },
    { key: "siLabel", label: "Saldo Inicial", width: 34, align: "right" },
    { key: "deb", label: "Débito", money: true },
    { key: "cre", label: "Crédito", money: true },
    { key: "sfLabel", label: "Saldo Final", width: 34, align: "right" },
  ];
  const data = rows.map(r => ({
    ...r,
    siLabel: fmtDC(r.siMag, r.siIsDebit),
    sfLabel: fmtDC(r.sfMag, r.sfIsDebit),
    _level: r.level || 0,
    _bold: !r.analitica,
  }));
  const totalsRow = {
    code: "", name: "TOTAIS (contas analíticas)",
    deb: totals.deb, cre: totals.cre,
    siLabel: fmtDC(totals.siMag, totals.siIsDebit),
    sfLabel: fmtDC(totals.sfMag, totals.sfIsDebit),
  };

  if (format === "excel") {
    exportXls(`balancete_${year}.xls`, title, subtitle, headers, data);
  } else {
    exportPdfTable({ title, subtitle, headers, rows: data, totalsRow, orientation: "landscape" });
  }
}

// ===================== BALANÇO PATRIMONIAL =====================
export function exportBalanco({ groups, year, companyName, format }) {
  const title = `Balanço Patrimonial — ${year}`;
  const subtitle = `${companyName ? companyName + " • " : ""}Ativo / Passivo / Patrimônio Líquido`;
  const headers = [
    { key: "code", label: "Código", width: 28 },
    { key: "name", label: "Conta", width: 80, indent: true },
    { key: "valor", label: "Saldo", money: true },
  ];
  const rows = [];
  let totalAtivo = 0, totalPassivoPl = 0;
  groups.forEach(g => {
    rows.push({ code: "", name: g.label, valor: undefined, _level: 0, _bold: true });
    g.accounts.forEach(a => rows.push({ ...a, valor: a.saldo, _level: a.level || 0, _bold: !a.analitica }));
    rows.push({ code: "", name: `Total ${g.label}`, valor: g.total, _level: 0, _bold: true });
    rows.push({ code: "", name: "", valor: undefined, _level: 0, _bold: false });
    if (g.id === "ativo") totalAtivo = g.total;
    else totalPassivoPl += g.total;
  });
  const totalsRow = { name: "Ativo = Passivo + PL", valor: totalAtivo, code: "" };

  if (format === "excel") {
    exportXls(`balanco_patrimonial_${year}.xls`, title, subtitle, headers, rows);
  } else {
    exportPdfTable({ title, subtitle, headers, rows, totalsRow, orientation: "portrait" });
  }
}