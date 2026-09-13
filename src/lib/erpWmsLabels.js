// Utilitários compartilhados das etiquetas WMS (compra/produção)
// Reexportados por src/components/erp/ErpWmsLabelPanel.jsx

// Tamanhos pré-definidos por modelo de etiqueta (mm) — cada tipo (compra/produção)
// pode ter sua própria configuração de largura e altura
export const DEFAULT_LABEL_SIZES = {
  compra: { width_mm: 100, height_mm: 60 },
  producao: { width_mm: 100, height_mm: 50 },
};

// Lote de produção: ano + número do dia do ano + código da linha (ex: 2026256L01)
export function genProductionLot(fabricacao, line) {
  const dt = fabricacao ? new Date(`${fabricacao}T12:00:00`) : new Date();
  const start = new Date(dt.getFullYear(), 0, 0);
  const doy = Math.floor((dt - start) / 86400000);
  return `${dt.getFullYear()}${String(doy).padStart(3, "0")}${(line?.code || "").toUpperCase()}`;
}

// QR code da etiqueta: produto, NF, fornecedor, quantidade, lote e validade
export function labelQrPayload(l) {
  return "ETQ|" + JSON.stringify({
    id: l.id, code: l.code || "", tipo: l.label_type,
    prod: l.product_name, cod: l.product_code,
    qtd: l.quantity, un: l.unit || "",
    lote: l.lot || "", val: l.expiry_date || "", fab: l.fabricacao_date || "",
    nf: l.nota_number || "", forn: l.supplier_name || "", op: l.op_number || "",
  });
}

// Interpreta a bipagem: QR "ETQ|{json}", código da etiqueta ou id
export function parseLabelScan(text) {
  const t = String(text || "").trim();
  if (t.startsWith("ETQ|")) { try { return JSON.parse(t.slice(4)); } catch (e) { return null; } }
  return { id: t, code: t };
}